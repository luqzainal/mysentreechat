const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// Test user credentials
const testUser = {
    email: process.env.TEST_USER_EMAIL || 'testuser@example.com',
    password: process.env.TEST_USER_PASSWORD || 'testpass123'
};

let authToken = null;
let testDeviceId = null;
let testCampaignId = null;

async function loginTestUser() {
    try {
        console.log('🔐 Logging in test user...');
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });
        
        authToken = response.data.token;
        console.log('✅ Login successful');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function getTestDevice() {
    try {
        console.log('📱 Getting test device...');
        const response = await axios.get(`${API_BASE_URL}/whatsapp/devices`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.data && response.data.length > 0) {
            testDeviceId = response.data[0].id;
            console.log(`✅ Using device: ${testDeviceId} (${response.data[0].name || 'Unnamed'})`);
            return true;
        } else {
            console.log('❌ No devices found');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to get devices:', error.response?.data?.message || error.message);
        return false;
    }
}

async function createTestAICampaign() {
    try {
        console.log('🤖 Creating test AI campaign...');
        
        const campaignData = {
            name: `AI Test Campaign ${Date.now()}`,
            status: 'enable',
            isNotMatchDefaultResponse: 'no',
            sendTo: 'all',
            type: 'message_contains_keyword',
            description: 'Test AI chatbot campaign for integration testing',
            keywords: 'test,hello,ai',
            nextBotAction: '',
            presenceDelayTime: '2',
            presenceDelayStatus: 'enable_typing',
            saveData: 'no_save_response',
            apiRestDataStatus: 'disabled',
            captionAi: 'Hello! This is an AI-powered response. How can I help you today?',
            useAiFeature: 'use_ai',
            aiSpintax: '{Hello|Hi|Greetings}! This is an {AI-powered|automated|intelligent} response generated on {[now_formatted|DD/MM/YYYY]} at {[now_formatted|HH:mm]}. How can I {help|assist} you today?'
        };

        const response = await axios.post(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns`,
            campaignData,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        testCampaignId = response.data._id;
        console.log(`✅ AI campaign created: ${testCampaignId}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to create AI campaign:', error.response?.data?.message || error.message);
        console.error('   Details:', error.response?.data);
        return false;
    }
}

async function testAICampaignFeatures() {
    try {
        console.log('\n🧪 Testing AI campaign features...');
        
        // Test get campaign
        console.log('  📋 Getting AI campaign details...');
        const getResponse = await axios.get(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        const campaign = getResponse.data.find(c => c._id === testCampaignId);
        if (campaign) {
            console.log(`  ✅ Campaign retrieved: ${campaign.name}`);
            console.log(`     - Status: ${campaign.status}`);
            console.log(`     - Uses AI: ${campaign.useAI ? 'Yes' : 'No'}`);
            console.log(`     - Keywords: ${campaign.keywords}`);
        } else {
            console.log('  ❌ Campaign not found in list');
            return false;
        }

        // Test update campaign
        console.log('  ✏️ Updating AI campaign...');
        const updateData = {
            name: campaign.name + ' (Updated)',
            captionAi: 'Updated AI response with enhanced capabilities!',
            aiSpintax: '{Updated|Enhanced|Improved} AI response! Current time: {[now_formatted|HH:mm:ss]}'
        };
        
        await axios.put(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}`,
            updateData,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('  ✅ Campaign updated successfully');

        // Test toggle status
        console.log('  🔄 Testing status toggle...');
        await axios.put(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}/status`,
            { status: 'disable' },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('  ✅ Campaign disabled');

        await axios.put(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}/status`,
            { status: 'enable' },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('  ✅ Campaign re-enabled');

        // Test AI settings update
        console.log('  ⚙️ Testing AI settings update...');
        const aiSettings = {
            aiModel: 'gpt-3.5-turbo',
            aiTemperature: 0.8,
            aiMaxTokens: 200,
            aiSystemPrompt: 'You are a helpful WhatsApp assistant. Respond concisely and friendly.',
            aiContextWindow: 5
        };

        await axios.put(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}/settings`,
            aiSettings,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('  ✅ AI settings updated');

        return true;
    } catch (error) {
        console.error('❌ AI campaign features test failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testAILogsAndStats() {
    try {
        console.log('\n📊 Testing AI logs and statistics...');

        // Add test log entries
        console.log('  📝 Adding test AI interaction logs...');
        const testLogs = [
            {
                input: 'Hello, how are you?',
                output: 'Hi there! I\'m doing great, thank you for asking. How can I help you today?',
                tokens: 25,
                duration: 1200
            },
            {
                input: 'What services do you offer?',
                output: 'We offer various services including customer support, product information, and general assistance. What would you like to know more about?',
                tokens: 35,
                duration: 1500
            }
        ];

        for (const log of testLogs) {
            await axios.post(
                `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}/logs`,
                log,
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        }
        console.log('  ✅ Test logs added');

        // Get logs
        console.log('  📖 Retrieving AI logs...');
        const logsResponse = await axios.get(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}/logs?page=1&limit=10`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );

        if (logsResponse.data.logs && logsResponse.data.logs.length > 0) {
            console.log(`  ✅ Retrieved ${logsResponse.data.logs.length} logs`);
            console.log(`     - Total interactions: ${logsResponse.data.stats.totalInteractions}`);
            console.log(`     - Total tokens: ${logsResponse.data.stats.totalTokens}`);
            console.log(`     - Average response time: ${logsResponse.data.stats.averageResponseTime.toFixed(2)}ms`);
        }

        // Get stats
        console.log('  📈 Getting AI statistics...');
        const statsResponse = await axios.get(
            `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}/stats`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );

        console.log('  ✅ Statistics retrieved:');
        console.log(`     - Total interactions: ${statsResponse.data.totalInteractions}`);
        console.log(`     - Total tokens used: ${statsResponse.data.totalTokens}`);
        console.log(`     - Success rate: ${(statsResponse.data.successRate * 100).toFixed(1)}%`);

        return true;
    } catch (error) {
        console.error('❌ AI logs and stats test failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function cleanupTestCampaign() {
    if (testCampaignId && testDeviceId) {
        try {
            console.log('\n🧹 Cleaning up test campaign...');
            await axios.delete(
                `${API_BASE_URL}/ai-chatbot/${testDeviceId}/campaigns/${testCampaignId}`,
                {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                }
            );
            console.log('✅ Test campaign deleted');
        } catch (error) {
            console.log('⚠️ Could not delete test campaign:', error.response?.data?.message || error.message);
        }
    }
}

async function runCampaignIntegrationTests() {
    console.log('🚀 Starting AI Campaign Integration Tests...\n');
    console.log(`🔗 API Base URL: ${API_BASE_URL}`);

    let testResults = {
        total: 0,
        passed: 0,
        failed: 0
    };

    // Step 1: Login
    const loginSuccess = await loginTestUser();
    if (!loginSuccess) {
        console.log('\n❌ Cannot proceed without authentication');
        return;
    }

    // Step 2: Get test device
    const deviceSuccess = await getTestDevice();
    testResults.total++;
    if (deviceSuccess) {
        testResults.passed++;
    } else {
        testResults.failed++;
        console.log('\n❌ Cannot proceed without a device');
        return;
    }

    // Step 3: Create AI campaign
    const createSuccess = await createTestAICampaign();
    testResults.total++;
    if (createSuccess) {
        testResults.passed++;
    } else {
        testResults.failed++;
        console.log('\n❌ Cannot proceed without creating a campaign');
        return;
    }

    // Step 4: Test AI campaign features
    const featuresSuccess = await testAICampaignFeatures();
    testResults.total++;
    if (featuresSuccess) {
        testResults.passed++;
    } else {
        testResults.failed++;
    }

    // Step 5: Test logs and statistics
    const logsSuccess = await testAILogsAndStats();
    testResults.total++;
    if (logsSuccess) {
        testResults.passed++;
    } else {
        testResults.failed++;
    }

    // Cleanup
    await cleanupTestCampaign();

    // Final results
    console.log('\n📊 === AI CAMPAIGN INTEGRATION TEST RESULTS ===');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed === 0) {
        console.log('\n🎉 All AI campaign integration tests passed!');
        console.log('✅ Your AI chatbot system is ready for production use.');
    } else {
        console.log(`\n⚠️ ${testResults.failed} test(s) failed. Check the logs above for details.`);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AI Campaign Integration Test Script

This script tests the full AI chatbot campaign functionality including:
- AI campaign creation/update/deletion
- AI settings management
- AI logs and statistics
- Campaign status management

Usage:
  node test-ai-campaign-integration.js [options]

Options:
  --help, -h          Show this help message
  --api-url <url>     Set custom API base URL

Environment Variables:
  API_BASE_URL        Base URL for the API (default: http://localhost:5000/api)
  TEST_USER_EMAIL     Email for test user login
  TEST_USER_PASSWORD  Password for test user login

Prerequisites:
1. Backend server must be running
2. Test user must exist in the system
3. At least one WhatsApp device must be connected
4. OpenAI API key must be configured for the test user

Examples:
  node test-ai-campaign-integration.js
  node test-ai-campaign-integration.js --api-url http://localhost:3000/api
`);
    process.exit(0);
}

// Run tests
runCampaignIntegrationTests().catch(error => {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
});