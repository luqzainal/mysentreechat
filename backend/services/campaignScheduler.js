const cron = require('node-cron');
const Campaign = require('../models/Campaign.js');
const { executeBulkCampaign, executeAIChatbotCampaign } = require('../controllers/whatsappController.js');

class CampaignScheduler {
    constructor() {
        this.scheduledTasks = new Map();
        this.isRunning = false;
    }

    // Start the scheduler
    start() {
        if (this.isRunning) {
            console.log('[CampaignScheduler] Scheduler is already running');
            return;
        }

        console.log('[CampaignScheduler] Starting campaign scheduler...');
        
        // Check for scheduled campaigns every minute
        this.cronJob = cron.schedule('* * * * *', async () => {
            await this.checkScheduledCampaigns();
        }, {
            scheduled: true,
            timezone: "Asia/Kuala_Lumpur"
        });

        this.isRunning = true;
        console.log('[CampaignScheduler] Campaign scheduler started successfully');
    }

    // Stop the scheduler
    stop() {
        if (this.cronJob) {
            this.cronJob.destroy();
            this.isRunning = false;
            console.log('[CampaignScheduler] Campaign scheduler stopped');
        }
    }

    // Check for campaigns that need to be executed
    async checkScheduledCampaigns() {
        try {
            const now = new Date();
            console.log(`[CampaignScheduler] Checking scheduled campaigns at ${now.toISOString()}`);

            // Find campaigns that are scheduled to run now or in the past but haven't been executed
            const scheduledCampaigns = await Campaign.find({
                scheduledAt: { $lte: now },
                statusEnabled: true,
                campaignType: 'bulk', // Only bulk campaigns can be scheduled for now
                // Add a field to track if campaign has been executed
                $or: [
                    { lastExecutedAt: { $exists: false } },
                    { $expr: { $lt: ['$lastExecutedAt', '$scheduledAt'] } }
                ]
            });

            console.log(`[CampaignScheduler] Found ${scheduledCampaigns.length} campaigns to execute`);

            for (const campaign of scheduledCampaigns) {
                await this.executeCampaign(campaign);
            }

        } catch (error) {
            console.error('[CampaignScheduler] Error checking scheduled campaigns:', error);
        }
    }

    // Execute a single campaign
    async executeCampaign(campaign) {
        try {
            console.log(`[CampaignScheduler] Executing scheduled campaign: ${campaign.campaignName} (${campaign._id})`);

            // Check if campaign should run based on schedule type and details
            if (!this.shouldRunNow(campaign)) {
                console.log(`[CampaignScheduler] Campaign ${campaign._id} skipped due to schedule constraints`);
                return;
            }

            // Check if WhatsApp is connected before attempting execution
            const baileysService = require('../services/baileysService.js');
            const sock = baileysService.getWhatsAppSocket(campaign.userId.toString());
            
            if (!sock || !sock.user) {
                console.log(`[CampaignScheduler] Campaign ${campaign._id} skipped - WhatsApp not connected for user ${campaign.userId}`);
                
                // Update campaign with skip reason (don't mark as failed, just log attempt)
                await Campaign.findByIdAndUpdate(campaign._id, {
                    lastExecutionError: 'WhatsApp not connected',
                    lastExecutionAttempt: new Date()
                });
                return;
            }

            let executionSuccess = false;
            let executionError = null;

            // Create a mock request and response object for the controller
            const mockReq = {
                params: {
                    campaignId: campaign._id.toString(),
                    deviceId: campaign.deviceId
                },
                user: {
                    _id: campaign.userId,
                    id: campaign.userId.toString()
                }
            };

            const mockRes = {
                status: (code) => ({
                    json: (data) => {
                        if (code >= 400) {
                            executionError = data.message || 'Execution failed';
                            console.log(`[CampaignScheduler] Campaign execution failed:`, { code, data });
                        } else {
                            executionSuccess = true;
                            console.log(`[CampaignScheduler] Campaign execution response:`, { code, data });
                        }
                        return mockRes;
                    }
                }),
                json: (data) => {
                    executionSuccess = true;
                    console.log(`[CampaignScheduler] Campaign execution success:`, data);
                    return mockRes;
                }
            };

            // Execute based on campaign type
            if (campaign.campaignType === 'bulk') {
                await executeBulkCampaign(mockReq, mockRes);
            } else if (campaign.campaignType === 'ai_chatbot') {
                await executeAIChatbotCampaign(mockReq, mockRes);
            }

            // Mark campaign based on execution result
            if (executionSuccess) {
                await Campaign.findByIdAndUpdate(campaign._id, {
                    lastExecutedAt: new Date(),
                    lastExecutionError: null
                });
                console.log(`[CampaignScheduler] Campaign ${campaign._id} executed successfully`);
            } else {
                await Campaign.findByIdAndUpdate(campaign._id, {
                    lastExecutionError: executionError || 'Unknown execution error',
                    lastExecutionAttempt: new Date(),
                    $inc: { failedCount: 1 }
                });
                console.log(`[CampaignScheduler] Campaign ${campaign._id} execution failed: ${executionError}`);
            }

        } catch (error) {
            console.error(`[CampaignScheduler] Error executing campaign ${campaign._id}:`, error);
            
            // Log the failure
            await Campaign.findByIdAndUpdate(campaign._id, {
                $inc: { failedCount: 1 },
                lastExecutionError: error.message,
                lastExecutionAttempt: new Date()
            });
        }
    }

