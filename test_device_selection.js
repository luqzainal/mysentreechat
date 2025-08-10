const axios = require('axios');
require('dotenv').config();

const baseURL = 'http://localhost:3001';
const testUser = {
    email: 'test12@test.com',
    password: 'test123' // Try common test passwords
};

async function testDeviceSelection() {
    console.log('🧪 Testing Device Selection Functionality');
    console.log('==========================================');
    
    try {
        // Step 0: Register a test user first
        console.log('\n0. Registering test user...');
        try {
            const registerResponse = await axios.post(`${baseURL}/api/auth/register`, {
                name: 'Test Device User',
                email: 'devicetest@test.com',
                password: 'test123'
            });
            console.log('✅ Test user registered successfully');
        } catch (regError) {
            if (regError.response?.status === 400 && regError.response?.data?.message?.includes('already exists')) {
                console.log('✅ Test user already exists, proceeding...');
            } else {
                throw regError;
            }
        }
        
        // Step 1: Login
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            email: 'devicetest@test.com',
            password: 'test123'
        });
        const token = loginResponse.data.token;
        const userId = loginResponse.data._id;
        console.log('✅ Login successful, User ID:', userId);
        
        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        // Step 2: Create a test device if none exists
        console.log('\n2. Checking for devices...');
        let devicesResponse = await axios.get(`${baseURL}/api/whatsapp/devices`, { headers });
        let devices = devicesResponse.data;
        console.log(`Found ${devices.length} existing device(s)`);
        
        if (devices.length === 0) {
            console.log('Creating test device...');
            // We need to create a device directly in the database since the API doesn't have a create device endpoint
            const mongoose = require('mongoose');
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/waziper');
            
            const WhatsappDevice = require('./backend/models/WhatsappDevice.js');
            const testDevice = await WhatsappDevice.create({
                userId: userId,
                deviceId: 'test-device-' + Date.now(),
                name: 'Test Device',
                number: '+1234567890',
                connectionStatus: 'disconnected'
            });
            
            mongoose.disconnect();
            console.log('✅ Test device created:', testDevice.deviceId);
            
            // Fetch devices again
            devicesResponse = await axios.get(`${baseURL}/api/whatsapp/devices`, { headers });
            devices = devicesResponse.data;
        }
        
        console.log(`✅ Using ${devices.length} device(s) for testing:`);
        devices.forEach(device => {
            console.log(`   - ID: ${device.id}`);
            console.log(`   - Name: ${device.name}`);
            console.log(`   - Number: ${device.number}`);
            console.log(`   - Connected: ${device.connected}`);
            console.log('   ---');
        });
        
        const testDevice = devices[0];
        console.log(`\n3. Using device: ${testDevice.id} for campaign test`);
        
        // Step 3: Test campaign creation with proper device ID
        console.log('\n4. Testing campaign creation...');
        const campaignData = {
            campaignName: 'Test Device Selection Campaign',
            statusEnabled: true,
            enableLink: false,
            urlLink: '',
            caption: 'Test message for device selection',
            campaignType: 'bulk',
            contactGroupId: 'test-group-id', // We'll need a valid group ID
            scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            minIntervalSeconds: 5,
            maxIntervalSeconds: 10,
            campaignScheduleType: 'anytime',
            mediaAttachments: []
        };
        
        // First, let's check if there are contact groups
        try {
            const groupsResponse = await axios.get(`${baseURL}/api/contacts/groups`, { headers });
            const groups = groupsResponse.data;
            console.log(`   Found ${groups.length} contact group(s)`);
            
            if (groups.length > 0) {
                campaignData.contactGroupId = groups[0]._id;
                console.log(`   Using group: ${groups[0].name} (${groups[0]._id})`);
            } else {
                console.log('   No contact groups found - creating test group...');
                const testGroup = {
                    name: 'Test Group for Device Selection',
                    description: 'Temporary test group',
                    contacts: []
                };
                const createGroupResponse = await axios.post(`${baseURL}/api/contacts/groups`, testGroup, { headers });
                campaignData.contactGroupId = createGroupResponse.data._id;
                console.log(`   Created test group: ${createGroupResponse.data._id}`);
            }
        } catch (groupError) {
            console.log('   ⚠️ Could not fetch/create contact groups:', groupError.response?.data?.message || groupError.message);
            // Continue with a dummy group ID for testing API structure
            campaignData.contactGroupId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
        }
        
        // Test campaign creation
        const campaignResponse = await axios.post(
            `${baseURL}/api/campaigns/${testDevice.id}`, 
            campaignData, 
            { headers }
        );
        
        console.log('✅ Campaign created successfully!');
        console.log(`   Campaign ID: ${campaignResponse.data._id}`);
        console.log(`   Device ID used: ${testDevice.id}`);
        console.log(`   Campaign Name: ${campaignResponse.data.campaignName}`);
        
        // Step 4: Verify the campaign was saved with correct device ID
        console.log('\n5. Verifying campaign was saved correctly...');
        const campaignsResponse = await axios.get(`${baseURL}/api/campaigns/${testDevice.id}`, { headers });
        const savedCampaigns = campaignsResponse.data;
        
        const savedCampaign = savedCampaigns.find(c => c.id === campaignResponse.data._id);
        if (savedCampaign) {
            console.log('✅ Campaign found in device campaigns list');
            console.log(`   Saved campaign name: ${savedCampaign.name}`);
        } else {
            console.log('❌ Campaign not found in device campaigns list');
        }
        
        // Clean up - delete test campaign
        console.log('\n6. Cleaning up - deleting test campaign...');
        await axios.delete(`${baseURL}/api/campaigns/${testDevice.id}/${campaignResponse.data._id}`, { headers });
        console.log('✅ Test campaign deleted');
        
        console.log('\n🎉 Device Selection Test PASSED - No 404 errors detected!');
        
    } catch (error) {
        console.error('\n❌ Test FAILED:');
        console.error('Status:', error.response?.status);
        console.error('Message:', error.response?.data?.message || error.message);
        
        if (error.response?.status === 404) {
            console.error('\n🔍 404 Error Analysis:');
            console.error('URL:', error.config?.url);
            console.error('Method:', error.config?.method);
            console.error('This suggests device ID mapping issues between frontend and backend');
        }
        
        process.exit(1);
    }
}

testDeviceSelection();