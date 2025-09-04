import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,VerifyOtp,ResendOtp,userlogout, getUser, updateuser, updatePass} from "../Controller/AuthController.js"
import {getLocation, getproperties, getproperty} from "../Controller/Propertiescontroller.js"
import { bookingbyuser, createBooking,createRazorpayOrder,getCheckout, verifyPayment} from "../Controller/BookingController.js";
import { googleAuth } from "../Controller/GoogleAuthController.js";

dotenv.config();

const router = express.Router();

// Auth part
router.post("/login",Userlogin)
router.post("/register",UserRegister)
router.post("/verify-otp",VerifyOtp)
router.post("/resend-otp",ResendOtp)
router.post("/logout",userlogout)
router.get("/getuser",getUser)
router.put("/updateuser",updateuser)
router.put("/changepassword",updatePass)
router.get('/location',getLocation)
router.get("/properties",getproperties)
router.get("/property/:id",getproperty)
router.post("/add-booking",createBooking)
router.get('/checkout',getCheckout);
router.post("/google-auth", googleAuth);
router.get("/get-booking",bookingbyuser)
router.post("/create-order", createRazorpayOrder);
router.post("/verify-payment", verifyPayment);

  
export default router;