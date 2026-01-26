const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');

// Initialize stripe only if key exists to prevent crash
const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

const checkStripeConfig = () => {
    if (!stripe) {
        throw new Error('Stripe API Key is missing. Please add STRIPE_SECRET_KEY to your .env file.');
    }
};

/**
 * @route   POST /api/payments/create-checkout-session
 * @desc    Create a Stripe Checkout Session for a shipment
 */
const createCheckoutSession = asyncHandler(async (req, res) => {
    checkStripeConfig();
    const { shipmentId } = req.body;

    // 1. Fetch shipment details
    const { data: shipment, error: fetchError } = await supabaseAdmin
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

    if (fetchError || !shipment) {
        return res.status(404).json({ error: 'Not Found', message: 'Shipment not found' });
    }

    // 2. Validate ownership
    if (shipment.sender_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden', message: 'You can only pay for your own shipments' });
    }

    // 3. Create Stripe Session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'ngn',
                    product_data: {
                        name: `Shipment Tracking: ${shipment.tracking_number}`,
                        description: `Shipping from ${shipment.origin} to ${shipment.destination}`,
                    },
                    unit_amount: Math.round(parseFloat(shipment.shipping_fee || 5000) * 100), // Fee in kobo/cents
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/user/shipments?payment=success&id=${shipmentId}`,
        cancel_url: `${process.env.FRONTEND_URL}/user/shipments?payment=cancelled`,
        metadata: {
            shipmentId: shipment.id,
            userId: req.user.id
        }
    });

    // 4. Create payment record
    await supabaseAdmin.from('payments').insert({
        shipment_id: shipmentId,
        amount: shipment.shipping_fee || 50,
        stripe_session_id: session.id,
        status: 'pending'
    });

    res.json({ url: session.url });
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Stripe Webhooks
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
    checkStripeConfig();
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            throw new Error('Stripe Webhook Secret is missing.');
        }
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const shipmentId = session.metadata.shipmentId;

        // Update payment record
        await supabaseAdmin.from('payments')
            .update({
                status: 'succeeded',
                stripe_payment_intent_id: session.payment_intent,
                updated_at: new Date().toISOString()
            })
            .eq('stripe_session_id', session.id);

        // Update shipment record
        await supabaseAdmin.from('shipments')
            .update({
                payment_status: 'paid',
                status: 'processing', // Move from pending to processing
                updated_at: new Date().toISOString()
            })
            .eq('id', shipmentId);

        // Add tracking event
        await supabaseAdmin.from('tracking_events').insert({
            shipment_id: shipmentId,
            status: 'processing',
            location: 'System',
            description: 'Payment verified. Shipment moved to processing.'
        });
    }

    res.json({ received: true });
});

module.exports = {
    createCheckoutSession,
    handleStripeWebhook
};
