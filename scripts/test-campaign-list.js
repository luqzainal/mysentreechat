#!/usr/bin/env node

// Test script specifically for campaign listing
const axios = require('axios');

const testCampaignListing = async () => {
  const baseURL = 'http://localhost:5000/api';
  
  // Get token from environment or set a placeholder
  const testToken = process.env.TEST_TOKEN || 'Bearer your-test-token-here';
  
  console.log('🚀 Testing Campaign Listing...\n');
  
  try {
    // Test 1: Get devices first
    console.log('1. Getting available devices...');
    let deviceId = null;
    try {
      const devicesResponse = await axios.get(`${baseURL}/whatsapp/devices`, {
        headers: { 'Authorization': testToken }
      });
      
      const devices = devicesResponse.data;
      if (devices.length > 0) {
        deviceId = devices[0].id;
        console.log(`✅ Found device: ${deviceId}`);
        console.log(`   Device name: ${devices[0].name || 'N/A'}`);
        console.log(`   Phone number: ${devices[0].phoneNumber || devices[0].number || 'N/A'}\n`);
      } else {
        console.log('❌ No devices found. Please connect a device first.\n');
        return;
      }
    } catch (error) {
      console.log('❌ Failed to get devices:', error.response?.data?.message || error.message);
      return;
    }
    
    // Test 2: Get AI chatbot campaigns
    console.log('2. Testing AI Chatbot campaign listing...');
    try {
      const campaignsResponse = await axios.get(`${baseURL}/ai-chatbot/${deviceId}/campaigns`, {
        headers: { 'Authorization': testToken }
      });
      
      const campaigns = campaignsResponse.data;
      console.log(`✅ Successfully fetched ${campaigns.length} AI chatbot campaigns`);
      
      if (campaigns.length > 0) {
        console.log('   Campaign details:');
        campaigns.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.name || campaign._id}`);
          console.log(`      Status: ${campaign.status}`);
          console.log(`      Last edited: ${campaign.lastEdited}`);
          console.log(`      Media: ${campaign.media ? 'Yes' : 'No'}`);
          console.log(`      AI enabled: ${campaign.useAI ? 'Yes' : 'No'}`);
        });
      } else {
        console.log('   No campaigns found for this device.');
      }
      console.log('');
    } catch (error) {
      console.log('❌ Failed to get AI chatbot campaigns:');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.message || error.message}`);
      if (error.response?.data) {
        console.log(`   Response data:`, JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Test 3: Get bulk campaigns for comparison
    console.log('3. Testing Bulk campaign listing...');
    try {
      const bulkResponse = await axios.get(`${baseURL}/campaigns/${deviceId}`, {
        headers: { 'Authorization': testToken }
      });
      
      const bulkCampaigns = bulkResponse.data;
      console.log(`✅ Successfully fetched ${bulkCampaigns.length} bulk campaigns`);
      
      if (bulkCampaigns.length > 0) {
        console.log('   Bulk campaign details:');
        bulkCampaigns.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.name}`);
          console.log(`      Status: ${campaign.status}`);
          console.log(`      Last edited: ${campaign.lastEdited}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log('❌ Failed to get bulk campaigns:');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('🎉 Campaign listing test completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
};

// Check if token is provided
if (!process.env.TEST_TOKEN) {
  console.log('❌ No authentication token provided.');
  console.log('Please set environment variable TEST_TOKEN with your bearer token:');
  console.log('Example: TEST_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." node scripts/test-campaign-list.js');
  process.exit(1);
}

// Run test
testCampaignListing();