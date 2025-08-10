const axios = require('axios');

// Test script untuk campaign API
const testCampaignAPI = async () => {
  const baseURL = 'http://localhost:5000/api';
  
  try {
    console.log('🚀 Testing Campaign API...');
    
    // Test 1: Check if server is running
    console.log('\n1. Testing server connection...');
    try {
      const response = await axios.get(`${baseURL}/users/profile`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server connection failed:', error.message);
      return;
    }
    
    // Test 2: Test campaign creation with minimal data
    console.log('\n2. Testing campaign creation...');
    const testData = new FormData();
    testData.append('campaignName', 'Test Campaign');
    testData.append('campaignType', 'bulk');
    testData.append('contactGroupId', 'test-group-id');
    testData.append('statusEnabled', 'true');
    testData.append('enableLink', 'false');
    testData.append('useAI', 'false');
    
    try {
      const response = await axios.post(`${baseURL}/campaigns/test-device-id`, testData, {
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'multipart/form-data'
        }
      });
      console.log('✅ Campaign creation test passed');
      console.log('Response:', response.data);
    } catch (error) {
      console.log('❌ Campaign creation failed:');
      console.log('Status:', error.response?.status);
      console.log('Message:', error.response?.data?.message);
      console.log('Error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run test
testCampaignAPI();
