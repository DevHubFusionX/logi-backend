const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/helpers');
const config = require('../config');

/**
 * @route   POST /api/support/tickets
 * @desc    Create new support ticket
 */
const createTicket = asyncHandler(async (req, res) => {
    const { subject, message, category, priority, shipmentId } = req.body;

    const { data, error } = await supabase
        .from('support_tickets')
        .insert({
            user_id: req.user.id,
            subject,
            message,
            category: category || 'general',
            priority: priority || 'medium',
            shipment_id: shipmentId || null,
            status: config.ticketStatus.OPEN
        })
        .select()
        .single();

    if (error) throw error;

    res.status(201).json({
        message: 'Support ticket created successfully',
        ticket: data
    });
});

/**
 * @route   GET /api/support/tickets
 * @desc    Get user's tickets
 */
const getTickets = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { status } = req.query;

    let query = supabase
        .from('support_tickets')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id);

    if (status) {
        query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
        tickets: data,
        total: count,
        ...paginatedResponse(data, count, page, limit).pagination
    });
});

/**
 * @route   GET /api/support/tickets/:id
 * @desc    Get single ticket by ID
 */
const getTicketById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('support_tickets')
        .select(`
            *,
            replies:ticket_replies(*)
        `)
        .eq('id', id)
        .single();

    if (error || !data) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'Ticket not found'
        });
    }

    // Sort replies by date
    if (data.replies) {
        data.replies.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        );
    }

    res.json(data);
});

/**
 * @route   POST /api/support/tickets/:id/replies
 * @desc    Add reply to ticket
 */
const addReply = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    const { data, error } = await supabase
        .from('ticket_replies')
        .insert({
            ticket_id: id,
            user_id: req.user.id,
            message,
            is_staff: req.userRole === 'admin'
        })
        .select()
        .single();

    if (error) throw error;

    // Update ticket status if it was closed
    await supabase
        .from('support_tickets')
        .update({
            status: config.ticketStatus.IN_PROGRESS,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('status', config.ticketStatus.CLOSED);

    res.status(201).json({
        message: 'Reply added successfully',
        reply: data
    });
});

/**
 * @route   POST /api/support/tickets/:id/close
 * @desc    Close a ticket
 */
const closeTicket = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('support_tickets')
        .update({
            status: config.ticketStatus.CLOSED,
            closed_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ message: 'Ticket closed successfully' });
});

/**
 * @route   GET /api/support/faqs
 * @desc    Get FAQs
 */
const getFAQs = asyncHandler(async (req, res) => {
    const { category } = req.query;

    let query = supabase
        .from('faqs')
        .select('*')
        .eq('is_published', true)
        .order('order_index', { ascending: true });

    if (category) {
        query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
});

/**
 * @route   GET /api/support/faqs/search
 * @desc    Search FAQs
 */
const searchFAQs = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.json([]);
    }

    const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_published', true)
        .or(`question.ilike.%${q}%,answer.ilike.%${q}%`);

    if (error) throw error;

    res.json(data || []);
});

/**
 * @route   GET /api/support/contact
 * @desc    Get contact information
 */
const getContactInfo = asyncHandler(async (req, res) => {
    // This could come from a settings table or be hardcoded
    res.json({
        email: 'support@blynelogistics.com',
        phone: '+1 (555) 123-4567',
        address: '123 Logistics Way, Shipping City, SC 12345',
        hours: {
            weekdays: '9:00 AM - 6:00 PM',
            saturday: '10:00 AM - 4:00 PM',
            sunday: 'Closed'
        },
        social: {
            twitter: '@blynelogistics',
            facebook: 'blynelogistics',
            linkedin: 'blyne-logistics'
        }
    });
});

/**
 * @route   POST /api/support/contact
 * @desc    Submit contact form
 */
const submitContactForm = asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body;

    const { data, error } = await supabaseAdmin
        .from('contact_submissions')
        .insert({
            name,
            email,
            subject,
            message
        })
        .select()
        .single();

    if (error) throw error;

    res.status(201).json({
        message: 'Thank you for your message. We will get back to you soon.'
    });
});

/**
 * @route   POST /api/support/chat/start
 * @desc    Start live chat session
 */
const startLiveChat = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
            user_id: req.user.id,
            status: 'active'
        })
        .select()
        .single();

    if (error) throw error;

    res.json({
        sessionId: data.id,
        agentName: 'Support Team',
        message: 'A support agent will be with you shortly.'
    });
});

/**
 * @route   POST /api/support/chat/:sessionId/message
 * @desc    Send chat message
 */
const sendChatMessage = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;

    const { data, error } = await supabase
        .from('chat_messages')
        .insert({
            session_id: sessionId,
            sender_id: req.user.id,
            message,
            is_from_user: true
        })
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'Message sent',
        data
    });
});

module.exports = {
    createTicket,
    getTickets,
    getTicketById,
    addReply,
    closeTicket,
    getFAQs,
    searchFAQs,
    getContactInfo,
    submitContactForm,
    startLiveChat,
    sendChatMessage
};
