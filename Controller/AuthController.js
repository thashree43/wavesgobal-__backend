// import bcrypt from "bcrypt";
// import UserModel from "../Models/UserModel.js";
// import OtpModel from "../Models/OtpModel.js";
// import PasswordResetModel from "../Models/Passresetmodel.js";
// import sendEmail from "../utils/SendEmail.js";
// import crypto from "crypto";
// import jwt from "jsonwebtoken";

// export const Userlogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) {
//       return res.status(403).json({ message: "Email and password are required" });
//     }

//     const user = await UserModel.findOne({ email });
//     if (!user) {
//       return res.status(409).json({ message: "This user doesn't exist" });
//     }

//     if (!user.isVerified) {
//       return res.status(403).json({ message: "Please verify your email first" });
//     }

//     if (user.isBlocked) {
//       return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
//     const isProduction = process.env.NODE_ENV === "production";

//     res.cookie("usertoken", token, {
//       httpOnly: true,
//       secure: true, 
//       sameSite: "None", 
//       maxAge: 30 * 24 * 60 * 60 * 1000,
//       path: "/",
//       domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
//     });

//     const userResponse = {
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       mobile: user.mobile,
//     };

//     return res.status(200).json({
//       message: "Successfully logged in",
//       user: userResponse,
//       success: true,
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };


// export const UserRegister = async (req, res) => {
//   try {
//     const { username, email, phone, password } = req.body;
    
//     if (!username || !email || !phone || !password) {
//       return res.status(400).json({ message: "All fields are required" });
//     }
    
