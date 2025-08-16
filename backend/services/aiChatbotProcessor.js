const Campaign = require('../models/Campaign.js');
const Message = require('../models/Message.js');
const { processSpintax } = require('../utils/spintaxUtils.js');

class AIChatbotProcessor {
    constructor() {
        this.activeCampaigns = new Map(); // userId -> campaigns[]
        this.lastRefresh = new Map(); // userId -> timestamp
        this.refreshInterval = 60000; // Refresh campaigns every 60 seconds
    }

    // Get active AI chatbot campaigns for a user
    async getActiveCampaigns(userId) {
        const now = Date.now();
        const lastRefresh = this.lastRefresh.get(userId) || 0;

        // Refresh campaigns if cache is old
        if (now - lastRefresh > this.refreshInterval) {
            try {
                console.log(`[AIChatbotProcessor] Fetching campaigns for user ${userId} with criteria:`, {
                    userId: userId,
                    campaignType: 'ai_chatbot',
                    status: 'enable',
                    statusEnabled: true
                });

                const campaigns = await Campaign.find({
                    userId: userId,
                    campaignType: 'ai_chatbot',
                    status: 'enable',
                    statusEnabled: true
                }).sort({ createdAt: -1 }); // Latest first for priority

                console.log(`[AIChatbotProcessor] Found campaigns:`, campaigns.map(c => ({
                    id: c._id,
                    name: c.name || c.campaignName,
                    status: c.status,
                    statusEnabled: c.statusEnabled,
                    keywords: c.keywords,
                    type: c.type
                })));

                this.activeCampaigns.set(userId, campaigns);
                this.lastRefresh.set(userId, now);
                
                console.log(`[AIChatbotProcessor] Refreshed ${campaigns.length} active AI campaigns for user ${userId}`);
            } catch (error) {
                console.error(`[AIChatbotProcessor] Error refreshing campaigns for user ${userId}:`, error);
                return this.activeCampaigns.get(userId) || [];
            }
        } else {
            console.log(`[AIChatbotProcessor] Using cached campaigns for user ${userId} (${this.activeCampaigns.get(userId)?.length || 0} campaigns)`);
        }

        return this.activeCampaigns.get(userId) || [];
    }

    // Process incoming message and check for AI chatbot responses
    async processMessage(userId, deviceId, messageData) {
        try {
            const { remoteJid, messageText, messageId, timestamp } = messageData;
            
            console.log(`[AIChatbotProcessor] Processing message from ${remoteJid} for user ${userId}: "${messageText}"`);

            // Get active campaigns
            const activeCampaigns = await this.getActiveCampaigns(userId);
            
            if (activeCampaigns.length === 0) {
                console.log(`[AIChatbotProcessor] No active AI chatbot campaigns for user ${userId}`);
                return false;
            }

            // Check each campaign for matches
            for (const campaign of activeCampaigns) {
                const shouldRespond = this.checkMessageMatch(campaign, messageText, remoteJid);
                
                if (shouldRespond) {
                    console.log(`[AIChatbotProcessor] Campaign ${campaign._id} (${campaign.name}) matched message. Sending response...`);
                    
                    await this.sendChatbotResponse(userId, deviceId, campaign, remoteJid, messageText);
                    
                    // Update campaign statistics
                    await Campaign.findByIdAndUpdate(campaign._id, {
                        $inc: { 'aiStats.totalInteractions': 1 }
                    });

                    return true; // Stop processing after first match
                }
            }

            console.log(`[AIChatbotProcessor] No matching campaigns found for message: "${messageText}"`);
            return false;

        } catch (error) {
            console.error('[AIChatbotProcessor] Error processing message:', error);
            return false;
        }
    }

