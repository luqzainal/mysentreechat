const makeWASocket = require('baileys').default
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore, Browsers } = require('baileys')
const path = require('path')
const fs = require('fs-extra')
const WhatsappDevice = require('../models/WhatsappDevice.js')
const User = require('../models/User.js')
const Message = require('../models/Message.js')
const pino = require('pino')

const PLAN_LIMITS = { Free: 1, Basic: 2, Pro: 5, default: 1 }

// Helper function to process incoming messages
const processIncomingMessage = async (userId, msg) => {
  try {
    console.log(`[processIncomingMessage] Processing message for user ${userId}, ID: ${msg.key.id}`);
    
    const deviceId = msg.key.remoteJid?.split('@')[0] || 'unknown';
    
    // Save to database
    const messageData = {
      user: userId,
      chatJid: msg.key.remoteJid,
      messageId: msg.key.id,
      body: msg.message.conversation || msg.message.extendedTextMessage?.text || '',
      timestamp: new Date((parseInt(msg.messageTimestamp) || Math.floor(Date.now() / 1000)) * 1000),
      fromMe: msg.key.fromMe,
      status: 'received',
      sourceDeviceId: deviceId
    };

    console.log(`[processIncomingMessage] Saving message to DB:`, messageData);
    const savedMessage = new Message(messageData);
    await savedMessage.save();
    console.log(`[processIncomingMessage] Message saved to DB with ID: ${savedMessage._id}`);

    // Process AI Chatbot
    const aiChatbotProcessor = require('./aiChatbotProcessor.js');
    const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    if (messageText.trim()) {
      const chatbotData = {
        messageId: msg.key.id,
        chatJid: msg.key.remoteJid,
        messageText: messageText,
        timestamp: parseInt(msg.messageTimestamp) || Math.floor(Date.now() / 1000)
      };
      
      console.log(`[processIncomingMessage] Processing AI chatbot for text: "${messageText}"`);
      await aiChatbotProcessor.processMessage(userId, deviceId, chatbotData);
    }
  } catch (error) {
    console.error(`[processIncomingMessage] Error:`, error);
  }
};

const clients = new Map() // Map<userId, socket>
let ioGlobal = null

const baileysLogger = pino({ level: 'debug' })

const getAuth = async (userId) => {
  const authPath = path.join(__dirname, '..', 'sessions_baileys', userId)
  console.log(`[Baileys] Getting auth state for user ${userId} from path: ${authPath}`)
  const { state, saveCreds } = await useMultiFileAuthState(authPath)
  return { state, saveCreds }
}

// Kembalikan store
const store = makeInMemoryStore({ logger: baileysLogger.child({ stream: 'store' }) })

const emit = (userId, event, data) => {
  console.log(`[Baileys Emit Function] Entered. Checking ioGlobal. Is null? ${!ioGlobal}. Event: ${event}, UserID: ${userId}`);
  if (ioGlobal) {
    const logData = event === 'whatsapp_qr' ? '<QR Data>' : JSON.stringify(data);
    console.log(`[Baileys Emit Function] ioGlobal exists. Emitting event '${event}' to user ${userId}. Data Snippet: ${logData.substring(0, 100)}...`)
    try {
      ioGlobal.to(userId).emit(event, data)
      console.log(`[Baileys Emit Function] Emit successful for event '${event}' to user ${userId}.`);
    } catch (socketEmitError) {
      console.error(`[Baileys Emit Function] Error during actual emit for event '${event}', user ${userId}: ${socketEmitError.message}`, { stack: socketEmitError.stack });
    }
  } else {
    console.warn(`[Baileys Emit Function] ioGlobal is null. Cannot emit Socket.IO event '${event}' to user ${userId}`)
  }
}

