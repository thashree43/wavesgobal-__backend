import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive'], 
    default: 'active'
  }
}, { timestamps: true });

const locationmodel = mongoose.model('Location', LocationSchema);

export default locationmodel;
