import jwt from "jsonwebtoken";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import sendEmail from "../utils/SendEmail.js";
import axios from "axios";

export const createBooking = async (req, res) => {
  try {
    const { 
      userId, 
      propertyId, 
      checkinDate, 
      checkoutDate, 
      guests, 
      pricingPeriod,
      units,
      pricePerUnit,
      subtotal,
      cleaningFee,
      serviceFee,
      cityTax,
      vat,
      totalPrice 
    } = req.body;

    const user = await UserModel.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });

    const property = await PropertyModel.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const formatDate = (date) => {
      const d = new Date(date);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const year = d.getFullYear();
      return `${year}-${month}-${day}`;
    };

    const booking = await BookingModel.create({
      user: userId,
      property: propertyId,
      checkIn: formatDate(checkinDate),
      checkOut: formatDate(checkoutDate),
      guests,
      pricingPeriod,
      units,
      pricePerUnit,
      subtotal,
      cleaningFee,
      serviceFee,
      cityTax,
      vat,
      totalPrice,
      bookingStatus: "pending",
      paymentStatus: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await UserModel.findByIdAndUpdate(userId, { $push: { bookings: booking._id } });
    await PropertyModel.findByIdAndUpdate(propertyId, { $push: { bookings: booking._id } });

    res.status(201).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBookingDetails = async (req, res) => {
  try {
    const { name, email, phone, bookingId } = req.body;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    
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

export const confirmBooking = async (req, res) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    
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
      return res.status(400).json({ message: "Guest details not found. Please update details first." });
    }

    booking.paymentStatus = "pending";
    booking.bookingStatus = "confirmed";
    booking.paymentMethod = paymentMethod;
    await booking.save();

    await PropertyModel.findByIdAndUpdate(booking.property, {
      $push: { "availability.unavailableDates": { checkIn: booking.checkIn, checkOut: booking.checkOut } },
    });

    const property = await PropertyModel.findById(booking.property);

    const confirmationEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #e67300; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Booking Confirmed!</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi ${booking.guestName},</p>
          <p style="font-size: 14px; color: #333; margin-bottom: 20px;">Thank you for your booking! We're excited to host you.</p>
          
          <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin-bottom: 20px;">
            <h3 style="color: #e67300; margin-top: 0;">Booking Details</h3>
            <p style="margin: 8px 0;"><strong>Booking ID:</strong> ${booking._id}</p>
            <p style="margin: 8px 0;"><strong>Property:</strong> ${property.name}</p>
            <p style="margin: 8px 0;"><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
            <p style="margin: 8px 0;"><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
            <p style="margin: 8px 0;"><strong>Guests:</strong> ${booking.guests}</p>
            <p style="margin: 8px 0;"><strong>Duration:</strong> ${booking.units} Night(s)</p>
          </div>

          <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin-bottom: 20px;">
            <h3 style="color: #e67300; margin-top: 0;">Price Breakdown</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; text-align: left;">Rate per Night:</td>
                <td style="padding: 8px 0; text-align: right;">AED ${booking.pricePerUnit.toLocaleString()}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; text-align: left;">Subtotal:</td>
                <td style="padding: 8px 0; text-align: right;">AED ${booking.subtotal.toLocaleString()}</td>
              </tr>
              ${booking.cleaningFee > 0 ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; text-align: left;">Cleaning Fee:</td><td style="padding: 8px 0; text-align: right;">AED ${booking.cleaningFee.toLocaleString()}</td></tr>` : ''}
              ${booking.serviceFee > 0 ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; text-align: left;">Service Fee:</td><td style="padding: 8px 0; text-align: right;">AED ${booking.serviceFee.toLocaleString()}</td></tr>` : ''}
              ${booking.cityTax > 0 ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; text-align: left;">City Tourism Tax:</td><td style="padding: 8px 0; text-align: right;">AED ${booking.cityTax.toLocaleString()}</td></tr>` : ''}
              ${booking.vat > 0 ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; text-align: left;">VAT/GST:</td><td style="padding: 8px 0; text-align: right;">AED ${booking.vat.toLocaleString()}</td></tr>` : ''}
              <tr>
                <td style="padding: 12px 0; text-align: left; font-weight: bold; font-size: 16px;">Total Amount:</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 16px; color: #e67300;">AED ${booking.totalPrice.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin-bottom: 20px;">
            <h3 style="color: #e67300; margin-top: 0;">Payment Information</h3>
            <p style="margin: 8px 0;"><strong>Payment Method:</strong> ${paymentMethod === 'pay-at-property' ? 'Pay at Property' : paymentMethod}</p>
            <p style="margin: 8px 0;"><strong>Payment Status:</strong> Confirmed</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #856404; font-size: 14px;"><strong>Important:</strong> Please keep your booking ID safe. You will need it at check-in. A valid ID proof is required during check-in.</p>
          </div>

          <div style="text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 20px;">
            <p style="margin: 10px 0; color: #666; font-size: 12px;">If you have any questions, contact us at support@wavescation.com</p>
            <p style="margin: 10px 0; color: #666; font-size: 12px;">Thank you for choosing Wavescation!</p>
          </div>
        </div>
      </div>
    `;
    sendEmail(booking.guestEmail, "Booking Confirmation - Wavescation", confirmationEmail).catch((err) => {
      console.error("Confirmation email failed:", err);
    });

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });

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

export const getCheckout = async (req, res) => {
  try {
    const { propertyId, bookingId } = req.query;

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });

    const property = await PropertyModel.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.status(200).json({ 
      propertyData: property,
      userData: user,
      bookingData: booking
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    // ✅ Check if booking has expired
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      booking.bookingStatus = "cancelled";
      await booking.save();
      return res.status(400).json({ 
        success: false,
        message: "Booking expired. Please create a new booking.",
        expired: true
      });
    }

    // ✅ If there's already a valid checkout ID that's less than 25 minutes old, reuse it
    if (booking.paymentCheckoutId && booking.paymentAttempts?.length > 0) {
      const lastAttempt = booking.paymentAttempts[booking.paymentAttempts.length - 1];
      const timeSinceCreation = Date.now() - new Date(lastAttempt.timestamp).getTime();
      const minutesSinceCreation = timeSinceCreation / (1000 * 60);
      
      if (minutesSinceCreation < 25 && lastAttempt.status === 'initiated') {
        console.log(`♻️ Reusing existing checkout (${minutesSinceCreation.toFixed(1)} min old)`);
        return res.json({
          success: true,
          checkoutId: booking.paymentCheckoutId,
          amount: booking.totalPrice,
          reused: true
        });
      } else {
        console.log(`🔄 Checkout too old (${minutesSinceCreation.toFixed(1)} min), creating new one`);
      }
    }

    // ✅ CRITICAL: Always use TEST mode URLs
    const isTestMode = true; // Force test mode
    const afsUrl = 'https://test.oppwa.com/v1/checkouts'; // Always use test URL

    // ✅ URLs
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
    const cleanBackendUrl = backendUrl.replace(/\/$/, '');
    
    const shopperResultUrl = `${cleanFrontendUrl}/payment-return`;
    const webhookUrl = `${cleanBackendUrl}/api/user/afs-webhook`;

    console.log('🔧 Creating NEW checkout:', {
      environment: 'TEST (FORCED)',
      amount: booking.totalPrice.toFixed(2),
      bookingId: booking._id.toString(),
      entityId: process.env.AFS_ENTITY_ID,
      shopperResultUrl,
      webhookUrl
    });

    const params = new URLSearchParams();
    params.append('entityId', process.env.AFS_ENTITY_ID);
    params.append('amount', booking.totalPrice.toFixed(2));
    params.append('currency', 'AED');
    params.append('paymentType', 'DB');
    params.append('merchantTransactionId', booking._id.toString());
    params.append('shopperResultUrl', shopperResultUrl);
    params.append('notificationUrl', webhookUrl);
    
    // Customer details
    params.append('customer.email', booking.guestEmail);
    params.append('customer.givenName', booking.guestName);
    if (booking.guestPhone) {
      params.append('customer.phone', booking.guestPhone);
    }
    
    // Billing address
    params.append('billing.street1', booking.property.address || 'Dubai');
    params.append('billing.city', 'Dubai');
    params.append('billing.state', 'Dubai');
    params.append('billing.country', 'AE');
    params.append('billing.postcode', '00000');
    
    // Custom parameters
    params.append('customParameters[SHOPPER_bookingId]', booking._id.toString());

    const response = await axios.post(
      afsUrl,
      params.toString(),
      {
        headers: {
          'Authorization': `Bearer ${process.env.AFS_ACCESS_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000 // 15 second timeout
      }
    );

    console.log('📥 AFS Response:', {
      code: response.data.result.code,
      description: response.data.result.description,
      checkoutId: response.data.id
    });

    if (response.data.result.code.match(/^000\.200/)) {
      // ✅ Update booking with new checkout ID
      booking.paymentCheckoutId = response.data.id;
      
      // ✅ Track this attempt
      if (!booking.paymentAttempts) {
        booking.paymentAttempts = [];
      }
      booking.paymentAttempts.push({
        checkoutId: response.data.id,
        timestamp: new Date(),
        status: 'initiated'
      });
      
      await booking.save();

      res.json({
        success: true,
        checkoutId: response.data.id,
        amount: booking.totalPrice
      });
    } else {
      console.error('❌ AFS Error:', response.data.result);
      res.status(400).json({
        success: false,
        message: 'Failed to initialize payment',
        error: response.data.result.description
      });
    }
  } catch (error) {
    console.error('💥 Payment initialization error:', error.response?.data || error.message);
    
    // Better error messages
    let errorMessage = 'Payment initialization failed. Please try again.';
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Payment gateway timeout. Please check your internet and try again.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Payment gateway authentication failed. Please contact support.';
    }
    
    res.status(500).json({ 
      success: false,
      message: errorMessage
    });
  }
};
// export const verifyAFSPayment = async (req, res) => {
//   try {
//     const { checkoutId, bookingId, resourcePath, id } = req.body;
    
//     console.log('═══════════════════════════════════════');
//     console.log('🔍 PAYMENT VERIFICATION STARTED');
//     console.log('═══════════════════════════════════════');
//     console.log('Request Body:', JSON.stringify(req.body, null, 2));

//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) {
//       console.error('❌ No authorization token');
//       return res.status(401).json({ message: "Unauthorized" });
//     }
    
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const booking = await BookingModel.findById(bookingId).populate('property');

//     if (!booking) {
//       console.error('❌ Booking not found');
//       return res.status(404).json({ message: "Booking not found" });
//     }
    
//     console.log('✅ Booking found:', {
//       id: booking._id,
//       status: booking.bookingStatus,
//       paymentStatus: booking.paymentStatus,
//       checkoutId: booking.paymentCheckoutId
//     });
    
//     if (booking.user.toString() !== decoded.id) {
//       console.error('❌ User not authorized');
//       return res.status(403).json({ message: "Not authorized" });
//     }

//     if (booking.paymentStatus === "confirmed") {
//       console.log('ℹ️ Payment already confirmed');
//       return res.json({ 
//         success: true, 
//         booking,
//         message: 'Payment already confirmed'
//       });
//     }

//     // ❌ REMOVE THIS ENTIRE TEST MODE AUTO-CONFIRM SECTION
//     // The webhook will handle confirmation after actual payment

//     // Just store the checkout ID and wait for webhook
//     console.log('ℹ️ Payment initiated, waiting for webhook confirmation');
//     booking.paymentCheckoutId = id || checkoutId;
//     await booking.save();
//     console.log('═══════════════════════════════════════');

//     return res.json({ 
//       success: false, 
//       pending: true,
//       message: 'Payment is being processed. Please wait for confirmation...',
//       note: 'Webhook will confirm payment status'
//     });
    
//   } catch (error) {
//     console.error('💥💥💥 VERIFICATION ERROR 💥💥💥');
//     console.error('Error:', error.message);
//     console.log('═══════════════════════════════════════');
    
//     res.status(500).json({ 
//       success: false,
//       message: 'Payment verification failed. Please contact support.'
//     });
//   }
// };

export const handleAFSWebhook = async (req, res) => {
  try {
    console.log('🔔 ═══════════════════════════════════════');
    console.log('🔔 AFS WEBHOOK RECEIVED');
    console.log('🔔 Time:', new Date().toISOString());
    console.log('🔔 ═══════════════════════════════════════');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    const { 
      id, 
      merchantTransactionId, 
      result, 
      amount, 
      currency, 
      paymentType, 
      paymentBrand,
      card,
      ndc // NDC (Network Data Capture) error code
    } = req.body;

    // ✅ Check for NDC errors first
    if (ndc) {
      console.log('⚠️ NDC Error detected:', ndc);
      console.log('This typically means checkout expired or was invalid');
    }

    if (!merchantTransactionId) {
      console.error('❌ No booking ID in webhook');
      return res.status(400).send('Bad Request: No merchantTransactionId');
    }

    const booking = await BookingModel.findById(merchantTransactionId).populate('property');

    if (!booking) {
      console.error('❌ Booking not found:', merchantTransactionId);
      return res.status(404).send('Not Found: Booking does not exist');
    }

    console.log('✅ Booking found:', {
      id: booking._id,
      currentStatus: booking.bookingStatus,
      currentPaymentStatus: booking.paymentStatus
    });

    // ✅ AFS Result Code Patterns
    const successPattern = /^(000\.000\.|000\.100\.1|000\.[36])/;
    const pendingPattern = /^(000\.200)/;
    
    // ✅ More specific failure patterns
    const rejectedPattern = /^(000\.400\.[1][0-9]{2}|000\.400\.0[^0])/; // Rejected by system
    const errorPattern = /^(800\.|900\.|100\.)/; // Communication/system errors
    const expiredPattern = /^(000\.100\.[0-9]{2})/; // Expired/invalid checkout

    if (successPattern.test(result.code)) {
      console.log('✅✅✅ WEBHOOK: Payment SUCCESSFUL ✅✅✅');
      console.log('Transaction ID:', id);
      console.log('Amount:', amount, currency);
      console.log('Payment Brand:', paymentBrand);

      // Use the model method if you added it
      if (booking.updatePaymentFromWebhook) {
        booking.updatePaymentFromWebhook(req.body);
      } else {
        // Manual update
        booking.paymentTransactionId = id;
        booking.paymentDetails = {
          paymentBrand: paymentBrand,
          amount: parseFloat(amount),
          currency: currency,
          resultCode: result.code,
          resultDescription: result.description,
          cardBin: card?.bin,
          cardLast4: card?.last4Digits,
          timestamp: new Date(),
          webhookReceived: true,
          webhookReceivedAt: new Date()
        };
      }

      booking.paymentStatus = "confirmed";
      booking.bookingStatus = "confirmed";
      booking.paymentMethod = "online-payment";
      booking.expiresAt = undefined;
      
      await booking.save();
      console.log('✅ Booking status updated to confirmed');

      // Block property dates
      await PropertyModel.findByIdAndUpdate(booking.property._id, {
        $push: { 
          "availability.unavailableDates": { 
            checkIn: booking.checkIn, 
            checkOut: booking.checkOut 
          } 
        },
      });
      console.log('✅ Property dates blocked');

      // Send confirmation email
      const confirmationEmail = generateConfirmationEmail(booking);
      sendEmail(
        booking.guestEmail, 
        "Payment Successful - Booking Confirmed", 
        confirmationEmail
      ).catch((err) => {
        console.error("❌ Confirmation email failed:", err);
      });

      console.log('✅ Confirmation email queued');
      
    } else if (pendingPattern.test(result.code)) {
      console.log('⏳ WEBHOOK: Payment PENDING');
      console.log('Result Code:', result.code);
      console.log('Description:', result.description);
      
      booking.paymentStatus = "pending-verification";
      booking.paymentDetails = {
        resultCode: result.code,
        resultDescription: result.description,
        timestamp: new Date(),
        webhookReceived: true,
        webhookReceivedAt: new Date()
      };
      await booking.save();
      
    } else if (expiredPattern.test(result.code) || ndc) {
      console.log('⏰ WEBHOOK: Checkout EXPIRED or INVALID');
      console.log('Result Code:', result.code);
      console.log('Description:', result.description);
      console.log('NDC:', ndc);
      
      // Don't immediately cancel - keep as pending for retry
      booking.paymentStatus = "pending";
      booking.paymentDetails = {
        resultCode: result.code,
        resultDescription: result.description,
        ndc: ndc,
        timestamp: new Date(),
        webhookReceived: true,
        webhookReceivedAt: new Date()
      };
      await booking.save();
      console.log('⚠️ Booking kept as pending for potential retry');
      
    } else if (rejectedPattern.test(result.code) || errorPattern.test(result.code)) {
      console.log('❌ WEBHOOK: Payment FAILED/REJECTED');
      console.log('Result Code:', result.code);
      console.log('Description:', result.description);
      
      booking.paymentStatus = "failed";
      booking.bookingStatus = "cancelled";
      booking.paymentDetails = {
        resultCode: result.code,
        resultDescription: result.description,
        timestamp: new Date(),
        webhookReceived: true,
        webhookReceivedAt: new Date()
      };
      await booking.save();
      console.log('✅ Booking marked as failed/cancelled');
      
      // Send failure notification email
      const failureEmail = generatePaymentFailureEmail(booking, result.description);
      sendEmail(
        booking.guestEmail,
        "Payment Failed - Wavescation",
        failureEmail
      ).catch(err => console.error("Email error:", err));
    }

    console.log('🔔 ═══════════════════════════════════════');
    
    // ✅ CRITICAL: Always return 200 OK to acknowledge webhook
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    console.log('Stack:', error.stack);
    console.log('🔔 ═══════════════════════════════════════');
    // Still return 200 to prevent AFS from retrying
    res.status(200).send('Error processed');
  }
};



// ✅ Helper function for failure email
function generatePaymentFailureEmail(booking, reason) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc2626; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Payment Failed</h1>
      </div>
      <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi ${booking.guestName},</p>
        <p style="font-size: 14px; color: #333; margin-bottom: 20px;">
          Unfortunately, your payment for booking ${booking._id} could not be processed.
        </p>
        
        <div style="background-color: #fee; padding: 20px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
          <h3 style="color: #dc2626; margin-top: 0;">Reason</h3>
          <p style="margin: 0;">${reason || 'Payment declined by your bank'}</p>
        </div>

        <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin-bottom: 20px;">
          <h3 style="color: #e67300; margin-top: 0;">What's Next?</h3>
          <ul style="padding-left: 20px; color: #555;">
            <li>Check your card details and try again</li>
            <li>Try a different payment method</li>
            <li>Contact your bank if the issue persists</li>
            <li>Or choose "Pay at Property" option</li>
          </ul>
        </div>

        <div style="text-align: center; padding: 20px;">
          <a href="${process.env.FRONTEND_URL}/checkout?bookingId=${booking._id}&propertyId=${booking.property._id}" 
             style="display: inline-block; padding: 12px 30px; background-color: #e67300; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Try Again
          </a>
        </div>

        <div style="text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 20px;">
          <p style="margin: 10px 0; color: #666; font-size: 12px;">Need help? Contact us at support@wavescation.com</p>
        </div>
      </div>
    </div>
  `;
}

// Keep your existing generateConfirmationEmail function

export const checkPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json({
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      confirmed: booking.paymentStatus === "confirmed",
      details: booking.paymentDetails
    });
    
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ message: 'Failed to check payment status' });
  }
};

export const bookingbyuser = async (req, res) => {
  try {
    const { id } = req.query;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (id && id !== decoded.id) {
      return res.status(403).json({ message: "Not authorized to view other user's bookings" });
    }

    const userId = id || decoded.id;

    const bookings = await BookingModel.find({ user: userId, bookingStatus: ["confirmed", "cancelled"] })
      .populate("property") 
      .populate("user", "name email"); 

    res.status(200).json({ bookings, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
};











// ✅ Helper function for email
function generateConfirmationEmail(booking) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #e67300; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Payment Successful!</h1>
      </div>
      <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi ${booking.guestName},</p>
        <p style="font-size: 14px; color: #333; margin-bottom: 20px;">Your payment has been successfully processed and your booking is confirmed!</p>
        
        <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin-bottom: 20px;">
          <h3 style="color: #e67300; margin-top: 0;">Booking Details</h3>
          <p style="margin: 8px 0;"><strong>Booking ID:</strong> ${booking._id}</p>
          <p style="margin: 8px 0;"><strong>Property:</strong> ${booking.property.name}</p>
          <p style="margin: 8px 0;"><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
          <p style="margin: 8px 0;"><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
          <p style="margin: 8px 0;"><strong>Amount Paid:</strong> AED ${booking.totalPrice.toLocaleString()}</p>
          <p style="margin: 8px 0;"><strong>Payment Method:</strong> ${booking.paymentDetails?.paymentBrand || 'Card'}</p>
          <p style="margin: 8px 0;"><strong>Transaction ID:</strong> ${booking.paymentTransactionId}</p>
        </div>

        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
          <p style="margin: 0; color: #155724; font-size: 14px;"><strong>✓ Payment Confirmed</strong></p>
          <p style="margin: 8px 0 0 0; color: #155724; font-size: 12px;">Your booking is now confirmed. We look forward to hosting you!</p>
        </div>

        <div style="text-align: center; padding: 20px; border-top: 1px solid #ddd; margin-top: 20px;">
          <p style="margin: 10px 0; color: #666; font-size: 12px;">Questions? Contact us at support@wavescation.com</p>
          <p style="margin: 10px 0; color: #666; font-size: 12px;">Thank you for choosing Wavescation!</p>
        </div>
      </div>
    </div>
  `;
}

