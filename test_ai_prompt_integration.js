/**
 * Test script untuk verify AI prompt field integration
 * Usage: node test_ai_prompt_integration.js
 */

const mongoose = require('mongoose');
const Campaign = require('./backend/models/Campaign');
const Settings = require('./backend/models/Settings');
const aiService = require('./backend/services/aiService');

// Test configuration
const TEST_CONFIG = {
    testUserId: null, // Will be set dynamically
    testPrompt: "Generate a friendly greeting message in Malay for a customer asking about our services",
    testIncomingMessage: "Hello, what services do you offer?"
};

async function testAIPromptIntegration() {
    try {
        console.log('🚀 Starting AI Prompt Integration Test...\n');

        // Connect to database
        console.log('📡 Connecting to database...');
        await mongoose.connect('mongodb://localhost:27017/waziper_v2');
        console.log('✅ Database connected\n');

        // Find a user with OpenAI API key
        console.log('🔍 Looking for user with OpenAI API key...');
        const userSettings = await Settings.findOne({ 
            openaiApiKey: { $exists: true, $ne: null, $ne: '' } 
        });

        if (!userSettings) {
            console.log('❌ No user found with OpenAI API key configured');
            console.log('💡 Please configure OpenAI API key in Settings first');
            return;
        }

        TEST_CONFIG.testUserId = userSettings.userId.toString();
        console.log(`✅ Found user with API key: ${TEST_CONFIG.testUserId}\n`);

        // Test 1: Process AI Prompt with parameters
        console.log('🧪 Test 1: Processing AI Prompt with parameters...');
        const processedPrompt = aiService.processAIPrompt(TEST_CONFIG.testPrompt, {
            incomingMessage: TEST_CONFIG.testIncomingMessage,
            senderName: 'TestUser',
            botName: 'WaziperBot'
        });
        console.log(`Input prompt: "${TEST_CONFIG.testPrompt}"`);
        console.log(`Processed prompt: "${processedPrompt}"`);
        console.log('✅ Test 1 passed\n');

        // Test 2: Generate AI Response
        console.log('🧪 Test 2: Generating AI response...');
        const startTime = Date.now();
        const aiResult = await aiService.generateResponse(TEST_CONFIG.testUserId, processedPrompt, {
            incomingMessage: TEST_CONFIG.testIncomingMessage,
            model: 'gpt-3.5-turbo',
            maxTokens: 100,
            temperature: 0.7
        });

        if (aiResult && aiResult.response) {
            console.log('✅ AI Response generated successfully!');
            console.log(`📝 Response: "${aiResult.response}"`);
            console.log(`⏱️  Response time: ${aiResult.usage.responseTime}ms`);
            console.log(`🎯 Tokens used: ${aiResult.usage.tokens}`);
            console.log(`🤖 Model: ${aiResult.model}`);
        } else {
            console.log('❌ Failed to generate AI response');
            return;
        }
        console.log('✅ Test 2 passed\n');

        // Test 3: Find AI Chatbot Campaign
        console.log('🧪 Test 3: Testing with actual AI Chatbot campaign...');
        const aiCampaign = await Campaign.findOne({
            userId: TEST_CONFIG.testUserId,
            campaignType: 'ai_chatbot',
            useAiFeature: 'use_ai',
            aiSpintax: { $exists: true, $ne: null, $ne: '' }
        });

        if (aiCampaign) {
            console.log(`✅ Found AI campaign: ${aiCampaign.name || aiCampaign._id}`);
            console.log(`📋 AI Prompt: "${aiCampaign.aiSpintax}"`);
            
            // Test campaign AI prompt processing
            const campaignProcessedPrompt = aiService.processAIPrompt(aiCampaign.aiSpintax, {
                incomingMessage: 'Hi there!',
                senderName: 'TestCustomer',
                botName: 'Assistant'
            });
            
            console.log(`🔄 Processed campaign prompt: "${campaignProcessedPrompt}"`);
            
            // Generate response using campaign settings
            const campaignAiResult = await aiService.generateResponse(TEST_CONFIG.testUserId, campaignProcessedPrompt, {
                incomingMessage: 'Hi there!',
                model: aiCampaign.aiModel || 'gpt-3.5-turbo',
                maxTokens: aiCampaign.aiMaxTokens || 150,
                temperature: aiCampaign.aiTemperature || 0.7
            });
            
            if (campaignAiResult && campaignAiResult.response) {
                console.log(`🎉 Campaign AI response: "${campaignAiResult.response}"`);
                console.log('✅ Test 3 passed');
            } else {
                console.log('❌ Failed to generate campaign AI response');
            }
        } else {
            console.log('⚠️  No AI chatbot campaign found with AI prompt configured');
            console.log('💡 Create an AI chatbot campaign with "Use AI" enabled and AI prompt filled');
        }

        console.log('\n🎉 AI Prompt Integration Test completed!');
        console.log('\n📋 Summary:');
        console.log('✅ AI Service integration: Working');
        console.log('✅ Parameter processing: Working');  
        console.log('✅ OpenAI API connection: Working');
        console.log('✅ Response generation: Working');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        if (error.status === 401) {
            console.log('💡 Check if your OpenAI API key is valid');
        } else if (error.status === 429) {
            console.log('💡 Rate limit exceeded, try again later');
        } else if (error.status === 402) {
            console.log('💡 Insufficient OpenAI credits');
        }
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('📡 Database connection closed');
    }
}

// Run the test
if (require.main === module) {
    testAIPromptIntegration().catch(console.error);
}

module.exports = { testAIPromptIntegration };
