import BookingModel from "../Models/BookingModel";

export const getMyBookings = async (req, res) => {
    try {
      const bookings = await BookingModel.find({ user: req.user.id }).populate("property");
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  