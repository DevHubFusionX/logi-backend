const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const addressRoutes = require('./addresses');
const shipmentRoutes = require('./shipments');
const driverRoutes = require('./drivers');
const trackingRoutes = require('./tracking');
const supportRoutes = require('./support');
const analyticsRoutes = require('./analytics');
const paymentRoutes = require('./paymentRoutes');
const pricingRoutes = require('./pricing');

// Vehicle routes (simple)
const { authenticate, authorize } = require('../middleware/auth');
const driverController = require('../controllers/driverController');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/addresses', addressRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/drivers', driverRoutes);
router.use('/tracking', trackingRoutes);
router.use('/support', supportRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/payments', paymentRoutes);
router.use('/pricing', pricingRoutes);

// Vehicle routes
router.get('/vehicles/available', authenticate, driverController.getAvailableVehicles);

// User shipments route (matches frontend service)
const shipmentController = require('../controllers/shipmentController');
router.get('/users/:userId/shipments', authenticate, shipmentController.getUserShipments);
router.get('/users/:userId/shipment-stats', authenticate, shipmentController.getUserShipmentStats);

module.exports = router;
