import jwt from "jsonwebtoken";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import sendEmail from "../utils/SendEmail.js";
import axios from "axios";


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


export const initializeAFSPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const booking = await BookingModel.findById(bookingId).populate('property');

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.user.toString() !== decoded.id) return res.status(403).json({ message: "Not authorized" });

    // ✅ Expiry check
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      booking.bookingStatus = "cancelled";
      await booking.save();
      return res.status(400).json({ success: false, message: "Booking expired", expired: true });
    }

    console.log('🔄 Creating AFS checkout');

    // ✅ Use Live URL directly
    const afsUrl = process.env.AFS_TEST_MODE === 'true'
      ? 'https://test.oppwa.com/v1/checkouts'
      : 'https://eu-prod.oppwa.com/v1/checkouts';

    const frontendUrl = (process.env.FRONTEND_URL || 'https://www.wavescation.com').replace(/\/$/, '');
    const shopperResultUrl = `${frontendUrl}/payment-return`;
    const amount = booking.totalPrice;
    console.log("this be the total amount",booking)
    const currency = process.env.AFS_CURRENCY || "AED";

    const params = new URLSearchParams();
    params.append('entityId', process.env.AFS_ENTITY_ID);
    params.append('amount', amount);
    params.append('currency', currency);
    params.append('paymentType', 'DB');
    params.append('merchantTransactionId', booking._id.toString());

    // Customer details
    params.append('customer.email', booking.guestEmail || 'guest@wavescation.com');
    params.append('customer.givenName', booking.guestName || 'Guest');
    if (booking.guestPhone) params.append('customer.phone', booking.guestPhone);

    // Billing
    params.append('billing.street1', booking.property?.address || 'Dubai');
    params.append('billing.city', 'Dubai');
    params.append('billing.country', 'AE');
    params.append('billing.postcode', '00000');

  
    console.log('📤 AFS Request:', {
      url: afsUrl,
      amount,
      bookingId: booking._id.toString()
    });

    const response = await axios.post(afsUrl, params.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.AFS_ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 20000,
    });

    console.log('📥 AFS Response:', response.data.result);

    if (response.data.result.code.match(/^(000\.000\.|000\.100\.1|000\.200)/)) {
      booking.paymentStatus = "pending";
      booking.bookingStatus = "pending";
      booking.paymentCheckoutId = response.data.id;
      booking.paymentResourcePath = response.data.resourcePath || null;
      await booking.save();

      res.json({
        success: true,
        checkoutId: response.data.id,
        amount,
      });
    } else {
      res.status(400).json({
        success: false,
        message: response.data.result?.description || 'AFS checkout creation failed',
      });
    }
  } catch (error) {
    console.error('💥 Payment init error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Payment initialization failed',
      details: error.message,
    });
  }
};



// export const verifyAFSPayment = async (req, res) => {
//   try {
//     const { resourcePath: resourcePathQuery, id, bookingId } = req.query;
//     console.log('🔍 Verify payment:', { resourcePath: resourcePathQuery, id, bookingId });

//     if (!bookingId) return res.status(400).json({ success: false, message: 'Booking ID required' });

//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) return res.status(401).json({ message: 'Unauthorized' });
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const booking = await BookingModel.findById(bookingId).populate('property');
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });
//     if (booking.user.toString() !== decoded.id) return res.status(403).json({ message: 'Not authorized' });

//     // Return early if already processed
//     if (booking.paymentStatus === 'confirmed') return res.json({ success: true, confirmed: true, booking });
//     if (booking.paymentStatus === 'failed') return res.json({ success: false, failed: true, message: booking.paymentDetails?.resultDescription });

//     let resourcePath = resourcePathQuery || booking.paymentResourcePath || null;
//     const afsBaseUrl = process.env.AFS_TEST_MODE === 'true' ? 'https://test.oppwa.com' : 'https://eu-prod.oppwa.com';
//     let statusUrl = null;

