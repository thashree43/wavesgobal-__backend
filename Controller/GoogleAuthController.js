import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import UserModel from "../Models/UserModel.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { name, email, picture } = payload;

    let user = await UserModel.findOne({ email });
    if (!user) {
        user = await UserModel.create({
          name,
          email,
          password: "",
          profilePic: picture,
          isGoogleUser: true,
          isVerified:true
        });
      }
      

    const appToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.cookie("usertoken", appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      success: true,
      token: appToken,
      user,
    });
  } catch (err) {
    console.error("Google Auth Error:", err);
    res.status(400).json({ success: false, message: "Google login failed" });
  }
};
