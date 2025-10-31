import jwt from "jsonwebtoken";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import sendEmail from "../utils/SendEmail.js";
import axios from "axios";

// ============================================
// CREATE BOOKING
// ============================================
export const createBooking = async (req, res) => {
  try {
    const { 
      userId, propertyId, checkinDate, checkoutDate, guests, pricingPeriod,
      units, pricePerUnit, subtotal, cleaningFee, serviceFee, cityTax, vat, totalPrice 
    } = req.body;

    const user = await UserModel.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });

    const property = await PropertyModel.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const formatDate = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const booking = await BookingModel.create({
      user: userId, property: propertyId,
      checkIn: formatDate(checkinDate), checkOut: formatDate(checkoutDate),
      guests, pricingPeriod, units, pricePerUnit, subtotal, cleaningFee,
      serviceFee, cityTax, vat, totalPrice,
      bookingStatus: "pending", paymentStatus: "pending",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    await UserModel.findByIdAndUpdate(userId, { $push: { bookings: booking._id } });
    await PropertyModel.findByIdAndUpdate(propertyId, { $push: { bookings: booking._id } });

    res.status(201).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================
// UPDATE BOOKING DETAILS
// ============================================
export const updateBookingDetails = async (req, res) => {
  try {
    const { name, email, phone, bookingId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(bookingId);

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      booking.bookingStatus = "cancelled";
      await booking.save();
      return res.status(400).json({ message: "Booking expired" });
    }

    booking.guestPhone = phone;
    booking.guestEmail = email;
    booking.guestName = name;
    await booking.save();
    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================
// CONFIRM BOOKING (Pay at Property)
// ============================================
export const confirmBooking = async (req, res) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(bookingId);

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      booking.bookingStatus = "cancelled";
      await booking.save();
      return res.status(400).json({ message: "Booking expired" });
    }
    if (!booking.guestPhone || !booking.guestEmail || !booking.guestName) {
      return res.status(400).json({ message: "Guest details not found" });
    }

    booking.paymentStatus = "pending";
    booking.bookingStatus = "confirmed";
    booking.paymentMethod = paymentMethod;
    await booking.save();

    await PropertyModel.findByIdAndUpdate(booking.property, {
      $push: { "availability.unavailableDates": { checkIn: booking.checkIn, checkOut: booking.checkOut } },
    });

    const property = await PropertyModel.findById(booking.property);
    const confirmationEmail = generateConfirmationEmailTemplate(booking, property, paymentMethod);
    sendEmail(booking.guestEmail, "Booking Confirmation - Wavescation", confirmationEmail).catch(err => 
      console.error("Email failed:", err)
    );

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================
// CANCEL BOOKING
// ============================================
export const cancelBooking = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(req.params.bookingId);
    
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    booking.bookingStatus = "cancelled";
    await booking.save();

    res.json({ message: "Booking cancelled successfully", success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================
// GET CHECKOUT DATA
// ============================================
export const getCheckout = async (req, res) => {
  try {
    const { propertyId, bookingId } = req.query;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Account blocked" });

    const property = await PropertyModel.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.status(200).json({ propertyData: property, userData: user, bookingData: booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============================================
// INITIALIZE AFS PAYMENT
// ============================================
export const initializeAFSPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(bookingId).populate('property');

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      booking.bookingStatus = "cancelled";
      await booking.save();
      return res.status(400).json({ 
        success: false, message: "Booking expired", expired: true 
      });
    }

    console.log('🔄 Creating new AFS checkout session');

    const isTest = process.env.AFS_TEST_MODE === 'true';
    const afsUrl = isTest 
      ? 'https://test.oppwa.com/v1/checkouts'
      : 'https://oppwa.com/v1/checkouts';

    const frontendUrl = (process.env.FRONTEND_URL || 'https://www.wavescation.com').replace(/\/$/, '');
    const backendUrl = (process.env.BACKEND_URL || 'https://wavesgobal-backend.onrender.com').replace(/\/$/, '');
    
    const shopperResultUrl = `${frontendUrl}/payment-return`;
    const webhookUrl = `${backendUrl}/api/user/afs-webhook`;

    console.log('🔧 Creating AFS checkout:', {
      environment: isTest ? 'TEST' : 'PRODUCTION',
      afsUrl,
      amount: booking.totalPrice.toFixed(2),
      bookingId: booking._id.toString(),
      shopperResultUrl,
      webhookUrl,
      entityId: process.env.AFS_ENTITY_ID
    });

    const params = new URLSearchParams();
    params.append('entityId', process.env.AFS_ENTITY_ID);
    params.append('amount', booking.totalPrice.toFixed(2));
    params.append('currency', 'AED');
    params.append('paymentType', 'DB');
    params.append('merchantTransactionId', booking._id.toString());
    params.append('shopperResultUrl', shopperResultUrl);
    
    // CRITICAL: Webhook configuration
    params.append('notificationUrl', webhookUrl);
    
    params.append('customer.email', booking.guestEmail || 'guest@wavescation.com');
    params.append('customer.givenName', booking.guestName || 'Guest');
    if (booking.guestPhone) params.append('customer.phone', booking.guestPhone);
    
    params.append('billing.street1', booking.property?.address || 'Dubai');
    params.append('billing.city', 'Dubai');
    params.append('billing.state', 'Dubai');
    params.append('billing.country', 'AE');
    params.append('billing.postcode', '00000');
    
    params.append('customParameters[SHOPPER_bookingId]', booking._id.toString());

    const response = await axios.post(afsUrl, params.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.AFS_ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 20000
    });

    console.log('📥 AFS Response:', {
      code: response.data.result?.code,
      description: response.data.result?.description,
      checkoutId: response.data.id
    });

    if (response.data.result.code.match(/^000\.200/)) {
      booking.paymentCheckoutId = response.data.id;
      booking.paymentAttempts = booking.paymentAttempts || [];
      booking.paymentAttempts.push({
        checkoutId: response.data.id,
        timestamp: new Date(),
        status: 'initiated',
        environment: isTest ? 'test' : 'production'
      });
      await booking.save();

      console.log('✅ Checkout created successfully:', response.data.id);

      res.json({
        success: true,
        checkoutId: response.data.id,
        amount: booking.totalPrice,
        environment: isTest ? 'test' : 'production'
      });
    } else {
      console.error('❌ AFS Error:', response.data.result);
      res.status(400).json({
        success: false,
        message: 'Payment initialization failed',
        error: response.data.result.description,
        code: response.data.result.code
      });
    }
  } catch (error) {
    console.error('💥 Payment init error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(500).json({ 
      success: false,
      message: error.code === 'ECONNABORTED' 
        ? 'Payment gateway timeout' 
        : 'Payment initialization failed',
      details: error.response?.data?.result?.description || error.message
    });
  }
};

// ============================================
// VERIFY AFS PAYMENT - Query the payment status
// ============================================
export const verifyAFSPayment = async (req, res) => {
  try {
    const { resourcePath, id, bookingId } = req.query;
    
    console.log('🔍 Verify payment called:', { resourcePath, id, bookingId });

    if (!bookingId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Booking ID required' 
      });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(bookingId).populate('property');

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if already confirmed by webhook
    if (booking.paymentStatus === 'confirmed') {
      console.log('✅ Payment already confirmed by webhook');
      return res.json({
        success: true,
        confirmed: true,
        booking,
        message: 'Payment confirmed'
      });
    }

    // If resourcePath exists, query AFS for payment status
    if (resourcePath && id) {
      try {
        const isTest = process.env.AFS_TEST_MODE === 'true';
        const afsBaseUrl = isTest ? 'https://test.oppwa.com' : 'https://oppwa.com';
        const statusUrl = `${afsBaseUrl}${resourcePath}?entityId=${process.env.AFS_ENTITY_ID}`;

        console.log('🔍 Querying AFS status:', statusUrl);

        const statusResponse = await axios.get(statusUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.AFS_ACCESS_TOKEN}`
          },
          timeout: 10000
        });

        console.log('📥 AFS Status Response:', {
          code: statusResponse.data.result?.code,
          description: statusResponse.data.result?.description
        });

        const successPattern = /^(000\.000\.|000\.100\.1|000\.[36])/;
        const pendingPattern = /^(000\.200|800\.400\.5|100\.400\.500)/;

        if (successPattern.test(statusResponse.data.result.code)) {
          // Payment successful - update booking
          console.log('✅ Payment SUCCESS via API verification');
          
          booking.paymentTransactionId = statusResponse.data.id;
          booking.paymentDetails = {
            paymentBrand: statusResponse.data.paymentBrand,
            amount: parseFloat(statusResponse.data.amount),
            currency: statusResponse.data.currency,
            resultCode: statusResponse.data.result.code,
            resultDescription: statusResponse.data.result.description,
            cardBin: statusResponse.data.card?.bin,
            cardLast4: statusResponse.data.card?.last4Digits,
            timestamp: new Date(),
            verifiedViaAPI: true
          };
          booking.paymentStatus = "confirmed";
          booking.bookingStatus = "confirmed";
          booking.paymentMethod = "online-payment";
          booking.expiresAt = undefined;
          await booking.save();

          await PropertyModel.findByIdAndUpdate(booking.property._id, {
            $push: { 
              "availability.unavailableDates": { 
                checkIn: booking.checkIn, 
                checkOut: booking.checkOut 
              } 
            }
          });

          const email = generateConfirmationEmail(booking);
          sendEmail(booking.guestEmail, "Payment Successful - Wavescation", email)
            .catch(err => console.error("Email error:", err));

          return res.json({
            success: true,
            confirmed: true,
            booking,
            message: 'Payment confirmed'
          });
        } else if (pendingPattern.test(statusResponse.data.result.code)) {
          console.log('⏳ Payment still PENDING');
          return res.json({
            success: false,
            pending: true,
            message: 'Payment is being processed. Please wait...'
          });
        } else {
          // Payment failed
          console.log('❌ Payment FAILED via API verification');
          
          booking.paymentStatus = "failed";
          booking.bookingStatus = "cancelled";
          booking.paymentDetails = {
            resultCode: statusResponse.data.result.code,
            resultDescription: statusResponse.data.result.description,
            timestamp: new Date(),
            verifiedViaAPI: true
          };
          await booking.save();

          return res.json({
            success: false,
            failed: true,
            message: statusResponse.data.result.description || 'Payment failed'
          });
        }
      } catch (apiError) {
        console.error('❌ AFS API query failed:', apiError.message);
        // Fall back to pending status
        return res.json({
          success: false,
          pending: true,
          message: 'Payment verification in progress...'
        });
      }
    }

    // No resourcePath - wait for webhook
    console.log('⏳ No resourcePath, waiting for webhook...');
    return res.json({
      success: false,
      pending: true,
      message: 'Payment is being processed. Please wait...'
    });
    
  } catch (error) {
    console.error('❌ Verify payment error:', error);
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify payment',
      details: error.message
    });
  }
};

// ============================================
// WEBHOOK HANDLER - PRIMARY PAYMENT PROCESSOR
// ============================================
export const handleAFSWebhook = async (req, res) => {
  try {
    console.log('🔔 ═══════════════════════════════════════');
    console.log('🔔 WEBHOOK RECEIVED:', new Date().toISOString());
    console.log('🔔 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔔 Body:', JSON.stringify(req.body, null, 2));
    console.log('🔔 Query:', JSON.stringify(req.query, null, 2));
    console.log('🔔 ═══════════════════════════════════════');

    // ALWAYS respond 200 immediately to acknowledge webhook
    res.status(200).send('OK');

    const { id, merchantTransactionId, result, amount, currency, paymentBrand, card } = req.body;

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
    console.log('📊 Current booking status:', {
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

    if (successPattern.test(result.code)) {
      console.log('✅✅✅ WEBHOOK: Payment SUCCESS ✅✅✅');
      
      booking.paymentTransactionId = id;
      booking.paymentDetails = {
        paymentBrand, 
        amount: parseFloat(amount), 
        currency,
        resultCode: result.code, 
        resultDescription: result.description,
        cardBin: card?.bin, 
        cardLast4: card?.last4Digits,
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

      const email = generateConfirmationEmail(booking);
      sendEmail(booking.guestEmail, "Payment Successful - Wavescation", email)
        .catch(err => console.error("Email error:", err));
      
      console.log('📧 Confirmation email sent');
      
    } else if (rejectedPattern.test(result.code)) {
      console.log('❌ WEBHOOK: Payment FAILED');
      
      booking.paymentStatus = "failed";
      booking.bookingStatus = "cancelled";
      booking.paymentDetails = {
        resultCode: result.code,
        resultDescription: result.description,
        timestamp: new Date(),
        webhookReceived: true
      };
      await booking.save();
      
      const email = generatePaymentFailureEmail(booking, result.description);
      sendEmail(booking.guestEmail, "Payment Failed - Wavescation", email)
        .catch(err => console.error("Email error:", err));
    } else {
      console.log('⚠️ WEBHOOK: Unknown result code:', result.code);
    }

    console.log('🔔 ═══════════════════════════════════════');
  } catch (error) {
    console.error('💥 Webhook error:', error);
    // Don't throw - webhook already responded
  }
};

// ============================================
// CHECK PAYMENT STATUS - FOR POLLING
// ============================================
export const checkPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(bookingId);

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    console.log('📊 Payment status check:', {
      bookingId,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus
    });

    res.json({
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      confirmed: booking.paymentStatus === "confirmed",
      failed: booking.paymentStatus === "failed",
      details: booking.paymentDetails
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ message: 'Failed to check status' });
  }
};

// ============================================
// GET USER BOOKINGS
// ============================================
export const bookingbyuser = async (req, res) => {
  try {
    const { id } = req.query;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (id && id !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const bookings = await BookingModel.find({ 
      user: id || decoded.id, 
      bookingStatus: { $in: ["confirmed", "cancelled"] }
    })
    .populate("property") 
    .populate("user", "name email");

    res.status(200).json({ bookings, success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
};

// ============================================
// EMAIL TEMPLATES
// ============================================
function generateConfirmationEmail(booking) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #e67300; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Payment Successful!</h1>
      </div>
      <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333;">Hi ${booking.guestName},</p>
        <p style="font-size: 14px; color: #333;">Your payment has been successfully processed!</p>
        
        <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin: 20px 0;">
          <h3 style="color: #e67300; margin-top: 0;">Booking Details</h3>
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          <p><strong>Property:</strong> ${booking.property.name}</p>
          <p><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
          <p><strong>Amount Paid:</strong> AED ${booking.totalPrice.toLocaleString()}</p>
          <p><strong>Transaction ID:</strong> ${booking.paymentTransactionId}</p>
        </div>

        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; text-align: center;">
          <p style="margin: 0; color: #155724; font-size: 18px;"><strong>✓ Payment Confirmed</strong></p>
        </div>

        <div style="text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 20px;">
          <p style="color: #666; font-size: 12px;">Questions? Contact support@wavescation.com</p>
        </div>
      </div>
    </div>
  `;
}

function generatePaymentFailureEmail(booking, reason) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc2626; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Payment Failed</h1>
      </div>
      <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd;">
        <p>Hi ${booking.guestName},</p>
        <p>Unfortunately, your payment could not be processed.</p>
        <div style="background-color: #fee; padding: 20px; border-left: 4px solid #dc2626; margin: 20px 0;">
          <h3 style="color: #dc2626;">Reason</h3>
          <p>${reason || 'Payment was declined by your bank'}</p>
        </div>
        <div style="text-align: center; padding: 20px;">
          <a href="${process.env.FRONTEND_URL}/checkout?bookingId=${booking._id}&propertyId=${booking.property._id}" 
             style="display: inline-block; padding: 12px 30px; background-color: #e67300; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Try Again
          </a>
        </div>
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin-top: 20px;">
          <p style="margin: 0; color: #1565c0; font-size: 13px;">
            If payment was deducted from your account, it will be automatically refunded within 5-7 business days.
          </p>
        </div>
      </div>
    </div>
  `;
}

function generateConfirmationEmailTemplate(booking, property, paymentMethod) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #e67300; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Booking Confirmed!</h1>
      </div>
      <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd;">
        <p>Hi ${booking.guestName},</p>
        <p>Thank you for your booking with Wavescation!</p>
        <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin: 20px 0;">
          <h3 style="color: #e67300;">Booking Details</h3>
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          <p><strong>Property:</strong> ${property.name}</p>
          <p><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
          <p><strong>Guests:</strong> ${booking.guests}</p>
          <p><strong>Total Amount:</strong> AED ${booking.totalPrice.toLocaleString()}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod === 'pay-at-property' ? 'Pay at Property' : paymentMethod}</p>
        </div>
      </div>
    </div>
  `;
}


export const testWebhook = async (req, res) => {
  console.log('🧪 TEST WEBHOOK CALLED');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Query:', JSON.stringify(req.query, null, 2));
  
  res.status(200).json({
    success: true,
    message: 'Webhook endpoint is working!',
    received: {
      method: req.method,
      body: req.body,
      query: req.query,
      headers: req.headers
    },
    timestamp: new Date().toISOString()
  });
};