    // Check if campaign should run now based on schedule type and details
    shouldRunNow(campaign) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDate();

        switch (campaign.campaignScheduleType) {
            case 'anytime':
                return true;

            case 'specific_daytime':
                // Run during daytime hours (8 AM to 6 PM)
                return currentHour >= 8 && currentHour < 18;

            case 'specific_nighttime':
                // Run during nighttime hours (6 PM to 8 AM)
                return currentHour >= 18 || currentHour < 8;

            case 'specific_odd':
                // Run on odd days
                return currentDay % 2 === 1;

            case 'specific_even':
                // Run on even days
                return currentDay % 2 === 0;

            case 'custom_slots':
                // Run only during specified hours
                if (campaign.campaignScheduleDetails && Array.isArray(campaign.campaignScheduleDetails)) {
                    return campaign.campaignScheduleDetails.includes(currentHour);
                }
                return false;

            default:
                return true;
        }
    }

    // Add a new scheduled campaign
    async addScheduledCampaign(campaignId) {
        try {
            const campaign = await Campaign.findById(campaignId);
            if (campaign && campaign.scheduledAt && campaign.statusEnabled) {
                console.log(`[CampaignScheduler] Added campaign ${campaignId} to scheduler`);
                // The cron job will pick it up automatically
                return true;
            }
            return false;
        } catch (error) {
            console.error(`[CampaignScheduler] Error adding scheduled campaign ${campaignId}:`, error);
            return false;
        }
    }

    // Remove a scheduled campaign
    async removeScheduledCampaign(campaignId) {
        try {
            // Update campaign to disable scheduling
            await Campaign.findByIdAndUpdate(campaignId, {
                scheduledAt: null,
                statusEnabled: false
            });
            console.log(`[CampaignScheduler] Removed campaign ${campaignId} from scheduler`);
            return true;
        } catch (error) {
            console.error(`[CampaignScheduler] Error removing scheduled campaign ${campaignId}:`, error);
            return false;
        }
    }

    // Get scheduler status
    getStatus() {
        return {
            isRunning: this.isRunning,
            scheduledTasksCount: this.scheduledTasks.size,
            lastCheck: new Date().toISOString()
        };
    }
}

// Create singleton instance
const campaignScheduler = new CampaignScheduler();

module.exports = campaignScheduler;