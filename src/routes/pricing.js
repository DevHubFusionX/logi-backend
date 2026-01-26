const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/pricing
 * @desc    Get all pricing configurations
 * @access  Public
 */
router.get('/', pricingController.getPricingConfigs);

/**
 * @route   POST /api/pricing/calculate
 * @desc    Calculate shipment price
 * @access  Public
 */
router.post('/calculate', pricingController.calculatePrice);

/**
 * @route   PUT /api/pricing/:id
 * @desc    Update a pricing configuration
 * @access  Private/Admin
 */
router.put('/:id', authenticate, authorize('admin'), pricingController.updatePricingConfig);

module.exports = router;
