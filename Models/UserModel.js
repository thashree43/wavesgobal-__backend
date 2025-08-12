import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
name:{
    type:String,
    required:true
},
email:{
    type:String,
    required:true
},
mobile:{
    type:String,
    required:true
},
password:{
    type:String,
    required:true
},
isAdmin:{
    type:Boolean,
    default:false
},
isVerified:{
    type:Boolean,
    default:false
},
token:{
    type:String
}
})
const UserModel = mongoose.model("User",UserSchema)

export default UserModel
