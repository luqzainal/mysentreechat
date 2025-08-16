const cron = require('node-cron');
const WhatsappDevice = require('../models/WhatsappDevice.js');
const { getWhatsAppSocket, connectToWhatsApp } = require('./baileysService.js');

class ConnectionMonitor {
    constructor() {
        this.isRunning = false;
        this.reconnectAttempts = new Map(); // userId -> attempts count
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 10000; // 10 seconds
    }

    // Start the connection monitor
    start() {
        if (this.isRunning) {
            console.log('[ConnectionMonitor] Monitor is already running');
            return;
        }

        console.log('[ConnectionMonitor] Starting connection monitor...');
        
        // Check connections every 30 seconds
        this.cronJob = cron.schedule('*/30 * * * * *', async () => {
            await this.checkConnections();
        }, {
            scheduled: true,
            timezone: "Asia/Kuala_Lumpur"
        });

        this.isRunning = true;
        console.log('[ConnectionMonitor] Connection monitor started successfully');
    }

    // Stop the monitor
    stop() {
        if (this.cronJob) {
            this.cronJob.destroy();
            this.isRunning = false;
            console.log('[ConnectionMonitor] Connection monitor stopped');
        }
    }

    // Check all connections and auto-reconnect if needed
    async checkConnections() {
        try {
            console.log(`[ConnectionMonitor] Checking connections at ${new Date().toISOString()}`);

            // Find devices that should be connected but are marked as disconnected in DB
            const disconnectedDevices = await WhatsappDevice.find({
                connectionStatus: 'disconnected',
                // Only check devices that were connected in the last 24 hours
                lastConnectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

            console.log(`[ConnectionMonitor] Found ${disconnectedDevices.length} recently disconnected devices`);

            for (const device of disconnectedDevices) {
                await this.attemptReconnection(device);
            }

            // Also check devices marked as connected in DB but not in memory
            const connectedDevices = await WhatsappDevice.find({
                connectionStatus: 'connected'
            });

            for (const device of connectedDevices) {
                const sock = getWhatsAppSocket(device.userId.toString());
                if (!sock || !sock.user) {
                    console.log(`[ConnectionMonitor] Device ${device.deviceId} marked as connected in DB but not in memory. Updating DB...`);
                    await WhatsappDevice.updateOne(
                        { _id: device._id },
                        { connectionStatus: 'disconnected', updatedAt: new Date() }
                    );
                }
            }

        } catch (error) {
            console.error('[ConnectionMonitor] Error checking connections:', error);
        }
    }

    // Attempt to reconnect a device
    async attemptReconnection(device) {
        const userId = device.userId.toString();
        const currentAttempts = this.reconnectAttempts.get(userId) || 0;

        // Check if max attempts reached
        if (currentAttempts >= this.maxReconnectAttempts) {
            console.log(`[ConnectionMonitor] Max reconnect attempts (${this.maxReconnectAttempts}) reached for user ${userId}. Skipping...`);
            return;
        }

        // Check if device was disconnected recently (less than 5 minutes ago)
        const timeSinceLastUpdate = Date.now() - device.updatedAt.getTime();
        if (timeSinceLastUpdate < 5 * 60 * 1000) { // 5 minutes
            console.log(`[ConnectionMonitor] Device ${device.deviceId} disconnected recently (${Math.round(timeSinceLastUpdate/1000)}s ago). Attempting reconnection...`);
            
            // Check if already connected in memory
            const existingSocket = getWhatsAppSocket(userId);
            if (existingSocket && existingSocket.user) {
                console.log(`[ConnectionMonitor] User ${userId} already connected in memory. Updating DB status...`);
                await WhatsappDevice.updateOne(
                    { _id: device._id },
                    { connectionStatus: 'connected', updatedAt: new Date() }
                );
                this.reconnectAttempts.delete(userId);
                return;
            }

            // Attempt reconnection
            console.log(`[ConnectionMonitor] Attempting reconnection for user ${userId} (attempt ${currentAttempts + 1}/${this.maxReconnectAttempts})`);
            
            try {
                this.reconnectAttempts.set(userId, currentAttempts + 1);
                
                // Add delay before reconnection
                await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
                
                // Attempt to connect
                await connectToWhatsApp(userId);
                
                console.log(`[ConnectionMonitor] Reconnection attempt initiated for user ${userId}`);
                
            } catch (error) {
                console.error(`[ConnectionMonitor] Error during reconnection attempt for user ${userId}:`, error);
            }
        }
    }

    // Reset reconnect attempts for a user (call when successfully connected)
    resetReconnectAttempts(userId) {
        this.reconnectAttempts.delete(userId);
        console.log(`[ConnectionMonitor] Reset reconnect attempts for user ${userId}`);
    }

    // Force reconnect a specific user
    async forceReconnect(userId) {
        console.log(`[ConnectionMonitor] Force reconnecting user ${userId}...`);
        
        try {
            // Reset attempts counter
            this.reconnectAttempts.delete(userId);
            
            // Attempt connection
            await connectToWhatsApp(userId);
            
            console.log(`[ConnectionMonitor] Force reconnection initiated for user ${userId}`);
            return true;
            
        } catch (error) {
            console.error(`[ConnectionMonitor] Error during force reconnection for user ${userId}:`, error);
            return false;
        }
    }

    // Get monitor status
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeReconnectAttempts: Array.from(this.reconnectAttempts.entries()),
            lastCheck: new Date().toISOString()
        };
    }

    // Set keep-alive ping for active connections
    startKeepAlive() {
        // Send ping every 5 minutes to keep connections alive
        setInterval(async () => {
            try {
                const connectedDevices = await WhatsappDevice.find({
                    connectionStatus: 'connected'
                });

                for (const device of connectedDevices) {
                    const sock = getWhatsAppSocket(device.userId.toString());
                    if (sock && sock.user) {
                        try {
                            // Send a simple ping to keep connection alive
                            await sock.query({
                                tag: 'iq',
                                attrs: {
                                    type: 'get',
                                    xmlns: 'w:p',
                                    to: sock.user.id
                                }
                            });
                            console.log(`[ConnectionMonitor] Keep-alive ping sent for user ${device.userId}`);
                        } catch (pingError) {
                            console.warn(`[ConnectionMonitor] Keep-alive ping failed for user ${device.userId}:`, pingError.message);
                        }
                    }
                }
            } catch (error) {
                console.error('[ConnectionMonitor] Error during keep-alive ping:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
}

// Create singleton instance
const connectionMonitor = new ConnectionMonitor();

module.exports = connectionMonitor;