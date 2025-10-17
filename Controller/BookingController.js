
import jwt from "jsonwebtoken";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import sendEmail from "../utils/SendEmail.js";

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

    
    const { name, email, phone,bookingId } = req.body;

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

          <div style="background-color: white; padding: 20px; border-left: 4px solid #e67300; margin-bottom: 20px;">
            <h3 style="color: #e67300; margin-top: 0;">What's Next?</h3>
            <ul style="margin: 0; padding-left: 20px; color: #333; font-size: 14px;">
              <li style="margin: 8px 0;">We will contact you on ${booking.guestPhone} to confirm details</li>
              <li style="margin: 8px 0;">Check the property rules and house manual</li>
              <li style="margin: 8px 0;">Arrive between 3 PM - 10 PM on check-in day</li>
              <li style="margin: 8px 0;">Check-out by 11 AM on your checkout day</li>
            </ul>
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

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized to create order for this booking" });
    }

    const options = {
      amount: amount || booking.totalPrice * 100, 
      currency: "AED",
      receipt: `booking_rcpt_${booking._id}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({ 
      orderId: order.id, 
      amount: options.amount, 
      currency: options.currency, 
      key: process.env.RAZORPAY_KEY_ID 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.user.toString() !== decoded.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    booking.paymentStatus = "confirmed";
    booking.bookingStatus = "confirmed";
    await booking.save();

    await PropertyModel.findByIdAndUpdate(booking.property, {
      $push: { "availability.unavailableDates": { checkIn: booking.checkIn, checkOut: booking.checkOut } },
    });

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    const bookings = await BookingModel.find({ user: userId, bookingStatus: ["confirmed","cancelled" ]})
      .populate("property") 
      .populate("user", "name email"); 

    res.status(200).json({ bookings, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
};