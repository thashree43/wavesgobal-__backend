import adminModel from "../Models/AdminModel.js";
import BookingModel from "../Models/BookingModel.js";
import locationmodel from "../Models/LocationModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import UserModel from "../Models/UserModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ReviewModel from "../Models/ReviewModel.js";

export const adminRegister = async (req, res) => {
  try {
    console.log(req.body)
    const { email, number, password } = req.body;

    if (!email || !number || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new adminModel({
      email,
      number,
      password: hashedPassword,
    });

    await newAdmin.save();

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    console.log(req.body);

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Email/phone and password are required" });
    }

    const admin = await adminModel.findOne({
      $or: [{ email: identifier }, { number: identifier }],
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, role: "admin" }, 
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    
    res.cookie("admintoken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      message: "Admin logged in successfully",
      token,
      admin,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAdmin = async (req, res) => {
  try {
    const adminId = req.admin.id; 

    const admin = await adminModel.findById(adminId).select("-password").lean();
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.status(200).json({ success: true, admin });
  } catch (error) {
    console.error("Error in getAdmin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const changePass = async (req, res) => {
  try {
    const adminId = req.admin.id; 
    const { currentPassword, newPassword } = req.body;
    console.log("kl",adminId,currentPassword,newPassword)

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Old and new passwords are required" });
    }

    const admin = await adminModel.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    await admin.save();
    console.log("pass changed")
    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error in changePass:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addLocation = async (req, res) => {
    try {  
      const {name,description,status} = req.body
      const image = req.file?.location;  

      const existlocation = await locationmodel.findOne({name}).lean();

      if(existlocation){
        res.status(400).json({message:"name is already existed"})
      }else{
        const newlocation = new locationmodel({
            name,
            description,
            image,
            status
        })

        const savelocation = await newlocation.save()
        res.status(200).json({ message: "Location added successfully" });
      }
    } catch (error) {
      console.error("Error in addLocation:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

export const getlocation = async(req,res)=>{
    try {
        const location = await locationmodel.find()
          .select('name description image status createdAt')
          .lean()
          .sort({ createdAt: -1 });
        
        if(!location || location.length === 0){
            res.status(404).json({message:"no location found"})
        }else{
            res.status(200).json({success:true,location})
        }
    } catch (error) {
        console.error(error)
        res.status(500).json({error:"Internal server error"})
    }
}
  
export const UpdateLocation = async (req, res) => {
  try {
    const { id, name, description, status } = req.body;
    const image = req.file?.location;

    if (!id) {
      return res.status(400).json({ message: "Location ID is required" });
    }

    const updatedLocation = await locationmodel.findByIdAndUpdate(
      id,
      {
        name,
        description,
        status,
        ...(image && { image })  
      },
      { new: true, lean: true } 
    );

    if (!updatedLocation) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({
      message: "Location updated successfully",
      location: updatedLocation
    });
  } catch (error) {
    console.error("Error in UpdateLocation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addproperty = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      type, 
      neighborhood, 
      location, 
      mapLocation, 
      pricing,
      fees,
      area, 
      bedrooms, 
      bathrooms, 
      guests, 
      beds,
      propertyHighlights,
      amenities,
      roomsAndSpaces,
      nearbyAttractions,
      houseRules,
      extraServices,
      availability,
      status 
    } = req.body;

    const images = req.files ? req.files.map(file => ({
      url: file.location,
      name: file.originalname,
      id: file.filename
    })) : [];

    const existProperty = await PropertyModel.findOne({ title }).lean();
    if (existProperty) {
      return res.status(400).json({ message: "Property already exists" });
    }

    const parsedMapLocation = 
      typeof mapLocation === "string" ? JSON.parse(mapLocation) : mapLocation;

    const parsedPricing = 
      typeof pricing === "string" ? JSON.parse(pricing) : pricing || {};

    if (!parsedPricing.night && !parsedPricing.week && !parsedPricing.month && !parsedPricing.year) {
      return res.status(400).json({ message: "At least one pricing period is required" });
    }

    const cleanedPricing = {
      night: parsedPricing.night || undefined,
      week: parsedPricing.week || undefined,
      month: parsedPricing.month || undefined,
      year: parsedPricing.year || undefined,
      weekdays: {
        monday: parsedPricing.weekdays?.monday || undefined,
        tuesday: parsedPricing.weekdays?.tuesday || undefined,
        wednesday: parsedPricing.weekdays?.wednesday || undefined,
        thursday: parsedPricing.weekdays?.thursday || undefined,
        friday: parsedPricing.weekdays?.friday || undefined,
        saturday: parsedPricing.weekdays?.saturday || undefined,
        sunday: parsedPricing.weekdays?.sunday || undefined
      },
      customDates: (parsedPricing.customDates || []).map(custom => ({
        startDate: custom.startDate,
        endDate: custom.endDate,
        price: custom.price,
        label: custom.label || ''
      }))
    };

    const parsedFees = 
      typeof fees === "string" ? JSON.parse(fees) : fees || {
        cleaningFee: 0,
        serviceFee: 0,
        cityTourismTax: 0,
        vatGst: 0,
        damageDeposit: 0
      };

    const parsedPropertyHighlights = 
      typeof propertyHighlights === "string" ? JSON.parse(propertyHighlights) : propertyHighlights || [];

    const cleanedPropertyHighlights = parsedPropertyHighlights.map(highlight => ({
      name: highlight.name || '',
      icon: typeof highlight.icon === 'object' ? '' : (highlight.icon || '')
    }));

    const parsedAmenities = 
      typeof amenities === "string" ? JSON.parse(amenities) : amenities || {
        general: [],
        kitchen: [],
        recreation: [],
        safety: []
      };

    const cleanedAmenities = {
      general: (parsedAmenities.general || []).map(item => ({
        name: item.name || '',
        icon: typeof item.icon === 'object' ? '' : (item.icon || '')
      })),
      kitchen: (parsedAmenities.kitchen || []).map(item => ({
        name: item.name || '',
        icon: typeof item.icon === 'object' ? '' : (item.icon || '')
      })),
      recreation: (parsedAmenities.recreation || []).map(item => ({
        name: item.name || '',
        icon: typeof item.icon === 'object' ? '' : (item.icon || '')
      })),
      safety: (parsedAmenities.safety || []).map(item => ({
        name: item.name || '',
        icon: typeof item.icon === 'object' ? '' : (item.icon || '')
      }))
    };

    const parsedRoomsAndSpaces = 
      typeof roomsAndSpaces === "string" ? JSON.parse(roomsAndSpaces) : roomsAndSpaces || {};

    const parsedNearbyAttractions = 
      typeof nearbyAttractions === "string" ? JSON.parse(nearbyAttractions) : nearbyAttractions || [];

    const cleanedNearbyAttractions = parsedNearbyAttractions
      .filter(attraction => attraction.name && attraction.distance)
      .map(attraction => ({
        name: attraction.name,
        distance: attraction.distance
      }));

    const parsedHouseRules = 
      typeof houseRules === "string" ? JSON.parse(houseRules) : houseRules || {
        checkIn: '15:00',
        checkOut: '11:00',
        maxGuests: '',
        smoking: false,
        parties: false,
        pets: false,
        children: false
      };

    const parsedExtraServices = 
      typeof extraServices === "string" ? JSON.parse(extraServices) : extraServices || [];

    const parsedAvailability = 
      typeof availability === "string" ? JSON.parse(availability) : availability || {
        blockedDates: []
      };

    const cleanedAvailability = {
      blockedDates: (parsedAvailability.blockedDates || []).map(blocked => ({
        startDate: blocked.startDate,
        endDate: blocked.endDate,
        reason: blocked.reason || 'Blocked by admin'
      }))
    };

    const newProperty = new PropertyModel({
      title,
      description,
      type,
      neighborhood,
      location,
      mapLocation: parsedMapLocation,
      pricing: cleanedPricing,
      fees: parsedFees,
      area,
      bedrooms,
      bathrooms,
      guests,
      beds,
      propertyHighlights: cleanedPropertyHighlights,
      amenities: cleanedAmenities,
      roomsAndSpaces: parsedRoomsAndSpaces,
      nearbyAttractions: cleanedNearbyAttractions,
      houseRules: parsedHouseRules,
      extraServices: parsedExtraServices,
      availability: cleanedAvailability,
      images,
      status: status === 'true' || status === true
    });

    const savedProperty = await newProperty.save();

    res.status(200).json({ 
      success: true, 
      message: "Property added successfully", 
      property: savedProperty 
    });
  } catch (error) {
    console.error("Error adding property:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getProperty = async (req, res) => {
  try {
    const properties = await PropertyModel.find()
      .select('title description type neighborhood location mapLocation pricing fees area bedrooms bathrooms guests beds propertyHighlights amenities roomsAndSpaces nearbyAttractions houseRules extraServices availability images status createdAt')
      .populate('neighborhood', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (!properties || properties.length === 0) {
      return res.status(404).json({ message: "No properties found" });
    }

    const formattedProperties = properties.map(property => {
      const pricingDisplay = {};
      if (property.pricing?.night) pricingDisplay.night = `AED ${property.pricing.night.toLocaleString()}/night`;
      if (property.pricing?.week) pricingDisplay.week = `AED ${property.pricing.week.toLocaleString()}/week`;
      if (property.pricing?.month) pricingDisplay.month = `AED ${property.pricing.month.toLocaleString()}/month`;
      if (property.pricing?.year) pricingDisplay.year = `AED ${property.pricing.year.toLocaleString()}/year`;

      const weekdayPricingDisplay = {};
      if (property.pricing?.weekdays) {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        days.forEach(day => {
          if (property.pricing.weekdays[day]) {
            weekdayPricingDisplay[day] = `AED ${property.pricing.weekdays[day].toLocaleString()}`;
          }
        });
      }

      const customDatesDisplay = (property.pricing?.customDates || []).map(custom => ({
        startDate: custom.startDate,
        endDate: custom.endDate,
        price: `AED ${custom.price.toLocaleString()}/night`,
        priceValue: custom.price,
        label: custom.label || ''
      }));

      const feesDisplay = {};
      if (property.fees?.cleaningFee) feesDisplay.cleaningFee = `AED ${property.fees.cleaningFee.toLocaleString()}`;
      if (property.fees?.serviceFee) feesDisplay.serviceFee = `AED ${property.fees.serviceFee.toLocaleString()}`;
      if (property.fees?.cityTourismTax) feesDisplay.cityTourismTax = `AED ${property.fees.cityTourismTax.toLocaleString()}`;
      if (property.fees?.vatGst) feesDisplay.vatGst = `AED ${property.fees.vatGst.toLocaleString()}`;
      if (property.fees?.damageDeposit) feesDisplay.damageDeposit = `AED ${property.fees.damageDeposit.toLocaleString()}`;

      return {
        id: property._id,
        title: property.title,
        description: property.description,
        type: property.type,
        neighborhood: property.neighborhood?.name || property.neighborhood,
        location: property.location,
        mapLocation: property.mapLocation,
        pricing: property.pricing,
        pricingDisplay: pricingDisplay,
        weekdayPricingDisplay: weekdayPricingDisplay,
        customDatesDisplay: customDatesDisplay,
        fees: property.fees,
        feesDisplay: feesDisplay,
        area: property.area ? `${property.area} sqft` : '',
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        guests: property.guests,
        beds: property.beds,
        propertyHighlights: property.propertyHighlights,
        amenities: property.amenities,
        roomsAndSpaces: property.roomsAndSpaces,
        nearbyAttractions: property.nearbyAttractions,
        houseRules: property.houseRules,
        extraServices: property.extraServices,
        availability: property.availability,
        images: property.images,
        status: property.status ? 'Available' : 'Not Available',
        addedDate: property.createdAt.toISOString().split('T')[0],
      };
    });

    res.status(200).json({ 
      success: true, 
      property: formattedProperties 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (req.body.mapLocation) {
      updateData.mapLocation = JSON.parse(req.body.mapLocation);
    }

    if (req.body.pricing) {
      const parsedPricing = JSON.parse(req.body.pricing);
      if (!parsedPricing.night && !parsedPricing.week && !parsedPricing.month && !parsedPricing.year) {
        return res.status(400).json({ message: "At least one pricing period is required" });
      }
      updateData.pricing = {
        night: parsedPricing.night || undefined,
        week: parsedPricing.week || undefined,
        month: parsedPricing.month || undefined,
        year: parsedPricing.year || undefined,
        weekdays: {
          monday: parsedPricing.weekdays?.monday || undefined,
          tuesday: parsedPricing.weekdays?.tuesday || undefined,
          wednesday: parsedPricing.weekdays?.wednesday || undefined,
          thursday: parsedPricing.weekdays?.thursday || undefined,
          friday: parsedPricing.weekdays?.friday || undefined,
          saturday: parsedPricing.weekdays?.saturday || undefined,
          sunday: parsedPricing.weekdays?.sunday || undefined
        },
        customDates: (parsedPricing.customDates || []).map(custom => ({
          startDate: custom.startDate,
          endDate: custom.endDate,
          price: custom.price,
          label: custom.label || ''
        }))
      };
    }

    if (req.body.fees) {
      updateData.fees = JSON.parse(req.body.fees);
    }

    if (req.body.propertyHighlights) {
      const parsed = JSON.parse(req.body.propertyHighlights);
      updateData.propertyHighlights = parsed.map(highlight => ({
        name: highlight.name || '',
        icon: typeof highlight.icon === 'object' ? '' : (highlight.icon || '')
      }));
    }

    if (req.body.amenities) {
      const parsed = JSON.parse(req.body.amenities);
      updateData.amenities = {
        general: (parsed.general || []).map(item => ({
          name: item.name || '',
          icon: typeof item.icon === 'object' ? '' : (item.icon || '')
        })),
        kitchen: (parsed.kitchen || []).map(item => ({
          name: item.name || '',
          icon: typeof item.icon === 'object' ? '' : (item.icon || '')
        })),
        recreation: (parsed.recreation || []).map(item => ({
          name: item.name || '',
          icon: typeof item.icon === 'object' ? '' : (item.icon || '')
        })),
        safety: (parsed.safety || []).map(item => ({
          name: item.name || '',
          icon: typeof item.icon === 'object' ? '' : (item.icon || '')
        }))
      };
    }

    if (req.body.roomsAndSpaces) {
      updateData.roomsAndSpaces = JSON.parse(req.body.roomsAndSpaces);
    }

    if (req.body.nearbyAttractions) {
      const parsed = JSON.parse(req.body.nearbyAttractions);
      updateData.nearbyAttractions = parsed
        .filter(attraction => attraction.name && attraction.distance)
        .map(attraction => ({
          name: attraction.name,
          distance: attraction.distance
        }));
    }

    if (req.body.houseRules) {
      updateData.houseRules = JSON.parse(req.body.houseRules);
    }

    if (req.body.extraServices) {
      updateData.extraServices = JSON.parse(req.body.extraServices);
    }

    if (req.body.availability) {
      const parsed = JSON.parse(req.body.availability);
      updateData.availability = {
        blockedDates: (parsed.blockedDates || []).map(blocked => ({
          startDate: blocked.startDate,
          endDate: blocked.endDate,
          reason: blocked.reason || 'Blocked by admin'
        }))
      };
    }

    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => ({
        url: file.location,
        name: file.originalname,
        id: file.filename
      }));
    }

    const updatedProperty = await PropertyModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, lean: true }
    );

    if (!updatedProperty) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json({
      success: true,
      message: "Property updated successfully",
      property: updatedProperty
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

export const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("first",id)

    const deletedProperty = await PropertyModel.findByIdAndDelete(id);

    if (!deletedProperty) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json({ 
      success: true, 
      message: "Property deleted successfully" 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await PropertyModel.findById(id)
      .populate('neighborhood', 'name')
      .lean();

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.status(200).json({ 
      success: true, 
      property 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUsers = async(req,res)=>{
  try {
    const users = await UserModel.find()
      .select('name email mobile createdAt isBlocked isVerified')
      .sort({ createdAt: -1 })
      .lean();

    if(!users || users.length === 0){
      res.status(404).json({message:"Users not found"})
    } else {
      res.status(200).json(users)
    }
  } catch (error) {
    res.status(500).json({message:"Internal server error"})
  }
}

export const blockUnblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { isBlocked },
      { new: true, lean: true }
    ).select('name email isBlocked');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getBookings = async(req,res)=>{
  try {
    const bookings = await BookingModel.find({bookingStatus:["confirmed","cancelled"]})
      .populate("user")
      .populate("property")
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(bookings)
    res.status(200).json(bookings)
  } catch (error) {
    res.status(500).json({message:"Internal server error"})
  }
}

export const adminLogout = async (req, res) => {
  try {
    res.clearCookie("admintoken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/",
    });

    res.status(200).json({ success: true, message: "Admin logged out successfully" });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



export const markChekout = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { checkedOut } = req.body;
    
    const booking = await BookingModel.findByIdAndUpdate(
      bookingId,
      { checkedOut },
      { new: true }
    ).select('checkedOut property');
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    if (checkedOut && booking.property) {
      await PropertyModel.findByIdAndUpdate(
        booking.property,
        { $pull: { bookings: booking._id } }
      );
    }
    
    res.status(200).json({
      success: true,
      message: `Booking checkout marked as ${checkedOut ? 'completed' : 'reverted'} successfully`,
      booking,
    });
  } catch (error) {
    console.error("Checkout update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



export const getAllReviews = async (req, res) => {
  try {
    const reviews = await ReviewModel.find()
      .populate('user', 'name email')
      .populate('property', 'title location')
      .populate('booking', 'checkInDate checkOutDate')
      .sort({ createdAt: -1 });

    res.status(200).json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
};

export const getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;
    console.log(reviewId)
    const review = await ReviewModel.findById(reviewId)
      .populate('user', 'name email phone')
      .populate('property', 'title location images price')
      .populate('booking', 'checkInDate checkOutDate totalAmount');
     console.log(review)
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.status(200).json(review);
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ message: 'Failed to fetch review', error: error.message });
  }
};

export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await ReviewModel.findById(reviewId);
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const property = await PropertyModel.findById(review.property);
    
    if (property) {
      const allReviews = await ReviewModel.find({ 
        property: review.property,
        _id: { $ne: reviewId }
      });

      if (allReviews.length > 0) {
        const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
        property.rating = totalRating / allReviews.length;
        property.reviewCount = allReviews.length;
      } else {
        property.rating = 0;
        property.reviewCount = 0;
      }

      await property.save();
    }

    await ReviewModel.findByIdAndDelete(reviewId);

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Failed to delete review', error: error.message });
  }
};


export const cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.bookingStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    booking.bookingStatus = "cancelled";
    await booking.save();

    await PropertyModel.findByIdAndUpdate(booking.property, {
      $inc: { availableUnits: booking.units },
    });

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("❌ Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: error.message,
    });
  }
};
