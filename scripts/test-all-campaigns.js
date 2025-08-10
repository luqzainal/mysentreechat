#!/usr/bin/env node
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test script untuk semua jenis campaign
const testAllCampaigns = async () => {
  const baseURL = 'http://localhost:5000/api';
  
  // Gunakan token sebenar dari localStorage atau environment variable
  const testToken = process.env.TEST_TOKEN || 'Bearer your-test-token-here';
  
  console.log('🚀 Testing All Campaign Types...\n');
  
  try {
    // Test 1: Test server connection
    console.log('1. Testing server connection...');
    try {
      const response = await axios.get(`${baseURL}/users/profile`, {
        headers: { 'Authorization': testToken }
      });
      console.log('✅ Server is running and authentication works\n');
    } catch (error) {
      console.log('❌ Server connection or auth failed:', error.response?.data?.message || error.message);
      console.log('Please ensure backend server is running and you have a valid token\n');
      return;
    }
    
    // Test 2: Test device listing
    console.log('2. Testing device listing...');
    let deviceId = null;
    try {
      const response = await axios.get(`${baseURL}/whatsapp/devices`, {
        headers: { 'Authorization': testToken }
      });
      const devices = response.data;
      if (devices.length > 0) {
        deviceId = devices[0].id;
        console.log(`✅ Found ${devices.length} device(s). Using device: ${deviceId}\n`);
      } else {
        console.log('❌ No devices found. Please connect a device first.\n');
        return;
      }
    } catch (error) {
      console.log('❌ Device listing failed:', error.response?.data?.message || error.message);
      return;
    }
    
    // Test 3: Test contact groups
    console.log('3. Testing contact groups...');
    let contactGroupId = null;
    try {
      const response = await axios.get(`${baseURL}/contact-groups`, {
        headers: { 'Authorization': testToken }
      });
      const groups = response.data;
      if (groups.length > 0) {
        contactGroupId = groups[0]._id;
        console.log(`✅ Found ${groups.length} contact group(s). Using group: ${groups[0].name}\n`);
      } else {
        console.log('⚠️ No contact groups found. Will create a test group...\n');
        // Create a test contact group
        const testGroup = await axios.post(`${baseURL}/contact-groups`, {
          name: 'Test Group',
          description: 'Test group for campaign testing'
        }, {
          headers: { 'Authorization': testToken }
        });
        contactGroupId = testGroup.data._id;
        console.log('✅ Created test contact group\n');
      }
    } catch (error) {
      console.log('❌ Contact group handling failed:', error.response?.data?.message || error.message);
      return;
    }
    
    // Test 4: Test Bulk Campaign Creation
    console.log('4. Testing Bulk Campaign Creation...');
    try {
      const bulkData = new FormData();
      bulkData.append('campaignName', 'Test Bulk Campaign');
      bulkData.append('campaignType', 'bulk');
      bulkData.append('contactGroupId', contactGroupId);
      bulkData.append('statusEnabled', 'true');
      bulkData.append('enableLink', 'false');
      bulkData.append('caption', 'This is a test bulk campaign message');
      bulkData.append('minIntervalSeconds', '5');
      bulkData.append('maxIntervalSeconds', '10');
      bulkData.append('campaignScheduleType', 'anytime');
      
      const response = await axios.post(`${baseURL}/campaigns/${deviceId}`, bulkData, {
        headers: { 
          'Authorization': testToken,
          ...bulkData.getHeaders()
        }
      });
      console.log('✅ Bulk campaign creation successful');
      console.log(`   Campaign ID: ${response.data._id}`);
      console.log(`   Campaign Name: ${response.data.campaignName}\n`);
    } catch (error) {
      console.log('❌ Bulk campaign creation failed:');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.message || error.message}`);
      if (error.response?.data?.error) {
        console.log(`   Details: ${JSON.stringify(error.response.data.error)}`);
      }
      console.log('');
    }
    
    // Test 5: Test AI Chatbot Campaign Creation
    console.log('5. Testing AI Chatbot Campaign Creation...');
    try {
      const aiData = new FormData();
      aiData.append('name', 'Test AI Chatbot');
      aiData.append('campaignType', 'ai_chatbot');
      aiData.append('status', 'enable');
      aiData.append('isNotMatchDefaultResponse', 'no');
      aiData.append('sendTo', 'all');
      aiData.append('type', 'message_contains_keyword');
      aiData.append('description', 'Test AI chatbot campaign');
      aiData.append('keywords', 'hai,hello,helo');
      aiData.append('presenceDelayStatus', 'disable');
      aiData.append('saveData', 'no_save_response');
      aiData.append('apiRestDataStatus', 'disabled');
      aiData.append('captionAi', 'Hello! This is an automated AI response.');
      aiData.append('useAiFeature', 'not_use_ai');
      
      const response = await axios.post(`${baseURL}/ai-chatbot/${deviceId}/campaigns`, aiData, {
        headers: { 
          'Authorization': testToken,
          ...aiData.getHeaders()
        }
      });
      console.log('✅ AI Chatbot campaign creation successful');
      console.log(`   Campaign ID: ${response.data._id}`);
      console.log(`   Campaign Name: ${response.data.name}\n`);
    } catch (error) {
      console.log('❌ AI Chatbot campaign creation failed:');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.message || error.message}`);
      if (error.response?.data?.error) {
        console.log(`   Details: ${JSON.stringify(error.response.data.error)}`);
      }
      console.log('');
    }
    
    // Test 6: Test campaign listing
    console.log('6. Testing campaign listing...');
    try {
      const [bulkCampaigns, aiCampaigns] = await Promise.all([
        axios.get(`${baseURL}/campaigns/${deviceId}`, {
          headers: { 'Authorization': testToken }
        }),
        axios.get(`${baseURL}/ai-chatbot/${deviceId}/campaigns`, {
          headers: { 'Authorization': testToken }
        })
      ]);
      
      console.log(`✅ Found ${bulkCampaigns.data.length} bulk campaign(s)`);
      console.log(`✅ Found ${aiCampaigns.data.length} AI chatbot campaign(s)\n`);
    } catch (error) {
      console.log('❌ Campaign listing failed:', error.response?.data?.message || error.message);
    }
    
    console.log('🎉 Campaign testing completed!');
    console.log('\nNOTE: If you see any failures, please check:');
    console.log('- Backend server is running (npm run server)');
    console.log('- You have a valid authentication token');
    console.log('- Your device is properly connected');
    console.log('- You have at least one contact group');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
};

// Helper function to get test token
const getTestToken = () => {
  // Try to get token from environment variable
  if (process.env.TEST_TOKEN) {
    return process.env.TEST_TOKEN;
  }
  
  console.log('No TEST_TOKEN environment variable found.');
  console.log('Please set TEST_TOKEN=Bearer_your_token_here or login to get a token.');
  console.log('You can get a token by logging into the frontend and checking localStorage.');
  return null;
};

// Check if token is provided
if (!process.env.TEST_TOKEN) {
  console.log('❌ No authentication token provided.');
  console.log('Please set environment variable TEST_TOKEN with your bearer token:');
  console.log('Example: TEST_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." node scripts/test-all-campaigns.js');
  process.exit(1);
}

// Run test
testAllCampaigns();