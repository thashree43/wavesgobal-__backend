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

dotenv.config();
databaseConnection();

const app = express();
const PORT = 3000;

// ============================================
// RAW BODY PARSER FOR WEBHOOK - MUST BE FIRST
// ============================================
app.use('/api/user/afs-webhook', express.raw({ type: '*/*' }));

// ============================================
// WEBHOOK ROUTE - BEFORE ANY OTHER MIDDLEWARE
// ============================================
app.post('/api/user/afs-webhook', async (req, res) => {
  try {
    console.log('🔔 ═══════════════════════════════════════');
    console.log('🔔 WEBHOOK RECEIVED:', new Date().toISOString());
    console.log('🔔 IP:', req.ip);
    console.log('🔔 Method:', req.method);
    console.log('🔔 Content-Type:', req.headers['content-type']);
    console.log('🔔 Headers:', JSON.stringify(req.headers, null, 2));
    
    // Parse body based on content type
    let body = {};
    
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      // Parse form data manually
      const bodyString = req.body.toString('utf-8');
      console.log('🔔 Raw Body (form):', bodyString);
      
      const params = new URLSearchParams(bodyString);
      for (const [key, value] of params) {
        body[key] = value;
      }
    } else if (req.headers['content-type']?.includes('application/json')) {
      body = JSON.parse(req.body.toString('utf-8'));
      console.log('🔔 Raw Body (json):', JSON.stringify(body, null, 2));
    } else {
      console.log('🔔 Raw Body:', req.body.toString('utf-8'));
      body = JSON.parse(req.body.toString('utf-8'));
    }
    
    console.log('🔔 Parsed Body:', JSON.stringify(body, null, 2));
    console.log('🔔 ═══════════════════════════════════════');

    // ALWAYS respond 200 immediately
    res.status(200).send('OK');

    // Import models
    const BookingModel = (await import('./Models/BookingModel.js')).default;
    const PropertyModel = (await import('./Models/PropertyModel.js')).default;
    const sendEmail = (await import('./utils/SendEmail.js')).default;

    const { id, merchantTransactionId, result, amount, currency, paymentBrand, card } = body;

    if (!merchantTransactionId) {
      console.error('❌ No merchantTransactionId in webhook');
      return;
    }

    const booking = await BookingModel.findById(merchantTransactionId).populate('property');
    if (!booking) {
      console.error('❌ Booking not found:', merchantTransactionId);
      return;
    }

    console.log('✅ Booking found:', booking._id);
    console.log('📊 Current status:', {
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus
    });

    // Don't process if already confirmed
    if (booking.paymentStatus === 'confirmed') {
      console.log('ℹ️ Booking already confirmed, skipping');
      return;
    }

    const successPattern = /^(000\.000\.|000\.100\.1|000\.[36])/;
    const rejectedPattern = /^(000\.400\.|800\.|900\.|100\.)/;

    const resultCode = result?.code || body['result.code'];
    const resultDescription = result?.description || body['result.description'];

    if (successPattern.test(resultCode)) {
      console.log('✅✅✅ WEBHOOK: Payment SUCCESS ✅✅✅');
      
      booking.paymentTransactionId = id;
      booking.paymentDetails = {
        paymentBrand: paymentBrand || body.paymentBrand,
        amount: parseFloat(amount),
        currency,
        resultCode,
        resultDescription,
        cardBin: card?.bin || body['card.bin'],
        cardLast4: card?.last4Digits || body['card.last4Digits'],
        timestamp: new Date(),
        webhookReceived: true
      };
      booking.paymentStatus = "confirmed";
      booking.bookingStatus = "confirmed";
      booking.paymentMethod = "online-payment";
      booking.expiresAt = undefined;
      await booking.save();

      console.log('💾 Booking updated successfully');

      await PropertyModel.findByIdAndUpdate(booking.property._id, {
        $push: {
          "availability.unavailableDates": {
            checkIn: booking.checkIn,
            checkOut: booking.checkOut
          }
        }
      });

      console.log('🏠 Property availability updated');

      // Send email (simplified)
      const emailHtml = `
        <h1>Payment Successful!</h1>
        <p>Hi ${booking.guestName},</p>
        <p>Your booking ${booking._id} has been confirmed.</p>
        <p>Amount: AED ${booking.totalPrice}</p>
      `;
      
      sendEmail(booking.guestEmail, "Payment Successful - Wavescation", emailHtml)
        .catch(err => console.error("Email error:", err));

      console.log('📧 Confirmation email sent');

    } else if (rejectedPattern.test(resultCode)) {
      console.log('❌ WEBHOOK: Payment FAILED');

      booking.paymentStatus = "failed";
      booking.bookingStatus = "cancelled";
      booking.paymentDetails = {
        resultCode,
        resultDescription,
        timestamp: new Date(),
        webhookReceived: true
      };
      await booking.save();
    }

    console.log('🔔 ═══════════════════════════════════════');
  } catch (error) {
    console.error('💥 Webhook error:', error);
  }
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Wavescation API is running',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// CORS - ALLOW ALL FOR WEBHOOKS
// ============================================
app.use(cors({
    origin: function(origin, callback) {
        // Allow all origins (webhooks have no origin)
        callback(null, true);
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

app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.removeHeader("Cross-Origin-Embedder-Policy");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  next();
});

// Request logging
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
app.use((req, res) => {
  console.log('❌ 404 Not Found:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

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

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});