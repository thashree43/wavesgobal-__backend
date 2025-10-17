import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { UpdateLocation, addLocation, addproperty, adminLogin, adminLogout, adminRegister, blockUnblockUser, cancelBooking, changePass, deleteProperty, deleteReview, getAdmin, getAllReviews, getBookings, getProperty, getReviewById, getUsers, getlocation, markChekout, updateProperty } from "../Controller/AdminController.js";
import { getBookingStatus, getDashboardData, getDashboardStats, getMonthlyRevenue, getPropertyTypes, getRecentBookings, getTopLocations, getUserGrowth } from "./DashboardController.js";
import { verifyAdmin } from "../Middleware/AuthMiddleware.js";
dotenv.config();

const Adminrouter = express.Router();

const s3Client = new S3Client({
  region: "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY || "",
    secretAccessKey: process.env.AWS_SECRET_KEY || "",
  },
});

const categoryUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: "waveslocation",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      cb(null, Date.now().toString() + "-" + file.originalname);
    },
  }),
});

const propertyUpload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: "wavesproperty",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      cb(null, Date.now().toString() + "-" + file.originalname);
    },
  }),
  limits: {
    files: 10,
    fileSize: 20 * 1024 * 1024, // 20MB max per file
    fieldSize: 25 * 1024 * 1024, // 25MB max for text fields
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
