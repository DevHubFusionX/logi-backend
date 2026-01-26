const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * Authentication Middleware
 * Verifies JWT token from Supabase Auth
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No valid authorization token provided'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify the token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });
        }

        // Attach user to request
        req.user = user;
        req.token = token;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Authentication Error',
            message: 'Failed to authenticate request'
        });
    }
};

/**
 * Role-based authorization middleware
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required'
                });
            }

            // Get user's role from their profile using admin client to bypass RLS
            const { data: profile, error } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', req.user.id)
                .single();

            if (error || !profile) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'User profile not found'
                });
            }

            if (!roles.includes(profile.role)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: `Access denied. Required role: ${roles.join(' or ')}`
                });
            }

            req.userRole = profile.role;
            next();
        } catch (error) {
            console.error('Authorization error:', error);
            return res.status(500).json({
                error: 'Authorization Error',
                message: 'Failed to authorize request'
            });
        }
    };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                req.user = user;
                req.token = token;
            }
        }

        next();
    } catch (error) {
        // Continue without auth
        next();
    }
};

module.exports = { authenticate, authorize, optionalAuth };
