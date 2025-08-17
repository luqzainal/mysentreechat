// Debug Campaign Data from Database
const mongoose = require('mongoose');
const Campaign = require('./backend/models/Campaign.js');

const debug = async () => {
    try {
        console.log('🔍 DEBUGGING CAMPAIGN DATA FROM DATABASE\n');
        
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/waziper_v2', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB');
        
        // Find all AI chatbot campaigns
        const campaigns = await Campaign.find({ 
            campaignType: 'ai_chatbot',
            status: 'enable'
        }).sort({ createdAt: -1 }).limit(5);
        
        console.log(`\n📋 Found ${campaigns.length} active AI chatbot campaigns:`);
        
        campaigns.forEach((campaign, index) => {
            console.log(`\n--- Campaign ${index + 1}: ${campaign.name} ---`);
            console.log(`ID: ${campaign._id}`);
            console.log(`Conversation Mode: ${campaign.conversationMode || 'undefined'}`);
            console.log(`Max Conversation Bubbles: ${campaign.maxConversationBubbles || 'undefined'}`);
            console.log(`End Conversation Keywords: "${campaign.endConversationKeywords || 'undefined'}"`);
            console.log(`Bubble Options:`, campaign.bubbleOptions ? JSON.stringify(campaign.bubbleOptions, null, 2) : 'undefined');
            console.log(`Caption AI: "${campaign.captionAi}"`);
            console.log(`Use AI Feature: ${campaign.useAiFeature}`);
            
            // Test bubble selection logic
            if (campaign.bubbleOptions && campaign.bubbleOptions.length > 0) {
                const activeBubbles = campaign.bubbleOptions.filter(bubble => 
                    bubble.active && bubble.text && bubble.text.trim()
                );
                console.log(`Active bubbles: ${activeBubbles.length} out of ${campaign.bubbleOptions.length}`);
                activeBubbles.forEach(bubble => {
                    console.log(`  - Bubble ${bubble.id}: "${bubble.text}" (active: ${bubble.active})`);
                });
            } else {
                console.log('❌ No bubble options found');
            }
            
            // Test end keywords
            const testKeywords = campaign.endConversationKeywords;
            if (testKeywords) {
                console.log(`End keywords test:`);
                const keywords = testKeywords.split(',').map(k => k.trim());
                console.log(`  Parsed keywords: [${keywords.join(', ')}]`);
                
                // Test some messages
                const testMessages = ['stop', 'bye', 'hello', 'selesai'];
                testMessages.forEach(msg => {
                    const shouldEnd = keywords.some(keyword => 
                        msg.toLowerCase().includes(keyword.toLowerCase())
                    );
                    console.log(`  "${msg}" -> ${shouldEnd ? 'END' : 'CONTINUE'}`);
                });
            } else {
                console.log('❌ No end conversation keywords found');
            }
        });
        
        if (campaigns.length === 0) {
            console.log('\n⚠️  No active AI chatbot campaigns found!');
            console.log('Please create a campaign with:');
            console.log('- conversationMode: continuous_chat');
            console.log('- Multiple bubble options with some active');
            console.log('- End conversation keywords like "stop,bye,end"');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
};

debug();