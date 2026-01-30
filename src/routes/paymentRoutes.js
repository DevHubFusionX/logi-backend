const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const paystackController = require('../controllers/paystackController');
const { authenticate } = require('../middleware/auth');

// ========== Stripe Routes ==========
// Create checkout session - standard authenticated route
router.post('/create-checkout-session', authenticate, paymentController.createCheckoutSession);

// Stripe Webhook - MUST use express.raw() to verify signature correctly
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

// ========== Paystack Routes ==========
// Initialize Paystack payment
router.get('/initialize/:bookingId', authenticate, paystackController.initializePayment);

// Verify payment status by booking ID
router.get('/booking/verify/:bookingId', authenticate, paystackController.verifyPayment);

// Paystack Webhook
router.post('/paystack-webhook', paystackController.handlePaystackWebhook);

module.exports = router;
