const mongoose = require('./backend/node_modules/mongoose');
const bcrypt = require('./backend/node_modules/bcryptjs');

// Connect to MongoDB
mongoose.connect('mongodb://109.123.234.112:27017/chatbotkuasaplusdb');

// Import User model dari backend
const User = require('./backend/models/User');

async function resetPassword() {
  try {    
    const email = 'evodagang.malaysia@gmail.com';
    const newPassword = 'admin123'; // Password baru yang senang ingat
    
    console.log(`🔄 Resetting password for: ${email}`);
    
    // Hash password baru
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update user password
    const result = await User.updateOne(
      { email: email },
      { password: hashedPassword }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Password berjaya direset!');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password baru: ${newPassword}`);
    } else {
      console.log('❌ User tidak ditemui');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

resetPassword();