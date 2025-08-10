import  express  from "express";
import path from "path";
import { addLocation } from "../Controller/AdminController.js";
const Adminrouter = express.Router()

Adminrouter.post("/addlocation",addLocation)

export default Adminrouter