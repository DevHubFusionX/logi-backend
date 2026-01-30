const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, validations } = require('../middleware/validate');

// Public routes
router.post('/register', validations.register, validate, authController.register);
router.post('/login', validations.login, validate, authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', validations.forgotPassword, validate, authController.forgotPassword);
router.post('/reset-password', validations.resetPassword, validate, authController.resetPassword);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
