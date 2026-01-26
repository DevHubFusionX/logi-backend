const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Public tracking route (no auth required)
router.get('/active', optionalAuth, trackingController.getActiveShipments);
router.get('/:trackingNumber', trackingController.trackShipment);

// Protected routes
router.get('/:id/timeline', authenticate, trackingController.getTimeline);
router.get('/:id/location', authenticate, trackingController.getLiveLocation);
router.get('/:id/driver', authenticate, trackingController.getDriver);
router.get('/:id/eta', authenticate, trackingController.getETA);
router.get('/:id/history', authenticate, trackingController.getTrackingHistory);

module.exports = router;
