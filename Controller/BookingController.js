import jwt from "jsonwebtoken";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";

export const createBooking = async (req, res) => {
  try {

    console.log(req.body,"this be the body ")
    const { propertyId, checkIn, checkOut, guests } = req.body;
    const token = req.cookies.usertoken;

    if (!token) {
      return res.status(401).json({ message: "No token found" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    const property = await PropertyModel.findById(propertyId);

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const nights =
      (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24);
    const totalPrice = nights * property.price;

    const booking = await BookingModel.create({
      user: user._id,
      property: propertyId,
      checkIn,
      checkOut,
      guests,
      totalPrice,
    });

    await UserModel.findByIdAndUpdate(user._id, { $push: { bookings: booking._id } });
    await PropertyModel.findByIdAndUpdate(propertyId, { $push: { bookings: booking._id } });

    res.status(201).json(booking);
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