// import jwt from "jsonwebtoken";
// import BookingModel from "../Models/BookingModel.js";
// import UserModel from "../Models/UserModel.js";
// import PropertyModel from "../Models/PropertyModel.js";
// import Razorpay from "razorpay";
// import crypto from "crypto";

// export const createBooking = async (req, res) => {
//   try {
//     console.log(req.body)
//     const { userId, propertyId, checkinDate, checkoutDate, guests, nights, totalPrice, } = req.body;

//     const user = await UserModel.findById(userId).select("-password");

//     if (!user) return res.status(404).json({ message: "User not found" });

//     const property = await PropertyModel.findById(propertyId);

//     if (!property) return res.status(404).json({ message: "Property not found" });

//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  
//     const booking = await BookingModel.create({
//       user: userId,
//       property: propertyId,
//       checkIn:checkinDate,
//       checkOut:checkoutDate,
//       guests,
//       nights,
//       totalPrice,
//       bookingStatus: "pending",
//       paymentStatus: "pending",
//       expiresAt,
//     });
//     console.log("first")


//     console.log(booking)

//     await UserModel.findByIdAndUpdate(userId, { $push: { bookings: booking._id } });
//     await PropertyModel.findByIdAndUpdate(propertyId, { $push: { bookings: booking._id } });

//     res.status(201).json({ success: true, booking });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// export const confirmBooking = async (req, res) => {
//   try {
//     const { bookingId } = req.body;
//     const token = req.cookies.usertoken;
//     if (!token) return res.status(401).json({ message: "No token found" });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const booking = await BookingModel.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: "Booking not found" });

//     if (booking.user.toString() !== decoded.id) {
//       return res.status(403).json({ message: "Not authorized" });
//     }

//     if (booking.expiresAt && booking.expiresAt < new Date()) {
//       booking.bookingStatus = "cancelled";
//       await booking.save();
//       return res.status(400).json({ message: "Booking expired" });
//     }

//     booking.paymentStatus = "paid";
//     booking.bookingStatus = "confirmed";
//     await booking.save();

//     await PropertyModel.findByIdAndUpdate(booking.property, {
//       $push: { "availability.unavailableDates": { checkIn: booking.checkIn, checkOut: booking.checkOut } },
//     });

//     res.json({ success: true, booking });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// export const cancelBooking = async (req, res) => {
//   try {
//     const booking = await BookingModel.findById(req.params.id);
//     if (!booking) return res.status(404).json({ message: "Booking not found" });

//     if (booking.user.toString() !== req.user.id) {
//       return res.status(403).json({ message: "Not authorized" });
//     }

//     booking.bookingStatus = "cancelled";
//     await booking.save();

//     res.json({ message: "Booking cancelled successfully" });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// export const getCheckout = async (req, res) => {
//   try {
//     const { propertyId } = req.query;
//     const token = req.cookies.usertoken;

//     if (!token) return res.status(401).json({ message: "Unauthorized" });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     const user = await UserModel.findById(decoded.id).select("-password");
//     const property = await PropertyModel.findById(propertyId);

//     if (!property) {
//       return res.status(404).json({ message: "Property not found" });
//     }

//     res.status(200).json({ 
//       propertyData: property,
//       userData: user
//     });

//   } catch (error) {
//     console.error("Error in getCheckout:", error);
//     res.status(500).json({ message: error.message });
//   }
// };

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// export const createRazorpayOrder = async (req, res) => {
//   try {
//     const { bookingId, amount } = req.body;


//     const booking = await BookingModel.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: "Booking not found" });

//     const options = {
//       amount: amount || booking.totalPrice * 100, 
//       currency: "AED",
//       receipt: `booking_rcpt_${booking._id}`,
//     };
//     console.log(options)

//     const order = await razorpay.orders.create(options);
//     console.log(order,"herr")

//     res.json({ 
//       orderId: order.id, 
//       amount: options.amount, 
//       currency: options.currency, 
//       key: process.env.RAZORPAY_KEY_ID 
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// export const verifyPayment = async (req, res) => {
//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

//     const body = razorpay_order_id + "|" + razorpay_payment_id;

//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body.toString())
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ message: "Invalid payment signature" });
//     }

//     const booking = await BookingModel.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: "Booking not found" });

//     booking.paymentStatus = "confirmed";
//     booking.bookingStatus = "confirmed";
//     await booking.save();

//     await PropertyModel.findByIdAndUpdate(booking.property, {
//       $push: { "availability.unavailableDates": { checkIn: booking.checkIn, checkOut: booking.checkOut } },
//     });

//     res.json({ success: true, booking });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// export const bookingbyuser = async (req, res) => {
//   try {
//     const { id } = req.query;

//     if (!id) {
//       return res.status(400).json({ message: "User ID is required" });
//     }

//     const bookings = await BookingModel.find({ user: id, bookingStatus: "confirmed" })
//       .populate("property") 
//       .populate("user", "name email"); 

//     res.status(200).json({ bookings });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Failed to fetch bookings", error });
//   }
// };

// const datas = 2




import jwt from "jsonwebtoken";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";

export const createBooking = async (req, res) => {
  try {
    console.log(req.body);
    const { userId, propertyId, checkinDate, checkoutDate, guests, nights, totalPrice } = req.body;

    const user = await UserModel.findById(userId).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    const property = await PropertyModel.findById(propertyId);

    if (!property) return res.status(404).json({ message: "Property not found" });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  
    const booking = await BookingModel.create({
      user: userId,
      property: propertyId,
      checkIn: checkinDate,
      checkOut: checkoutDate,
      guests,
      nights,
      totalPrice,
      bookingStatus: "pending",
      paymentStatus: "pending",
      expiresAt,
    });
    console.log("first");

    console.log(booking);

    await UserModel.findByIdAndUpdate(userId, { $push: { bookings: booking._id } });
    await PropertyModel.findByIdAndUpdate(propertyId, { $push: { bookings: booking._id } });

    res.status(201).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
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

    booking.paymentStatus = "paid";
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

export const cancelBooking = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const booking = await BookingModel.findById(req.params.id);
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
    const { propertyId } = req.query;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await UserModel.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    const property = await PropertyModel.findById(propertyId);

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json({ 
      propertyData: property,
      userData: user
    });

  } catch (error) {
    console.error("Error in getCheckout:", error);
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
    console.log(options);

    const order = await razorpay.orders.create(options);
    console.log(order, "here");

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

    // Verify that the requested user ID matches the authenticated user
    if (id && id !== decoded.id) {
      return res.status(403).json({ message: "Not authorized to view other user's bookings" });
    }

    const userId = id || decoded.id;

    const bookings = await BookingModel.find({ user: userId, bookingStatus: "confirmed" })
      .populate("property") 
      .populate("user", "name email"); 

    res.status(200).json({ bookings, success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
};

