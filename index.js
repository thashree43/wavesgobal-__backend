// import express from 'express';
// import cors from 'cors';
// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// import path from 'path';
// import Adminrouter from './Routes/AdminRoutes.js';
// import Userrouter from './Routes/UserRoutes.js';
// import databaseConnection from './utils/db.js';
// import cookieParser from 'cookie-parser';
// import nodeCron from 'node-cron';
// import './jobs/BookingClean.js';

// dotenv.config();
// databaseConnection();

// const app = express();
// const PORT = 3000;

// // ============================================
// // CRITICAL: WEBHOOK MUST BE FIRST - BEFORE ANY BODY PARSING
// // ============================================
// app.post('/api/user/afs-webhook', express.raw({ type: '*/*' }), async (req, res) => {
//     try {
//       console.log('🔔 ═══════════════════════════════════════');
//       console.log('🔔 WEBHOOK RECEIVED:', new Date().toISOString());
//       console.log('🔔 IP:', req.ip);
//       console.log('🔔 Content-Type:', req.headers['content-type']);
//       console.log('🔔 Headers:', JSON.stringify(req.headers, null, 2));
      
//       // ALWAYS respond 200 FIRST to acknowledge receipt
//       res.status(200).send('OK');
      
//       // Parse body
//       let body = {};
//       const bodyString = req.body.toString('utf-8');
//       console.log('🔔 Raw Body:', bodyString);
      
//       // Parse form-urlencoded data
//       const params = new URLSearchParams(bodyString);
//       for (const [key, value] of params) {
//         // Handle nested keys like result.code, card.bin, etc.
//         if (key.includes('.')) {
//           const [parent, child] = key.split('.');
//           if (!body[parent]) body[parent] = {};
//           body[parent][child] = value;
//         } else {
//           body[key] = value;
//         }
//       }
      
//       console.log('🔔 Parsed Body:', JSON.stringify(body, null, 2));
      
//       // Import models
//       const BookingModel = (await import('./Models/BookingModel.js')).default;
//       const PropertyModel = (await import('./Models/PropertyModel.js')).default;
//       const sendEmail = (await import('./utils/SendEmail.js')).default;
  
//       const merchantTransactionId = body.merchantTransactionId;
//       const resultCode = body.result?.code;
  
//       if (!merchantTransactionId) {
//         console.error('❌ No merchantTransactionId');
//         return;
//       }
  
//       // ✅ Validate ObjectId format before querying
//       if (!/^[0-9a-fA-F]{24}$/.test(merchantTransactionId)) {
//         console.error('❌ Invalid booking ID format:', merchantTransactionId);
//         return;
//       }
  
//       console.log('🔍 Looking for booking:', merchantTransactionId);
  
//       const booking = await BookingModel.findById(merchantTransactionId).populate('property');
//       if (!booking) {
//         console.error('❌ Booking not found:', merchantTransactionId);
//         return;
//       }
  
//       console.log('✅ Booking found:', booking._id);
//       console.log('📊 Current status:', {
//         paymentStatus: booking.paymentStatus,
//         bookingStatus: booking.bookingStatus
//       });
  
//       // Skip if already confirmed
//       if (booking.paymentStatus === 'confirmed') {
//         console.log('ℹ️ Already confirmed, skipping');
//         return;
//       }
  
//       if (!resultCode) {
//         console.error('❌ No result code in webhook');
//         return;
//       }
  
//       const successPattern = /^(000\.000\.|000\.100\.1|000\.[36])/;
//       const failedPattern = /^(000\.400|800\.|900\.|100\.)/;
  
//       if (successPattern.test(resultCode)) {
//         console.log('✅✅✅ PAYMENT SUCCESS ✅✅✅');
        
//         booking.paymentTransactionId = body.id;
//         booking.paymentDetails = {
//           paymentBrand: body.paymentBrand,
//           amount: parseFloat(body.amount || 0),
//           currency: body.currency,
//           resultCode: resultCode,
//           resultDescription: body.result?.description,
//           cardBin: body.card?.bin,
//           cardLast4: body.card?.last4Digits,
//           timestamp: new Date(),
//           webhookReceived: true
//         };
//         booking.paymentStatus = "confirmed";
//         booking.bookingStatus = "confirmed";
//         booking.paymentMethod = "online-payment";
//         booking.expiresAt = undefined;
//         await booking.save();
  
