import cron from "node-cron";
import BookingModel from "./Models/BookingModel.js";

cron.schedule("*/5 * * * *", async () => {
  console.log("⏰ Running expired bookings cleanup...");
  try {
    const now = new Date();
    const result = await BookingModel.updateMany(
      { bookingStatus: "pending", expiresAt: { $lt: now } },
      { $set: { bookingStatus: "cancelled" } }
    );
    if (result.modifiedCount > 0) {
      console.log(`❌ Cancelled ${result.modifiedCount} expired bookings`);
    }
  } catch (error) {
    console.error("Error cleaning expired bookings:", error.message);
  }
});
