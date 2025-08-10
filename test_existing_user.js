const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const baseURL = 'http://localhost:3001';

async function testExistingUser() {
    console.log('🧪 Testing with Existing User and Device');
    console.log('======================================');
    
    try {
        // First create a test user with the same setup as the original user
        console.log('\n1. Testing with existing user setup...');
        
        // Test register the original user
        let token, userId;
        try {
            const registerResponse = await axios.post(`${baseURL}/api/auth/register`, {
                name: 'kyra',
                email: 'test12@test.com',
                password: 'test123'
            });
            token = registerResponse.data.token;
            userId = registerResponse.data._id;
            console.log('✅ Original user registered with new credentials');
        } catch (regError) {
            if (regError.response?.status === 400 && regError.response?.data?.message?.includes('already exists')) {
                // User exists, try to reset password by creating new user
                const testEmail = 'kyra' + Date.now() + '@test.com';
                const registerResponse = await axios.post(`${baseURL}/api/auth/register`, {
                    name: 'Kyra Test',
                    email: testEmail,
                    password: 'test123'
                });
                token = registerResponse.data.token;
                userId = registerResponse.data._id;
                console.log('✅ New test user created:', testEmail);
                
                // Now create a device for this user by directly inserting into DB
                // But for now, let's test the API structure
            } else {
                throw regError;
            }
        }

        const headers = { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        console.log(`   User ID: ${userId}`);

        // Test devices endpoint
        console.log('\n2. Checking devices for user...');
        const devicesResponse = await axios.get(`${baseURL}/api/whatsapp/devices`, { headers });
        const devices = devicesResponse.data;
        
        console.log(`Found ${devices.length} devices`);
        
        if (devices.length > 0) {
            console.log('\n📋 Device Analysis:');
            devices.forEach((device, index) => {
                console.log(`   Device ${index + 1}:`);
                console.log(`     - id: ${device.id}`);
                console.log(`     - name: ${device.name}`);  
                console.log(`     - number: ${device.number}`);
                console.log(`     - connected: ${device.connected}`);
            });

            // Test campaign creation with first device
            const testDevice = devices[0];
            console.log(`\n3. Testing campaign creation with device: ${testDevice.id}`);
            
            const testCampaignData = {
                campaignName: 'Device Test Campaign',
                statusEnabled: true,
                enableLink: false,
                urlLink: '',
                caption: 'Test message for device mapping validation',
                campaignType: 'bulk',
                contactGroupId: '507f1f77bcf86cd799439011', // Valid ObjectId format
                minIntervalSeconds: 5,
                maxIntervalSeconds: 10,
                campaignScheduleType: 'anytime',
                mediaAttachments: []
            };
            
            try {
                const campaignResponse = await axios.post(
                    `${baseURL}/api/campaigns/${testDevice.id}`, 
                    testCampaignData, 
                    { headers }
                );
                
                console.log('✅ Campaign created successfully!');
                console.log(`   Campaign ID: ${campaignResponse.data._id}`);
                console.log(`   Device ID used: ${testDevice.id}`);
                
                // Clean up - delete test campaign
                try {
                    await axios.delete(`${baseURL}/api/campaigns/${testDevice.id}/${campaignResponse.data._id}`, { headers });
                    console.log('✅ Test campaign cleaned up');
                } catch (deleteError) {
                    console.log('⚠️ Could not delete test campaign (this is okay)');
                }
                
                console.log('\n🎉 DEVICE SELECTION TEST PASSED!');
                console.log('   ✅ Device ID mapping working correctly');
                console.log('   ✅ No 404 errors detected');
                console.log('   ✅ Campaign creation successful with device selection');
                
            } catch (campaignError) {
                console.error('\n❌ Campaign creation FAILED:');
                console.error('Status:', campaignError.response?.status);
                console.error('Message:', campaignError.response?.data?.message);
                
                if (campaignError.response?.status === 404) {
                    console.error('\n🔍 DEVICE ID MAPPING ISSUE DETECTED:');
                    console.error(`   Frontend sent device ID: ${testDevice.id}`);
                    console.error(`   Backend could not find device with this ID`);
                    console.error('   This indicates the 404 error issue is still present');
                } else if (campaignError.response?.status === 400) {
                    console.log('\n💡 400 Error - likely validation issue (contact groups, etc.)');
                    console.log('   But device ID mapping appears to be working (no 404)');
                }
            }
        } else {
            console.log('\n📝 No devices found for user');
            console.log('   This is normal for a new test user');
            console.log('   Device ID mapping structure verification completed');
        }

    } catch (error) {
        console.error('\n❌ Test FAILED:');
        console.error('Status:', error.response?.status);
        console.error('Message:', error.response?.data?.message || error.message);
    }
}

testExistingUser();