//         console.log('💾 Booking confirmed');
  
//         // Update property availability
//         await PropertyModel.findByIdAndUpdate(booking.property._id, {
//           $push: {
//             "availability.unavailableDates": {
//               checkIn: booking.checkIn,
//               checkOut: booking.checkOut
//             }
//           }
//         });
  
//         console.log('🏠 Property updated');
  
//         // Send email
//         const emailHtml = `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//             <div style="background: #10b981; padding: 20px; text-align: center; color: white;">
//               <h1>✓ Payment Successful!</h1>
//             </div>
//             <div style="padding: 30px; background: #f9fafb;">
//               <p style="font-size: 16px;">Hi ${booking.guestName},</p>
//               <p>Your payment of <strong>AED ${booking.totalPrice}</strong> has been confirmed.</p>
//               <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
//                 <h3 style="margin-top: 0; color: #10b981;">Booking Confirmed</h3>
//                 <p><strong>Booking ID:</strong> ${booking._id}</p>
//                 <p><strong>Property:</strong> ${booking.property.name}</p>
//                 <p><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
//                 <p><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
//                 <p><strong>Guests:</strong> ${booking.guests}</p>
//                 <p><strong>Transaction ID:</strong> ${body.id || 'N/A'}</p>
//               </div>
//               <div style="background: #dcfce7; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #86efac;">
//                 <p style="margin: 0; color: #166534; font-size: 18px; font-weight: bold;">✓ Payment Confirmed</p>
//               </div>
//               <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
//                 <p style="color: #6b7280; font-size: 12px;">
//                   Need help? Contact us at info@wavescation.com
//                 </p>
//               </div>
//             </div>
//           </div>
//         `;
        
//         sendEmail(booking.guestEmail, "Payment Successful - Wavescation", emailHtml)
//           .catch(err => console.error("📧 Email error:", err));
  
//         console.log('📧 Email queued');
  
//       } else if (failedPattern.test(resultCode)) {
//         console.log('❌ PAYMENT FAILED:', resultCode);
        
//         booking.paymentStatus = "failed";
//         booking.bookingStatus = "cancelled";
//         booking.paymentDetails = {
//           resultCode: resultCode,
//           resultDescription: body.result?.description || 'Payment failed',
//           timestamp: new Date(),
//           webhookReceived: true
//         };
//         await booking.save();
        
//         console.log('💾 Booking marked as failed');
        
//         // Send failure email
//         const failureEmail = `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//             <div style="background: #dc2626; padding: 20px; text-align: center; color: white;">
//               <h1>Payment Failed</h1>
//             </div>
//             <div style="padding: 30px; background: #f9fafb;">
//               <p>Hi ${booking.guestName},</p>
//               <p>Unfortunately, your payment could not be processed.</p>
//               <div style="background: #fee; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
//                 <p><strong>Reason:</strong> ${body.result?.description || 'Payment declined'}</p>
//               </div>
//               <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin-top: 20px;">
//                 <p style="margin: 0; color: #1e40af; font-size: 13px;">
//                   If payment was deducted, it will be refunded within 5-7 business days.
//                 </p>
//               </div>
//             </div>
//           </div>
//         `;
        
//         sendEmail(booking.guestEmail, "Payment Failed - Wavescation", failureEmail)
//           .catch(err => console.error("📧 Email error:", err));
          
//       } else {
//         console.log('⚠️ Unknown result code:', resultCode);
//       }
  
//       console.log('🔔 Webhook processing complete');
//       console.log('🔔 ═══════════════════════════════════════');
//     } catch (error) {
//       console.error('💥 Webhook error:', error.message);
//       console.error(error.stack);
//     }
// });

