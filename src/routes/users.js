const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, validations } = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

// Admin only routes
router.get('/', authorize('admin'), userController.getAllUsers);

// Profile routes (any authenticated user)
router.get('/profile', userController.getProfile);
router.put('/profile', validations.updateProfile, validate, userController.updateProfile);
router.post('/change-password', userController.changePassword);

// Address routes
router.get('/addresses', userController.getAddresses);
router.post('/addresses', userController.addAddress);
router.delete('/addresses/:id', userController.deleteAddress);

// Notification routes
router.get('/notifications', userController.getNotifications);
router.post('/notifications/:id/read', userController.markNotificationRead);

// User by ID routes (admin or self)
router.get('/:id', userController.getUserById);
router.put('/:id', authorize('admin'), userController.updateUser);

module.exports = router;
