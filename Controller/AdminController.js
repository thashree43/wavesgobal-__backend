import locationmodel from "../Models/LocationModel.js";
import PropertyModel from "../Models/PropertyModel.js";
import UserModel from "../Models/UserModel.js";


export const addLocation = async (req, res) => {
    try {  
      const {name,description,status} = req.body
      const image = req.file?.location;  

      const existlocation = await locationmodel.findOne({name})

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
        if(!location){
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
      { new: true } 
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
      price, 
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
      status 
    } = req.body;

    const images = req.files ? req.files.map(file => ({
      url: file.location || file.path,   // use location if S3, path if local
      name: file.originalname,
      id: file.filename
    })) : [];

    const existProperty = await PropertyModel.findOne({ title });
    if (existProperty) {
      return res.status(400).json({ success: false, message: "Property already exists" });
    }

    const safeParse = (field, fallback) => {
      try {
        return typeof field === "string" ? JSON.parse(field) : (field || fallback);
      } catch (e) {
        console.error(`Invalid JSON for field:`, e.message);
        return fallback;
      }
    };

    const parsedMapLocation = safeParse(mapLocation, {});
    
    const parsedPropertyHighlights = safeParse(propertyHighlights, []);
    const cleanedPropertyHighlights = parsedPropertyHighlights.map(highlight => ({
      name: highlight?.name || '',
      icon: typeof highlight?.icon === 'object' ? '' : (highlight?.icon || '')
    }));

    const parsedAmenities = safeParse(amenities, {
      general: [],
      kitchen: [],
      recreation: [],
      safety: []
    });
    const cleanedAmenities = {
      general: (parsedAmenities.general || []).map(item => ({
        name: item?.name || '',
        icon: typeof item?.icon === 'object' ? '' : (item?.icon || '')
      })),
      kitchen: (parsedAmenities.kitchen || []).map(item => ({
        name: item?.name || '',
        icon: typeof item?.icon === 'object' ? '' : (item?.icon || '')
      })),
      recreation: (parsedAmenities.recreation || []).map(item => ({
        name: item?.name || '',
        icon: typeof item?.icon === 'object' ? '' : (item?.icon || '')
      })),
      safety: (parsedAmenities.safety || []).map(item => ({
        name: item?.name || '',
        icon: typeof item?.icon === 'object' ? '' : (item?.icon || '')
      }))
    };

    const parsedRoomsAndSpaces = safeParse(roomsAndSpaces, {});
    
    const parsedNearbyAttractions = safeParse(nearbyAttractions, []);
    const cleanedNearbyAttractions = parsedNearbyAttractions
      .filter(attraction => attraction?.name && attraction?.distance)
      .map(attraction => ({
        name: attraction.name,
        distance: attraction.distance
      }));

    const parsedHouseRules = safeParse(houseRules, {
      checkIn: '15:00',
      checkOut: '11:00',
      maxGuests: '',
      smoking: false,
      parties: false,
      pets: false,
      children: false
    });

    const parsedExtraServices = safeParse(extraServices, []);

    const newProperty = new PropertyModel({
      title,
      description,
      type,
      neighborhood,
      location,
      mapLocation: parsedMapLocation,
      price,
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
      images,
      status: status === 'true' || status === true
    });

    const savedProperty = await newProperty.save();

    res.status(201).json({ 
      success: true, 
      message: "Property added successfully", 
      property: savedProperty 
    });
     
  } catch (error) {
    console.error("Error adding property:", error);
    res.status(500).json({ success: false, message: "Server error while adding property", error: error.message });
  }
};


export const getProperty = async (req, res) => {
  try {
    const properties = await PropertyModel.find()
      .populate('neighborhood', 'name')
      .sort({ createdAt: -1 });

    if (!properties || properties.length === 0) {
      return res.status(404).json({ message: "No properties found" });
    }

    const formattedProperties = properties.map(property => ({
      id: property._id,
      title: property.title,
      description: property.description,
      type: property.type,
      neighborhood: property.neighborhood?.name || property.neighborhood,
      location: property.location,
      mapLocation: property.mapLocation,
      price: `AED ${property.price?.toLocaleString()}`,
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
      images: property.images,
      status: property.status ? 'Available' : 'Not Available',
      addedDate: property.createdAt.toISOString().split('T')[0],
    }));

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
    console.log("lkkl")
    const { id } = req.params;
    const updateData = { ...req.body };

    if (req.body.mapLocation) {
      updateData.mapLocation = JSON.parse(req.body.mapLocation);
    }
    if (req.body.propertyHighlights) {
      updateData.propertyHighlights = JSON.parse(req.body.propertyHighlights);
    }
    if (req.body.amenities) {
      updateData.amenities = JSON.parse(req.body.amenities);
    }
    if (req.body.roomsAndSpaces) {
      updateData.roomsAndSpaces = JSON.parse(req.body.roomsAndSpaces);
    }
    if (req.body.nearbyAttractions) {
      updateData.nearbyAttractions = JSON.parse(req.body.nearbyAttractions);
    }
    if (req.body.houseRules) {
      updateData.houseRules = JSON.parse(req.body.houseRules);
    }
    if (req.body.extraServices) {
      updateData.extraServices = JSON.parse(req.body.extraServices);
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
      { new: true }
    );

    console.log(updatedProperty,"may here")

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
    res.status(500).json({ message: "Server error" });
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
      .populate('neighborhood', 'name');

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
    console.log("l;l;;")
    const users = await UserModel.find()

    if(!users){
      res.status(404).json({message:"Users not found"})
    }
    res.status(200).json(users)
  } catch (error) {
    res.status(500).json({messag:"Internal server error"})


  }
}