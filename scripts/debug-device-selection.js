#!/usr/bin/env node

// Debug script for device selection issues
const axios = require('axios');

const debugDeviceSelection = async () => {
  const baseURL = 'http://localhost:5000/api';
  const testToken = process.env.TEST_TOKEN || 'Bearer your-test-token-here';
  
  console.log('🔍 Debugging Device Selection Issues...\n');
  
  try {
    // Test 1: Check devices endpoint
    console.log('1. Testing /whatsapp/devices endpoint...');
    try {
      const devicesResponse = await axios.get(`${baseURL}/whatsapp/devices`, {
        headers: { 'Authorization': testToken }
      });
      
      const devices = devicesResponse.data;
      console.log(`✅ Found ${devices.length} device(s)`);
      
      if (devices.length > 0) {
        devices.forEach((device, index) => {
          console.log(`   ${index + 1}. Device ID: ${device.id || device._id || device.deviceId}`);
          console.log(`      Name: ${device.name || 'N/A'}`);
          console.log(`      Phone: ${device.phoneNumber || device.number || 'N/A'}`);
          console.log(`      Status: ${device.connectionStatus || device.status || 'N/A'}`);
          console.log(`      Full object keys: ${Object.keys(device).join(', ')}\n`);
        });
      } else {
        console.log('❌ No devices found. This could be why device selection is not working.');
        console.log('   Please connect a WhatsApp device first.\n');
        return;
      }
    } catch (error) {
      console.log('❌ Failed to fetch devices:', error.response?.data?.message || error.message);
      return;
    }
    
    // Test 2: Check if devices can be used for campaigns
    console.log('2. Testing device compatibility for campaigns...');
    try {
      const devicesResponse = await axios.get(`${baseURL}/whatsapp/devices`, {
        headers: { 'Authorization': testToken }
      });
      
      const devices = devicesResponse.data;
      const firstDevice = devices[0];
      
      if (firstDevice) {
        const deviceId = firstDevice.id || firstDevice._id || firstDevice.deviceId;
        console.log(`   Testing device: ${deviceId}`);
        
        // Test if we can fetch campaigns for this device
        try {
          const campaignsResponse = await axios.get(`${baseURL}/campaigns/${deviceId}`, {
            headers: { 'Authorization': testToken }
          });
          console.log(`   ✅ Device ${deviceId} can be used for bulk campaigns (${campaignsResponse.data.length} campaigns found)`);
        } catch (campaignError) {
          console.log(`   ❌ Device ${deviceId} cannot be used for bulk campaigns:`, campaignError.response?.data?.message || campaignError.message);
        }
        
        // Test AI chatbot compatibility
        try {
          const aiCampaignsResponse = await axios.get(`${baseURL}/ai-chatbot/${deviceId}/campaigns`, {
            headers: { 'Authorization': testToken }
          });
          console.log(`   ✅ Device ${deviceId} can be used for AI chatbot campaigns (${aiCampaignsResponse.data.length} campaigns found)`);
        } catch (aiCampaignError) {
          console.log(`   ❌ Device ${deviceId} cannot be used for AI chatbot campaigns:`, aiCampaignError.response?.data?.message || aiCampaignError.message);
        }
      }
    } catch (error) {
      console.log('❌ Failed to test device compatibility:', error.message);
    }
    
    console.log('\n3. Device Selection Troubleshooting Tips:');
    console.log('   - Make sure at least one WhatsApp device is connected');
    console.log('   - Check if device status is "connected"');
    console.log('   - Verify user has access to the device');
    console.log('   - Try refreshing the page after connecting device');
    console.log('   - Check browser console for JavaScript errors');
    
    console.log('\n🎉 Device selection debug completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
};

// Check if token is provided
if (!process.env.TEST_TOKEN) {
  console.log('❌ No authentication token provided.');
  console.log('Please set environment variable TEST_TOKEN with your bearer token:');
  console.log('Example: TEST_TOKEN="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." node scripts/debug-device-selection.js');
  process.exit(1);
}

// Run debug
debugDeviceSelection();