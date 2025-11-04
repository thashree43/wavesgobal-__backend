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

    // Redirect URL for live only
    if (process.env.AFS_TEST_MODE !== 'true') {
      params.append('shopperResultUrl', shopperResultUrl);
    }

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



export const verifyAFSPayment = async (req, res) => {
  try {
    const { resourcePath: resourcePathQuery, id, bookingId } = req.query;
    console.log('🔍 Verify payment:', { resourcePath: resourcePathQuery, id, bookingId });

    if (!bookingId) return res.status(400).json({ success: false, message: 'Booking ID required' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

      // ✅ Immediate DB update (no webhook needed)
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

      // Send email asynchronously
      sendEmail(booking.guestEmail, 'Payment Successful - Wavescation', /* html omitted */)
        .catch((err) => console.error('📧 Email error:', err));

      // ✅ Added: respond immediately as confirmed
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