const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });
const WhatsappDevice = require('./backend/models/WhatsappDevice.js');
const User = require('./backend/models/User.js');

async function assignDeviceToTestUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Find test user
    const testUser = await User.findOne({ email: 'devicetest@test.com' });
    if (!testUser) {
      console.log('Test user not found');
      return;
    }
    console.log('Test user found:', testUser._id);
    
    // Check if test user has any devices
    let device = await WhatsappDevice.findOne({ userId: testUser._id });
    
    if (!device) {
      // Find the existing device and assign it to test user
      const existingDevice = await WhatsappDevice.findOne({ deviceId: '601127592769' });
      if (existingDevice) {
        existingDevice.userId = testUser._id;
        await existingDevice.save();
        console.log('Assigned existing device to test user');
        device = existingDevice;
      } else {
        // Create new device
        device = await WhatsappDevice.create({
          userId: testUser._id,
          deviceId: 'test-device-' + Date.now(),
          name: 'Test Device',
          number: '+1234567890',
          connectionStatus: 'disconnected'
        });
        console.log('Created new device for test user');
      }
    }
    
    console.log('Device for test user:', device.deviceId);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.disconnect();
  }
}

assignDeviceToTestUser();