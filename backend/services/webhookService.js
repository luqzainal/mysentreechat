const axios = require('axios');

class WebhookService {
    constructor() {
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }

    // Send webhook data to external API
    async sendWebhook(campaign, customerData, botResponse, additionalData = {}) {
        try {
            // Check if API Rest Data is enabled and configured
            if (campaign.apiRestDataStatus !== 'enabled' || !campaign.apiRestConfig?.webhookUrl) {
                console.log(`[WebhookService] Webhook not configured for campaign ${campaign._id}`);
                return { success: true, skipped: true };
            }

            const config = campaign.apiRestConfig;
            
            // Build payload based on configuration
            const payload = this.buildPayload(campaign, customerData, botResponse, config, additionalData);
            
            // Prepare request configuration
            const requestConfig = {
                method: config.method || 'POST',
                url: config.webhookUrl,
                data: payload,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Waziper-WhatsApp-Bot/1.0',
                    ...config.headers
                },
                timeout: 10000 // 10 seconds timeout
            };

            console.log(`[WebhookService] Sending webhook for campaign ${campaign._id} to ${config.webhookUrl}`);
            
            // Send with retry logic
            const response = await this.sendWithRetry(requestConfig);
            
            console.log(`[WebhookService] Webhook sent successfully. Status: ${response.status}`);
            
            return {
                success: true,
                status: response.status,
                responseData: response.data,
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`[WebhookService] Failed to send webhook for campaign ${campaign._id}:`, error.message);
            
            return {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    // Build webhook payload based on configuration
    buildPayload(campaign, customerData, botResponse, config, additionalData) {
        const payload = {
            event: 'ai_chatbot_response',
            campaign_id: campaign._id.toString(),
            campaign_name: campaign.name || campaign.campaignName
        };

        // Add customer data if enabled
        if (config.sendCustomerData) {
            payload.customer = {
                phone: customerData.phone || customerData.remoteJid,
                name: customerData.name || 'Unknown',
                message: customerData.message || customerData.messageText
            };
        }

        // Add bot response data if enabled
        if (config.sendResponseData) {
            payload.bot_response = {
                message: botResponse.message || botResponse.responseText,
                type: botResponse.type || 'unknown',
                ai_tokens: botResponse.aiTokens || 0,
                response_time: botResponse.responseTime || 0
            };
        }

        // Add timestamp and campaign info if enabled
        if (config.sendTimestamp) {
            payload.timestamp = new Date().toISOString();
            payload.device_id = campaign.deviceId;
            payload.user_id = campaign.userId.toString();
        }

        // Add any additional data
        if (additionalData && Object.keys(additionalData).length > 0) {
            payload.additional_data = additionalData;
        }

        return payload;
    }

    // Send request with retry logic
    async sendWithRetry(requestConfig, attempt = 1) {
        try {
            const response = await axios(requestConfig);
            return response;
        } catch (error) {
            if (attempt < this.retryAttempts) {
                console.log(`[WebhookService] Retry attempt ${attempt + 1} for ${requestConfig.url}`);
                await this.delay(this.retryDelay * attempt);
                return this.sendWithRetry(requestConfig, attempt + 1);
            }
            throw error;
        }
    }

    // Delay utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Test webhook configuration
    async testWebhook(webhookUrl, method = 'POST', headers = {}) {
        try {
            const testPayload = {
                event: 'webhook_test',
                timestamp: new Date().toISOString(),
                message: 'This is a test webhook from Waziper AI Chatbot',
                test: true
            };

            const requestConfig = {
                method: method,
                url: webhookUrl,
                data: testPayload,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Waziper-WhatsApp-Bot/1.0',
                    ...headers
                },
                timeout: 5000 // 5 seconds for test
            };

            const response = await axios(requestConfig);
            
            return {
                success: true,
                status: response.status,
                message: 'Webhook test successful',
                responseData: response.data
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Webhook test failed'
            };
        }
    }

    // Validate webhook URL
    isValidWebhookUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }
}

// Export singleton instance
module.exports = new WebhookService();