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
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
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
      const checkOutDate = new Date(checkout);

      const overlappingBookings = await BookingModel.find({
        $or: [
          {
            checkIn: { $lte: checkOutDate },
            checkOut: { $gte: checkInDate },
          },
        ],
      })
        .select("property")
        .lean();

      unavailablePropertyIds = overlappingBookings.map(
        (booking) => booking.property
      );

      if (unavailablePropertyIds.length > 0) {
        filter._id = { $nin: unavailablePropertyIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [properties, totalCount] = await Promise.all([
      PropertyModel.find(filter)
        .select(
          "title type price bedrooms bathrooms guests area location images propertyHighlights amenities createdAt neighborhood status"
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