// Function to process messages directly (shared logic)
const processMessageDirectly = async (userId, messageUpsert) => {
  console.log('[Baileys DEBUG] processMessageDirectly called for user', userId, 'with:', JSON.stringify(messageUpsert, null, 2));
  
  if (messageUpsert.type === 'notify' && messageUpsert.messages) {
    for (const msg of messageUpsert.messages) {
      if (msg.message && !msg.key.fromMe) {
        console.log(`[Baileys] Processing incoming message from ${msg.key.remoteJid} for user ${userId}`);
        
        try {
          // Get device ID from socket or use default
          const deviceId = msg.key.participant?.split('@')[0] || msg.key.remoteJid?.split('@')[0] || 'unknown_device';
          const receiverJid = `${userId}@s.whatsapp.net`;

          const messageData = {
            user: userId,
            chatJid: msg.key.remoteJid,
            messageId: msg.key.id,
            body: msg.message.conversation || msg.message.extendedTextMessage?.text || JSON.stringify(msg.message) || '',
            timestamp: new Date((parseInt(msg.messageTimestamp) || Math.floor(Date.now() / 1000)) * 1000),
            fromMe: msg.key.fromMe,
            status: 'received',
            sourceDeviceId: deviceId
          };

          console.log(`[Baileys] Saving message to DB for user ${userId}:`, JSON.stringify(messageData));
          const savedMessage = await Message.create(messageData);
          console.log(`[Baileys] Message saved to DB for user ${userId}, ID: ${savedMessage._id}`);

          // Emit to frontend
          emit(userId, 'new_whatsapp_message', savedMessage);

          // Process AI Chatbot campaigns
          try {
            const aiChatbotProcessor = require('./aiChatbotProcessor.js');
            const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (messageText.trim()) {
              const chatbotData = {
                remoteJid: msg.key.remoteJid,
                messageText: messageText,
                messageId: msg.key.id,
                timestamp: parseInt(msg.messageTimestamp) || Math.floor(Date.now() / 1000)
              };

              await aiChatbotProcessor.processMessage(userId, deviceId, chatbotData);
            }
          } catch (chatbotError) {
            console.error(`[Baileys] Error processing AI chatbot for user ${userId}:`, chatbotError);
          }

        } catch (dbError) {
          console.error(`[Baileys] Error in processMessageDirectly for user ${userId}: ${dbError.message}`, { stack: dbError.stack });
        }
      }
    }
  }
};

