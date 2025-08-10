import mongoose from 'mongoose'

const databaseConnection = async()=>{
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log("database is connected")
  } catch (error) {
    console.error("databse connection error",error)
    throw error
  }
}

export default databaseConnection