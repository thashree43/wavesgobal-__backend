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