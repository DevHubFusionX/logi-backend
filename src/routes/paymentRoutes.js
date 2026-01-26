const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

// Create checkout session - standard authenticated route
router.post('/create-checkout-session', authenticate, paymentController.createCheckoutSession);

// Stripe Webhook - MUST use express.raw() to verify signature correctly
// and must NOT be authenticated via JWT middleware
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

module.exports = router;