//     if (resourcePath) {
//       if (!resourcePath.startsWith('/')) resourcePath = `/${resourcePath}`;
//       statusUrl = `${afsBaseUrl}${resourcePath.split('?')[0]}?entityId=${process.env.AFS_ENTITY_ID}`;
//     } else if (id) {
//       statusUrl = `${afsBaseUrl}/v1/payments/${encodeURIComponent(id)}?entityId=${process.env.AFS_ENTITY_ID}`;
//     } else {
//       return res.status(400).json({ success: false, message: 'resourcePath or id required to verify payment' });
//     }

//     console.log('📤 Querying AFS Status:', statusUrl);

//     const statusResponse = await axios.get(statusUrl, {
//       headers: { Authorization: `Bearer ${process.env.AFS_ACCESS_TOKEN}` },
//       timeout: 15000,
//     });

//     console.log('📥 AFS Status Response:', JSON.stringify(statusResponse.data, null, 2));
//     const result = statusResponse.data.result || {};
//     const resultCode = result.code;

//     if (!resultCode) return res.json({ success: false, pending: true, message: 'Processing payment...' });

//     console.log('📊 Result Code:', resultCode, '-', result.description);

//     const successPattern = /^(000\.000\.|000\.100\.1|000\.[36])/;
//     const pendingPattern = /^(000\.200)/;
//     const failedPattern = /^(000\.400|800\.|900\.|100\.)/;

//     // ✅ SUCCESS
//     if (successPattern.test(resultCode)) {
//       console.log('✅ PAYMENT SUCCESS');

//       // ✅ Immediate DB update (no webhook needed)
//       booking.paymentTransactionId = statusResponse.data.id;
//       booking.paymentDetails = {
//         paymentBrand: statusResponse.data.paymentBrand,
//         amount: parseFloat(statusResponse.data.amount || 0),
//         currency: statusResponse.data.currency,
//         resultCode: resultCode,
//         resultDescription: result.description,
//         timestamp: new Date(),
//         retrievedViaAPI: true,
//       };
//       booking.paymentStatus = 'confirmed';
//       booking.bookingStatus = 'confirmed';
//       booking.paymentMethod = 'online-payment';
//       booking.expiresAt = undefined;
//       await booking.save();

//       // Update property availability
//       await PropertyModel.findByIdAndUpdate(booking.property._id, {
//         $push: {
//           'availability.unavailableDates': {
//             checkIn: booking.checkIn,
//             checkOut: booking.checkOut,
//           },
//         },
//       });

//       // Send email asynchronously
//       sendEmail(booking.guestEmail, 'Payment Successful - Wavescation', /* html omitted */)
//         .catch((err) => console.error('📧 Email error:', err));

//       // ✅ Added: respond immediately as confirmed
//       return res.json({
//         success: true,
//         confirmed: true,
//         booking,
//         message: 'Payment confirmed without webhook',
//       });
//     }

//     // ⏳ PENDING
//     if (pendingPattern.test(resultCode)) {
//       console.log('⏳ Payment still pending');
//       return res.json({ success: false, pending: true, message: 'Waiting for payment submission...' });
//     }

//     // ❌ FAILED
//     if (failedPattern.test(resultCode)) {
//       console.log('❌ PAYMENT FAILED');
//       booking.paymentStatus = 'failed';
//       booking.bookingStatus = 'cancelled';
//       booking.paymentDetails = {
//         resultCode,
//         resultDescription: result.description,
//         timestamp: new Date(),
//         retrievedViaAPI: true,
//       };
//       await booking.save();
//       return res.json({ success: false, failed: true, message: result.description || 'Payment failed' });
//     }

//     // ⚠️ Unknown status
//     console.log('⚠️ Unknown result code:', resultCode);
//     return res.json({ success: false, pending: true, message: 'Processing payment...', result });

//   } catch (apiError) {
//     console.error('❌ AFS Status API Error:', apiError.message);
//     if (apiError.response) {
//       const errData = apiError.response.data;
//       const resCode = errData?.result?.code;

//       if (resCode && resCode.startsWith('200.300')) {
//         console.log('⚠️ Parameter error from AFS:', errData.result.parameterErrors);
//         await BookingModel.findByIdAndUpdate(req.query.bookingId, {
//           paymentStatus: 'failed',
//           bookingStatus: 'cancelled',
//           paymentDetails: {
//             resultCode: resCode,
//             resultDescription: errData.result.description,
//             parameterErrors: errData.result.parameterErrors,
//             timestamp: new Date(),
//             retrievedViaAPI: true,
//           },
//         });
//         return res.json({
//           success: false,
//           failed: true,
//           message: 'Payment invalid / parameter error',
//           details: { code: resCode, description: errData.result.description },
//         });
//       }

