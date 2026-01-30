const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { parsePagination, paginatedResponse } = require('../utils/helpers');

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 */
const getAllUsers = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { search, role } = req.query;

    let query = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' });

    // Apply filters
    if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (role) {
        query = query.eq('role', role);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    const users = data.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        phone: u.phone,
        companyName: u.company_name,
        clientCategory: u.client_category,
        role: u.role,
        avatar: u.avatar_url,
        createdAt: u.created_at
    }));

    res.json({
        users,
        total: count,
        page,
        ...paginatedResponse(users, count, page, limit).pagination
    });
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 */
const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'User not found'
        });
    }

    res.json({
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone,
        companyName: data.company_name,
        clientCategory: data.client_category,
        role: data.role,
        avatar: data.avatar_url,
        createdAt: data.created_at
    });
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 */
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, phone, role } = req.body;

    const updateData = {};
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (role) updateData.role = role;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'User updated successfully',
        user: {
            id: data.id,
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
            role: data.role
        }
    });
});

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 */
const getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error || !data) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'User profile not found'
        });
    }

    // Get shipment stats for this user
    const { count: shipmentCount } = await supabaseAdmin
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', userId);

    const { data: shipmentFees } = await supabaseAdmin
        .from('shipments')
        .select('shipping_fee')
        .eq('sender_id', userId);

    const totalVolume = shipmentFees?.reduce((sum, s) => sum + parseFloat(s.shipping_fee || 0), 0) || 0;

    res.json({
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone,
        companyName: data.company_name,
        clientCategory: data.client_category,
        role: data.role,
        avatar: data.avatar_url,
        createdAt: data.created_at,
        stats: {
            shipments: shipmentCount || 0,
            volume: totalVolume,
            rating: 5.0 // Placeholder
        }
    });
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 */
const updateProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, phone, companyName, clientCategory, avatarUrl } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (companyName) updateData.company_name = companyName;
    if (clientCategory) updateData.client_category = clientCategory;
    if (avatarUrl) updateData.avatar_url = avatarUrl;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;

    res.json({
        message: 'Profile updated successfully',
        user: {
            id: data.id,
            email: data.email,
            firstName: data.first_name,
            lastName: data.last_name,
            phone: data.phone,
            companyName: data.company_name,
            clientCategory: data.client_category,
            avatar: data.avatar_url
        }
    });
});

/**
 * @route   POST /api/users/change-password
 * @desc    Change user password
 */
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword
    });

    if (verifyError) {
        return res.status(400).json({
            error: 'Invalid Password',
            message: 'Current password is incorrect'
        });
    }

    // Update password
    const { error } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (error) throw error;

    res.json({ message: 'Password changed successfully' });
});

/**
 * @route   GET /api/users/addresses
 * @desc    Get user's saved addresses
 */
const getAddresses = asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('addresses')
        .select('*')
        .eq('user_id', req.user.id)
        .order('is_default', { ascending: false });

    if (error) throw error;

    res.json(data);
});

/**
 * @route   POST /api/users/addresses
 * @desc    Add new address
 */
const addAddress = asyncHandler(async (req, res) => {
    const { label, name, address, street, city, state, postalCode, country, phone, isDefault } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
        await supabaseAdmin
            .from('addresses')
            .update({ is_default: false })
            .eq('user_id', req.user.id);
    }

    const { data, error } = await supabaseAdmin
        .from('addresses')
        .insert({
            user_id: req.user.id,
            label,
            contact_name: name,
            phone,
            street: street || address, // Handle both frontend 'address' and backend 'street'
            city,
            state,
            postal_code: postalCode,
            country: country || 'Nigeria', // Default to Nigeria if not provided
            is_default: isDefault || false
        })
        .select()
        .single();

    if (error) throw error;

    res.status(201).json(data);
});

/**
 * @route   PUT /api/users/addresses/:id
 * @desc    Update address
 */
const updateAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { label, name, address, street, city, state, postalCode, country, phone, isDefault } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
        await supabaseAdmin
            .from('addresses')
            .update({ is_default: false })
            .eq('user_id', req.user.id);
    }

    const updateData = {};
    if (label) updateData.label = label;
    if (name) updateData.contact_name = name;
    if (phone) updateData.phone = phone;
    if (street || address) updateData.street = street || address;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (postalCode) updateData.postal_code = postalCode;
    if (country) updateData.country = country;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    const { data, error } = await supabaseAdmin
        .from('addresses')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select()
        .single();

    if (error) throw error;

    res.json(data);
});

/**
 * @route   POST /api/users/addresses/:id/set-default
 * @desc    Set address as default
 */
const setDefaultAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Unset all defaults first
    await supabaseAdmin
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', req.user.id);

    // Set new default
    const { data, error } = await supabaseAdmin
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select()
        .single();

    if (error) throw error;

    res.json(data);
});

/**
 * @route   DELETE /api/users/addresses/:id
 * @desc    Delete address
 */
const deleteAddress = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabaseAdmin
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ message: 'Address deleted successfully' });
});

/**
 * @route   GET /api/users/notifications
 * @desc    Get user notifications
 */
const getNotifications = asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePagination(req.query);
    const { unreadOnly } = req.query;

    let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id);

    if (unreadOnly === 'true') {
        query = query.eq('is_read', false);
    }

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    // Get unread count
    const { count: unreadCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('is_read', false);

    res.json({
        notifications: data,
        unreadCount: unreadCount || 0,
        ...paginatedResponse(data, count, page, limit).pagination
    });
});

/**
 * @route   POST /api/users/notifications/:id/read
 * @desc    Mark notification as read
 */
const markNotificationRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ message: 'Notification marked as read' });
});

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    getProfile,
    updateProfile,
    changePassword,
    getAddresses,
    addAddress,
    updateAddress,
    setDefaultAddress,
    deleteAddress,
    getNotifications,
    markNotificationRead
};
