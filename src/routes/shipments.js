const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate, validations } = require('../middleware/validate');

// Public stats route
router.get('/stats', shipmentController.getShipmentStats);

// Protected routes
router.use(authenticate);

// CRUD operations
router.get('/', shipmentController.getAllShipments);
router.post('/', validations.createShipment, validate, shipmentController.createShipment);
router.get('/:id', shipmentController.getShipmentById);
router.put('/:id', authorize('admin', 'driver', 'user'), shipmentController.updateShipment);
router.delete('/:id', authorize('admin', 'user'), shipmentController.deleteShipment);

// Additional shipment operations
router.post('/:id/cancel', shipmentController.cancelShipment);
router.get('/:id/documents', shipmentController.getShipmentDocuments);

module.exports = router;
