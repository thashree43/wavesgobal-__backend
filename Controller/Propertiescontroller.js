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

    console.log('Search params:', { checkin, checkout, locationId, adults, children, infants });

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
      console.log('Filtering by dates:', { checkin, checkout });

      const overlappingBookings = await BookingModel.find({
        bookingStatus: "confirmed",
        $or: [
          {
            $and: [
              { checkIn: { $lt: checkout } },
              { checkOut: { $gt: checkin } }
            ]
          }
        ],
      })
        .select("property checkIn checkOut bookingStatus")
        .lean();

      console.log('Found overlapping bookings:', overlappingBookings.length);
      if (overlappingBookings.length > 0) {
        console.log('Booking details:', overlappingBookings.map(b => ({
          property: b.property,
          checkIn: b.checkIn,
          checkOut: b.checkOut
        })));
      }

      const allProperties = await PropertyModel.find({
        'availability.unavailableDates': { $exists: true, $ne: [] }
      })
        .select('_id title availability.unavailableDates')
        .lean();

      const propertiesWithBlockedDates = allProperties.filter(property => {
        if (!property.availability || !property.availability.unavailableDates) return false;
        
        return property.availability.unavailableDates.some(blocked => {
          return blocked.checkIn < checkout && blocked.checkOut > checkin;
        });
      });

      console.log('Properties with blocked dates:', propertiesWithBlockedDates.length);
      if (propertiesWithBlockedDates.length > 0) {
        console.log('Blocked properties:', propertiesWithBlockedDates.map(p => ({
          id: p._id,
          title: p.title,
          blockedDates: p.availability.unavailableDates
        })));
      }

      const bookingPropertyIds = overlappingBookings.map((booking) => booking.property.toString());
      const blockedPropertyIds = propertiesWithBlockedDates.map(p => p._id.toString());
      
      unavailablePropertyIds = [...new Set([...bookingPropertyIds, ...blockedPropertyIds])];
      
      console.log('Total unavailable properties:', unavailablePropertyIds.length);

      if (unavailablePropertyIds.length > 0) {
        filter._id = { $nin: unavailablePropertyIds.map(id => new mongoose.Types.ObjectId(id)) };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('Final filter:', JSON.stringify(filter, null, 2));

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

    console.log('Properties found:', properties.length, 'Total count:', totalCount);

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