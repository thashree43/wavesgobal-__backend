import cron from "node-cron";
import BookingModel from "../Models/BookingModel.js";
import UserModel from "../Models/UserModel.js";
import PropertyModel from "../Models/PropertyModel.js";

cron.schedule("*/10 * * * * *", async () => {
  console.log("⏰ Running cleanup for unconfirmed bookings...");
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const oldBookings = await BookingModel.find({
      bookingStatus: { $nin: ["confirmed","cancelled"]},
      createdAt: { $lt: fifteenMinutesAgo },
    });

    if (oldBookings.length === 0) {
      console.log("✅ No old unconfirmed bookings found");
      return;
    }

    const bookingIds = oldBookings.map(b => b._id);

    const result = await BookingModel.deleteMany({ _id: { $in: bookingIds } });
    console.log(`🗑️ Deleted ${result.deletedCount} unconfirmed bookings older than 15 minutes`);

    await UserModel.updateMany(
      { bookings: { $in: bookingIds } },
      { $pull: { bookings: { $in: bookingIds } } }
    );

    await PropertyModel.updateMany(
      { bookings: { $in: bookingIds } },
      { $pull: { bookings: { $in: bookingIds } } }
    );

    console.log("✅ Cleanup complete for Users and Properties.");
  } catch (error) {
    console.error("❌ Error during cleanup:", error.message);
  }
});
