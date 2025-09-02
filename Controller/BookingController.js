import jwt from "jsonwebtoken";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";


export const createBooking = async (req, res) => {
  try {
    const { propertyId, checkinDate, checkoutDate, guests } = req.body;
    const token = req.cookies.usertoken;

    if (!token) return res.status(401).json({ message: "No token found" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const property = await PropertyModel.findById(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const nights =
      (new Date(checkoutDate) - new Date(checkinDate)) / (1000 * 60 * 60 * 24);
    const totalPrice = nights * property.price;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const booking = await BookingModel.create({
      user: user._id,
      property: propertyId,
      checkIn: checkinDate,
      checkOut: checkoutDate,
      guests,
      totalPrice,
      bookingStatus: "pending",
      paymentStatus: "pending",
      expiresAt,
    });


    await UserModel.findByIdAndUpdate(user._id, { $push: { bookings: booking._id } });
    await PropertyModel.findByIdAndUpdate(propertyId, { $push: { bookings: booking._id } });

    res.status(201).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const token = req.cookies.usertoken;
    if (!token) return res.status(401).json({ message: "No token found" });

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
    const booking = await BookingModel.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    booking.bookingStatus = "cancelled";
    await booking.save();

    res.json({ message: "Booking cancelled successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




export const getCheckout = async (req, res) => {
  try {
    console.log("controller running");

    const token = req.cookies.usertoken;
    const propId = req.query.propertyId;

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Build query
    const query = { 
      user: decoded.id, 
      bookingStatus: "pending"  // only pending bookings
    };

    if (propId) {
      query.property = propId;
    }

    // Find latest booking
    const latestBooking = await BookingModel.findOne(query)
      .sort({ createdAt: -1 }) // get the last added booking
      .populate("property")
      .populate("user", "-password");

    if (!latestBooking) {
      return res.status(404).json({ message: "No pending bookings found" });
    }

    res.status(200).json({ booking: latestBooking });

  } catch (error) {
    console.error("Error in getCheckout:", error);
    res.status(500).json({ message: error.message });
  }
};


export const bookingbyuser = async (req, res) => {
  try {
    const { id } = req.query
    console.log("controller",req.query)
    console.log(id)

    if (!id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const bookings = await BookingModel.find({ user: id ,bookingStatus:"confirmed"})
      .populate("property") 
      .populate("user", "name email"); 

    res.status(200).json({ bookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bookings", error });
  }
};