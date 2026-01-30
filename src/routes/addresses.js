const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

// All address routes require authentication
router.use(authenticate);

// These routes match /api/addresses/...
router.get('/', userController.getAddresses);
router.post('/', userController.addAddress);
router.put('/:id', userController.updateAddress);
router.post('/:id/set-default', userController.setDefaultAddress);
router.delete('/:id', userController.deleteAddress);

module.exports = router;
