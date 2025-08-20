import bcrypt from "bcrypt";
import UserModel from "../Models/UserModel.js";
import OtpModel from "../Models/OtpModel.js";
import sendEmail from "../utils/SendEmail.js"
import crypto from "crypto"
import jwt from "jsonwebtoken";

export const Userlogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);

    if (!email || !password) {
      return res.status(403).json({ message: "Email and password are required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(409).json({ message: "This user doesn't exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d"
    });

    res.cookie("usertoken", token, {
      httpOnly: true,
      secure: process.env.JWT_SECRET,      
      sameSite: "lax",    
      maxAge: 24 * 60 * 60 * 1000
    });
    

    res.status(200).json({ message: "Successfully logged in", token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const UserRegister = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "This user already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new UserModel({
      name: username,
      email,
      mobile: phone,
      password: hashedPassword
    });
    await newUser.save();

    const otp = crypto.randomInt(100000, 999999);
    console.log(otp)

    await OtpModel.create({
      email,
      otp,
      expiresAt: Date.now() + 60 * 1000  
    });

    await sendEmail(email, "Your OTP Code", `Your OTP is: ${otp}`);

    res.status(201).json({ message: "OTP sent to your email", email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const VerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const otpRecord = await OtpModel.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    await OtpModel.deleteOne({ email });

    const user = await UserModel.findOne({ email });
    if (user) {
      user.isVerified = true;
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d"
    });

    res.cookie("usertoken", token, {
      httpOnly: true,
      secure: false,      
      sameSite: "lax",   
      maxAge: 24 * 60 * 60 * 1000
    });
    

    res.status(200).json({ message: "OTP verified, logged in", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const token = req.cookies.usertoken;

    if (!token) {
      return res.status(401).json({ message: "No token found" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");

    res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};


export const ResendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = crypto.randomInt(100000, 999999);

    await OtpModel.findOneAndUpdate(
      { email },
      { otp, expiresAt: Date.now() + 60 * 1000 },
      { upsert: true }
    );

    await sendEmail(email, "Your OTP Code", `Your new OTP is: ${otp}`);

    res.status(200).json({ message: "New OTP sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const userlogout = async (req,res)=>{
  try {
     res.clearCookie('usertoken',{
      httpOnly:true,
      secure:true,
      sameSite:'strict'
     });
     return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
  }
}


