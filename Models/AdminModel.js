import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    number: {
      type: String, 
      required: true,
      unique: true,
      match: [/^\+?[0-9]{7,15}$/, "Please enter a valid phone number"],
    },
  },
  { timestamps: true }
);

const adminModel = mongoose.model("Admin", adminSchema);
export default adminModel
