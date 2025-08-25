import PropertyModel from "../Models/PropertyModel.js";
import BookingModel from "../Models/BookingModel.js";
import locationmodel from "../Models/LocationModel.js";

export const getLocation = async(req,res)=>{
    try {
        const location = await locationmodel.find()
        if(!location){
            res.status(404).json({message:"Location not found"})
        }

        res.status(200).json({success:true,location})
    } catch (error) {
        res.status(500).json({message:"Internal server error"})
        console.error(error)
    }
}


export const getproperties = async (req, res) => {
  try {
    const {
      checkin,
      checkout,
      adults,
      children,
      infants,
      location,
      neighborhood,
      priceMin,
      priceMax,
      propertyType,
      bedrooms,
      bathrooms,
      guests,
      minArea,
    } = req.query;

    let filter = {};

    // ✅ Normal filters
    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }
    if (neighborhood) {
      filter.neighborhood = neighborhood;
    }
    if (priceMin || priceMax) {
      filter.price = {};
      if (priceMin) filter.price.$gte = Number(priceMin);
      if (priceMax) filter.price.$lte = Number(priceMax);
    }
    if (propertyType) {
      filter.type = propertyType;
    }
    if (bedrooms) filter.bedrooms = { $gte: Number(bedrooms) };
    if (bathrooms) filter.bathrooms = { $gte: Number(bathrooms) };
    if (guests) filter.guests = { $gte: Number(guests) };
    if (minArea) filter.area = { $gte: Number(minArea) };

    let unavailablePropertyIds = [];

    // ✅ If checkin & checkout are provided → exclude booked properties
    if (checkin && checkout) {
      const checkInDate = new Date(checkin);
      const checkOutDate = new Date(checkout);

      // Find bookings overlapping with requested dates
      const overlappingBookings = await BookingModel.find({
        $or: [
          {
            checkIn: { $lte: checkOutDate },
            checkOut: { $gte: checkInDate },
          },
        ],
      }).select("property");

      unavailablePropertyIds = overlappingBookings.map(
        (booking) => booking.property
      );

      if (unavailablePropertyIds.length > 0) {
        filter._id = { $nin: unavailablePropertyIds };
      }
    }

    // ✅ Fetch properties
    const properties = await PropertyModel.find(filter)
      .populate("neighborhood")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: properties.length,
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
  
      const property = await PropertyModel.findById(id).populate("bookings");
  
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
  
      console.log(property, "this be the property");
      return res.status(200).json({ success: true, property });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  