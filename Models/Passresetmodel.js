import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    token: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 900
    }
}, { timestamps: true });

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetModel = mongoose.model("PasswordReset", PasswordResetSchema);
export default PasswordResetModel;