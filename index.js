import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Adminrouter from './Routes/AdminRoutes.js';
import Userrouter from './Routes/UserRoutes.js';
import databaseConnection from './utils/db.js';
import cookieParser from 'cookie-parser';
import nodeCron from 'node-cron';
import './jobs/BookingClean.js';
import { handleAFSWebhook } from './Controller/BookingController.js';

dotenv.config();
databaseConnection();

const app = express();
const PORT = 3000;

// ============================================
// CRITICAL: WEBHOOK ROUTE BEFORE OTHER MIDDLEWARE
// ============================================
// This MUST come before CORS and body parser middleware
// AFS webhook sends application/x-www-form-urlencoded data
app.post('/api/user/afs-webhook', 
  express.urlencoded({ extended: true }),
  express.json(),
  (req, res, next) => {
    console.log('🔔 ═══════════════════════════════════════');
    console.log('🔔 WEBHOOK HIT AT:', new Date().toISOString());
    console.log('🔔 IP:', req.ip);
    console.log('🔔 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔔 Body:', JSON.stringify(req.body, null, 2));
    console.log('🔔 ═══════════════════════════════════════');
    next();
  },
  handleAFSWebhook
);

// ============================================
// HEALTH CHECK ENDPOINT (for uptime monitoring)
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple health check for root
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Wavescation API is running',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
    'https://www.wavescation.com',
    'http://localhost:5173',
    'https://test.oppwa.com',  // AFS test environment
    'https://oppwa.com'         // AFS production environment
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, webhooks)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Log but don't block - important for debugging
            console.log('⚠️ CORS: Origin not in whitelist:', origin);
            callback(null, true); // Allow anyway for webhooks
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// ============================================
// GENERAL MIDDLEWARE
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Remove problematic headers
app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.removeHeader("Cross-Origin-Embedder-Policy");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  next();
});

// Request logging (useful for debugging)
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================
// API ROUTES
// ============================================
app.use('/api/admin', Adminrouter);
app.use('/api/user', Userrouter);

// ============================================
// ERROR HANDLING
// ============================================
// 404 handler
app.use((req, res) => {
  console.log('❌ 404 Not Found:', req.method, req.path);
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('🚀 ═══════════════════════════════════════');
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀 AFS Mode: ${process.env.AFS_TEST_MODE === 'true' ? 'TEST' : 'PRODUCTION'}`);
    console.log(`🚀 Webhook URL: ${process.env.BACKEND_URL}/api/user/afs-webhook`);
    console.log('🚀 ═══════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});