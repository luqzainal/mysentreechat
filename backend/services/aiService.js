const OpenAI = require('openai');
const Settings = require('../models/Settings');

class AIService {
    constructor() {
        this.openaiClients = new Map(); // Cache OpenAI clients by userId
    }

    // Get OpenAI client for specific user
    async getOpenAIClient(userId) {
        try {
            // Check if we already have a cached client
            if (this.openaiClients.has(userId)) {
                return this.openaiClients.get(userId);
            }

            // Get user's OpenAI API key from settings
            const settings = await Settings.findOne({ userId }).select('openaiApiKey');
            
            if (!settings || !settings.openaiApiKey) {
                console.warn(`[AIService] No OpenAI API key found for user ${userId}`);
                return null;
            }

            // Create new OpenAI client
            const openai = new OpenAI({
                apiKey: settings.openaiApiKey,
            });

            // Cache the client
            this.openaiClients.set(userId, openai);
            
            console.log(`[AIService] OpenAI client created for user ${userId}`);
            return openai;

        } catch (error) {
            console.error(`[AIService] Error getting OpenAI client for user ${userId}:`, error);
            return null;
        }
    }

    // Generate AI response based on prompt and context
    async generateResponse(userId, prompt, context = {}) {
        try {
            const openai = await this.getOpenAIClient(userId);
            
            if (!openai) {
                console.error(`[AIService] OpenAI client not available for user ${userId}`);
                return null;
            }

            // Build messages array
            const messages = [
                {
                    role: "system",
                    content: "You are a helpful WhatsApp chatbot assistant. Generate natural, friendly responses in the language requested. Keep responses concise and relevant."
                }
            ];

            // Add context if available
            if (context.incomingMessage) {
                messages.push({
                    role: "user", 
                    content: `User sent: "${context.incomingMessage}"`
                });
            }

            // Add the AI prompt
            messages.push({
                role: "user",
                content: prompt
            });

            console.log(`[AIService] Generating AI response for user ${userId} with prompt: "${prompt}"`);

            const startTime = Date.now();
            const completion = await openai.chat.completions.create({
                model: context.model || "gpt-3.5-turbo",
                messages: messages,
                max_tokens: context.maxTokens || 150,
                temperature: context.temperature || 0.7,
                presence_penalty: 0.1,
                frequency_penalty: 0.1
            });

            const responseTime = Date.now() - startTime;
            const aiResponse = completion.choices[0]?.message?.content;

            if (!aiResponse) {
                console.error(`[AIService] Empty response from OpenAI for user ${userId}`);
                return null;
            }

            console.log(`[AIService] AI response generated for user ${userId}. Response time: ${responseTime}ms, Tokens: ${completion.usage?.total_tokens || 0}`);

            return {
                response: aiResponse.trim(),
                usage: {
                    tokens: completion.usage?.total_tokens || 0,
                    promptTokens: completion.usage?.prompt_tokens || 0,
                    completionTokens: completion.usage?.completion_tokens || 0,
                    responseTime: responseTime
                },
                model: completion.model
            };

        } catch (error) {
            console.error(`[AIService] Error generating AI response for user ${userId}:`, error);
            
            // Handle specific OpenAI errors
            if (error.status === 401) {
                console.error(`[AIService] Invalid API key for user ${userId}`);
                // Remove cached client
                this.openaiClients.delete(userId);
            } else if (error.status === 429) {
                console.error(`[AIService] Rate limit exceeded for user ${userId}`);
            } else if (error.status === 402) {
                console.error(`[AIService] Insufficient credits for user ${userId}`);
            }

            return null;
        }
    }

    // Process AI prompt dengan parameter replacement
    processAIPrompt(prompt, context = {}) {
        let processedPrompt = prompt;

        // Replace common parameters
        const parameters = {
            '[wa_name]': context.senderName || 'User',
            '[me_wa_name]': context.botName || 'Bot',
            '[incoming_message]': context.incomingMessage || '',
            '[greet]': this.getGreeting(),
            '[now_formatted|DD MMM YYYY]': new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short', 
                year: 'numeric'
            }),
            '[now_formatted|HH:mm]': new Date().toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })
        };

        // Replace all parameters
        Object.entries(parameters).forEach(([param, value]) => {
            processedPrompt = processedPrompt.replace(new RegExp(param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        });

        // Handle custom date formats
        const dateFormatRegex = /\[now_formatted\|([^\]]+)\]/g;
        processedPrompt = processedPrompt.replace(dateFormatRegex, (match, format) => {
            try {
                // Simple format mapping
                const now = new Date();
                if (format.includes('DD MMM YYYY')) {
                    return now.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    });
                } else if (format.includes('HH:mm')) {
                    return now.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                }
                return match; // Return original if format not recognized
            } catch (error) {
                console.warn(`[AIService] Error formatting date: ${error.message}`);
                return match;
            }
        });

        return processedPrompt;
    }

    // Get greeting based on current time
    getGreeting() {
        const hour = new Date().getHours();
        
        if (hour < 12) {
            return 'Good morning';
        } else if (hour < 17) {
            return 'Good afternoon';
        } else {
            return 'Good evening';
        }
    }

    // Clear cached client for user (useful when API key changes)
    clearUserCache(userId) {
        this.openaiClients.delete(userId);
        console.log(`[AIService] Cleared cache for user ${userId}`);
    }

    // Clear all cached clients
    clearAllCache() {
        this.openaiClients.clear();
        console.log(`[AIService] Cleared all cached OpenAI clients`);
    }
}

// Export singleton instance
module.exports = new AIService();
