const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars if running separately (optional)
dotenv.config(); 

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Opsyen Mongoose 6 tidak memerlukan banyak flag lama
      // useNewUrlParser: true, 
      // useUnifiedTopology: true,
      // useCreateIndex: true, // Tidak disokong
      // useFindAndModify: false // Tidak disokong
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB; 