const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (with email verification)
 */
const register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phoneNumber, companyName, clientCategory, address } = req.body;

    // Use standard signUp to trigger email verification
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name: firstName,
                last_name: lastName,
                phone: phoneNumber || null,
                company_name: companyName,
                client_category: clientCategory
            },
            emailRedirectTo: `${process.env.FRONTEND_URL}/auth/callback`
        }
    });

    if (authError) {
        return res.status(400).json({
            error: 'Registration Failed',
            message: authError.message
        });
    }

    // Add address if provided
    if (address && authData.user) {
        const { error: addressError } = await supabaseAdmin
            .from('addresses')
            .insert({
                user_id: authData.user.id,
                street: address,
                city: 'Unknown', // Need to parse or ask user for structured address
                is_default: true,
                label: 'Main Office'
            });

        if (addressError) {
            console.error('Failed to save address:', addressError);
            // Don't fail registration for address error, just log it
        }
    }

    // If session is null, it means verification email was sent
    const verificationRequired = !authData.session;

    res.status(201).json({
        message: verificationRequired
            ? 'Registration initiated. Please check your email to verify your account.'
            : 'Registration successful.',
        verificationRequired,
        user: {
            id: authData.user.id,
            email: authData.user.email,
            firstName,
            lastName,
            companyName,
            role: 'user'
        },
        token: authData.session?.access_token
    });
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 */
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(401).json({
            error: 'Login Failed',
            message: error.message
        });
    }

    // Get user profile using admin client to bypass RLS
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

    res.json({
        message: 'Login successful',
        user: {
            id: data.user.id,
            email: data.user.email,
            firstName: profile?.first_name,
            lastName: profile?.last_name,
            role: profile?.role || 'user',
            avatar: profile?.avatar_url
        },
        token: data.session.access_token
    });
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 */
const logout = asyncHandler(async (req, res) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        return res.status(400).json({
            error: 'Logout Failed',
            message: error.message
        });
    }

    res.json({ message: 'Logged out successfully' });
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) {
        return res.status(400).json({
            error: 'Reset Failed',
            message: error.message
        });
    }

    res.json({
        message: 'Password reset email sent. Please check your inbox.'
    });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 */
const getCurrentUser = asyncHandler(async (req, res) => {
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', req.user.id)
        .single();

    if (error) {
        return res.status(404).json({
            error: 'Not Found',
            message: 'User profile not found'
        });
    }

    res.json({
        id: req.user.id,
        email: req.user.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        phone: profile.phone,
        role: profile.role,
        avatar: profile.avatar_url,
        createdAt: profile.created_at
    });
});

module.exports = {
    register,
    login,
    logout,
    forgotPassword,
    getCurrentUser
};
