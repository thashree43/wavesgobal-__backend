import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  checkIn: { type: String, required: true },
  checkOut: { type: String, required: true },
  guests: { type: Number, required: true, min: 1 },
  pricingPeriod: { 
    type: String, 
    enum: ["night", "week", "month", "year"], 
    required: true 
  },
  units: { type: Number, required: true, min: 1 },
  pricePerUnit: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  cleaningFee: { type: Number, default: 0 },
  serviceFee: { type: Number, default: 0 },
  cityTax: { type: Number, default: 0 },
  vat: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },
  guestPhone: { type: String },
  guestEmail: { type: String },
  guestName: { type: String },
  paymentMethod: {
    type: String,
    enum: ["online-payment", "netbanking", "pay-at-property"],
    default: "pay-at-property"
  },
  advancePaymentPaid: { type: Boolean, default: false },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending",
  },
  bookingStatus: {
    type: String,
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending", 
  },
  expiresAt: { type: Date },
  checkedOut: { type: Boolean, default: false },
  rated: {
    type: Boolean,
    default: false,
  },
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review",
  }
}, { timestamps: true });

const BookingModel = mongoose.model("Booking", bookingSchema);
export default BookingModel;