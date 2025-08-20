#!/usr/bin/env node

const mongoose = require('mongoose');
const Campaign = require('./backend/models/Campaign.js');

// Test data setup
const createTestData = async () => {
  console.log('Creating test data...');
  
  const testUserId = new mongoose.Types.ObjectId();
  const testDeviceId = 'test-device-123';
  
  // Create test campaigns with various contactGroupId scenarios
  const testCampaigns = [
    {
      userId: testUserId,
      deviceId: testDeviceId,
      campaignName: 'Test Campaign - Normal Group',
      campaignType: 'bulk',
      contactGroupId: new mongoose.Types.ObjectId(), // Normal contact group
      statusEnabled: true
    },
    {
      userId: testUserId,
      deviceId: testDeviceId,
      campaignName: 'Test Campaign - All Contacts String',
      campaignType: 'bulk',
      contactGroupId: 'all_contacts', // Already correct
      statusEnabled: true
    },
    {
      userId: testUserId,
      deviceId: testDeviceId,
      campaignName: 'Test Campaign - Problematic ObjectId',
      campaignType: 'bulk',
      contactGroupId: mongoose.Types.ObjectId.createFromHexString('616c6c5f636f6e7461637473'), // This should be fixed
      statusEnabled: true
    },
    {
      userId: testUserId,
      deviceId: testDeviceId,
      campaignName: 'Test Campaign - AI Chatbot',
      campaignType: 'ai_chatbot',
      name: 'Test AI Bot',
      captionAi: 'Hello from AI bot',
      statusEnabled: true
    }
  ];
  
  const createdCampaigns = await Campaign.insertMany(testCampaigns);
  console.log(`✅ Created ${createdCampaigns.length} test campaigns`);
  
  return {
    testUserId,
    testDeviceId,
    createdCampaigns
  };
};

// Verify test data before migration
const verifyBeforeMigration = async (testData) => {
  console.log('\nVerifying data BEFORE migration...');
  
  const campaigns = await Campaign.find({
    userId: testData.testUserId
  });
  
  console.log(`Found ${campaigns.length} test campaigns:`);
  campaigns.forEach((campaign, index) => {
    console.log(`${index + 1}. ${campaign.campaignName}`);
    console.log(`   Type: ${campaign.campaignType}`);
    console.log(`   contactGroupId: ${campaign.contactGroupId} (Type: ${typeof campaign.contactGroupId})`);
    if (campaign.contactGroupId) {
      console.log(`   contactGroupId hex: ${campaign.contactGroupId.toString()}`);
    }
    console.log('');
  });
  
  // Check for the problematic ObjectId
  const problematicCampaign = campaigns.find(c => 
    c.contactGroupId && c.contactGroupId.toString() === '616c6c5f636f6e7461637473'
  );
  
  if (problematicCampaign) {
    console.log(`✅ Found problematic campaign: ${problematicCampaign.campaignName}`);
    console.log(`   contactGroupId should be migrated: ${problematicCampaign.contactGroupId.toString()}`);
  } else {
    console.log(`❌ No problematic campaign found - test setup may have failed`);
  }
};

// Run migration on test data
const runMigration = async () => {
  console.log('\nRunning migration...');
  
  const { migrateAllContactsCampaigns } = require('./migrate_all_contacts.js');
  const result = await migrateAllContactsCampaigns();
  
  console.log('Migration result:', result);
  return result;
};

// Verify test data after migration
const verifyAfterMigration = async (testData) => {
  console.log('\nVerifying data AFTER migration...');
  
  const campaigns = await Campaign.find({
    userId: testData.testUserId
  });
  
  console.log(`Found ${campaigns.length} test campaigns:`);
  let fixedCampaignFound = false;
  
  campaigns.forEach((campaign, index) => {
    console.log(`${index + 1}. ${campaign.campaignName}`);
    console.log(`   Type: ${campaign.campaignType}`);
    console.log(`   contactGroupId: ${campaign.contactGroupId} (Type: ${typeof campaign.contactGroupId})`);
    
    if (campaign.campaignName.includes('Problematic ObjectId') && campaign.contactGroupId === 'all_contacts') {
      console.log(`   ✅ SUCCESS: Problematic ObjectId was fixed!`);
      fixedCampaignFound = true;
    }
    console.log('');
  });
  
  if (!fixedCampaignFound) {
    console.log(`❌ FAILED: Problematic campaign was not fixed correctly`);
    return false;
  }
  
  // Check that normal campaigns weren't affected
  const normalCampaign = campaigns.find(c => c.campaignName.includes('Normal Group'));
  if (normalCampaign && normalCampaign.contactGroupId !== 'all_contacts' && mongoose.Types.ObjectId.isValid(normalCampaign.contactGroupId)) {
    console.log(`✅ SUCCESS: Normal campaigns were not affected`);
  } else {
    console.log(`❌ FAILED: Normal campaigns were incorrectly modified`);
    return false;
  }
  
  return true;
};

// Cleanup test data
const cleanupTestData = async (testData) => {
  console.log('\nCleaning up test data...');
  
  const result = await Campaign.deleteMany({
    userId: testData.testUserId
  });
  
  console.log(`✅ Deleted ${result.deletedCount} test campaigns`);
};

// Database connection
const connectDB = async () => {
  try {
    // Use test database to avoid affecting production data
    const testDbUri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/waziper_test';
    const conn = await mongoose.connect(testDbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`Test MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('Test database connection failed:', error);
    process.exit(1);
  }
};

// Main test execution
const runTest = async () => {
  console.log('🧪 Starting Migration Test Suite');
  console.log('=' .repeat(50));
  
  try {
    // Connect to test database
    await connectDB();
    
    // Create test data
    const testData = await createTestData();
    
    // Verify before migration
    await verifyBeforeMigration(testData);
    
    // Run migration
    const migrationResult = await runMigration();
    
    if (!migrationResult.success) {
      console.error('❌ Migration failed:', migrationResult.error);
      await cleanupTestData(testData);
      process.exit(1);
    }
    
    // Verify after migration
    const verificationResult = await verifyAfterMigration(testData);
    
    // Cleanup
    await cleanupTestData(testData);
    
    // Final result
    if (verificationResult) {
      console.log('\n🎉 All tests passed! Migration script is ready for production.');
      process.exit(0);
    } else {
      console.log('\n❌ Tests failed! Please check the migration script.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  }
};

// Run the test if this script is executed directly
if (require.main === module) {
  runTest();
}

module.exports = { runTest };