import mongoose from "mongoose";
import PropertyModel from "../Models/PropertyModel.js";
import BookingModel from "../Models/BookingModel.js";
import locationmodel from "../Models/LocationModel.js";

export const getLocation = async (req, res) => {
  try {
    const locations = await locationmodel
      .find({ status: "active" })
      .select("name _id image")
      .lean();
    
    if (!locations || locations.length === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    const locationsWithPropertyCount = await Promise.all(
      locations.map(async (location) => {
        const propertyCount = await PropertyModel.countDocuments({
          neighborhood: location._id,
          status: true
        });
        return {
          ...location,
          properties: propertyCount
        };
      })
    );

    res.status(200).json({ success: true, location: locationsWithPropertyCount });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
    console.error(error);
  }
};
export const getproperties = async (req, res) => {
  try {
    const {
      checkin,
      checkout,
      location,
      locationId,
      guests,
      adults,
      children,
      infants,
      priceMin,
      priceMax,
      propertyType,
      bedrooms,
      bathrooms,
      minArea,
      page = 1,
      limit = 12,
    } = req.query;

    let filter = { status: true };

    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    if (locationId && mongoose.Types.ObjectId.isValid(locationId)) {
      filter.neighborhood = new mongoose.Types.ObjectId(locationId);
    }

    if (priceMin || priceMax) {
      filter.$or = [
        { 'pricing.night': { $gte: Number(priceMin || 0), $lte: Number(priceMax || Infinity) } },
        { 'pricing.week': { $gte: Number(priceMin || 0), $lte: Number(priceMax || Infinity) } },
        { 'pricing.month': { $gte: Number(priceMin || 0), $lte: Number(priceMax || Infinity) } },
        { 'pricing.year': { $gte: Number(priceMin || 0), $lte: Number(priceMax || Infinity) } }
      ];
    }

    if (propertyType) filter.type = propertyType;
    if (bedrooms) filter.bedrooms = { $gte: Number(bedrooms) };
    if (bathrooms) filter.bathrooms = { $gte: Number(bathrooms) };

    const totalGuests = Number(adults || guests || 0) + Number(children || 0) + Number(infants || 0);
    if (totalGuests > 0) {
      filter.guests = { $gte: totalGuests };
    }

    if (minArea) filter.area = { $gte: Number(minArea) };

    let unavailablePropertyIds = [];

    if (checkin && checkout) {
      const checkInDate = new Date(checkin);
      checkInDate.setHours(0, 0, 0, 0);
      
      const checkOutDate = new Date(checkout);
      checkOutDate.setHours(0, 0, 0, 0);

      const overlappingBookings = await BookingModel.find({
        bookingStatus: "confirmed",
        $or: [
          {
            checkIn: { $gte: checkin, $lt: checkout }
          },
          {
            checkOut: { $gt: checkin, $lte: checkout }
          },
          {
            checkIn: { $lte: checkin },
            checkOut: { $gte: checkout }
          },
          {
            checkIn: { $gte: checkin },
            checkOut: { $lte: checkout }
          }
        ],
      })
        .select("property checkIn checkOut")
        .lean();

      const propertiesWithBlockedDates = await PropertyModel.find({
        'availability.unavailableDates': {
          $elemMatch: {
            $or: [
              { checkIn: { $gte: checkin, $lt: checkout } },
              { checkOut: { $gt: checkin, $lte: checkout } },
              { checkIn: { $lte: checkin }, checkOut: { $gte: checkout } },
              { checkIn: { $gte: checkin }, checkOut: { $lte: checkout } }
            ]
          }
        }
      }).select('_id').lean();

      const bookingPropertyIds = overlappingBookings.map((booking) => booking.property.toString());
      const blockedPropertyIds = propertiesWithBlockedDates.map(p => p._id.toString());
      
      unavailablePropertyIds = [...new Set([...bookingPropertyIds, ...blockedPropertyIds])];

      if (unavailablePropertyIds.length > 0) {
        filter._id = { $nin: unavailablePropertyIds.map(id => new mongoose.Types.ObjectId(id)) };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [properties, totalCount] = await Promise.all([
      PropertyModel.find(filter)
        .select(
          "title type pricing bedrooms bathrooms guests area location images propertyHighlights amenities createdAt neighborhood status ratings"
        )
        .populate("neighborhood", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PropertyModel.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: properties.length,
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      currentPage: parseInt(page),
      data: properties,
    });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getproperty = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Property ID is required" });
    }
    
    const property = await PropertyModel.findById(id)
      .populate("neighborhood", "name")
      .populate({
        path: "reviews",
        match: { status: "active" },
        options: { sort: "-createdAt", limit: 10 },
        populate: { path: "user", select: "name email" }
      })
      .populate("bookings")
      .lean();
      
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    
    return res.status(200).json({ success: true, property });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};