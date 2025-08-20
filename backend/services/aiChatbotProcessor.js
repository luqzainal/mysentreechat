const Campaign = require('../models/Campaign.js');
const Message = require('../models/Message.js');
const { processSpintax } = require('../utils/spintaxUtils.js');
const webhookService = require('./webhookService.js');
const conversationService = require('./conversationService.js');

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
                }).sort({ createdAt: 1 }); // Oldest first - keyword campaigns should have priority over AI default response

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
            
            // Safety checks for required parameters
            if (!userId || !deviceId || !messageData || !remoteJid || !messageText) {
                console.warn(`[AIChatbotProcessor] Invalid message data received:`, {
                    hasUserId: !!userId,
                    hasDeviceId: !!deviceId,
                    hasMessageData: !!messageData,
                    hasRemoteJid: !!remoteJid,
                    hasMessageText: !!messageText
                });
                return false;
            }
            
            console.log(`[AIChatbotProcessor] Processing message from ${remoteJid} for user ${userId}: "${messageText}"`);

            // Get active campaigns
            const activeCampaigns = await this.getActiveCampaigns(userId);
            
            if (activeCampaigns.length === 0) {
                console.log(`[AIChatbotProcessor] No active AI chatbot campaigns for user ${userId}`);
                return false;
            }

            // PRIORITY 1: Check stop keywords from ALL campaigns FIRST (highest priority)
            console.log(`[AIChatbotProcessor] PRIORITY 1: Checking stop keywords across all campaigns`);
            for (const campaign of activeCampaigns) {
                if (campaign.endConversationKeywords && campaign.endConversationKeywords.trim()) {
                    const hasStopKeyword = conversationService.hasEndKeyword(messageText, campaign.endConversationKeywords);
                    if (hasStopKeyword) {
                        console.log(`[AIChatbotProcessor] STOP KEYWORD detected in campaign ${campaign._id}. Ending any ongoing conversation.`);
                        // End any ongoing conversation
                        conversationService.endConversation(userId, remoteJid);
                        return true; // Stop all processing - no response needed
                    }
                }
            }

            // PRIORITY 2: Check ongoing conversation BUT respect new keyword matches
            let conversationCampaign = null;
            const conversationStatus = conversationService.getConversationStatus(userId, remoteJid);
            
            // PRIORITY 3: Check keyword campaigns (higher priority than continuing conversation)
            const keywordCampaigns = activeCampaigns.filter(c => 
                c.isNotMatchDefaultResponse !== 'yes' && 
                c.isNotMatchDefaultResponse !== true
            );
            const defaultResponseCampaigns = activeCampaigns.filter(c => 
                c.isNotMatchDefaultResponse === 'yes' || 
                c.isNotMatchDefaultResponse === true
            );

            console.log(`[AIChatbotProcessor] PRIORITY 3: Checking ${keywordCampaigns.length} keyword campaigns`);

            // Check keyword campaigns first - they can override ongoing conversations
            for (const campaign of keywordCampaigns) {
                const shouldRespond = this.checkMessageMatch(campaign, messageText, remoteJid);
                
                if (shouldRespond) {
                    console.log(`[AIChatbotProcessor] KEYWORD CAMPAIGN ${campaign._id} (${campaign.name}) matched message. This overrides any ongoing conversation.`);
                    
                    // End any existing conversation since we're starting a new keyword-based response
                    if (conversationStatus) {
                        console.log(`[AIChatbotProcessor] Ending previous conversation to start keyword campaign`);
                        conversationService.endConversation(userId, remoteJid);
                    }
                    
                    // Start conversation if in continuous mode
                    if (campaign.conversationMode === 'continuous_chat') {
                        conversationService.startConversation(userId, remoteJid, campaign._id.toString());
                    }
                    
                    await this.sendChatbotResponse(userId, deviceId, campaign, remoteJid, messageText, false);
                    
                    // Update campaign statistics
                    await Campaign.findByIdAndUpdate(campaign._id, {
                        $inc: { 'aiStats.totalInteractions': 1 }
                    });

                    return true; // Stop processing after first match
                }
            }

            // PRIORITY 4: Continue ongoing conversation ONLY if no keyword campaigns matched
            if (conversationStatus) {
                // Find the campaign for ongoing conversation
                conversationCampaign = activeCampaigns.find(c => c._id.toString() === conversationStatus.campaignId);
                
                if (conversationCampaign && conversationService.shouldContinueConversation(userId, remoteJid, conversationCampaign, messageText)) {
                    console.log(`[AIChatbotProcessor] PRIORITY 4: Continuing conversation with campaign ${conversationCampaign._id} (no keyword override)`);
                    console.log(`[AIChatbotProcessor] Campaign conversation settings:`);
                    console.log(`  conversationMode: ${conversationCampaign.conversationMode}`);
                    console.log(`  maxConversationBubbles: ${conversationCampaign.maxConversationBubbles}`);
                    console.log(`  endConversationKeywords: "${conversationCampaign.endConversationKeywords}"`);
                    console.log(`  bubbleOptions count: ${conversationCampaign.bubbleOptions?.length || 0}`);
                    
                    // Increment message count
                    conversationService.incrementMessageCount(userId, remoteJid);
                    
                    await this.sendChatbotResponse(userId, deviceId, conversationCampaign, remoteJid, messageText, true);
                    
                    // Update campaign statistics
                    await Campaign.findByIdAndUpdate(conversationCampaign._id, {
                        $inc: { 'aiStats.totalInteractions': 1 }
                    });

                    return true;
                }
            }

            console.log(`[AIChatbotProcessor] PRIORITY 5: Checking ${defaultResponseCampaigns.length} default response campaigns`);

            // PRIORITY 5: Check default response campaigns (AI fallback) - lowest priority

            // PRIORITY 5: If no keyword campaigns matched, try default response campaigns (AI fallback)
            for (const campaign of defaultResponseCampaigns) {
                const shouldRespond = this.checkMessageMatch(campaign, messageText, remoteJid);
                
                if (shouldRespond) {
                    console.log(`[AIChatbotProcessor] PRIORITY 5: DEFAULT RESPONSE campaign ${campaign._id} (${campaign.name}) matched message. Sending AI fallback response...`);
                    
                    // Start conversation if in continuous mode
                    if (campaign.conversationMode === 'continuous_chat') {
                        conversationService.startConversation(userId, remoteJid, campaign._id.toString());
                    }
                    
                    await this.sendChatbotResponse(userId, deviceId, campaign, remoteJid, messageText, false);
                    
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
        // Null/undefined safety checks
        if (!campaign || !messageText || !remoteJid) {
            console.warn(`[AIChatbotProcessor] Invalid parameters for checkMessageMatch:`, {
                hasCampaign: !!campaign,
                hasMessageText: !!messageText,
                hasRemoteJid: !!remoteJid
            });
            return false;
        }

        const lowerMessageText = messageText.toLowerCase();

        console.log(`[AIChatbotProcessor] Checking match for campaign ${campaign._id}:`, {
            campaignName: campaign.name || campaign.campaignName,
            messageText: messageText,
            keywords: campaign.keywords,
            type: campaign.type,
            sendTo: campaign.sendTo,
            isNotMatchDefaultResponse: campaign.isNotMatchDefaultResponse,
            remoteJid: remoteJid
        });

        // Check sendTo criteria with null safety
        if (campaign.sendTo === 'group' && !remoteJid.includes('@g.us')) {
            console.log(`[AIChatbotProcessor] Campaign ${campaign._id} is for groups only, but message is individual. Skipping.`);
            return false;
        }
        if (campaign.sendTo === 'individual' && remoteJid.includes('@g.us')) {
            console.log(`[AIChatbotProcessor] Campaign ${campaign._id} is for individuals only, but message is from group. Skipping.`);
            return false;
        }

        // Check if this is a default response campaign (isNotMatchDefaultResponse = 'yes')
        if (campaign.isNotMatchDefaultResponse === 'yes' || campaign.isNotMatchDefaultResponse === true) {
            // This campaign handles unmatched messages with AI
            console.log(`[AIChatbotProcessor] Default response campaign - will match any message`);
            return true;
        }

        // Check message type and keywords for keyword-based campaigns
        if (!campaign.keywords || campaign.keywords.length === 0) {
            console.log(`[AIChatbotProcessor] No keywords defined for campaign ${campaign._id}`);
            return false;
        }

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

    // Helper method to check if message has keyword match
    hasKeywordMatch(campaign, messageText) {
        if (!campaign.keywords || campaign.keywords.length === 0) {
            return false;
        }

        const lowerMessageText = messageText.toLowerCase();

        switch (campaign.type) {
            case 'message_contains_keyword':
                return campaign.keywords.some(keyword => 
                    lowerMessageText.includes(keyword.toLowerCase())
                );

            case 'message_contains_whole_keyword':
                const words = lowerMessageText.split(/\s+/);
                return campaign.keywords.some(keyword => 
                    words.includes(keyword.toLowerCase())
                );

            case 'message_contains_regex':
                try {
                    const regex = new RegExp(campaign.keywords.join('|'), 'i');
                    return regex.test(messageText);
                } catch (error) {
                    console.error(`[AIChatbotProcessor] Invalid regex in campaign ${campaign._id}:`, error);
                    return false;
                }

            default:
                return false;
        }
    }

    // Send chatbot response
    async sendChatbotResponse(userId, deviceId, campaign, remoteJid, originalMessage, isContinuation = false, messageData = {}) {
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

            // Determine response type based on campaign settings
            let responseText;
            let shouldUseAI = false;
            let shouldSendMedia = false;
            
            console.log(`[AIChatbotProcessor] Campaign settings for ${campaign._id}:`, {
                isNotMatchDefaultResponse: campaign.isNotMatchDefaultResponse,
                useAiFeature: campaign.useAiFeature,
                hasAiSpintax: !!(campaign.aiSpintax && campaign.aiSpintax.trim()),
                hasMediaAttachments: !!(campaign.mediaAttachments && campaign.mediaAttachments.length > 0),
                captionAi: campaign.captionAi ? campaign.captionAi.substring(0, 50) + '...' : null
            });
            
            if (campaign.isNotMatchDefaultResponse === 'yes' || campaign.isNotMatchDefaultResponse === true) {
                // Default response campaign - use AI if configured
                if (campaign.useAiFeature === 'use_ai' && campaign.aiSpintax && campaign.aiSpintax.trim()) {
                    shouldUseAI = true;
                    console.log(`[AIChatbotProcessor] Default response campaign - using AI`);
                } else {
                    // Fallback to static response for default campaigns
                    shouldSendMedia = (campaign.mediaAttachments && campaign.mediaAttachments.length > 0);
                    console.log(`[AIChatbotProcessor] Default response campaign - using static response (media: ${shouldSendMedia})`);
                }
            } else {
                // Keyword-based campaign
                const hasKeywordMatch = this.hasKeywordMatch(campaign, originalMessage);
                console.log(`[AIChatbotProcessor] Keyword match check result: ${hasKeywordMatch}`);
                
                if (hasKeywordMatch) {
                    // Keywords matched - determine response type based on campaign configuration
                    if (campaign.useAiFeature === 'use_ai' && campaign.aiSpintax && campaign.aiSpintax.trim()) {
                        shouldUseAI = true;
                        console.log(`[AIChatbotProcessor] Keywords matched - using AI response`);
                    } else {
                        // Use static response (caption + optional media)
                        shouldSendMedia = (campaign.mediaAttachments && campaign.mediaAttachments.length > 0);
                        console.log(`[AIChatbotProcessor] Keywords matched - using static response (media: ${shouldSendMedia})`);
                    }
                } else {
                    console.log(`[AIChatbotProcessor] No keyword match for campaign ${campaign._id}, skipping response`);
                    return false;
                }
            }
            
            // Process response based on determined type
            if (shouldUseAI) {
                // Use AI to generate dynamic response
                console.log(`[AIChatbotProcessor] Using AI to generate response for campaign ${campaign._id}`);
                
                const aiService = require('./aiService');
                
                // Process AI prompt with parameters
                const processedPrompt = aiService.processAIPrompt(campaign.aiSpintax, {
                    incomingMessage: originalMessage,
                    senderName: remoteJid.split('@')[0], // Use phone number as fallback
                    botName: 'Assistant'
                });
                
                // Generate AI response
                const aiResult = await aiService.generateResponse(userId, processedPrompt, {
                    incomingMessage: originalMessage,
                    model: campaign.aiModel || 'gpt-3.5-turbo',
                    maxTokens: campaign.aiMaxTokens || 150,
                    temperature: campaign.aiTemperature || 0.7
                });
                
                if (aiResult && aiResult.response) {
                    responseText = aiResult.response;
                    
                    // Add appointment link if available for AI response
                    if (campaign.appointmentLink && campaign.appointmentLink.trim()) {
                        responseText += `\n\n📅 Book an appointment: ${campaign.appointmentLink}`;
                        console.log(`[AIChatbotProcessor] Added appointment link to AI response: ${campaign.appointmentLink}`);
                    }
                    
                    // Log AI usage for campaign stats
                    try {
                        await Campaign.findByIdAndUpdate(campaign._id, {
                            $inc: { 
                                'aiStats.totalTokens': aiResult.usage.tokens,
                                'aiStats.totalInteractions': 1
                            },
                            $push: {
                                'aiLogs': {
                                    input: processedPrompt,
                                    output: aiResult.response,
                                    tokens: aiResult.usage.tokens,
                                    duration: aiResult.usage.responseTime,
                                    timestamp: new Date()
                                }
                            }
                        });
                        console.log(`[AIChatbotProcessor] AI stats updated for campaign ${campaign._id}`);
                    } catch (statsError) {
                        console.warn(`[AIChatbotProcessor] Failed to update AI stats:`, statsError.message);
                    }
                } else {
                    console.warn(`[AIChatbotProcessor] AI generation failed, falling back to caption for campaign ${campaign._id}`);
                    responseText = processSpintax(campaign.captionAi || campaign.caption || 'Hello! How can I help you?');
                    
                    // Add appointment link if available for fallback response too
                    if (campaign.appointmentLink && campaign.appointmentLink.trim()) {
                        responseText += `\n\n📅 Book an appointment: ${campaign.appointmentLink}`;
                        console.log(`[AIChatbotProcessor] Added appointment link to fallback response: ${campaign.appointmentLink}`);
                    }
                }
            } else {
                // Use static caption with bubble selection and spintax processing
                if (campaign.bubbleOptions && campaign.bubbleOptions.length > 0) {
                    // Use flow-based bubble selection if in conversation, otherwise use caption
                    const conversationStatus = conversationService.getConversationStatus(userId, remoteJid);
                    if (conversationStatus && campaign.conversationMode === 'continuous_chat') {
                        // Flow-based selection for active conversations
                        const selectedBubbleText = conversationService.selectFlowBubble(campaign, userId, remoteJid);
                        responseText = processSpintax(selectedBubbleText);
                        console.log(`[AIChatbotProcessor] Using flow-based bubble selection for conversation: "${responseText}"`);
                    } else {
                        // Random selection for initial response or non-conversation mode
                        const selectedBubbleText = conversationService.selectRandomBubble(campaign);
                        responseText = processSpintax(selectedBubbleText);
                        console.log(`[AIChatbotProcessor] Using random bubble selection: "${responseText}"`);
                    }
                } else {
                    // Fallback to captionAi field
                    responseText = processSpintax(campaign.captionAi || campaign.caption || 'Hello! How can I help you?');
                    console.log(`[AIChatbotProcessor] Using caption fallback: "${responseText}"`);
                }
                
                // Add appointment link if available
                if (campaign.appointmentLink && campaign.appointmentLink.trim()) {
                    responseText += `\n\n📅 Book an appointment: ${campaign.appointmentLink}`;
                    console.log(`[AIChatbotProcessor] Added appointment link to response: ${campaign.appointmentLink}`);
                }
                
                console.log(`[AIChatbotProcessor] Using static response for campaign ${campaign._id}: "${responseText}"`);
            }

            // Simulate typing if enabled
            if (campaign.presenceDelayStatus === 'enable_typing') {
                await sock.sendPresenceUpdate('composing', remoteJid);
                const delayTime = parseInt(campaign.presenceDelayTime) || 2;
                await new Promise(resolve => setTimeout(resolve, delayTime * 1000));
            }

            // Send media first if required
            let sentMessage;
            if (shouldSendMedia && campaign.mediaAttachments && campaign.mediaAttachments.length > 0) {
                console.log(`[AIChatbotProcessor] Sending media for campaign ${campaign._id}`);
                
                try {
                    const Media = require('../models/Media');
                    const media = await Media.findById(campaign.mediaAttachments[0]);
                    
                    if (media) {
                        console.log(`[AIChatbotProcessor] Processing media file: ${media.fileName}, storage: ${media.storageType}`);
                        
                        // Use the same logic as WhatsApp controller for media handling
                        const s3Service = require('./s3Service.js');
                        const fileInfo = await s3Service.getFileInfo(media);
                        
                        let mediaBuffer;
                        
                        if (fileInfo.isS3) {
                            // Download from S3 as buffer
                            console.log(`[AIChatbotProcessor] Downloading S3 file: ${media.fileName}`);
                            
                            const https = require('https');
                            const http = require('http');
                            const url = require('url');
                            
                            mediaBuffer = await new Promise((resolve, reject) => {
                                const parsedUrl = url.parse(fileInfo.accessUrl);
                                const client = parsedUrl.protocol === 'https:' ? https : http;
                                
                                client.get(fileInfo.accessUrl, (response) => {
                                    if (response.statusCode !== 200) {
                                        return reject(new Error(`Failed to download: ${response.statusCode}`));
                                    }
                                    
                                    const chunks = [];
                                    response.on('data', (chunk) => chunks.push(chunk));
                                    response.on('end', () => resolve(Buffer.concat(chunks)));
                                }).on('error', reject);
                            });
                            
                            console.log(`[AIChatbotProcessor] Downloaded ${mediaBuffer.length} bytes from S3`);
                        } else {
                            // Read local file as buffer
                            const fs = require('fs');
                            const path = require('path');
                            const localPath = path.join(__dirname, '..', media.filePath);
                            
                            console.log(`[AIChatbotProcessor] Reading local file: ${localPath}`);
                            
                            if (fs.existsSync(localPath)) {
                                mediaBuffer = fs.readFileSync(localPath);
                                console.log(`[AIChatbotProcessor] Read ${mediaBuffer.length} bytes from local file`);
                            } else {
                                throw new Error(`Local media file not found: ${localPath}`);
                            }
                        }
                        
                        // Prepare media message with buffer
                        let mediaMessage = {};
                        if (media.fileType.startsWith('image/')) {
                            mediaMessage.image = mediaBuffer;
                        } else if (media.fileType.startsWith('video/')) {
                            mediaMessage.video = mediaBuffer;
                        } else if (media.fileType.startsWith('audio/')) {
                            mediaMessage.audio = mediaBuffer;
                        } else {
                            mediaMessage.document = mediaBuffer;
                            mediaMessage.mimetype = media.fileType;
                            mediaMessage.fileName = media.originalName;
                        }
                        
                        if (responseText) {
                            mediaMessage.caption = responseText;
                        }
                        
                        sentMessage = await sock.sendMessage(remoteJid, mediaMessage);
                        console.log(`[AIChatbotProcessor] Sent media with caption to ${remoteJid}`);
                        
                    } else {
                        console.warn(`[AIChatbotProcessor] Media record not found for ID: ${campaign.mediaAttachments[0]}`);
                        // Fallback to text message
                        sentMessage = await sock.sendMessage(remoteJid, { text: responseText });
                    }
                } catch (mediaError) {
                    console.error(`[AIChatbotProcessor] Error sending media:`, mediaError);
                    console.warn(`[AIChatbotProcessor] Media processing failed, sending text only`);
                    // Fallback to text message
                    sentMessage = await sock.sendMessage(remoteJid, { text: responseText });
                }
            } else {
                // Send text response
                sentMessage = await sock.sendMessage(remoteJid, { text: responseText });
            }

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
            
            // Check for nextBotAction to chain to another campaign
            if (campaign.nextBotAction && campaign.nextBotAction.trim()) {
                // Initialize chain tracking for this message if not exists
                if (!messageData.chainTracker) {
                    messageData.chainTracker = new Set();
                }
                await this.handleNextBotAction(userId, deviceId, campaign.nextBotAction, remoteJid, originalMessage, messageData.chainTracker);
            }
            
            // Send webhook if API Rest Data is enabled
            try {
                const customerData = {
                    phone: remoteJid,
                    name: remoteJid.split('@')[0], // Use phone number as fallback name
                    message: originalMessage
                };
                
                const botResponseData = {
                    message: responseText,
                    type: campaign.useAiFeature === 'use_ai' && campaign.aiSpintax ? 'ai_generated' : 'static',
                    aiTokens: aiResult?.usage?.tokens || 0,
                    responseTime: aiResult?.usage?.responseTime || 0
                };
                
                const webhookResult = await webhookService.sendWebhook(
                    campaign, 
                    customerData, 
                    botResponseData,
                    {
                        messageId: sentMessage?.key?.id,
                        deviceId: deviceId
                    }
                );
                
                if (webhookResult.success && !webhookResult.skipped) {
                    console.log(`[AIChatbotProcessor] Webhook sent successfully for campaign ${campaign._id}`);
                } else if (webhookResult.skipped) {
                    console.log(`[AIChatbotProcessor] Webhook skipped for campaign ${campaign._id} (not configured)`);
                } else {
                    console.warn(`[AIChatbotProcessor] Webhook failed for campaign ${campaign._id}:`, webhookResult.error);
                }
            } catch (webhookError) {
                console.error(`[AIChatbotProcessor] Webhook error for campaign ${campaign._id}:`, webhookError.message);
            }
            
            return true;

        } catch (error) {
            console.error('[AIChatbotProcessor] Error sending chatbot response:', error);
            return false;
        }
    }

    // Handle nextBotAction - chain to another campaign or AI response
    async handleNextBotAction(userId, deviceId, nextBotAction, remoteJid, originalMessage, chainTracker = new Set()) {
        try {
            console.log(`[AIChatbotProcessor] Processing nextBotAction: "${nextBotAction}" for ${remoteJid}`);

            // Check if nextBotAction is "AI_REPLY" or similar AI trigger
            if (nextBotAction.toLowerCase().includes('ai')) {
                console.log(`[AIChatbotProcessor] nextBotAction is AI response type, triggering AI processing`);
                // Find an AI-powered campaign to handle this
                const aiCampaigns = await Campaign.find({
                    userId: userId,
                    campaignType: 'ai_chatbot',
                    useAiFeature: 'use_ai',
                    status: 'enable',
                    statusEnabled: true
                }).sort({ createdAt: -1 }).limit(1);

                if (aiCampaigns.length > 0) {
                    const aiCampaign = aiCampaigns[0];
                    console.log(`[AIChatbotProcessor] Found AI campaign ${aiCampaign._id} for nextBotAction`);
                    await this.sendChatbotResponse(userId, deviceId, aiCampaign, remoteJid, originalMessage, false);
                    return;
                }
            }

            // Try to find campaign by flowId (nextBotAction should contain flow ID)
            const nextCampaign = await Campaign.findOne({
                flowId: nextBotAction,
                userId: userId,
                campaignType: 'ai_chatbot',
                status: 'enable',
                statusEnabled: true
            });

            if (nextCampaign) {
                console.log(`[AIChatbotProcessor] Found next campaign: ${nextCampaign._id} (${nextCampaign.name}) with flowId: ${nextBotAction}`);
                
                // Prevent infinite loops
                if (chainTracker.has(nextCampaign._id.toString())) {
                    console.warn(`[AIChatbotProcessor] Loop detected! Campaign ${nextCampaign._id} already processed. Ending chain.`);
                    return;
                }
                chainTracker.add(nextCampaign._id.toString());

                // Limit chain depth to prevent excessive chaining
                if (chainTracker.size > 5) {
                    console.warn(`[AIChatbotProcessor] Maximum chain depth (5) reached. Ending chain.`);
                    return;
                }
                
                // Add small delay to make conversation feel more natural
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Send response from the chained campaign with chain tracking
                const messageData = { chainTracker };
                await this.sendChatbotResponse(userId, deviceId, nextCampaign, remoteJid, originalMessage, false, messageData);
            } else {
                console.warn(`[AIChatbotProcessor] No campaign found with flowId: ${nextBotAction} for user ${userId}`);
                
                // Fallback: try to find by campaign ID
                const nextCampaignById = await Campaign.findOne({
                    _id: nextBotAction,
                    userId: userId,
                    campaignType: 'ai_chatbot',
                    status: 'enable',
                    statusEnabled: true
                });

                if (nextCampaignById) {
                    console.log(`[AIChatbotProcessor] Found next campaign by ID: ${nextCampaignById._id} (${nextCampaignById.name})`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    await this.sendChatbotResponse(userId, deviceId, nextCampaignById, remoteJid, originalMessage, false);
                } else {
                    console.warn(`[AIChatbotProcessor] nextBotAction "${nextBotAction}" not found - no chaining performed`);
                }
            }

        } catch (error) {
            console.error(`[AIChatbotProcessor] Error handling nextBotAction: ${nextBotAction}:`, error);
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