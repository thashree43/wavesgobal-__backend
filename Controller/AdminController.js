import locationmodel from "../Models/LocationModel.js";
import PropertyModel from "../Models/PropertyModel.js";


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
  

export const addproperty = async (req, res) => {
  try {
    console.log("first");
    const { title, description, type, neighborhood, location, mapLocation, price, area, bedrooms, bathrooms } = req.body;

    console.log("ss");

    const images = req.files.map(file => file.location);

    const existproperty = await PropertyModel.find({title})

    if(!existproperty){
      res.status(400).json({message:"property allready existed"})
    }else{
       const newproperty = new PropertyModel({
        title,
        description,
        type,
        neighborhood,
        location,
        mapLocation,
        price,
        area,
        bedrooms,
        bathrooms
       })

       const saveproperty = await newproperty.save()
       res.status(200).json({ message: "Property added"});
    }
     
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


export const getProperty = async(req,res)=>{
  try {
    const property = await PropertyModel.find()

    if(!property){
      res.status(404).json({message:"No properties found"})
    }else{
      res.status(200).json({success:true,property})
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({message:"Internal server error"})
  }
}