// // Test endpoint to verify webhook is reachable
// app.all('/api/user/afs-webhook-test', (req, res) => {
//   console.log('🧪 ═══════════════════════════════════');
//   console.log('🧪 TEST WEBHOOK HIT');
//   console.log('Method:', req.method);
//   console.log('URL:', req.url);
//   console.log('IP:', req.ip);
//   console.log('Headers:', JSON.stringify(req.headers, null, 2));
//   console.log('🧪 ═══════════════════════════════════');
  
//   res.status(200).json({
//     success: true,
//     message: 'Webhook endpoint is reachable!',
//     timestamp: new Date().toISOString()
//   });
// });

// // ============================================
// // CORS - Must allow webhook requests
// // ============================================
// app.use(cors({
//     origin: function(origin, callback) {
//         // Allow all origins (webhooks may not have an origin header)
//         callback(null, true);
//     },
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//     credentials: true
// }));

// // ============================================
// // GENERAL MIDDLEWARE - AFTER WEBHOOK
// // ============================================
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// app.use(cookieParser());

// app.use((req, res, next) => {
//   res.removeHeader("Cross-Origin-Opener-Policy");
//   res.removeHeader("Cross-Origin-Embedder-Policy");
//   res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
//   next();
// });

// // Logging middleware
// app.use((req, res, next) => {
//   // Don't log webhook hits twice
//   if (!req.path.includes('/afs-webhook')) {
//     console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
//   }
//   next();
// });

// // Health check
// app.get('/health', (req, res) => {
//   res.status(200).json({
//     status: 'ok',
//     timestamp: Date.now(),
//     uptime: process.uptime(),
//     environment: process.env.NODE_ENV || 'development',
//     webhookUrl: `${process.env.BACKEND_URL}/api/user/afs-webhook`
//   });
// });

// app.get('/', (req, res) => {
//   res.status(200).json({
//     message: 'Wavescation API is running',
//     timestamp: new Date().toISOString()
//   });
// });

// // ============================================
// // ROUTES
// // ============================================
// app.use('/api/admin', Adminrouter);
// app.use('/api/user', Userrouter);

// // 404 handler
// app.use((req, res) => {
//   console.log('❌ 404 Not Found:', req.method, req.path);
//   res.status(404).json({
//     success: false,
//     message: 'Route not found',
//     path: req.path
//   });
// });

// // Error handler
// app.use((err, req, res, next) => {
//   console.error('💥 Server Error:', err);
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message || 'Internal server error',
//     ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
//   });
// });

// // ============================================
// // START SERVER
// // ============================================
// app.listen(PORT, () => {
//     console.log('🚀 ═══════════════════════════════════════');
//     console.log(`🚀 Server running at http://localhost:${PORT}`);
//     console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
//     console.log(`🚀 AFS Mode: ${process.env.AFS_TEST_MODE === 'true' ? 'TEST' : 'PRODUCTION'}`);
//     console.log(`🚀 Webhook URL: ${process.env.BACKEND_URL}/api/user/afs-webhook`);
//     console.log(`🚀 Test Webhook: ${process.env.BACKEND_URL}/api/user/afs-webhook-test`);
//     console.log('🚀 ═══════════════════════════════════════');
// });

// process.on('SIGTERM', () => {
//   console.log('👋 SIGTERM received, shutting down gracefully...');
//   process.exit(0);
// });

// process.on('SIGINT', () => {
//   console.log('👋 SIGINT received, shutting down gracefully...');
//   process.exit(0);
// });






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
// CORS
// ============================================
app.use(cors({
    origin: function(origin, callback) {
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// ============================================
// MIDDLEWARE
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

// Logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================
// HEALTH & STATUS ENDPOINTS
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    afsMode: process.env.AFS_TEST_MODE === 'true' ? 'TEST' : 'PRODUCTION',
    paymentMethod: 'Status API (No Webhooks in Test Mode)'
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Wavescation API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// ============================================
// ROUTES
// ============================================
app.use('/api/admin', Adminrouter);
app.use('/api/user', Userrouter);

// ============================================
// ERROR HANDLERS
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

// Error handler
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
    console.log(`🚀 Payment Method: Status API (No Webhooks)`);
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