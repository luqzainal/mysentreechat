// Check if we're in the right directory and load dependencies
const path = require('path');
const fs = require('fs');

// Try to load mongoose from backend node_modules
let mongoose, dotenv;
try {
  // Use path.resolve to get absolute path
  const mongoosePath = path.resolve('./backend/node_modules/mongoose');
  const dotenvPath = path.resolve('./backend/node_modules/dotenv');
  
  mongoose = require(mongoosePath);
  dotenv = require(dotenvPath);
} catch (error) {
  console.error('❌ Error: Cannot find mongoose or dotenv in backend/node_modules');
  console.error('Please make sure to run: cd backend && npm install');
  console.error('Error details:', error.message);
  process.exit(1);
}

// Load environment variables
dotenv.config({ path: './backend/.env' });

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/waziper_v2');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

// Function untuk clear semua collections
const clearAllCollections = async () => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('⚠️  WARNING: This will delete ALL data in the database!');
    console.log('📋 Collections that will be cleared:');
    collections.forEach((collection, index) => {
      console.log(`   ${index + 1}. ${collection.name}`);
    });
    console.log('');
    
    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('❓ Are you sure you want to clear ALL collections? (yes/no): ', resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled by user');
      return;
    }
    
    console.log('🗑️  Clearing all collections...');
    
    for (const collection of collections) {
      await mongoose.connection.db.collection(collection.name).deleteMany({});
      console.log(`✅ Cleared collection: ${collection.name}`);
    }
    
    console.log('🎉 Database cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
  }
};

// Function untuk clear collection tertentu
const clearSpecificCollection = async (collectionName) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionExists = collections.find(col => col.name === collectionName);
    
    if (!collectionExists) {
      console.log(`❌ Collection '${collectionName}' not found`);
      console.log('Available collections:', collections.map(col => col.name).join(', '));
      return;
    }
    
    console.log(`⚠️  WARNING: This will delete ALL data in collection '${collectionName}'!`);
    
    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question(`❓ Are you sure you want to clear collection '${collectionName}'? (yes/no): `, resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled by user');
      return;
    }
    
    await mongoose.connection.db.collection(collectionName).deleteMany({});
    console.log(`✅ Cleared collection: ${collectionName}`);
  } catch (error) {
    console.error('❌ Error clearing collection:', error.message);
  }
};

// Function untuk show semua collections
const showCollections = async () => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Available collections:');
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name}`);
    });
  } catch (error) {
    console.error('❌ Error getting collections:', error.message);
  }
};

// Main function
const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log('🚀 Database Clear Script for WAZIPER V2');
  console.log('=====================================\n');
  
  // Connect to database
  await connectDB();
  
  switch (command) {
    case 'all':
      console.log('🗑️  Clearing ALL collections...');
      await clearAllCollections();
      break;
      
    case 'collection':
      const collectionName = args[1];
      if (!collectionName) {
        console.log('❌ Please specify collection name');
        console.log('Usage: node clear-database.js collection <collection_name>');
        break;
      }
      await clearSpecificCollection(collectionName);
      break;
      
    case 'list':
      await showCollections();
      break;
      
    default:
      console.log('📖 Usage:');
      console.log('  node clear-database.js all                    - Clear all collections');
      console.log('  node clear-database.js collection <name>      - Clear specific collection');
      console.log('  node clear-database.js list                   - Show all collections');
      console.log('');
      console.log('📋 Examples:');
      console.log('  node clear-database.js all');
      console.log('  node clear-database.js collection users');
      console.log('  node clear-database.js collection contacts');
      console.log('  node clear-database.js list');
  }
  
  // Close connection
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  process.exit(0);
};

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

// Run script
main();
