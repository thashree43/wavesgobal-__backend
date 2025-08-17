import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { addLocation, addproperty, getProperty, getlocation } from "../Controller/AdminController.js";

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
Adminrouter.get("/getlocation", getlocation);
Adminrouter.post("/addproperty", propertyUpload.array("images", 10), addproperty);
Adminrouter.get("/getproperty",getProperty)

export default Adminrouter;
