const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Check if Paystack is configured
 */
const checkPaystackConfig = () => {
    if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack Secret Key is missing. Please add PAYSTACK_SECRET_KEY to your .env file.');
    }
};

/**
 * Helper to make Paystack API requests
 */
const paystackRequest = async (endpoint, method = 'GET', body = null) => {
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`https://api.paystack.co${endpoint}`, options);
    return response.json();
};

/**
 * @route   GET /api/payment/initialize/:bookingId
 * @desc    Initialize a Paystack payment for a shipment
 */
const initializePayment = asyncHandler(async (req, res) => {
    checkPaystackConfig();
    const { bookingId } = req.params;

    // 1. Fetch shipment details
    const { data: shipment, error: fetchError } = await supabaseAdmin
        .from('shipments')
        .select('*, sender:profiles!shipments_sender_id_fkey(email)')
        .eq('id', bookingId)
        .single();

    if (fetchError || !shipment) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Shipment not found'
        });
    }

    // 2. Validate ownership
    if (shipment.sender_id !== req.user.id) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only pay for your own shipments'
        });
    }

    // 3. Calculate amount in kobo (Paystack uses smallest currency unit)
    const amountInKobo = Math.round(parseFloat(shipment.shipping_fee || 5000) * 100);
    const email = shipment.sender?.email || req.user.email;
    const reference = `DARA-${shipment.tracking_number}-${Date.now()}`;

    // 4. Initialize Paystack transaction
    const paystackResponse = await paystackRequest('/transaction/initialize', 'POST', {
        email,
        amount: amountInKobo,
        reference,
        callback_url: `${process.env.FRONTEND_URL}/user/payment/callback`,
        metadata: {
            shipment_id: shipment.id,
            tracking_number: shipment.tracking_number,
            user_id: req.user.id
        }
    });

    if (!paystackResponse.status) {
        console.error('Paystack initialization failed:', paystackResponse);
        return res.status(400).json({
            error: 'Payment Error',
            message: paystackResponse.message || 'Failed to initialize payment'
        });
    }

    // 5. Create payment record
    await supabaseAdmin.from('payments').insert({
        shipment_id: bookingId,
        amount: shipment.shipping_fee || 50,
        reference,
        provider: 'paystack',
        status: 'pending'
    });

    res.json({
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        reference: paystackResponse.data.reference
    });
});

/**
 * @route   GET /api/payment/booking/verify/:bookingId
 * @desc    Verify payment status for a shipment
 */
const verifyPayment = asyncHandler(async (req, res) => {
    checkPaystackConfig();
    const { bookingId } = req.params;

    // 1. Get the latest pending payment for this shipment
    const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('shipment_id', bookingId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (paymentError || !payment) {
        // Check if already paid
        const { data: paidPayment } = await supabaseAdmin
            .from('payments')
            .select('*')
            .eq('shipment_id', bookingId)
            .eq('status', 'succeeded')
            .single();

        if (paidPayment) {
            return res.json({
                status: 'success',
                message: 'Payment already verified',
                amount: paidPayment.amount
            });
        }

        return res.status(404).json({
            error: 'Not Found',
            message: 'No pending payment found for this shipment'
        });
    }

    // 2. Verify with Paystack
    const paystackResponse = await paystackRequest(`/transaction/verify/${payment.reference}`);

    if (!paystackResponse.status) {
        return res.status(400).json({
            error: 'Verification Error',
            message: paystackResponse.message || 'Failed to verify payment'
        });
    }

    const { data: txData } = paystackResponse;

    if (txData.status === 'success') {
        // 3. Update payment record
        await supabaseAdmin.from('payments')
            .update({
                status: 'succeeded',
                paystack_reference: txData.reference,
                updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

        // 4. Update shipment record
        await supabaseAdmin.from('shipments')
            .update({
                payment_status: 'paid',
                status: 'confirmed',
                updated_at: new Date().toISOString()
            })
            .eq('id', bookingId);

        // 5. Add tracking event
        await supabaseAdmin.from('tracking_events').insert({
            shipment_id: bookingId,
            status: 'confirmed',
            location: 'System',
            description: 'Payment verified. Shipment confirmed for processing.'
        });

        return res.json({
            status: 'success',
            message: 'Payment verified successfully',
            amount: txData.amount / 100 // Convert back from kobo
        });
    } else if (txData.status === 'pending') {
        return res.json({
            status: 'pending',
            message: 'Payment is still being processed'
        });
    } else {
        // Payment failed
        await supabaseAdmin.from('payments')
            .update({
                status: 'failed',
                updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

        return res.json({
            status: 'failed',
            message: 'Payment verification failed'
        });
    }
});

/**
 * @route   POST /api/payment/webhook
 * @desc    Handle Paystack Webhooks
 */
const handlePaystackWebhook = asyncHandler(async (req, res) => {
    const crypto = require('crypto');
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Verify webhook signature
    const hash = crypto.createHmac('sha512', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
        const { reference, metadata } = event.data;
        const shipmentId = metadata?.shipment_id;

        if (shipmentId) {
            // Update payment status
            await supabaseAdmin.from('payments')
                .update({
                    status: 'succeeded',
                    paystack_reference: reference,
                    updated_at: new Date().toISOString()
                })
                .eq('reference', reference);

            // Update shipment
            await supabaseAdmin.from('shipments')
                .update({
                    payment_status: 'paid',
                    status: 'confirmed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', shipmentId);

            // Add tracking event
            await supabaseAdmin.from('tracking_events').insert({
                shipment_id: shipmentId,
                status: 'confirmed',
                location: 'System',
                description: 'Payment verified via webhook. Shipment confirmed.'
            });
        }
    }

    res.json({ received: true });
});

module.exports = {
    initializePayment,
    verifyPayment,
    handlePaystackWebhook
};
