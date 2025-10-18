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
  pricing: {
    night: { type: Number },
    week: { type: Number },
    month: { type: Number },
    year: { type: Number },
    weekdays: {
      monday: { type: Number },
      tuesday: { type: Number },
      wednesday: { type: Number },
      thursday: { type: Number },
      friday: { type: Number },
      saturday: { type: Number },
      sunday: { type: Number }
    },
    customDates: [
      {
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        price: { type: Number, required: true },
        label: { type: String }
      }
    ]
  },
  fees: {
    cleaningFee: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    cityTourismTax: { type: Number, default: 0 },
    vatGst: { type: Number, default: 0 },
    damageDeposit: { type: Number, default: 0 }
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
  availability: {
    blockedDates: [
      {
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        reason: { type: String, default: 'Blocked by admin' }
      }
    ]
  },
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
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    total: { type: Number, default: 0 },
    breakdown: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 },
    },
    categories: {
      cleanliness: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 },
      checkIn: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      location: { type: Number, default: 0 },
      value: { type: Number, default: 0 },
    },
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review",
  }]
}, { timestamps: true });

propertySchema.pre('save', function(next) {
  if (!this.pricing.night && !this.pricing.week && !this.pricing.month && !this.pricing.year) {
    return next(new Error('At least one pricing period (night, week, month, or year) is required'));
  }
  next();
});

export default mongoose.model("Property", propertySchema);