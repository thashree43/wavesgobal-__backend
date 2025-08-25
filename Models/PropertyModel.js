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
    type: {
        type: String,
        required: true,
        enum: ['Apartment', 'Villa', 'Studio', 'Penthouse', 'Townhouse', 'Office']
    },
    neighborhood: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
    },
    location: {
        type: String,
        required: true
    },
    mapLocation: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    price: {
        type: Number,
        required: true
    },
    area: {
        type: Number
    },
    bedrooms: {
        type: Number
    },
    bathrooms: {
        type: Number
    },
    guests: {
        type: Number
    },
    beds: {
        type: Number
    },
    propertyHighlights: [
        {
            name: { type: String, required: true },
            icon: { type: String, default: '' }
        }
    ],
    amenities: {
        general: [
            {
                name: { type: String, required: true },
                icon: { type: String, default: '' }
            }
        ],
        kitchen: [
            {
                name: { type: String, required: true },
                icon: { type: String, default: '' }
            }
        ],
        recreation: [
            {
                name: { type: String, required: true },
                icon: { type: String, default: '' }
            }
        ],
        safety: [
            {
                name: { type: String, required: true },
                icon: { type: String, default: '' }
            }
        ]
    },
    roomsAndSpaces: {
        livingRoom: { type: String },
        masterBedroom: { type: String },
        secondBedroom: { type: String },
        thirdBedroom: { type: String },
        kitchen: { type: String },
        balcony: { type: String }
    },
    nearbyAttractions: [
        {
            name: { type: String, required: true },
            distance: { type: String, required: true }
        }
    ],
    houseRules: {
        checkIn: { type: String, default: '15:00' },
        checkOut: { type: String, default: '11:00' },
        maxGuests: { type: Number },
        smoking: { type: Boolean, default: false },
        parties: { type: Boolean, default: false },
        pets: { type: Boolean, default: false },
        children: { type: Boolean, default: false }
    },
    extraServices: [
        {
            name: { type: String, required: true },
            description: { type: String, required: true },
            price: { type: String, required: true }
        }
    ],
    images: [
        {
            url: { type: String, required: true },
            name: { type: String },
            id: { type: String }
        }
    ],
    status: {
        type: Boolean,
        default: true
    },

    bookings: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking"
        }
    ],
    availability: {
        unavailableDates: [
            {
                checkIn: { type: Date },
                checkOut: { type: Date }
            }
        ]
    }

}, { timestamps: true });

export default mongoose.model("Property", propertySchema);
