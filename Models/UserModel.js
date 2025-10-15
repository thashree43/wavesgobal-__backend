import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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
    },
    trim: true
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
  isBlocked: {
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
}, {
  timestamps: true
});

const UserModel = mongoose.model('User', userSchema);

export default UserModel;