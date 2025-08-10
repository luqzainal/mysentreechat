#!/usr/bin/env node

// Quick debug script to test campaign validation
const mongoose = require('mongoose');
const Campaign = require('../backend/models/Campaign');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/waziper-v2');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

const testCampaignValidation = async () => {
  await connectDB();
  
  console.log('Testing Campaign Model Validation...\n');
  
  // Test 1: Bulk Campaign (should work)
  console.log('1. Testing Bulk Campaign Creation...');
  try {
    const bulkCampaign = new Campaign({
      userId: new mongoose.Types.ObjectId(),
      deviceId: 'test-device-1',
      campaignType: 'bulk',
      campaignName: 'Test Bulk Campaign',
      statusEnabled: true,
      contactGroupId: new mongoose.Types.ObjectId(),
      caption: 'Test bulk message'
    });
    
    await bulkCampaign.validate();
    console.log('✅ Bulk campaign validation passed');
  } catch (error) {
    console.log('❌ Bulk campaign validation failed:', error.message);
  }
  
  // Test 2: AI Chatbot Campaign (should work)
  console.log('\n2. Testing AI Chatbot Campaign Creation...');
  try {
    const aiCampaign = new Campaign({
      userId: new mongoose.Types.ObjectId(),
      deviceId: 'test-device-2',
      campaignType: 'ai_chatbot',
      name: 'Test AI Chatbot',
      captionAi: 'Hello! This is an AI response.',
      status: 'enable',
      type: 'message_contains_keyword',
      keywords: ['hello', 'hi']
    });
    
    await aiCampaign.validate();
    console.log('✅ AI Chatbot campaign validation passed');
  } catch (error) {
    console.log('❌ AI Chatbot campaign validation failed:', error.message);
  }
  
  // Test 3: AI Chatbot without name (should fail)
  console.log('\n3. Testing AI Chatbot without name (should fail)...');
  try {
    const aiCampaignNoName = new Campaign({
      userId: new mongoose.Types.ObjectId(),
      deviceId: 'test-device-3',
      campaignType: 'ai_chatbot',
      captionAi: 'Hello! This is an AI response.',
      status: 'enable'
    });
    
    await aiCampaignNoName.validate();
    console.log('❌ This should have failed but didn\'t');
  } catch (error) {
    console.log('✅ Correctly failed validation:', error.message);
  }
  
  // Test 4: AI Chatbot without captionAi (should fail)
  console.log('\n4. Testing AI Chatbot without captionAi (should fail)...');
  try {
    const aiCampaignNoCaption = new Campaign({
      userId: new mongoose.Types.ObjectId(),
      deviceId: 'test-device-4',
      campaignType: 'ai_chatbot',
      name: 'Test AI Chatbot',
      status: 'enable'
    });
    
    await aiCampaignNoCaption.validate();
    console.log('❌ This should have failed but didn\'t');
  } catch (error) {
    console.log('✅ Correctly failed validation:', error.message);
  }
  
  // Test 5: Bulk Campaign without campaignName (should fail)
  console.log('\n5. Testing Bulk Campaign without campaignName (should fail)...');
  try {
    const bulkCampaignNoName = new Campaign({
      userId: new mongoose.Types.ObjectId(),
      deviceId: 'test-device-5',
      campaignType: 'bulk',
      statusEnabled: true,
      contactGroupId: new mongoose.Types.ObjectId(),
      caption: 'Test bulk message'
    });
    
    await bulkCampaignNoName.validate();
    console.log('❌ This should have failed but didn\'t');
  } catch (error) {
    console.log('✅ Correctly failed validation:', error.message);
  }
  
  console.log('\n🎉 Campaign validation tests completed!');
  mongoose.connection.close();
};

testCampaignValidation().catch(console.error);