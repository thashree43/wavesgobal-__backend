import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,VerifyOtp,ResendOtp,userlogout, getUser} from "../Controller/AuthController.js"
import {getproperties, getproperty} from "../Controller/Propertiescontroller.js"
import { createBooking } from "../Controller/BookingController.js";

dotenv.config();

const router = express.Router();

// Auth part
router.post("/login",Userlogin)
router.post("/register",UserRegister)
router.post("/verify-otp",VerifyOtp)
router.post("/resend-otp",ResendOtp)
router.post("/logout",userlogout)
router.get("/getuser",getUser)

router.get("/properties",getproperties)
router.get("/property/:id",getproperty)
router.post("/add-booking",createBooking)

export default router;