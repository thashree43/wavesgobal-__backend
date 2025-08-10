import locationmodel from "../Models/LocationModel.js";


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
  


