import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,userlogout, getUser, updateuser, updatePass, forgotPassword, validateResetToken, resetPassword, VerifyOtp, ResendOtp} from "../Controller/AuthController.js"
import {getLocation, getproperties, getproperty} from "../Controller/Propertiescontroller.js"
import { bookingbyuser, createBooking, updateBookingDetails, confirmBooking, createRazorpayOrder, getCheckout, verifyPayment, cancelBooking} from "../Controller/BookingController.js";
import { googleAuth } from "../Controller/GoogleAuthController.js";
import { submitReview,  getPropertyReviews,  markReviewHelpful, getUserReviews,  updateReview,  deleteReview } from "../Controller/ReviewController.js";
dotenv.config();

const router = express.Router();

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
router.get('/location',getLocation)
router.get("/properties",getproperties)
router.get("/property/:id",getproperty)
router.post("/add-booking",createBooking)
router.put("/update-details", updateBookingDetails)
router.post("/confirm-booking", confirmBooking)
router.get('/checkout',getCheckout);
router.post("/google-auth", googleAuth);
router.get("/get-booking",bookingbyuser)
router.post("/create-order", createRazorpayOrder);
router.put('/cancel-booking/:bookingId',cancelBooking)
router.post("/:bookingId/review",submitReview);
router.get("/review/:propertyId", getPropertyReviews);
router.post("/review/:reviewId/helpful", markReviewHelpful);
router.get("/user-reviews", getUserReviews);
router.put("/review/:reviewId", updateReview);
router.delete("/review/:reviewId", deleteReview);
  
export default router;