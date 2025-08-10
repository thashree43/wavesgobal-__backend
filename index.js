import express from 'express';
import cors from "cors";
import { Router } from 'express';
import mongoose from 'mongoose';
import Adminrouter from './Routes/AdminRoutes.js';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config()
import databaseConnection from './utils/db.js';

databaseConnection()
const { urlencoded } = bodyParser

const app = express()

const PORT =3000

app.use(cors({
    origin:'http://localhost:5173',
    allowedHeaders:'Content-Type',
    credentials:true
}))

app.use(express.json())

app.use(urlencoded({extended:true}))

app.use('/api/admin',Adminrouter)

app.listen(PORT,()=>{
    console.log(`Server is running at http://localhost:${PORT}`);
})