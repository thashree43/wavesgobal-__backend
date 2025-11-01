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
    enum: ["pending", "pending-verification", "pendingWebhook", "confirmed", "failed", "refunded"],
    default: "pending",
  },
  bookingStatus: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed", "no-show"],
    default: "pending", 
  },
  
  // ✅ Payment gateway fields
  paymentCheckoutId: { type: String }, // Checkout ID from AFS
  paymentTransactionId: { type: String }, // Final transaction ID from AFS
  
  // ✅ UPDATED: More comprehensive payment details
  paymentDetails: {
    paymentBrand: { type: String }, // e.g., "VISA", "MASTER"
    amount: { type: Number }, // Changed from String to Number for consistency
    currency: { type: String }, // e.g., "AED"
    resultCode: { type: String }, // AFS result code
    resultDescription: { type: String }, // AFS result description
    
    // Card details (partial, for reference)
    cardBin: { type: String }, // First 6 digits
    cardLast4: { type: String }, // Last 4 digits (changed from last4Digits for consistency)
    
    // Additional tracking
    timestamp: { type: Date }, // Changed from String to Date
    webhookReceived: { type: Boolean, default: false }, // Track if webhook was received
    webhookReceivedAt: { type: Date }, // When webhook was received
  },
  
  // ✅ NEW: Payment attempts tracking (useful for debugging)
  paymentAttempts: [{
    checkoutId: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String }, // "initiated", "failed", "success"
    resultCode: { type: String },
    resultDescription: { type: String }
  }],
  
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

// Index for faster queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ property: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ expiresAt: 1 });

// ✅ NEW: Index for payment tracking
bookingSchema.index({ paymentCheckoutId: 1 });
bookingSchema.index({ paymentTransactionId: 1 });

// Auto-expire pending bookings
bookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ✅ NEW: Pre-save middleware to track payment attempts
bookingSchema.pre('save', function(next) {
  // If paymentCheckoutId is being set for the first time
  if (this.isModified('paymentCheckoutId') && this.paymentCheckoutId) {
    // Check if this checkout ID is already in attempts
    const exists = this.paymentAttempts?.some(
      attempt => attempt.checkoutId === this.paymentCheckoutId
    );
    
    if (!exists) {
      if (!this.paymentAttempts) {
        this.paymentAttempts = [];
      }
      this.paymentAttempts.push({
        checkoutId: this.paymentCheckoutId,
        timestamp: new Date(),
        status: 'initiated'
      });
    }
  }
  next();
});

// ✅ NEW: Instance method to update payment status from webhook
bookingSchema.methods.updatePaymentFromWebhook = function(webhookData) {
  const { id, result, amount, currency, paymentBrand, card } = webhookData;
  
  this.paymentTransactionId = id;
  this.paymentDetails = {
    paymentBrand: paymentBrand,
    amount: parseFloat(amount),
    currency: currency,
    resultCode: result.code,
    resultDescription: result.description,
    cardBin: card?.bin,
    cardLast4: card?.last4Digits,
    timestamp: new Date(),
    webhookReceived: true,
    webhookReceivedAt: new Date()
  };
  
  // Update payment attempt status
  if (this.paymentAttempts?.length > 0) {
    const lastAttempt = this.paymentAttempts[this.paymentAttempts.length - 1];
    lastAttempt.status = result.code.match(/^(000\.000\.|000\.100\.1|000\.[36])/) ? 'success' : 'failed';
    lastAttempt.resultCode = result.code;
    lastAttempt.resultDescription = result.description;
  }
  
  return this;
};

// ✅ NEW: Static method to find booking by checkout or transaction ID
bookingSchema.statics.findByPaymentId = function(paymentId) {
  return this.findOne({
    $or: [
      { paymentCheckoutId: paymentId },
      { paymentTransactionId: paymentId }
    ]
  });
};

// ✅ NEW: Instance method to check if payment is confirmed
bookingSchema.methods.isPaymentConfirmed = function() {
  return this.paymentStatus === 'confirmed' && this.bookingStatus === 'confirmed';
};

// ✅ NEW: Instance method to check if booking is still valid (not expired)
bookingSchema.methods.isValid = function() {
  if (!this.expiresAt) return true; // No expiration set
  return new Date() < this.expiresAt;
};

const BookingModel = mongoose.model("Booking", bookingSchema);
export default BookingModel;