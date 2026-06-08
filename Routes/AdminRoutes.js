import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import { UpdateLocation, addLocation, addproperty, adminLogin, adminLogout, adminRegister, blockUnblockUser, cancelBooking, changePass, deleteProperty, deleteReview, getAdmin, getAllReviews, getBookings, getProperty, getReviewById, getUsers, getlocation, markChekout, updateProperty } from "../Controller/AdminController.js";
import { getBookingStatus, getDashboardData, getDashboardStats, getMonthlyRevenue, getPropertyTypes, getRecentBookings, getTopLocations, getUserGrowth } from "./DashboardController.js";
import { verifyAdmin } from "../Middleware/AuthMiddleware.js";
dotenv.config();

const Adminrouter = express.Router();



const categoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "waveslocation",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const categoryUpload = multer({
  storage: categoryStorage,
});

const propertyStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "wavesproperty",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const propertyUpload = multer({
  storage: propertyStorage,
  limits: {
    files: 10,
    fileSize: 20 * 1024 * 1024,
    fieldSize: 25 * 1024 * 1024,
  },
});



Adminrouter.post("/addlocation", categoryUpload.single("image"), addLocation);
Adminrouter.get("/getlocation",verifyAdmin, getlocation);
Adminrouter.put("/updatelocation",categoryUpload.single('image'),UpdateLocation)
Adminrouter.post("/addproperty", propertyUpload.array("images", 10), addproperty);
Adminrouter.put("/updateproperty/:id", propertyUpload.array("images", 10), updateProperty);
Adminrouter.delete("/deleteproperty/:id",deleteProperty)
Adminrouter.get("/getproperty",verifyAdmin,getProperty)
Adminrouter.get("/users",verifyAdmin,getUsers)
Adminrouter.get("/bookings",verifyAdmin,getBookings)
Adminrouter.post("/register",adminRegister)
Adminrouter.post("/login",adminLogin)
Adminrouter.get("/me", verifyAdmin, getAdmin);
Adminrouter.put("/change-password", verifyAdmin, changePass);
Adminrouter.post('/logout',adminLogout)
Adminrouter.put('/users/:userId/block', verifyAdmin, blockUnblockUser);
Adminrouter.put('/update-checkout/:bookingId',markChekout)
// Adminrouter.get('/stats', getDashboardStats);
// Adminrouter.get('/monthly-revenue', getMonthlyRevenue);
// Adminrouter.get('/user-growth', getUserGrowth);
// Adminrouter.get('/property-types', getPropertyTypes);
// Adminrouter.get('/booking-status', getBookingStatus);
// Adminrouter.get('/recent-bookings', getRecentBookings);
// Adminrouter.get('/top-locations', getTopLocations);
Adminrouter.get('/reviews',verifyAdmin,getAllReviews)
Adminrouter.get('/reviews/:reviewId',verifyAdmin,getReviewById)
Adminrouter.get('/data',verifyAdmin, getDashboardData);
Adminrouter.delete('/reviews/:reviewId',verifyAdmin, deleteReview);
Adminrouter.put("/cancel-booking/:id", verifyAdmin, cancelBooking);



export default Adminrouter;
