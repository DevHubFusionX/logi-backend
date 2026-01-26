const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Public routes
router.get('/faqs', supportController.getFAQs);
router.get('/faqs/search', supportController.searchFAQs);
router.get('/contact', supportController.getContactInfo);
router.post('/contact', supportController.submitContactForm);

// Protected routes
router.use(authenticate);

// Ticket routes
router.get('/tickets', supportController.getTickets);
router.post('/tickets', supportController.createTicket);
router.get('/tickets/:id', supportController.getTicketById);
router.post('/tickets/:id/replies', supportController.addReply);
router.post('/tickets/:id/close', supportController.closeTicket);

// Chat routes
router.post('/chat/start', supportController.startLiveChat);
router.post('/chat/:sessionId/message', supportController.sendChatMessage);

module.exports = router;
