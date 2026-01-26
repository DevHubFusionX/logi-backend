const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

// All analytics routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Dashboard and overview
router.get('/dashboard', analyticsController.getDashboardSummary);
router.get('/valuation', analyticsController.getValuation);

// Financial analytics
router.get('/revenue', analyticsController.getRevenue);
router.get('/expenses', analyticsController.getExpenses);
router.get('/profit-margin', analyticsController.getProfitMargin);

// Operational analytics
router.get('/shipments', analyticsController.getShipmentStats);
router.get('/regional', analyticsController.getRegionalPerformance);
router.get('/errors', analyticsController.getErrorSummary);
router.get('/fleet-utilization', analyticsController.getFleetUtilization);
router.get('/live-tracking', analyticsController.getLiveTrackingOverview);
router.get('/delivery-performance', analyticsController.getDeliveryPerformance);

// Customer analytics
router.get('/customers', analyticsController.getCustomerMetrics);

// Report generation
router.post('/reports/:type', analyticsController.generateReport);

module.exports = router;