//     const existingUser = await UserModel.findOne({ email });
//     if (existingUser) {
//       if (existingUser.isVerified) {
//         return res.status(409).json({ message: "This user already exists" });
//       } else {
//         await UserModel.deleteOne({ email });
//         await OtpModel.deleteOne({ email });
//       }
//     }
    
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = new UserModel({ 
//       name: username, 
//       email, 
//       mobile: phone, 
//       password: hashedPassword,
//       isVerified: false,
//       isBlocked: false
//     });
//     await newUser.save();
    
//     const otp = crypto.randomInt(100000, 999999);
//     console.log("=".repeat(50));
//     console.log("OTP Generated:", otp);
//     console.log("Email:", email);
//     console.log("=".repeat(50));
    
//     await OtpModel.create({ 
//       email, 
//       otp, 
//       expiresAt: Date.now() + 10 * 60 * 1000 
//     });
    
//     const emailSubject = "Email Verification OTP";
//     const emailMessage = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: #e67300; font-size: 20px; margin-bottom: 20px;">Welcome to Wavescation!</h2>
//         <p style="font-size: 14px; color: #333;">Hello ${username},</p>
//         <p style="font-size: 14px; color: #333;">Thank you for registering. Your verification code is:</p>
//         <div style="text-align: center; margin: 30px 0;">
//           <div style="background-color: #f7f7f7; border: 2px solid #e67300; padding: 20px; border-radius: 10px; display: inline-block;">
//             <span style="font-size: 32px; font-weight: bold; color: #e67300; letter-spacing: 5px;">${otp}</span>
//           </div>
//         </div>
//         <p style="font-size: 14px; color: #333;">This code will expire in 10 minutes.</p>
//         <p style="font-size: 14px; color: #333;">If you didn't request this verification, please ignore this email.</p>
//         <p style="font-size: 14px; color: #333;">Best regards,<br>Wavescation Team</p>
//       </div>
//     `;
    
//     try {
//       await sendEmail(email, emailSubject, emailMessage);
//       console.log("Email sent successfully to:", email);
//     } catch (emailError) {
//       console.error("Email sending failed:", emailError);
//       await UserModel.deleteOne({ email });
//       await OtpModel.deleteOne({ email });
//       return res.status(500).json({ 
//         message: "Failed to send verification email. Please try again.", 
//         error: emailError.message 
//       });
//     }
    
//     res.status(201).json({ 
//       message: "OTP sent to your email", 
//       email,
//       success: true 
//     });
//   } catch (error) {
//     console.error("Registration error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// export const VerifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     if (!email || !otp) {
//       return res.status(400).json({ message: "Email and OTP are required" });
//     }

//     const otpRecord = await OtpModel.findOne({ email, otp: parseInt(otp) });
//     if (!otpRecord) {
//       return res.status(400).json({ message: "Invalid OTP" });
//     }

//     if (otpRecord.expiresAt < Date.now()) {
//       await OtpModel.deleteOne({ email });
//       return res.status(400).json({ message: "OTP expired" });
//     }

//     const user = await UserModel.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     user.isVerified = true;
//     await user.save();
//     await OtpModel.deleteOne({ email });

//     const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
//     const isProduction = process.env.NODE_ENV === "production";

//     res.cookie("usertoken", token, {
//       httpOnly: true,
//       secure: true, 
//       sameSite: "None", 
//       maxAge: 30 * 24 * 60 * 60 * 1000,
//       path: "/",
//       domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
//     });

//     const userResponse = {
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       mobile: user.mobile,
//     };

//     return res.status(200).json({
//       message: "OTP verified, registration successful",
//       user: userResponse,
//       success: true,
//     });
//   } catch (error) {
//     console.error("OTP verification error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };


// export const ResendOtp = async (req, res) => {
//   try {
//     const { email } = req.body;
    
//     if (!email) {
//       return res.status(400).json({ message: "Email is required" });
//     }
    
//     const user = await UserModel.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     if (user.isVerified) {
//       return res.status(400).json({ message: "User already verified" });
//     }
    
//     const otp = crypto.randomInt(100000, 999999);
//     console.log("=".repeat(50));
//     console.log("Resend OTP Generated:", otp);
//     console.log("Email:", email);
//     console.log("=".repeat(50));
    
//     await OtpModel.findOneAndUpdate(
//       { email }, 
//       { otp, expiresAt: Date.now() + 10 * 60 * 1000 }, 
//       { upsert: true }
//     );
    
//     const emailSubject = "Email Verification OTP - Resend";
//     const emailMessage = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: #e67300; font-size: 20px; margin-bottom: 20px;">Verification Code Resent</h2>
//         <p style="font-size: 14px; color: #333;">Hello ${user.name},</p>
//         <p style="font-size: 14px; color: #333;">Your new verification code is:</p>
//         <div style="text-align: center; margin: 30px 0;">
//           <div style="background-color: #f7f7f7; border: 2px solid #e67300; padding: 20px; border-radius: 10px; display: inline-block;">
//             <span style="font-size: 32px; font-weight: bold; color: #e67300; letter-spacing: 5px;">${otp}</span>
//           </div>
//         </div>
//         <p style="font-size: 14px; color: #333;">This code will expire in 10 minutes.</p>
//         <p style="font-size: 14px; color: #333;">Best regards,<br>Wavescation Team</p>
//       </div>
//     `;
    
//     try {
//       await sendEmail(email, emailSubject, emailMessage);
//       console.log("Resend email sent successfully to:", email);
//     } catch (emailError) {
//       console.error("Resend email failed:", emailError);
//       return res.status(500).json({ 
//         message: "Failed to send verification email", 
//         error: emailError.message 
//       });
//     }
    
//     res.status(200).json({ message: "New OTP sent", success: true });
//   } catch (error) {
//     console.error("Resend OTP error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// export const getUser = async (req, res) => {
//   try {
//     const token = req.cookies.usertoken || req.headers.authorization?.split(' ')[1];
//     if (!token) {
//       return res.status(401).json({ message: "No token found" });
//     }
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await UserModel.findById(decoded.id).select("-password");
    
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     if (user.isBlocked) {
//       return res.status(403).json({ message: "Your account has been blocked" });
//     }

//     res.status(200).json({ user, success: true });
//   } catch (error) {
//     res.status(401).json({ message: "Invalid or expired token" });
//   }
// };

// export const userlogout = async (req, res) => {
//   try {
//     const isProduction = process.env.NODE_ENV === "production";

//     res.clearCookie("usertoken", {
//       httpOnly: true,
//       secure: true, 
//       sameSite: "None", 
//       path: "/",
//       domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
//     });

//     return res.status(200).json({ message: "Logged out successfully", success: true });
//   } catch (error) {
//     console.error("Logout error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };


// export const updateuser = async(req,res)=>{
//   try {
//     const {name,mobile} = req.body;
//     const token = req.cookies.usertoken || req.headers.authorization?.split(' ')[1];
//     if(!token){
//       return res.status(404).json({message:"token not found"});
//     }
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await UserModel.findById(decoded.id).select("-password");
//     if(!user){
//       return res.status(404).json({message:"User not found"});
//     }

//     if (user.isBlocked) {
//       return res.status(403).json({ message: "Your account has been blocked" });
//     }

//     if(name)user.name = name;
//     if(mobile)user.mobile = mobile;
//     await user.save();
//     res.status(200).json({success:true,user});
//   } catch (error) {
//     res.status(500).json({message:"Internal server error"});
//   }
// };

// export const updatePass = async (req, res) => {
//   try {
//     const { currentPassword, newPassword } = req.body;
//     const token = req.cookies.usertoken || req.headers.authorization?.split(' ')[1];
//     if (!token) {
//       return res.status(401).json({ message: "Unauthorized, token not found" });
//     }
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await UserModel.findById(decoded.id);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     if (user.isBlocked) {
//       return res.status(403).json({ message: "Your account has been blocked" });
//     }

//     const isMatch = await bcrypt.compare(currentPassword, user.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: "Current password is incorrect" });
//     }
//     const isSameAsOld = await bcrypt.compare(newPassword, user.password);
//     if (isSameAsOld) {
//       return res.status(400).json({ message: "New password cannot be the same as old password" });
//     }
//     user.password = await bcrypt.hash(newPassword, 10);
//     await user.save();
//     return res.status(200).json({ success: true, message: "Password updated successfully" });
//   } catch (error) {
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

// export const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
    
//     if (!email) {
//       return res.status(400).json({ message: "Email is required" });
//     }

//     const user = await UserModel.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: "User with this email does not exist" });
//     }

//     if (user.isBlocked) {
//       return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
//     }

//     await PasswordResetModel.deleteMany({ email });

//     const resetToken = crypto.randomBytes(32).toString("hex");
//     const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

//     await PasswordResetModel.create({
//       email,
//       token: hashedToken,
//       expiresAt: Date.now() + 15 * 60 * 1000
//     });

//     const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
//     const emailSubject = "Password Reset Request";
//     const emailMessage = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2 style="color: #e67300; font-size: 20px; margin-bottom: 20px;">Password Reset Request</h2>
//         <p style="font-size: 14px; color: #333;">Hello,</p>
//         <p style="font-size: 14px; color: #333;">You requested to reset your password. Please click the button below:</p>
//         <div style="text-align: center; margin: 30px 0;">
//           <a href="${resetURL}" 
//              style="background-color: #e67300; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 14px;">
//             Reset Password
//           </a>
//         </div>
//         <p style="font-size: 14px; color: #333;">This link will expire in 15 minutes for security reasons.</p>
//         <p style="font-size: 14px; color: #333;">If you didn't request this password reset, please ignore this email.</p>
//         <p style="font-size: 14px; color: #333;">Best regards,<br>Wavescation Team</p>
//       </div>
//     `;

//     try {
//       await sendEmail(email, emailSubject, emailMessage);
//       console.log("Password reset email sent to:", email);
//     } catch (emailError) {
//       console.error("Password reset email failed:", emailError);
//       await PasswordResetModel.deleteOne({ email });
//       return res.status(500).json({ 
//         message: "Failed to send reset email", 
//         error: emailError.message 
//       });
//     }

//     res.status(200).json({ message: "Password reset link sent to your email" });
//   } catch (error) {
//     console.error("Forgot Password Error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// export const validateResetToken = async (req, res) => {
//   try {
//     const { token } = req.params;
    
//     if (!token) {
//       return res.status(400).json({ message: "Reset token is required" });
//     }

//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
//     const resetRecord = await PasswordResetModel.findOne({ 
//       token: hashedToken,
//       expiresAt: { $gt: Date.now() }
//     });

//     if (!resetRecord) {
//       return res.status(400).json({ message: "Invalid or expired reset token" });
//     }

//     res.status(200).json({ message: "Token is valid" });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// export const resetPassword = async (req, res) => {
//   try {
//     const { token, password } = req.body;
    
//     if (!token || !password) {
//       return res.status(400).json({ message: "Token and password are required" });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({ message: "Password must be at least 6 characters long" });
//     }

//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
//     const resetRecord = await PasswordResetModel.findOne({ 
//       token: hashedToken,
//       expiresAt: { $gt: Date.now() }
//     });

//     if (!resetRecord) {
//       return res.status(400).json({ message: "Invalid or expired reset token" });
//     }

//     const user = await UserModel.findOne({ email: resetRecord.email });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     if (user.isBlocked) {
//       return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     user.password = hashedPassword;
//     await user.save();

//     await PasswordResetModel.deleteOne({ _id: resetRecord._id });

//     res.status(200).json({ message: "Password reset successfully" });
//   } catch (error) {
//     console.error("Reset Password Error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };



import bcrypt from "bcrypt";
import UserModel from "../Models/UserModel.js";
import OtpModel from "../Models/OtpModel.js";
import PasswordResetModel from "../Models/Passresetmodel.js";
import sendEmail from "../utils/SendEmail.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

export const Userlogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(403).json({ message: "Email and password are required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(409).json({ message: "This user doesn't exist" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    return res.status(200).json({
      message: "Successfully logged in",
      user: userResponse,
      token,
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const UserRegister = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;
    
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({ message: "This user already exists" });
      } else {
        await UserModel.deleteOne({ email });
        await OtpModel.deleteOne({ email });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new UserModel({ 
      name: username, 
      email, 
      mobile: phone, 
      password: hashedPassword,
      isVerified: false,
      isBlocked: false
    });
    await newUser.save();
    
    const otp = crypto.randomInt(100000, 999999);
    console.log("=".repeat(50));
    console.log("OTP Generated:", otp);
    console.log("Email:", email);
    console.log("=".repeat(50));
    
    await OtpModel.create({ 
      email, 
      otp, 
      expiresAt: Date.now() + 10 * 60 * 1000 
    });
    
    const emailSubject = "Email Verification OTP";
    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e67300; font-size: 20px; margin-bottom: 20px;">Welcome to Wavescation!</h2>
        <p style="font-size: 14px; color: #333;">Hello ${username},</p>
        <p style="font-size: 14px; color: #333;">Thank you for registering. Your verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f7f7f7; border: 2px solid #e67300; padding: 20px; border-radius: 10px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; color: #e67300; letter-spacing: 5px;">${otp}</span>
          </div>
        </div>
        <p style="font-size: 14px; color: #333;">This code will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #333;">If you didn't request this verification, please ignore this email.</p>
        <p style="font-size: 14px; color: #333;">Best regards,<br>Wavescation Team</p>
      </div>
    `;
    
    try {
      await sendEmail(email, emailSubject, emailMessage);
      console.log("Email sent successfully to:", email);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      await UserModel.deleteOne({ email });
      await OtpModel.deleteOne({ email });
      return res.status(500).json({ 
        message: "Failed to send verification email. Please try again.", 
        error: emailError.message 
      });
    }
    
    res.status(201).json({ 
      message: "OTP sent to your email", 
      email,
      success: true 
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const VerifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const otpRecord = await OtpModel.findOne({ email, otp: parseInt(otp) });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < Date.now()) {
      await OtpModel.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isVerified = true;
    await user.save();
    await OtpModel.deleteOne({ email });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
    };

    return res.status(200).json({
      message: "OTP verified, registration successful",
      user: userResponse,
      token,
      success: true,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const ResendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: "User already verified" });
    }
    
    const otp = crypto.randomInt(100000, 999999);
    console.log("=".repeat(50));
    console.log("Resend OTP Generated:", otp);
    console.log("Email:", email);
    console.log("=".repeat(50));
    
    await OtpModel.findOneAndUpdate(
      { email }, 
      { otp, expiresAt: Date.now() + 10 * 60 * 1000 }, 
      { upsert: true }
    );
    
    const emailSubject = "Email Verification OTP - Resend";
    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e67300; font-size: 20px; margin-bottom: 20px;">Verification Code Resent</h2>
        <p style="font-size: 14px; color: #333;">Hello ${user.name},</p>
        <p style="font-size: 14px; color: #333;">Your new verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f7f7f7; border: 2px solid #e67300; padding: 20px; border-radius: 10px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; color: #e67300; letter-spacing: 5px;">${otp}</span>
          </div>
        </div>
        <p style="font-size: 14px; color: #333;">This code will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #333;">Best regards,<br>Wavescation Team</p>
      </div>
    `;
    
    try {
      await sendEmail(email, emailSubject, emailMessage);
      console.log("Resend email sent successfully to:", email);
    } catch (emailError) {
      console.error("Resend email failed:", emailError);
      return res.status(500).json({ 
        message: "Failed to send verification email", 
        error: emailError.message 
      });
    }
    
    res.status(200).json({ message: "New OTP sent", success: true });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "No token found" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    res.status(200).json({ user, success: true });
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const userlogout = async (req, res) => {
  try {
    // With token-based auth, logout is handled on the client side
    // by removing the token from storage
    return res.status(200).json({ 
      message: "Logged out successfully. Please remove token from client storage.", 
      success: true 
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const updateuser = async(req,res)=>{
  try {
    const {name,mobile} = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    console.log(token)
    if(!token){
      return res.status(401).json({message:"Unauthorized, token not found"});
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id).select("-password");
    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    if(name)user.name = name;
    if(mobile)user.mobile = mobile;
    await user.save();
    res.status(200).json({success:true,user});
  } catch (error) {
    res.status(500).json({message:"Internal server error"});
  }
};

export const updatePass = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized, token not found" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld) {
      return res.status(400).json({ message: "New password cannot be the same as old password" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User with this email does not exist" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
    }

    await PasswordResetModel.deleteMany({ email });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    await PasswordResetModel.create({
      email,
      token: hashedToken,
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const emailSubject = "Password Reset Request";
    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e67300; font-size: 20px; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="font-size: 14px; color: #333;">Hello,</p>
        <p style="font-size: 14px; color: #333;">You requested to reset your password. Please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetURL}" 
             style="background-color: #e67300; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 14px;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #333;">This link will expire in 15 minutes for security reasons.</p>
        <p style="font-size: 14px; color: #333;">If you didn't request this password reset, please ignore this email.</p>
        <p style="font-size: 14px; color: #333;">Best regards,<br>Wavescation Team</p>
      </div>
    `;

    try {
      await sendEmail(email, emailSubject, emailMessage);
      console.log("Password reset email sent to:", email);
    } catch (emailError) {
      console.error("Password reset email failed:", emailError);
      await PasswordResetModel.deleteOne({ email });
      return res.status(500).json({ 
        message: "Failed to send reset email", 
        error: emailError.message 
      });
    }

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const resetRecord = await PasswordResetModel.findOne({ 
      token: hashedToken,
      expiresAt: { $gt: Date.now() }
    });

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    res.status(200).json({ message: "Token is valid" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const resetRecord = await PasswordResetModel.findOne({ 
      token: hashedToken,
      expiresAt: { $gt: Date.now() }
    });

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const user = await UserModel.findOne({ email: resetRecord.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked. Please contact support." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    await PasswordResetModel.deleteOne({ _id: resetRecord._id });

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};