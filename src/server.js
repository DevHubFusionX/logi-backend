require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const { supabase } = require('./config/supabase');
        const { data, error } = await supabase.from('faqs').select('count', { count: 'exact', head: true });

        res.json({
            status: 'ok',
            database: error ? 'error' : 'connected',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (err) {
        res.json({
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
