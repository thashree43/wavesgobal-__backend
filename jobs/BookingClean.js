import cron from "node-cron";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";

cron.schedule("*/10 * * * * *", async () => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Find unconfirmed and not cancelled bookings older than 15 minutes
    const oldBookings = await BookingModel.find({
      bookingStatus: { $nin: ["confirmed", "cancelled"] },
      createdAt: { $lt: fifteenMinutesAgo },
    });

    if (!oldBookings.length) return;

    const bookingIds = oldBookings.map((b) => b._id);

    // Remove booking references from users
    await UserModel.updateMany(
      { bookings: { $in: bookingIds } },
      { $pull: { bookings: { $in: bookingIds } } }
    );

    // Remove booking references from properties
    await PropertyModel.updateMany(
      { bookings: { $in: bookingIds } },
      { $pull: { bookings: { $in: bookingIds } } }
    );

    // Now safely delete the old bookings
    const result = await BookingModel.deleteMany({ _id: { $in: bookingIds } });

    console.log(`🗑️ Deleted ${result.deletedCount} unconfirmed bookings older than 15 minutes`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error.message);
  }
});
