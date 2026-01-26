const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticate, authorize } = require('../middleware/auth');

// All driver routes require authentication
router.use(authenticate);

// Stats and available vehicles (accessible by admin)
router.get('/stats', authorize('admin'), driverController.getDriverStats);

// CRUD operations (admin only)
router.get('/', authorize('admin'), driverController.getAllDrivers);
router.post('/', authorize('admin'), driverController.createDriver);
router.get('/:id', authorize('admin', 'driver'), driverController.getDriverById);
router.put('/:id', authorize('admin'), driverController.updateDriver);
router.delete('/:id', authorize('admin'), driverController.deleteDriver);

// Driver actions
router.post('/:id/suspend', authorize('admin'), driverController.suspendDriver);
router.post('/:id/reactivate', authorize('admin'), driverController.reactivateDriver);
router.post('/:id/verify', authorize('admin'), driverController.verifyDriver);
router.post('/:id/vehicle', authorize('admin'), driverController.assignVehicle);

// Driver info
router.get('/:id/route', authorize('admin', 'driver'), driverController.getDriverRoute);
router.get('/:id/performance', authorize('admin', 'driver'), driverController.getDriverPerformance);

module.exports = router;
