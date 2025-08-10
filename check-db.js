const mongoose = require('./backend/node_modules/mongoose');

mongoose.connect('mongodb://109.123.234.112:27017/chatbotkuasaplusdb');

mongoose.connection.once('open', async () => {
  console.log('✅ Connected to MongoDB');
  
  // List all collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\n📁 Collections in database:');
  collections.forEach(col => console.log(`- ${col.name}`));
  
  // Check users collection directly
  const usersCollection = mongoose.connection.db.collection('users');
  const userCount = await usersCollection.countDocuments();
  console.log(`\n👥 Users collection count: ${userCount}`);
  
  if (userCount > 0) {
    const users = await usersCollection.find({}).toArray();
    console.log('\n📋 Users found:');
    users.forEach(user => {
      console.log(`- ID: ${user._id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Admin: ${user.isAdmin}`);
      console.log('---');
    });
  }
  
  mongoose.connection.close();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});