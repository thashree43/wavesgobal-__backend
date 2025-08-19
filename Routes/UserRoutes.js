import express from "express";
import path from "path";
import dotenv from "dotenv";
import {Userlogin,UserRegister,VerifyOtp,ResendOtp,userlogout} from "../Controller/AuthController.js"
import {getproperties} from "../Controller/Propertiescontroller.js"

dotenv.config();

const router = express.Router();

// Auth part
router.post("/login",Userlogin)
router.post("/register",UserRegister)
router.post("/verify-otp",VerifyOtp)
router.post("/resend-otp",ResendOtp)
router.post("/logout",userlogout)

router.get("/properties",getproperties)

export default router;