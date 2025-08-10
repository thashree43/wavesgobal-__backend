import express from 'express';
import cors from "cors";
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Adminrouter from './Routes/AdminRoutes.js';
import databaseConnection from './utils/db.js';

dotenv.config();
databaseConnection();

const app = express();
const PORT = 3000;

app.use(cors({
    origin: 'http://localhost:5173',
    allowedHeaders: 'Content-Type',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/admin', Adminrouter);

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
