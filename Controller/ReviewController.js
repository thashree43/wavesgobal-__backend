import ReviewModel from "../Models/ReviewModel.js";
import BookingModel from "../Models/BookingModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import mongoose from "mongoose";
import UserModel from "../Models/UserModel.js";
import jwt from "jsonwebtoken";


export const submitReview = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, review, categories } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });
    const userId = user._id

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: "Booking not found" 
      });
    }

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: "Unauthorized to review this booking" 
      });
    }

    if (!booking.checkedOut) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot review booking before checkout" 
      });
    }

    if (booking.rated) {
      return res.status(400).json({ 
        success: false, 
        message: "Booking already reviewed" 
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: "Rating must be between 1 and 5" 
      });
    }

    const newReview = new ReviewModel({
      booking: bookingId,
      property: booking.property,
      user: userId,
      rating: Number(rating),
      review: review || "",
      categories: categories || {},
    });

    await newReview.save();

    booking.rated = true;
    booking.reviewId = newReview._id;
    await booking.save();

    await updatePropertyRatings(booking.property);

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: newReview,
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit review",
      error: error.message,
    });
  }
};

export const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, totalCount, property] = await Promise.all([
      ReviewModel.find({ 
        property: propertyId, 
        status: "active" 
      })
        .populate("user", "name email")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ReviewModel.countDocuments({ 
        property: propertyId, 
        status: "active" 
      }),
      PropertyModel.findById(propertyId)
        .select("ratings")
        .lean(),
    ]);

    const formattedReviews = reviews.map(review => ({
      _id: review._id,
      userName: review.user?.name || "Anonymous",
      userEmail: review.user?.email,
      userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user?.name || 'user'}`,
      rating: review.rating,
      date: review.createdAt,
      comment: review.review,
      helpfulCount: review.helpfulCount,
      categories: review.categories,
    }));

    res.status(200).json({
      success: true,
      reviews: formattedReviews,
      stats: property?.ratings || {
        average: 0,
        total: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        categories: {
          cleanliness: 0,
          accuracy: 0,
          checkIn: 0,
          communication: 0,
          location: 0,
          value: 0,
        },
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalReviews: totalCount,
        hasMore: skip + reviews.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
};

export const markReviewHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    console.log(token)
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    console.log(user)
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });
    const userId = user._id

    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }
    const alreadyMarked = review.helpfulBy.includes(userId);

    if (alreadyMarked) {
      review.helpfulBy = review.helpfulBy.filter(
        id => id.toString() !== userId.toString()
      );
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add to helpful
      review.helpfulBy.push(userId);
      review.helpfulCount += 1;
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: alreadyMarked ? "Removed from helpful" : "Marked as helpful",
      helpfulCount: review.helpfulCount,
      isHelpful: !alreadyMarked,
    });
  } catch (error) {
    console.error("Error marking review helpful:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update review",
      error: error.message,
    });
  }
};

async function updatePropertyRatings(propertyId) {
  try {
    const reviews = await ReviewModel.find({
      property: propertyId,
      status: "active",
    }).lean();

    if (reviews.length === 0) {
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const average = totalRating / reviews.length;

    const breakdown = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };

    const categories = {
      cleanliness: 0,
      accuracy: 0,
      checkIn: 0,
      communication: 0,
      location: 0,
      value: 0,
    };

    reviews.forEach(review => {
      Object.keys(categories).forEach(category => {
        if (review.categories && review.categories[category]) {
          categories[category] += review.categories[category];
        }
      });
    });

    Object.keys(categories).forEach(category => {
      categories[category] = Number((categories[category] / reviews.length).toFixed(1));
    });

    // Update property
    await PropertyModel.findByIdAndUpdate(propertyId, {
      $set: {
        "ratings.average": Number(average.toFixed(1)),
        "ratings.total": reviews.length,
        "ratings.breakdown": breakdown,
        "ratings.categories": categories,
      },
      $addToSet: {
        reviews: { $each: reviews.map(r => r._id) },
      },
    });

  } catch (error) {
    console.error("Error updating property ratings:", error);
    throw error;
  }
}

export const getUserReviews = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    console.log(token)
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    console.log(user)
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });
    const userId = user._id   
     const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, totalCount] = await Promise.all([
      ReviewModel.find({ user: userId })
        .populate("property", "title location images")
        .populate("booking", "checkIn checkOut")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ReviewModel.countDocuments({ user: userId }),
    ]);

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalReviews: totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
      error: error.message,
    });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, review, categories } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    console.log(token)
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    console.log(user)
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });
    const userId = user._id
    const existingReview = await ReviewModel.findById(reviewId);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check ownership
    if (existingReview.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to update this review",
      });
    }

    // Update fields
    if (rating) existingReview.rating = Number(rating);
    if (review !== undefined) existingReview.review = review;
    if (categories) existingReview.categories = { ...existingReview.categories, ...categories };

    await existingReview.save();

    // Update property ratings
    await updatePropertyRatings(existingReview.property);

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      review: existingReview,
    });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update review",
      error: error.message,
    });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];
    console.log(token)
    if (!token) return res.status(401).json({ message: "Unauthorized, token not found" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    console.log(user)
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account has been blocked" });
    const userId = user._id
    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check ownership
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this review",
      });
    }

    const propertyId = review.property;

    // Update booking
    await BookingModel.findByIdAndUpdate(review.booking, {
      rated: false,
      reviewId: null,
    });

    // Delete review
    await ReviewModel.findByIdAndDelete(reviewId);

    // Update property ratings
    await updatePropertyRatings(propertyId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete review",
      error: error.message,
    });
  }
};