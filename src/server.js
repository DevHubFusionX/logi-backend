require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 5000;
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Validate environment variables on startup
const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'FRONTEND_URL'];
requiredEnv.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ CRITICAL ERROR: Missing required environment variable: ${key}`);
        process.exit(1);
    }
});

// Trust proxy (Render, Vercel, etc.)
app.set('trust proxy', 1);

// Middleware
app.use(compression()); // Gzip all responses
// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173'];

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests', message: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 login/register attempts per hour
    message: { error: 'Too many attempts', message: 'Too many authentication attempts from this IP, please try again after an hour' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Security middleware
app.use(helmet());
app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);

// Request logging
app.use(requestLogger());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const { supabase } = require('./config/supabase');
        const start = Date.now();
        const { error } = await supabase.from('faqs').select('count', { count: 'exact', head: true });
        const latency = Date.now() - start;

        res.json({
            status: 'ok',
            version: process.env.npm_package_version || '1.0.0',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            node: process.version,
            database: {
                status: error ? 'error' : 'connected',
                latency: `${latency}ms`
            },
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (err) {
        res.status(503).json({
            status: 'error',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`
    🚀 Logistics Backend Server
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ✅ Server running on port ${PORT}
    📍 http://localhost:${PORT}
    🔧 Environment: ${process.env.NODE_ENV || 'development'}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
});

module.exports = app;
