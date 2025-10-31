import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Adminrouter from './Routes/AdminRoutes.js';
import Userrouter from './Routes/UserRoutes.js';
import databaseConnection from './utils/db.js';
import cookieParser from 'cookie-parser';
import nodeCron from 'node-cron';
import './jobs/BookingClean.js'
dotenv.config();
databaseConnection();

const app = express();
const PORT = 3000;

const allowedOrigins = [
    'https://www.wavescation.com',
    'http://localhost:5173'
];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.removeHeader("Cross-Origin-Embedder-Policy");
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  next();
});

app.use('/api/admin', Adminrouter);
app.use('/api/user', Userrouter);

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
