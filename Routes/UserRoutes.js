import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,VerifyOtp,ResendOtp,userlogout, getUser, updateuser, updatePass} from "../Controller/AuthController.js"
import {getLocation, getproperties, getproperty} from "../Controller/Propertiescontroller.js"
import { createBooking,getCheckout} from "../Controller/BookingController.js";

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
router.get('/checkout', (req, res, next) => {
    console.log("📌 /booking route hit");
    console.log("Query:", req.query);
    console.log("Cookies:", req.cookies);
    next(); 
  }, getCheckout);
  
export default router;