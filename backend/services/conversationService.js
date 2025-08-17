class ConversationService {
    constructor() {
        // Track active conversations: userId -> { [chatJid]: { campaignId, messageCount, lastActivity } }
        this.activeConversations = new Map();
        this.conversationTimeout = 30 * 60 * 1000; // 30 minutes timeout
        
        // Clean up old conversations every 10 minutes
        setInterval(() => {
            this.cleanupOldConversations();
        }, 10 * 60 * 1000);
    }

    // Start or update conversation tracking
    startConversation(userId, chatJid, campaignId) {
        if (!this.activeConversations.has(userId)) {
            this.activeConversations.set(userId, new Map());
        }
        
        const userConversations = this.activeConversations.get(userId);
        userConversations.set(chatJid, {
            campaignId: campaignId,
            messageCount: 1,
            lastActivity: Date.now(),
            startTime: Date.now()
        });
        
        console.log(`[ConversationService] Started conversation for ${chatJid} with campaign ${campaignId}`);
    }

    // Increment message count for conversation
    incrementMessageCount(userId, chatJid) {
        const userConversations = this.activeConversations.get(userId);
        if (userConversations && userConversations.has(chatJid)) {
            const conversation = userConversations.get(chatJid);
            conversation.messageCount++;
            conversation.lastActivity = Date.now();
            
            console.log(`[ConversationService] Message count for ${chatJid}: ${conversation.messageCount}`);
            return conversation.messageCount;
        }
        return 0;
    }

    // Check if conversation should continue
    shouldContinueConversation(userId, chatJid, campaign, incomingMessage) {
        const userConversations = this.activeConversations.get(userId);
        if (!userConversations || !userConversations.has(chatJid)) {
            return false;
        }

        const conversation = userConversations.get(chatJid);
        
        // Check if conversation mode is continuous
        if (campaign.conversationMode !== 'continuous_chat') {
            return false;
        }

        // Check for end conversation keywords FIRST
        if (this.hasEndKeyword(incomingMessage, campaign.endConversationKeywords)) {
            console.log(`[ConversationService] End keyword detected, ending conversation for ${chatJid}`);
            this.endConversation(userId, chatJid);
            return false;
        }

        // Check message count limit
        const maxBubbles = parseInt(campaign.maxConversationBubbles) || 3;
        if (campaign.maxConversationBubbles !== 'unlimited' && conversation.messageCount >= maxBubbles) {
            console.log(`[ConversationService] Message limit reached for ${chatJid}, ending conversation`);
            this.endConversation(userId, chatJid);
            return false;
        }

        // Check conversation timeout
        if (Date.now() - conversation.lastActivity > this.conversationTimeout) {
            console.log(`[ConversationService] Conversation timeout for ${chatJid}, ending conversation`);
            this.endConversation(userId, chatJid);
            return false;
        }

        // For continuous chat mode, respond to ALL messages once conversation is active
        console.log(`[ConversationService] Continuous chat mode - responding to all messages in active conversation`);
        return true;
    }

    // Check if message contains end keywords
    hasEndKeyword(message, endKeywords) {
        if (!endKeywords || !message) {
            console.log(`[ConversationService] hasEndKeyword: missing data - message: "${message}", endKeywords: "${endKeywords}"`);
            return false;
        }
        
        const keywords = endKeywords.split(',').map(k => k.trim().toLowerCase());
        const lowerMessage = message.toLowerCase();
        
        console.log(`[ConversationService] hasEndKeyword check:`);
        console.log(`  Message: "${message}" -> "${lowerMessage}"`);
        console.log(`  End keywords: "${endKeywords}" -> [${keywords.join(', ')}]`);
        
        const result = keywords.some(keyword => {
            const match = lowerMessage.includes(keyword);
            console.log(`  Testing "${keyword}": ${match}`);
            return match;
        });
        
        console.log(`  Final result: ${result ? 'END CONVERSATION' : 'CONTINUE'}`);
        return result;
    }

    // End conversation
    endConversation(userId, chatJid) {
        const userConversations = this.activeConversations.get(userId);
        if (userConversations && userConversations.has(chatJid)) {
            const conversation = userConversations.get(chatJid);
            console.log(`[ConversationService] Ending conversation for ${chatJid} after ${conversation.messageCount} messages`);
            userConversations.delete(chatJid);
        }
    }

    // Get conversation status
    getConversationStatus(userId, chatJid) {
        const userConversations = this.activeConversations.get(userId);
        if (userConversations && userConversations.has(chatJid)) {
            return userConversations.get(chatJid);
        }
        return null;
    }

    // Select random bubble option
    selectRandomBubble(campaign) {
        console.log(`[ConversationService] selectRandomBubble called`);
        console.log(`  Campaign bubbleOptions:`, JSON.stringify(campaign.bubbleOptions, null, 2));
        
        if (!campaign.bubbleOptions || campaign.bubbleOptions.length === 0) {
            console.log(`[ConversationService] No bubbleOptions found, using captionAi: "${campaign.captionAi}"`);
            return campaign.captionAi || 'Hello! How can I help you?';
        }

        const activeBubbles = campaign.bubbleOptions.filter(bubble => {
            const isValid = bubble.active && bubble.text && bubble.text.trim();
            console.log(`  Bubble ${bubble.id}: active=${bubble.active}, text="${bubble.text}", valid=${isValid}`);
            return isValid;
        });
        
        console.log(`[ConversationService] Found ${activeBubbles.length} active bubbles out of ${campaign.bubbleOptions.length} total`);
        
        if (activeBubbles.length === 0) {
            console.log(`[ConversationService] No active bubbles found, using captionAi: "${campaign.captionAi}"`);
            return campaign.captionAi || 'Hello! How can I help you?';
        }

        const randomIndex = Math.floor(Math.random() * activeBubbles.length);
        const selectedBubble = activeBubbles[randomIndex];
        
        console.log(`[ConversationService] Selected bubble ${selectedBubble.id} (index ${randomIndex}) from ${activeBubbles.length} active options: "${selectedBubble.text}"`);
        return selectedBubble.text;
    }

    // Clean up old conversations
    cleanupOldConversations() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [userId, userConversations] of this.activeConversations) {
            for (const [chatJid, conversation] of userConversations) {
                if (now - conversation.lastActivity > this.conversationTimeout) {
                    userConversations.delete(chatJid);
                    cleanedCount++;
                }
            }
            
            // Remove empty user conversation maps
            if (userConversations.size === 0) {
                this.activeConversations.delete(userId);
            }
        }

        if (cleanedCount > 0) {
            console.log(`[ConversationService] Cleaned up ${cleanedCount} expired conversations`);
        }
    }

    // Get conversation statistics
    getConversationStats() {
        let totalConversations = 0;
        let totalUsers = this.activeConversations.size;

        for (const userConversations of this.activeConversations.values()) {
            totalConversations += userConversations.size;
        }

        return {
            totalUsers,
            totalConversations,
            conversationTimeout: this.conversationTimeout
        };
    }

    // Force end all conversations for a user
    endAllUserConversations(userId) {
        const userConversations = this.activeConversations.get(userId);
        if (userConversations) {
            const count = userConversations.size;
            userConversations.clear();
            console.log(`[ConversationService] Ended ${count} conversations for user ${userId}`);
        }
    }
}

// Export singleton instance
module.exports = new ConversationService();