    // Check if message matches campaign criteria
    checkMessageMatch(campaign, messageText, remoteJid) {
        const lowerMessageText = messageText.toLowerCase();

        console.log(`[AIChatbotProcessor] Checking match for campaign ${campaign._id}:`, {
            campaignName: campaign.name || campaign.campaignName,
            messageText: messageText,
            keywords: campaign.keywords,
            type: campaign.type,
            sendTo: campaign.sendTo,
            remoteJid: remoteJid
        });

        // Check sendTo criteria
        if (campaign.sendTo === 'group' && !remoteJid.includes('@g.us')) {
            console.log(`[AIChatbotProcessor] Campaign ${campaign._id} is for groups only, but message is individual. Skipping.`);
            return false;
        }
        if (campaign.sendTo === 'individual' && remoteJid.includes('@g.us')) {
            console.log(`[AIChatbotProcessor] Campaign ${campaign._id} is for individuals only, but message is from group. Skipping.`);
            return false;
        }

        // Check message type and keywords
        switch (campaign.type) {
            case 'message_contains_keyword':
                const keywordMatch = campaign.keywords.some(keyword => {
                    const match = lowerMessageText.includes(keyword.toLowerCase());
                    console.log(`[AIChatbotProcessor] Checking keyword "${keyword}" in "${messageText}": ${match}`);
                    return match;
                });
                console.log(`[AIChatbotProcessor] Overall keyword match result: ${keywordMatch}`);
                return keywordMatch;

            case 'message_contains_whole_keyword':
                const words = lowerMessageText.split(/\s+/);
                const wholeWordMatch = campaign.keywords.some(keyword => {
                    const match = words.includes(keyword.toLowerCase());
                    console.log(`[AIChatbotProcessor] Checking whole word "${keyword}" in words [${words.join(', ')}]: ${match}`);
                    return match;
                });
                console.log(`[AIChatbotProcessor] Overall whole word match result: ${wholeWordMatch}`);
                return wholeWordMatch;

            case 'message_contains_regex':
                try {
                    const regex = new RegExp(campaign.keywords.join('|'), 'i');
                    const regexMatch = regex.test(messageText);
                    console.log(`[AIChatbotProcessor] Regex match result: ${regexMatch}`);
                    return regexMatch;
                } catch (error) {
                    console.error(`[AIChatbotProcessor] Invalid regex in campaign ${campaign._id}:`, error);
                    return false;
                }

            case 'message_contains_ai':
                console.log(`[AIChatbotProcessor] AI mode - matching any message`);
                return true;

            default:
                console.log(`[AIChatbotProcessor] Unknown campaign type: ${campaign.type}`);
                return false;
        }
    }

    // Send chatbot response
    async sendChatbotResponse(userId, deviceId, campaign, remoteJid, originalMessage) {
        try {
            const baileysService = require('./baileysService.js');
            const sock = baileysService.getWhatsAppSocket(userId);

            if (!sock || !sock.user) {
                console.error(`[AIChatbotProcessor] WhatsApp not connected for user ${userId}`);
                return false;
            }

            // Force set presence to available before sending response
            try {
                await sock.sendPresenceUpdate('available');
                console.log(`[AIChatbotProcessor] Set presence to available for user ${userId}`);
            } catch (presenceError) {
                console.warn(`[AIChatbotProcessor] Failed to set presence, continuing anyway:`, presenceError.message);
            }

            // Process response message with spintax
            let responseText = processSpintax(campaign.captionAi || campaign.caption || 'Hello! How can I help you?');

            // Add AI processing if enabled
            if (campaign.useAiFeature === 'use_ai' && campaign.aiSpintax) {
                responseText = processSpintax(campaign.aiSpintax);
            }

            // Simulate typing if enabled
            if (campaign.presenceDelayStatus === 'enable_typing') {
                await sock.sendPresenceUpdate('composing', remoteJid);
                const delayTime = parseInt(campaign.presenceDelayTime) || 2;
                await new Promise(resolve => setTimeout(resolve, delayTime * 1000));
            }

            // Send response
            const sentMessage = await sock.sendMessage(remoteJid, { text: responseText });

            // Save message to database
            try {
                const newMessage = new Message({
                    user: userId,
                    chatJid: remoteJid,
                    body: responseText,
                    timestamp: new Date(),
                    fromMe: true,
                    messageId: sentMessage?.key?.id || `chatbot-${Date.now()}`,
                    status: 'sent',
                    sourceDeviceId: deviceId,
                    campaignId: campaign._id
                });
                await newMessage.save();
            } catch (dbError) {
                console.error(`[AIChatbotProcessor] Failed to save chatbot response to DB:`, dbError);
            }

            console.log(`[AIChatbotProcessor] Sent chatbot response to ${remoteJid} from campaign ${campaign._id}`);
            return true;

        } catch (error) {
            console.error('[AIChatbotProcessor] Error sending chatbot response:', error);
            return false;
        }
    }

    // Clear cache for user (call when campaigns are updated)
    clearCache(userId) {
        this.activeCampaigns.delete(userId);
        this.lastRefresh.delete(userId);
        console.log(`[AIChatbotProcessor] Cleared cache for user ${userId}`);
    }

    // Refresh campaigns for user (manual refresh)
    async refreshCampaigns(userId) {
        this.lastRefresh.delete(userId); // Force refresh
        return await this.getActiveCampaigns(userId);
    }
}

// Create singleton instance
const aiChatbotProcessor = new AIChatbotProcessor();

module.exports = aiChatbotProcessor;