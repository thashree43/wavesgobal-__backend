import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,userlogout, getUser, updateuser, updatePass, forgotPassword, validateResetToken, resetPassword, VerifyOtp, ResendOtp} from "../Controller/AuthController.js"
import {getLocation, getproperties, getproperty} from "../Controller/Propertiescontroller.js"
import { bookingbyuser, createBooking, updateBookingDetails, confirmBooking, getCheckout, cancelBooking, initializeAFSPayment, verifyAFSPayment, handleAFSWebhook, checkPaymentStatus} from "../Controller/BookingController.js";
import { googleAuth } from "../Controller/GoogleAuthController.js";
import { submitReview,  getPropertyReviews,  markReviewHelpful, getUserReviews,  updateReview,  deleteReview } from "../Controller/ReviewController.js";
dotenv.config();

const router = express.Router();

// Auth routes
router.post("/login",Userlogin)
router.post("/register",UserRegister)
router.post("/verify-otp",VerifyOtp)
router.post("/resend-otp",ResendOtp)
router.post("/logout",userlogout)
router.get("/getuser",getUser)
router.put("/updateuser",updateuser)
router.put("/changepassword",updatePass)
router.post("/forgot-password", forgotPassword)
router.get("/validate-reset-token/:token", validateResetToken)
router.post("/reset-password", resetPassword)

// Property routes
router.get('/location',getLocation)
router.get("/properties",getproperties)
router.get("/property/:id",getproperty)

// Booking routes
router.post("/add-booking",createBooking)
router.put("/update-details", updateBookingDetails)
router.post("/confirm-booking", confirmBooking)
router.get('/checkout',getCheckout);
router.get("/get-booking",bookingbyuser)
router.put('/cancel-booking/:bookingId',cancelBooking)

// Payment routes
router.post("/initialize-afs-payment", initializeAFSPayment);
router.get("/verify-payment", verifyAFSPayment); // CRITICAL: Called after payment redirect
router.post("/afs-webhook", handleAFSWebhook);   
router.get("/payment-status/:bookingId", checkPaymentStatus);

// Google Auth
router.post("/google-auth", googleAuth);

// Review routes
router.post("/:bookingId/review",submitReview);
router.get("/review/:propertyId", getPropertyReviews);
router.post("/review/:reviewId/helpful", markReviewHelpful);
router.get("/user-reviews", getUserReviews);
router.put("/review/:reviewId", updateReview);
router.delete("/review/:reviewId", deleteReview);

export default router;