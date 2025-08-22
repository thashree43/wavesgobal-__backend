import PropertyModel from "../Models/PropertyModel.js";

export const getproperties = async (req, res) => {
    try {
        const properties = await PropertyModel.find() 
            .populate('neighborhood') 
            .sort({ createdAt: -1 }); 
        console.log(properties);
        
        res.status(200).json({
            success: true,
            count: properties.length,
            data: properties
        });
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
}


export const getproperty = async(req,res)=>{
    try {
        const id = req.params.id
    const property = await PropertyModel.findById(id)
     if(!property){
        res.status(404).json({message:"property not found"})
     }
     res.status(200).json({success:true,property})
    } catch (error) {
        res.status(500).json({message:"Internal server error"})
        console.error(error)
    }
}


export const getPropertybyFilter = async(req,res)=>{
    try {
        
    } catch (error) {
        
    }
}