//       if (apiError.response.status === 404) {
//         return res.json({ success: false, cancelled: true, message: 'Payment not completed' });
//       }
//     }

//     console.error('❌ Verification Error:', apiError);
//     return res.status(500).json({ success: false, message: 'Verification failed' });
//   }
// };


export const verifyAFSPayment = async (req, res) => {
  try {
    const { resourcePath: resourcePathQuery, id, bookingId } = req.query;
    console.log('🔍 Verify payment:', { resourcePath: resourcePathQuery, id, bookingId });

    if (!bookingId) return res.status(400).json({ success: false, message: 'Booking ID required' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ FIX: Populate property here
    const booking = await BookingModel.findById(bookingId).populate('property');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.user.toString() !== decoded.id) return res.status(403).json({ message: 'Not authorized' });

    // Return early if already processed
    if (booking.paymentStatus === 'confirmed') return res.json({ success: true, confirmed: true, booking });
    if (booking.paymentStatus === 'failed') return res.json({ success: false, failed: true, message: booking.paymentDetails?.resultDescription });

    let resourcePath = resourcePathQuery || booking.paymentResourcePath || null;
    const afsBaseUrl = process.env.AFS_TEST_MODE === 'true' ? 'https://test.oppwa.com' : 'https://eu-prod.oppwa.com';
    let statusUrl = null;

    if (resourcePath) {
      if (!resourcePath.startsWith('/')) resourcePath = `/${resourcePath}`;
      statusUrl = `${afsBaseUrl}${resourcePath.split('?')[0]}?entityId=${process.env.AFS_ENTITY_ID}`;
    } else if (id) {
      statusUrl = `${afsBaseUrl}/v1/payments/${encodeURIComponent(id)}?entityId=${process.env.AFS_ENTITY_ID}`;
    } else {
      return res.status(400).json({ success: false, message: 'resourcePath or id required to verify payment' });
    }

    console.log('📤 Querying AFS Status:', statusUrl);

    const statusResponse = await axios.get(statusUrl, {
      headers: { Authorization: `Bearer ${process.env.AFS_ACCESS_TOKEN}` },
      timeout: 15000,
    });

    console.log('📥 AFS Status Response:', JSON.stringify(statusResponse.data, null, 2));
    const result = statusResponse.data.result || {};
    const resultCode = result.code;

    if (!resultCode) return res.json({ success: false, pending: true, message: 'Processing payment...' });

    console.log('📊 Result Code:', resultCode, '-', result.description);

    const successPattern = /^(000\.000\.|000\.100\.1|000\.[36])/;
    const pendingPattern = /^(000\.200)/;
    const failedPattern = /^(000\.400|800\.|900\.|100\.)/;

    // ✅ SUCCESS
    if (successPattern.test(resultCode)) {
      console.log('✅ PAYMENT SUCCESS');

      booking.paymentTransactionId = statusResponse.data.id;
      booking.paymentDetails = {
        paymentBrand: statusResponse.data.paymentBrand,
        amount: parseFloat(statusResponse.data.amount || 0),
        currency: statusResponse.data.currency,
        resultCode: resultCode,
        resultDescription: result.description,
        timestamp: new Date(),
        retrievedViaAPI: true,
      };
      booking.paymentStatus = 'confirmed';
      booking.bookingStatus = 'confirmed';
      booking.paymentMethod = 'online-payment';
      booking.expiresAt = undefined;
      await booking.save();

      // Update property availability
      await PropertyModel.findByIdAndUpdate(booking.property._id, {
        $push: {
          'availability.unavailableDates': {
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
          },
        },
      });

      // ✅ FIX: Send email with proper property data
      const property = booking.property; // Already populated above
      const emailHtml = generatePaymentSuccessEmailTemplate(booking, property, statusResponse.data);
      
      sendEmail(
        booking.guestEmail, 
        'Payment Successful - Wavescation Booking Confirmed', 
        emailHtml
      ).catch((err) => console.error('📧 Email error:', err));

      return res.json({
        success: true,
        confirmed: true,
        booking,
        message: 'Payment confirmed without webhook',
      });
    }

    // ⏳ PENDING
    if (pendingPattern.test(resultCode)) {
      console.log('⏳ Payment still pending');
      return res.json({ success: false, pending: true, message: 'Waiting for payment submission...' });
    }

    // ❌ FAILED
    if (failedPattern.test(resultCode)) {
      console.log('❌ PAYMENT FAILED');
      booking.paymentStatus = 'failed';
      booking.bookingStatus = 'cancelled';
      booking.paymentDetails = {
        resultCode,
        resultDescription: result.description,
        timestamp: new Date(),
        retrievedViaAPI: true,
      };
      await booking.save();
      return res.json({ success: false, failed: true, message: result.description || 'Payment failed' });
    }

    // ⚠️ Unknown status
    console.log('⚠️ Unknown result code:', resultCode);
    return res.json({ success: false, pending: true, message: 'Processing payment...', result });

  } catch (apiError) {
    console.error('❌ AFS Status API Error:', apiError.message);
    if (apiError.response) {
      const errData = apiError.response.data;
      const resCode = errData?.result?.code;

      if (resCode && resCode.startsWith('200.300')) {
        console.log('⚠️ Parameter error from AFS:', errData.result.parameterErrors);
        await BookingModel.findByIdAndUpdate(req.query.bookingId, {
          paymentStatus: 'failed',
          bookingStatus: 'cancelled',
          paymentDetails: {
            resultCode: resCode,
            resultDescription: errData.result.description,
            parameterErrors: errData.result.parameterErrors,
            timestamp: new Date(),
            retrievedViaAPI: true,
          },
        });
        return res.json({
          success: false,
          failed: true,
          message: 'Payment invalid / parameter error',
          details: { code: resCode, description: errData.result.description },
        });
      }

      if (apiError.response.status === 404) {
        return res.json({ success: false, cancelled: true, message: 'Payment not completed' });
      }
    }

    console.error('❌ Verification Error:', apiError);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};



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

    console.log('📊 Poll:', booking.paymentStatus);

    res.json({
      bookingId: booking._id,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      confirmed: booking.paymentStatus === "confirmed",
      failed: booking.paymentStatus === "failed",
      pending: booking.paymentStatus === "pending"
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check status' });
  }
};


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




// Add these improved email template functions to your controller file

function generatePaymentSuccessEmailTemplate(booking, property, paymentData) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (amount) => {
    return `AED ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #e67300 0%, #ff8c1a 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .success-icon { width: 60px; height: 60px; margin: 0 auto 15px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .checkmark { color: white; font-size: 36px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
        .message { font-size: 16px; color: #666; line-height: 1.6; margin-bottom: 30px; }
        .details-box { background: linear-gradient(to right, #fff5eb 0%, #ffffff 100%); border-left: 4px solid #e67300; padding: 25px; margin: 25px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .details-title { color: #e67300; font-size: 20px; font-weight: 600; margin: 0 0 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #666; font-size: 14px; font-weight: 500; }
        .detail-value { color: #333; font-size: 14px; font-weight: 600; text-align: right; }
        .property-name { color: #e67300; font-size: 16px; font-weight: 600; }
        .total-row { background-color: #fff5eb; margin: -25px -25px 0 -25px; padding: 20px 25px; border-radius: 0 0 8px 8px; }
        .total-label { color: #e67300; font-size: 16px; font-weight: 700; }
        .total-value { color: #e67300; font-size: 20px; font-weight: 700; }
        .payment-info { background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .payment-info-title { color: #2e7d32; font-size: 16px; font-weight: 600; margin: 0 0 10px 0; }
        .payment-info-text { color: #555; font-size: 14px; margin: 5px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #e67300 0%, #ff8c1a 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-weight: 600; margin: 20px 0; text-align: center; box-shadow: 0 4px 8px rgba(230, 115, 0, 0.3); }
        .footer { background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; }
        .footer-text { color: #999; font-size: 13px; line-height: 1.6; margin: 5px 0; }
        .social-links { margin: 20px 0; }
        .social-link { display: inline-block; margin: 0 10px; color: #e67300; text-decoration: none; font-size: 14px; }
        @media only screen and (max-width: 600px) {
          .content { padding: 25px 20px; }
          .details-box { padding: 20px; }
          .detail-row { flex-direction: column; gap: 5px; }
          .detail-value { text-align: left; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="success-icon">
            <div class="checkmark">✓</div>
          </div>
          <h1>Payment Successful!</h1>
        </div>

        <!-- Content -->
        <div class="content">
          <div class="greeting">Hi ${booking.guestName || 'Guest'},</div>
          
          <div class="message">
            Great news! Your payment has been processed successfully and your booking is now confirmed. 
            Get ready for an amazing stay with Wavescation!
          </div>

          <!-- Payment Info -->
          <div class="payment-info">
            <div class="payment-info-title">✓ Payment Confirmed</div>
            <div class="payment-info-text"><strong>Transaction ID:</strong> ${paymentData.id || booking.paymentTransactionId}</div>
            <div class="payment-info-text"><strong>Payment Method:</strong> ${paymentData.paymentBrand || 'Online Payment'}</div>
            <div class="payment-info-text"><strong>Date:</strong> ${formatDate(new Date())}</div>
          </div>

          <!-- Booking Details -->
          <div class="details-box">
            <div class="details-title">Booking Details</div>
            
            <div class="detail-row">
              <span class="detail-label">Booking ID</span>
              <span class="detail-value">${booking._id}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Property</span>
              <span class="detail-value property-name">${property?.name || 'Wavescation Property'}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Check-in</span>
              <span class="detail-value">${formatDate(booking.checkIn)}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Check-out</span>
              <span class="detail-value">${formatDate(booking.checkOut)}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Guests</span>
              <span class="detail-value">${booking.guests}</span>
            </div>

            ${booking.subtotal ? `
            <div class="detail-row">
              <span class="detail-label">Subtotal</span>
              <span class="detail-value">${formatCurrency(booking.subtotal)}</span>
            </div>
            ` : ''}

            ${booking.cleaningFee ? `
            <div class="detail-row">
              <span class="detail-label">Cleaning Fee</span>
              <span class="detail-value">${formatCurrency(booking.cleaningFee)}</span>
            </div>
            ` : ''}

            ${booking.serviceFee ? `
            <div class="detail-row">
              <span class="detail-label">Service Fee</span>
              <span class="detail-value">${formatCurrency(booking.serviceFee)}</span>
            </div>
            ` : ''}

            ${booking.cityTax ? `
            <div class="detail-row">
              <span class="detail-label">City Tax</span>
              <span class="detail-value">${formatCurrency(booking.cityTax)}</span>
            </div>
            ` : ''}

            ${booking.vat ? `
            <div class="detail-row">
              <span class="detail-label">VAT</span>
              <span class="detail-value">${formatCurrency(booking.vat)}</span>
            </div>
            ` : ''}

            <div class="total-row">
              <div class="detail-row" style="border: none; padding: 0;">
                <span class="total-label">Total Amount Paid</span>
                <span class="total-value">${formatCurrency(booking.totalPrice)}</span>
              </div>
            </div>
          </div>

          <div style="text-align: center;">
            <a href="https://www.wavescation.com/profile" class="cta-button">View My Bookings</a>
          </div>

          <div class="message" style="margin-top: 30px;">
            <strong>What's Next?</strong><br>
            • You'll receive check-in instructions 24 hours before your arrival<br>
            • Keep this email for your records<br>
            • Contact us anytime if you have questions
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-text">
            <strong>Need Help?</strong><br>
            Contact us at support@wavescation.com<br>
            or visit our website
          </div>
          
          <div class="social-links">
            <a href="#" class="social-link">Facebook</a>
            <a href="#" class="social-link">Instagram</a>
            <a href="#" class="social-link">Twitter</a>
          </div>

          <div class="footer-text">
            © ${new Date().getFullYear()} Wavescation. All rights reserved.<br>
            This is an automated email. Please do not reply directly to this message.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Updated function for "Pay at Property" bookings
function generateConfirmationEmailTemplate(booking, property, paymentMethod) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (amount) => {
    return `AED ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isPayAtProperty = paymentMethod === 'pay-at-property';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #e67300 0%, #ff8c1a 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
        .message { font-size: 16px; color: #666; line-height: 1.6; margin-bottom: 30px; }
        .details-box { background: linear-gradient(to right, #fff5eb 0%, #ffffff 100%); border-left: 4px solid #e67300; padding: 25px; margin: 25px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .details-title { color: #e67300; font-size: 20px; font-weight: 600; margin: 0 0 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #666; font-size: 14px; font-weight: 500; }
        .detail-value { color: #333; font-size: 14px; font-weight: 600; text-align: right; }
        .property-name { color: #e67300; font-size: 16px; font-weight: 600; }
        .total-row { background-color: #fff5eb; margin: -25px -25px 0 -25px; padding: 20px 25px; border-radius: 0 0 8px 8px; }
        .total-label { color: #e67300; font-size: 16px; font-weight: 700; }
        .total-value { color: #e67300; font-size: 20px; font-weight: 700; }
        .payment-note { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 25px 0; border-radius: 8px; }
        .payment-note-title { color: #856404; font-size: 16px; font-weight: 600; margin: 0 0 10px 0; }
        .payment-note-text { color: #856404; font-size: 14px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #e67300 0%, #ff8c1a 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-weight: 600; margin: 20px 0; text-align: center; box-shadow: 0 4px 8px rgba(230, 115, 0, 0.3); }
        .footer { background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; }
        .footer-text { color: #999; font-size: 13px; line-height: 1.6; margin: 5px 0; }
        @media only screen and (max-width: 600px) {
          .content { padding: 25px 20px; }
          .details-box { padding: 20px; }
          .detail-row { flex-direction: column; gap: 5px; }
          .detail-value { text-align: left; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmed!</h1>
        </div>

        <div class="content">
          <div class="greeting">Hi ${booking.guestName || 'Guest'},</div>
          
          <div class="message">
            Thank you for your booking with Wavescation! Your reservation has been confirmed.
            ${isPayAtProperty ? ' Please note that payment will be collected at the property upon arrival.' : ''}
          </div>

          ${isPayAtProperty ? `
          <div class="payment-note">
            <div class="payment-note-title">💳 Payment at Property</div>
            <div class="payment-note-text">
              Please bring payment of <strong>${formatCurrency(booking.totalPrice)}</strong> 
              when you check in. We accept cash and major credit cards.
            </div>
          </div>
          ` : ''}

          <div class="details-box">
            <div class="details-title">Booking Details</div>
            
            <div class="detail-row">
              <span class="detail-label">Booking ID</span>
              <span class="detail-value">${booking._id}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Property</span>
              <span class="detail-value property-name">${property?.name || 'Wavescation Property'}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Check-in</span>
              <span class="detail-value">${formatDate(booking.checkIn)}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Check-out</span>
              <span class="detail-value">${formatDate(booking.checkOut)}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Guests</span>
              <span class="detail-value">${booking.guests}</span>
            </div>

            <div class="total-row">
              <div class="detail-row" style="border: none; padding: 0;">
                <span class="total-label">Total Amount</span>
                <span class="total-value">${formatCurrency(booking.totalPrice)}</span>
              </div>
            </div>
          </div>

          <div style="text-align: center;">
            <a href="https://www.wavescation.com/profile" class="cta-button">View My Bookings</a>
          </div>

          <div class="message" style="margin-top: 30px;">
            <strong>What's Next?</strong><br>
            • Check-in instructions will be sent 24 hours before arrival<br>
            ${isPayAtProperty ? '• Bring payment for check-in<br>' : ''}
            • Contact us if you have any questions
          </div>
        </div>

        <div class="footer">
          <div class="footer-text">
            <strong>Need Help?</strong><br>
            Email: support@wavescation.com<br>
            Visit: www.wavescation.com
          </div>
          <div class="footer-text">
            © ${new Date().getFullYear()} Wavescation. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}