import mongoose from "mongoose";

const Schema = new mongoose.Schema({
 name:{
    type:String,
    required:true,
    unique:true
 },
 image:{
    type:String,
 }
},{timestamps:true});

const categorymodel = mongoose.model('Category',CategorySchema)

export default categorymodel