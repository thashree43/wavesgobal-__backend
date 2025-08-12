import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    type: { // Property Type
        type: String,
        required: true
    },
    neighborhood: { // Neighborhood/Area
        type: String
    },
    location: { // Full Address
        type: String,
        required: true
    },
    mapLocation: { // Lat/Lng
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    price: {
        type: Number,
        required: true
    },
    area: { // Area in sq ft
        type: Number
    },
    bedrooms: {
        type: Number
    },
    bathrooms: {
        type: Number
    },
    images: [
        {
            url: { type: String, required: true },
            name: { type: String },
            id: { type: String } 
        }
    ],
    status: { // Available for Sale/Rent
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export default mongoose.model("Property", propertySchema);
