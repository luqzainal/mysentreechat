import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Tersambung: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Ralat Sambungan MongoDB: ${error.message}`);
    process.exit(1); // Keluar dari proses jika sambungan gagal
  }
};

export default connectDB; 