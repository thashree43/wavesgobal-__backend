import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import path from "path";
import dotenv from "dotenv";
import { addLocation, getlocation } from "../Controller/AdminController.js";

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
      s3: s3Client, // 
      bucket: "waveslocation",
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: function (req, file, cb) {
        cb(null, Date.now().toString() + "-" + file.originalname);
      },
    }),
});

Adminrouter.post("/addlocation", categoryUpload.single("image"), addLocation);
Adminrouter.get('/getlocation',getlocation)

export default Adminrouter;