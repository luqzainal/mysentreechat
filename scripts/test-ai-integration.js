const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// Test configurations
const testConfigs = [
    {
        name: "Valid API Key Test",
        apiKey: "sk-test-valid-key-placeholder", // Replace with real key
        testMessage: "Hello AI! Can you respond to confirm the connection is working?",
        expectSuccess: true
    },
    {
        name: "Invalid API Key Test",
        apiKey: "sk-invalid-key-test",
        testMessage: "Test message",
        expectSuccess: false
    },
    {
        name: "Malformed API Key Test",
        apiKey: "invalid-format-key",
        testMessage: "Test message",
        expectSuccess: false
    },
    {
        name: "Empty API Key Test",
        apiKey: "",
        testMessage: "Test message",
        expectSuccess: false
    }
];

// Test user credentials (you need to create a test user first)
const testUser = {
    email: process.env.TEST_USER_EMAIL || 'testuser@example.com',
    password: process.env.TEST_USER_PASSWORD || 'testpass123'
};

let authToken = null;

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

async function testAIConnection(config) {
    try {
        console.log(`\n🧪 Testing: ${config.name}`);
        console.log(`   API Key: ${config.apiKey.substring(0, 10)}...`);
        
        const response = await axios.post(
            `${API_BASE_URL}/settings/ai/test`,
            {
                apiKey: config.apiKey,
                testMessage: config.testMessage
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.success) {
            console.log('✅ Test passed - API connection successful');
            console.log(`   AI Response: ${response.data.data.response}`);
            console.log(`   Model: ${response.data.data.model}`);
            console.log(`   Tokens: ${response.data.data.tokensUsed}`);
            console.log(`   Response Time: ${response.data.data.responseTime}`);
            
            if (config.expectSuccess) {
                console.log('✅ Result matches expectation (success)');
                return { success: true, expected: true };
            } else {
                console.log('⚠️ Unexpected success (expected failure)');
                return { success: true, expected: false };
            }
        }
    } catch (error) {
        const errorData = error.response?.data;
        console.log('❌ Test failed - API connection error');
        console.log(`   Error: ${errorData?.message || error.message}`);
        console.log(`   Error Code: ${errorData?.errorCode || 'UNKNOWN'}`);
        
        if (!config.expectSuccess) {
            console.log('✅ Result matches expectation (failure)');
            return { success: false, expected: true };
        } else {
            console.log('⚠️ Unexpected failure (expected success)');
            return { success: false, expected: false };
        }
    }
}

async function testSaveAPIKey(apiKey) {
    try {
        console.log('\n💾 Testing API key save...');
        const response = await axios.put(
            `${API_BASE_URL}/settings/ai`,
            { openaiApiKey: apiKey },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ API key saved successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to save API key:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testGetAPIKey() {
    try {
        console.log('\n🔍 Testing API key retrieval...');
        const response = await axios.get(
            `${API_BASE_URL}/settings/ai`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        console.log('✅ API key retrieved successfully');
        console.log(`   Key preview: ${response.data.openaiApiKey?.substring(0, 10)}...`);
        return response.data.openaiApiKey;
    } catch (error) {
        console.error('❌ Failed to get API key:', error.response?.data?.message || error.message);
        return null;
    }
}

async function testGetModels(apiKey) {
    try {
        console.log('\n🤖 Testing available models retrieval...');
        
        // First save the API key
        await testSaveAPIKey(apiKey);
        
        const response = await axios.get(
            `${API_BASE_URL}/settings/ai/models`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        if (response.data.success) {
            console.log('✅ Models retrieved successfully');
            console.log(`   Available models: ${response.data.models.length}`);
            response.data.models.slice(0, 3).forEach(model => {
                console.log(`   - ${model.id} (${model.owned_by})`);
            });
            return true;
        }
    } catch (error) {
        console.error('❌ Failed to get models:', error.response?.data?.message || error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting AI Integration Tests...\n');
    console.log(`🔗 API Base URL: ${API_BASE_URL}`);
    
    // Login first
    const loginSuccess = await loginTestUser();
    if (!loginSuccess) {
        console.log('\n❌ Cannot proceed without authentication');
        return;
    }

    let testResults = {
        total: 0,
        passed: 0,
        failed: 0
    };

    // Test API key management
    console.log('\n📋 === API KEY MANAGEMENT TESTS ===');
    
    // Test save and retrieve
    const testApiKey = testConfigs[0].apiKey; // Use first test key
    const saveSuccess = await testSaveAPIKey(testApiKey);
    const retrievedKey = await testGetAPIKey();
    
    if (saveSuccess && retrievedKey === testApiKey) {
        console.log('✅ API key save/retrieve test passed');
        testResults.passed++;
    } else {
        console.log('❌ API key save/retrieve test failed');
        testResults.failed++;
    }
    testResults.total++;

    // Test connection with each configuration
    console.log('\n📋 === CONNECTION TESTS ===');
    
    for (const config of testConfigs) {
        const result = await testAIConnection(config);
        testResults.total++;
        
        if (result.expected) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }
    }

    // Test models retrieval (only with valid key)
    const validConfig = testConfigs.find(c => c.expectSuccess);
    if (validConfig && validConfig.apiKey !== "sk-test-valid-key-placeholder") {
        console.log('\n📋 === MODELS TEST ===');
        const modelsSuccess = await testGetModels(validConfig.apiKey);
        testResults.total++;
        if (modelsSuccess) {
            testResults.passed++;
        } else {
            testResults.failed++;
        }
    }

    // Final results
    console.log('\n📊 === TEST RESULTS ===');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed === 0) {
        console.log('\n🎉 All tests passed! AI integration is working correctly.');
    } else {
        console.log(`\n⚠️ ${testResults.failed} test(s) failed. Check the logs above for details.`);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AI Integration Test Script

Usage:
  node test-ai-integration.js [options]

Options:
  --help, -h          Show this help message
  --api-url <url>     Set custom API base URL (default: http://localhost:5000/api)

Environment Variables:
  API_BASE_URL        Base URL for the API
  TEST_USER_EMAIL     Email for test user login
  TEST_USER_PASSWORD  Password for test user login

Before running:
1. Ensure the backend server is running
2. Create a test user account
3. Replace 'sk-test-valid-key-placeholder' with a real OpenAI API key in the script
4. Set up environment variables or modify testUser credentials

Examples:
  node test-ai-integration.js
  node test-ai-integration.js --api-url http://localhost:3000/api
`);
    process.exit(0);
}

// Override API URL if provided
if (args.includes('--api-url')) {
    const urlIndex = args.indexOf('--api-url') + 1;
    if (urlIndex < args.length) {
        process.env.API_BASE_URL = args[urlIndex];
        console.log(`Using custom API URL: ${args[urlIndex]}`);
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
});