async function connectToWhatsApp(userId) {
  // Isytihar pembolehubah di luar try block
  let limit = 0;
  let currentActiveDevicesCount = 0;
  let userPlan = 'Free'; // Simpan plan juga

  // --- SEMAKAN HAD SAMBUNGAN DAHULU ---
  try {
    console.log(`[Baileys] Connect request received for user ${userId}. Checking plan limits...`);
    const user = await User.findById(userId);
    if (!user) {
      console.error(`[Baileys] User not found for ID: ${userId}`);
      emit(userId, 'whatsapp_error', 'User not found.');
      return;
    }
    userPlan = user.membershipPlan || 'Free'; // Assign ke variable luar
    limit = PLAN_LIMITS[userPlan] || PLAN_LIMITS.default; // Assign ke variable luar
    currentActiveDevicesCount = await WhatsappDevice.countDocuments({ userId, connectionStatus: 'connected' }); // Assign ke variable luar

    console.log(`[Baileys] User ${userId}: Plan=${userPlan}, Limit=${limit}, CurrentActiveInDB=${currentActiveDevicesCount}`);

    if (currentActiveDevicesCount >= limit) {
      console.warn(`[Baileys] Connection limit reached for user ${userId}. Limit: ${limit}.`);
      emit(userId, 'whatsapp_error', `Connection limit (${limit}) reached. Please disconnect an existing device to add a new one.`);
      const existingDevice = await WhatsappDevice.findOne({ userId, connectionStatus: 'connected' });
      if (existingDevice) {
          emit(userId, 'whatsapp_status', 'connected');
      }
      return;
    }
  } catch (error) {
    console.error(`[Baileys] Error checking connection limit for user ${userId}: ${error.message}`, { stack: error.stack });
    emit(userId, 'whatsapp_error', 'Error checking connection limits.');
    return;
  }

  console.log(`[Baileys] Proceeding to set up new QR session for user ${userId} (Limit: ${limit}, Active: ${currentActiveDevicesCount}).`);

  const oldClient = clients.get(userId);
  if (oldClient) {
      console.warn(`[Baileys] Found an existing client in memory for user ${userId} before starting new QR. Disconnecting and removing it to ensure fresh QR.`);
      // return; // Hentikan jika had dicapai
  } else {
      console.log(`[Baileys] No existing client in memory for user ${userId}. Cleaning up potential old session folder...`);
      // KELUARKAN BLOK INI: Jangan padam sesi di sini kerana ia diperlukan untuk reconnect
      /*
      const authPath = path.join(__dirname, '..', 'sessions_baileys', userId);
      try {
          await fs.rm(authPath, { recursive: true, force: true });
          console.log(`[Baileys] Old session folder cleaned for user ${userId} at ${authPath}.`);
      } catch (err) {
          if (err.code === 'ENOENT') {
              console.log(`[Baileys] No old session folder to clean for user ${userId} at ${authPath}.`);
          } else {
              console.error(`[Baileys] Error cleaning old session folder for user ${userId}: ${err.message}`);
          }
      }
      */
  }

  console.log(`[Baileys] Setting up Baileys connection for user ${userId}...`);
  const { state, saveCreds } = await getAuth(userId);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[Baileys] Using Baileys version: ${version}, isLatest: ${isLatest}`);

  let sock
  try {
    console.log(`[Baileys] Calling makeWASocket for user ${userId}...`)
    sock = makeWASocket({
      version,
      logger: baileysLogger,
      printQRInTerminal: true,
      auth: state,
      browser: Browsers.windows('Chrome'),
      markOnlineOnConnect: false,
      // Enable message receiving
      getMessage: async (key) => {
        if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
        }
        return undefined;
      },
      // Disable full sync for faster performance
      syncFullHistory: false,
    })
    console.log(`[Baileys] makeWASocket call completed for user ${userId}. Binding event handlers...`)

    clients.set(userId, sock)

    // ---> TAMBAH PENDAFTARAN EVENT CREDENTIALS UPDATE <---
    sock.ev.on('creds.update', saveCreds);
    console.log(`[Baileys] 'creds.update' handler bound for user ${userId}.`);

    // Create a fresh store for this socket
    const userStore = makeInMemoryStore({ logger: baileysLogger.child({ stream: 'store' }) });
    userStore.bind(sock.ev);
    console.log(`[Baileys] Fresh store created and bound to socket events for user ${userId}`);

    // DIRECT WebSocket message capture - hook into raw WebSocket events
    if (sock.ws) {
      console.log(`[Baileys DEBUG] Setting up direct WebSocket message listener for user ${userId}`);
      
      const originalOnMessage = sock.ws.onmessage;
      sock.ws.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data && data[1] && data[1].tag === 'message' && data[1].attrs && data[1].attrs.type === 'text') {
            console.log(`[Baileys DEBUG] Direct WebSocket text message captured for user ${userId}:`, data);
            
            // Extract message data from WebSocket format
            const messageId = data[1].attrs.id;
            const fromJid = data[1].attrs.from;
            const messageText = data[2] || data[1].content || '';
            
            if (messageText && fromJid) {
              console.log(`[Baileys DEBUG] Processing direct WebSocket message: "${messageText}" from ${fromJid}`);
              
              // Create synthetic message object
              const syntheticMessage = {
                key: {
                  id: messageId,
                  fromMe: false,
                  remoteJid: fromJid
                },
                message: {
                  conversation: messageText
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
              };
              
              const syntheticUpsert = {
                messages: [syntheticMessage],
                type: 'notify'
              };
              
              // Process immediately
              processMessageDirectly(userId, syntheticUpsert).catch(err => {
                console.error(`[Baileys DEBUG] Error processing synthetic message:`, err);
              });
            }
          }
        } catch (parseError) {
          // Ignore parse errors, not all WebSocket messages are JSON
        }
        
        // Call original handler
        if (originalOnMessage) {
          originalOnMessage.call(this, event);
        }
      };
    }

    // Alternative event listeners for debugging
    sock.ev.on('messages.set', (messageSet) => {
      console.log(`[Baileys DEBUG] messages.set event received for user ${userId}:`, messageSet);
    });

    sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
      console.log(`[Baileys DEBUG] messaging-history.set received: ${chats.length} chats, ${contacts.length} contacts, ${messages.length} messages, isLatest: ${isLatest}`);
      
      // Process any incoming messages from history
      if (messages && messages.length > 0) {
        console.log(`[Baileys DEBUG] Processing ${messages.length} messages from history...`);
        for (const msg of messages) {
          if (msg.message && !msg.key.fromMe) {
            console.log(`[Baileys DEBUG] Found incoming message in history:`, {
              id: msg.key.id,
              from: msg.key.remoteJid,
              text: msg.message.conversation || msg.message.extendedTextMessage?.text
            });
            
            // Process this message directly if it's recent (within last 5 minutes)
            const messageTime = parseInt(msg.messageTimestamp) * 1000;
            const now = Date.now();
            if (now - messageTime < 5 * 60 * 1000) {
              console.log(`[Baileys DEBUG] Processing recent message from history...`);
              // Simulate messages.upsert for recent messages
              const simulatedUpsert = {
                messages: [msg],
                type: 'notify'
              };
              // Process immediately
              processMessageDirectly(userId, simulatedUpsert).catch(err => {
                console.error(`[Baileys DEBUG] Error processing history message:`, err);
              });
            }
          }
        }
      }
    });

    // ---> MAIN HANDLER messages.upsert <---
    console.log(`[Baileys] Setting up messages.upsert handler for user ${userId}...`);
    sock.ev.on('messages.upsert', async (m) => {
      console.log('[BAILEYS CRITICAL] messages.upsert event triggered for user', userId);
      console.log('[BAILEYS CRITICAL] RAW messages.upsert data:', JSON.stringify(m, null, 2));
      console.log(`[BAILEYS CRITICAL] Message type: ${m.type}, Messages count: ${m.messages?.length || 0}`);
      
      // Process ALL message types for debugging
      if (m.messages && m.messages.length > 0) {
        for (const msg of m.messages) {
          console.log(`[Baileys DEBUG] Message details:`, {
            id: msg.key.id,
            fromMe: msg.key.fromMe,
            remoteJid: msg.key.remoteJid,
            messageKeys: Object.keys(msg.message || {}),
            hasTextContent: !!(msg.message?.conversation || msg.message?.extendedTextMessage?.text)
          });
        }
      }
      
      // Use shared processing function
      await processMessageDirectly(userId, m);
      
      // Keep original logic as fallback
      if (m.type === 'notify') {
        console.log(`[Baileys DEBUG] Received 'notify' type messages.upsert for user ${userId}. Processing messages...`);
        for (const msg of m.messages) {
          console.log(`[Baileys DEBUG] Iterating message in m.messages. ID: ${msg.key.id}, fromMe: ${msg.key.fromMe}, hasMessageContent: ${!!msg.message}`); 
          // Check if message content exists and is not fromMe
          if (msg.message && !msg.key.fromMe) {
            console.log(`[Baileys] Condition Passed: Processing incoming message from ${msg.key.remoteJid} for user ${userId}. Message content:`, JSON.stringify(msg.message));
            // --- Logik asal untuk simpan DB dan emit --- (AKTIFKAN SEMULA)
            try {
              const deviceId = sock.user?.id?.split(':')[0]?.split('@')[0] || 'unknown_device';
              const receiverJid = sock.user?.id ? (sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id) : 'unknown_receiver@s.whatsapp.net';


              const messageData = {
                user: userId,
                chatJid: msg.key.remoteJid,
                messageId: msg.key.id,
                body: msg.message.conversation || msg.message.extendedTextMessage?.text || JSON.stringify(msg.message) || '',
                timestamp: new Date((parseInt(msg.messageTimestamp) || Math.floor(Date.now() / 1000)) * 1000),
                fromMe: msg.key.fromMe,
                status: 'received',
                sourceDeviceId: deviceId
              };

              console.log(`[Baileys] Saving message to DB for user ${userId}:`, JSON.stringify(messageData));
              const savedMessage = await Message.create(messageData);
              console.log(`[Baileys] Message saved to DB for user ${userId}, ID: ${savedMessage._id}`);

              console.log(`[Baileys] savedMessage object exists before emit attempt: ${!!savedMessage}`);
              if (!savedMessage) {
                console.error('[Baileys] CRITICAL: savedMessage is null/undefined before emit attempt!');
                // Mungkin return atau throw error di sini jika perlu
              }

              // Emit ke frontend
              console.log(`[Baileys] Attempting to call emit function for 'new_whatsapp_message' to user ${userId}...`);
              emit(userId, 'new_whatsapp_message', savedMessage);
              console.log(`[Baileys] emit function called for 'new_whatsapp_message', user ${userId}.`);

              // Process AI Chatbot campaigns
              try {
                const aiChatbotProcessor = require('./aiChatbotProcessor.js');
                const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                
                if (messageText.trim()) {
                  const chatbotData = {
                    remoteJid: msg.key.remoteJid,
                    messageText: messageText,
                    messageId: msg.key.id,
                    timestamp: parseInt(msg.messageTimestamp) || Math.floor(Date.now() / 1000)
                  };
                  
                  await aiChatbotProcessor.processMessage(userId, deviceId, chatbotData);
                }
              } catch (chatbotError) {
                console.error(`[Baileys] Error processing AI chatbot for user ${userId}:`, chatbotError);
              }

            } catch (dbError) {
              console.error(`[Baileys] Error saving message or emitting for user ${userId}: ${dbError.message}`, { stack: dbError.stack, rawMessage: JSON.stringify(msg) });
            }
          } else if (msg.key.fromMe) {
            // console.log(`[Baileys DEBUG] Ignoring own message (fromMe=true) for user ${userId}. ID: ${msg.key.id}`);
          } else {
            console.log(`[Baileys DEBUG] Ignoring message with no content or fromMe flag issue for user ${userId}. ID: ${msg.key.id}, fromMe: ${msg.key.fromMe}, Has Message: ${!!msg.message}`);
          }
        }
      } else {
        console.log(`[Baileys DEBUG] Received non-'notify' type messages.upsert for user ${userId}. Type: ${m.type}. Ignoring.`);
      }
    });
    console.log(`[Baileys] 'messages.upsert' handler bound for user ${userId}.`);

    // Alternative message capture - handle all message types
    sock.ev.on('messages.set', async (messageSet) => {
      console.log(`[BAILEYS ALTERNATIVE] messages.set event for user ${userId}:`, JSON.stringify(messageSet, null, 2));
    });

    // Try to capture chats update with messages
    sock.ev.on('chats.update', async (chatsUpdate) => {
      console.log(`[BAILEYS ALTERNATIVE] chats.update event for user ${userId}:`, JSON.stringify(chatsUpdate, null, 2));
    });

    // Direct WebSocket message interception as backup
    console.log(`[BAILEYS WEBSOCKET] Checking WebSocket availability for user ${userId}. sock.ws exists: ${!!sock.ws}`);
    if (sock.ws) {
      console.log(`[BAILEYS WEBSOCKET] Setting up WebSocket message interception for user ${userId}...`);
      const originalOnMessage = sock.ws.onmessage;
      sock.ws.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data && data[0] === 'message' && data[1] && data[1].message) {
            console.log(`[BAILEYS WEBSOCKET] Raw WebSocket message intercepted for user ${userId}:`, JSON.stringify(data[1], null, 2));
            
            // Process immediately for AI chatbot
            const msg = data[1];
            if (!msg.key.fromMe && msg.message) {
              console.log(`[BAILEYS WEBSOCKET] Processing incoming message immediately...`);
              processIncomingMessage(userId, msg).catch(err => {
                console.error(`[BAILEYS WEBSOCKET] Error processing message:`, err);
              });
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
        
        // Call original handler
        if (originalOnMessage) {
          originalOnMessage.call(this, event);
        }
      };
      console.log(`[BAILEYS WEBSOCKET] WebSocket interception setup complete for user ${userId}`);
    } else {
      console.log(`[BAILEYS WEBSOCKET] No WebSocket available for user ${userId}. Will try alternative approaches.`);
    }

    // ---> TAMBAH HANDLER DEBUG BARU <---
    sock.ev.on('messages.update', async (m) => {
        console.log('[Baileys DEBUG] RAW messages.update event received:', JSON.stringify(m, null, 2));
    });
    console.log(`[Baileys] 'messages.update' handler bound for user ${userId}.`);

    // Add final debug info about socket state
    console.log(`[BAILEYS FINAL DEBUG] Socket info for user ${userId}:`);
    console.log(`[BAILEYS FINAL DEBUG] - Socket exists: ${!!sock}`);
    console.log(`[BAILEYS FINAL DEBUG] - Socket.ev exists: ${!!sock?.ev}`);
    console.log(`[BAILEYS FINAL DEBUG] - Socket.ws exists: ${!!sock?.ws}`);
    console.log(`[BAILEYS FINAL DEBUG] - Socket.user: ${JSON.stringify(sock?.user)}`);
    console.log(`[BAILEYS FINAL DEBUG] - Socket readyState: ${sock?.ws?.readyState}`);

    // Test if we can manually trigger events
    setTimeout(() => {
      console.log(`[BAILEYS DELAYED TEST] Checking if events work after 5 seconds for user ${userId}...`);
      try {
        sock.ev.emit('test-delayed', { userId, timestamp: Date.now() });
        console.log(`[BAILEYS DELAYED TEST] Delayed test event emitted for user ${userId}`);
      } catch (error) {
        console.error(`[BAILEYS DELAYED TEST] Error emitting test event for user ${userId}:`, error);
      }
    }, 5000);

    sock.ev.on('chats.upsert', async (chats) => {
        console.log('[Baileys DEBUG] RAW chats.upsert event received:', JSON.stringify(chats, null, 2));
    });
    console.log(`[Baileys] 'chats.upsert' handler bound for user ${userId}.`);

    // ---> TAMBAH HANDLER UNTUK messaging-history.set <---
    sock.ev.on('messaging-history.set', async (historyData) => {
        console.log('[Baileys DEBUG] RAW messaging-history.set event received:', JSON.stringify({ 
            chatsCount: historyData.chats.length, 
            messagesCount: historyData.messages.length, 
            contactsCount: historyData.contacts.length, 
            isLatest: historyData.isLatest 
        }, null, 2));
    });
    console.log(`[Baileys] 'messaging-history.set' handler bound for user ${userId}.`); // Log Pengesahan
    // ---> AKHIR TAMBAHAN HANDLER DEBUG <---

    // Add comprehensive event logging
    console.log(`[BAILEYS SETUP] Setting up * (wildcard) event handler for user ${userId}...`);
    sock.ev.on('*', (event, ...args) => {
      console.log(`[BAILEYS ALL EVENTS] Event '${event}' triggered for user ${userId}`);
      if (event.includes('message') || event.includes('receipt') || event.includes('notify')) {
        console.log(`[BAILEYS EVENT] Event '${event}' triggered for user ${userId} with data:`, JSON.stringify(args, null, 2));
      }
    });
    console.log(`[BAILEYS SETUP] * (wildcard) event handler bound for user ${userId}`);

    // Test event system
    console.log(`[BAILEYS TEST] Testing event system for user ${userId}...`);
    sock.ev.emit('test-event', { test: 'data' });
    console.log(`[BAILEYS TEST] Test event emitted for user ${userId}`);

    // CRITICAL FIX: Direct message monitoring using setInterval as fallback
    const messageMonitor = setInterval(async () => {
      try {
        if (!clients.has(userId)) {
          console.log(`[BAILEYS MONITOR] Client no longer exists for user ${userId}, clearing monitor`);
          clearInterval(messageMonitor);
          return;
        }
        
        // Check for very recent unprocessed messages (last 30 seconds)
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        const recentMessages = await Message.find({
          user: userId,
          timestamp: { $gte: thirtySecondsAgo },
          fromMe: false,
          $or: [
            { processed: { $exists: false } },
            { processed: false }
          ]
        }).sort({ timestamp: -1 }).limit(3);
        
        if (recentMessages.length > 0) {
          console.log(`[BAILEYS MONITOR] Found ${recentMessages.length} unprocessed recent messages for user ${userId}`);
          
          for (const msg of recentMessages) {
            console.log(`[BAILEYS MONITOR] Processing message: "${msg.body}" from ${msg.chatJid}`);
            
            // Process with AI chatbot
            const aiChatbotProcessor = require('./aiChatbotProcessor.js');
            const chatbotData = {
              messageId: msg.messageId,
              chatJid: msg.chatJid,
              messageText: msg.body,
              timestamp: Math.floor(msg.timestamp.getTime() / 1000)
            };
            
            await aiChatbotProcessor.processMessage(userId, msg.sourceDeviceId || 'unknown', chatbotData);
            
            // Mark as processed
            await Message.updateOne({ _id: msg._id }, { processed: true });
            console.log(`[BAILEYS MONITOR] Marked message ${msg._id} as processed`);
          }
        }
      } catch (error) {
        console.error(`[BAILEYS MONITOR] Error in message monitor for user ${userId}:`, error);
      }
    }, 15000); // Check every 15 seconds
    
    console.log(`[BAILEYS MONITOR] Message monitor started for user ${userId}`);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      console.log(`[Baileys] connection.update event for user ${userId}. Status: ${connection}`, { update })

      if (qr) {
        console.log(`[Baileys] QR code received for user ${userId}. Emitting to frontend.`)
        emit(userId, 'whatsapp_qr', qr)
        emit(userId, 'whatsapp_status', 'waiting_qr')
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const reason = DisconnectReason[statusCode] || 'Unknown'
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.warn(`[Baileys] Connection closed for user ${userId}. StatusCode: ${statusCode}, Reason: ${reason}. Should Reconnect: ${shouldReconnect}.`, { error: lastDisconnect?.error })

        emit(userId, 'whatsapp_status', 'disconnected')
        emit(userId, 'whatsapp_qr', null)

        try {
          const deviceIdFromSock = sock.user?.id?.split(':')[0].split('@')[0]
          if (deviceIdFromSock) {
            console.log(`[Baileys] Updating DB status to 'disconnected' for user ${userId}, deviceId: ${deviceIdFromSock}`)
            await WhatsappDevice.updateOne(
              { userId, deviceId: deviceIdFromSock },
              { connectionStatus: 'disconnected', updatedAt: new Date() }
            )
          } else {
            console.warn(`[Baileys] No deviceId available on sock during close event for user ${userId}. Updating all non-disconnected devices for user.`)
            await WhatsappDevice.updateMany(
              { userId: userId, connectionStatus: { $ne: 'disconnected' } },
              { connectionStatus: 'disconnected', updatedAt: new Date() }
            )
          }
          console.log(`[Baileys] DB status updated to 'disconnected' for user ${userId}`)
        } catch (dbError) {
          console.error(`[Baileys] DB Error updating status to 'disconnected' for user ${userId}: ${dbError.message}`, { stack: dbError.stack })
        }

        clients.delete(userId)
        console.log(`[Baileys] Client removed from memory map for user ${userId}.`)

        if (!shouldReconnect) {
          console.warn(`[Baileys] Logged out condition detected for user ${userId}. Cleaning session data.`)
          const authPath = path.join(__dirname, '..', 'sessions_baileys', userId)
          try {
            await fs.rm(authPath, { recursive: true, force: true })
            console.log(`[Baileys] Session data deleted for user ${userId} at ${authPath}.`)
          } catch (err) {
            if (err.code === 'ENOENT') {
              console.warn(`[Baileys] Session folder not found for deletion for user ${userId} (maybe already deleted): ${authPath}`)
            } else {
              console.error(`[Baileys] Failed to delete session data for user ${userId} at ${authPath}: ${err.message}`, { stack: err.stack })
            }
          }
        }

        if (connection === 'close' && shouldReconnect) {
          console.log(`[Baileys] Restart required detected for user ${userId}. Attempting reconnect...`);
          setTimeout(() => {
            connectToWhatsApp(userId);
          }, 1000);
        }
      } else if (connection === 'open') {
        const deviceId = sock.user.id.split(':')[0].split('@')[0]
        const deviceName = sock.user.name || sock.user.verifiedName || `Device ${deviceId}`
        console.log(`[Baileys] Connection opened successfully for user ${userId}. WA User ID: ${sock.user?.id}, Device ID: ${deviceId}, Name: ${deviceName}`)
        emit(userId, 'whatsapp_status', 'connected')
        emit(userId, 'whatsapp_qr', null)

        // Reset reconnection attempts when successfully connected
        try {
          const connectionMonitor = require('./connectionMonitor.js');
          connectionMonitor.resetReconnectAttempts(userId);
        } catch (monitorError) {
          console.warn(`[Baileys] Could not reset reconnect attempts for user ${userId}:`, monitorError.message);
        }

        try {
          const deviceData = {
            userId,
            deviceId: deviceId,
            number: deviceId,
            name: deviceName,
            connectionStatus: 'connected',
            lastConnectedAt: new Date(),
            updatedAt: new Date()
          }
          console.log(`[Baileys] Updating/Creating DB record for user ${userId}, device ${deviceId}...`, { deviceData })
          await WhatsappDevice.findOneAndUpdate(
            { userId, deviceId: deviceData.deviceId },
            deviceData,
            { upsert: true, new: true, setDefaultsOnInsert: true }
          )
          console.log(`[Baileys] DB record updated/created for user ${userId}, device ${deviceId} to 'connected'.`)
        } catch (dbError) {
          console.error(`[Baileys] DB Error updating status to 'connected' for user ${userId}, device ${deviceId}: ${dbError.message}`, { stack: dbError.stack });
        }
      }
    })
    console.log(`[Baileys] 'connection.update' handler bound for user ${userId}.`); // Log Pengesahan

  } catch (error) {
    console.error(`[Baileys] Error connecting to WhatsApp for user ${userId}: ${error.message}`, { stack: error.stack });
    emit(userId, 'whatsapp_error', 'Error connecting to WhatsApp.');
  }
}

function initializeWhatsAppService(io) {
  ioGlobal = io;
  console.log("[Baileys] Baileys Service Initialized with Socket.IO instance.");
}

function getWhatsAppSocket(userId) {
  return clients.get(userId);
}

async function destroyClientByUserId(userId, deleteSession = true) {
  console.log(`[Baileys] Attempting to destroy client for user ${userId}. Delete session: ${deleteSession}`);
  const sock = clients.get(userId);
  if (sock) {
    try {
      console.log(`[Baileys] Emitting disconnect status before closing socket for user ${userId}`);
      // Emit status before trying to end, in case end() fails
      emit(userId, 'whatsapp_status', 'disconnected');
      emit(userId, 'whatsapp_qr', null);

      console.log(`[Baileys] Calling sock.end() for user ${userId}.`);
      // Attempt to close the socket gracefully
      try {
        sock.end(new Error('Client destroyed by server request.'));
      } catch (endError) {
        // Suppress error if socket was already closed (common scenario)
        if (endError.message?.includes('WebSocket was closed')) {
          console.warn(`[Baileys] Suppressed error during sock.end() for ${userId}: ${endError.message}. Socket likely already closed.`);
        } else {
          // Re-throw unexpected errors during end()
          console.error(`[Baileys] Unexpected error during sock.end() for user ${userId}: ${endError.message}`, { stack: endError.stack });
          throw endError; 
        }
      }
    } catch (error) {
      // Catch errors from emit or re-thrown endError
      console.error(`[Baileys] Error during client destruction process for user ${userId}: ${error.message}`, { stack: error.stack });
    } finally {
      // Always remove from map, even if errors occurred
      if (clients.has(userId)) {
        clients.delete(userId);
        console.log(`[Baileys] Client removed from memory map for user ${userId} after destruction attempt.`);
      }
    }
  } else {
    console.warn(`[Baileys] No active client found in memory map for user ${userId} to destroy.`);
  }

  // Update DB status (fallback, in case close event didn't fire or update failed)
  try {
    console.log(`[Baileys] Updating any non-disconnected DB records to 'disconnected' for user ${userId} during destruction (fallback).`);
    await WhatsappDevice.updateMany(
      { userId: userId, connectionStatus: { $ne: 'disconnected' } },
      { connectionStatus: 'disconnected', updatedAt: new Date() }
    );
  } catch (dbError) {
    console.error(`[Baileys] DB Error updating status to 'disconnected' during destruction fallback for user ${userId}: ${dbError.message}`, { stack: dbError.stack });
  }

  // Delete session data if requested
  if (deleteSession) {
    const authPath = path.join(__dirname, '..', 'sessions_baileys', userId);
    console.log(`[Baileys] Deleting session data for user ${userId} at ${authPath}.`);
    try {
      await fs.rm(authPath, { recursive: true, force: true });
      console.log(`[Baileys] Session data deleted successfully for user ${userId}.`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`[Baileys] Session folder not found for deletion for user ${userId} (maybe already deleted): ${authPath}`);
      } else {
        console.error(`[Baileys] Failed to delete session data for user ${userId} at ${authPath}: ${err.message}`, { stack: err.stack });
      }
    }
  }
}

// Alihkan module.exports ke sini, selepas semua definisi fungsi
module.exports = { 
  connectToWhatsApp, 
  getWhatsAppSocket,
  destroyClientByUserId,
  initializeWhatsAppService
};