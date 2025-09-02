import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    mobile: {
        type: String,
        required: function() {
            return !this.isGoogleUser; 
        }
    },
    password: {
        type: String,
        required: function() {
            return !this.isGoogleUser; 
        }
    },
    profilePic: {
        type: String 
    },
    isGoogleUser: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    token: {
        type: String
    },
    bookings: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking"
        }
    ]
}, { timestamps: true });

const UserModel = mongoose.model("User", UserSchema);

export default UserModel;
