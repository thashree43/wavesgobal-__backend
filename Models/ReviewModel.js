import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // One review per booking
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    categories: {
      cleanliness: { type: Number, min: 1, max: 5, default: 0 },
      accuracy: { type: Number, min: 1, max: 5, default: 0 },
      checkIn: { type: Number, min: 1, max: 5, default: 0 },
      communication: { type: Number, min: 1, max: 5, default: 0 },
      location: { type: Number, min: 1, max: 5, default: 0 },
      value: { type: Number, min: 1, max: 5, default: 0 },
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    helpfulBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    response: {
      text: String,
      date: Date,
    },
    status: {
      type: String,
      enum: ["active", "hidden", "reported"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ property: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

reviewSchema.pre("save", function (next) {
  if (this.isNew && this.rating) {
    const baseRating = this.rating;
    const categories = this.categories;
    
    if (!categories.cleanliness) categories.cleanliness = baseRating;
    if (!categories.accuracy) categories.accuracy = baseRating;
    if (!categories.checkIn) categories.checkIn = baseRating;
    if (!categories.communication) categories.communication = baseRating;
    if (!categories.location) categories.location = baseRating;
    if (!categories.value) categories.value = baseRating;
  }
  next();
});

const ReviewModel = mongoose.model("Review", reviewSchema);

export default ReviewModel;