const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  // Rujukan kepada peranti/nombor yang mana kempen ini aktif
  // Mungkin gunakan numberId (string) atau deviceId (string/ObjectId)
  // Untuk fleksibiliti, kita boleh simpan deviceId
  deviceId: {
      type: String, // Merujuk kepada deviceId dalam model WhatsappDevice
      required: true,
      ref: 'WhatsappDevice' // Rujukan tidak rasmi (kerana deviceId adalah string)
  },
  campaignName: {
    type: String,
    required: function() {
      // campaignName is required for bulk campaigns
      // For AI chatbot, it's optional (we use 'name' field instead)
      return this.campaignType === 'bulk';
    }
  },
  // AI Chatbot specific name field
  name: {
    type: String,
    required: function() {
      return this.campaignType === 'ai_chatbot';
    },
    validate: {
      validator: function(value) {
        // If this is an AI chatbot campaign, name must not be empty
        if (this.campaignType === 'ai_chatbot') {
          return value && value.trim().length > 0;
        }
        return true;
      },
      message: 'Name is required and cannot be empty for AI chatbot campaigns'
    }
  },
  campaignType: {
    type: String,
    enum: ['bulk', 'ai_chatbot'],
    default: 'ai_chatbot'
  },
  statusEnabled: {
    type: Boolean,
    default: true
  },
  enableLink: {
    type: Boolean,
    default: false
  },
  urlLink: {
    type: String
  },
  // Field media tunggal dibuang
  // mediaPath: {
  //   type: String,
  //   required: false
  // },
  // mediaOriginalName: { type: String },
  // mediaMimeType: { type: String },

  // BARU: Untuk pelbagai lampiran media dari Media Library
  mediaAttachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  }],

  caption: {
    type: String,
    required: false // Boleh jadi mesej sahaja tanpa kapsyen jika tiada media
  },
  // AI Chatbot specific caption field
  captionAi: {
    type: String,
    required: function() {
      return this.campaignType === 'ai_chatbot';
    },
    validate: {
      validator: function(value) {
        // If this is an AI chatbot campaign, captionAi must not be empty
        if (this.campaignType === 'ai_chatbot') {
          return value && value.trim().length > 0;
        }
        return true;
      },
      message: 'Caption/Text Message is required and cannot be empty for AI chatbot campaigns'
    }
  },
  // Field untuk AI Chatbot
  status: {
    type: String,
    enum: ['enable', 'disable'],
    default: 'enable'
  },
  isNotMatchDefaultResponse: {
    type: Boolean,
    default: false
  },
  sendTo: {
    type: String,
    enum: ['all', 'group', 'individual'],
    default: 'all'
  },
  type: {
    type: String,
    enum: ['message_contains_keyword', 'message_contains_whole_keyword', 'message_contains_regex', 'message_contains_ai'],
    default: 'message_contains_keyword'
  },
  description: {
    type: String
  },
  keywords: {
    type: [String],
    default: []
  },
  nextBotAction: {
    type: String
  },
  presenceDelayTime: {
    type: String
  },
  presenceDelayStatus: {
    type: String,
    enum: ['disable', 'enable_typing', 'enable_recording'],
    default: 'disable'
  },
  saveData: {
    type: String,
    enum: ['no_save_response', 'response_is_saved', 'save_to_database'],
    default: 'no_save_response'
  },
  apiRestDataStatus: {
    type: String,
    enum: ['enabled', 'disabled'],
    default: 'disabled'
  },
  apiRestConfig: {
    webhookUrl: { type: String },
    method: { type: String, enum: ['POST', 'PUT', 'PATCH'], default: 'POST' },
    headers: { type: mongoose.Schema.Types.Mixed },
    sendCustomerData: { type: Boolean, default: true },
    sendResponseData: { type: Boolean, default: true },
    sendTimestamp: { type: Boolean, default: true }
  },
  useAiFeature: {
    type: String,
    enum: ['not_use_ai', 'use_ai'],
    default: 'not_use_ai'
  },
  aiSpintax: {
    type: String
  },
  // Conversation Flow Features
  conversationMode: {
    type: String,
    enum: ['single_response', 'continuous_chat'],
    default: 'single_response'
  },
  maxConversationBubbles: {
    type: String,
    default: '3'
  },
  endConversationKeywords: {
    type: String
  },
  bubbleOptions: [{
    id: { type: Number, required: true },
    text: { type: String, required: true },
    active: { type: Boolean, default: false }
  }],
  // BARU: Untuk kempen pukal, simpan ID kumpulan kenalan yang digunakan
  contactGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContactGroup',
    required: function() { // Hanya diperlukan jika campaignType adalah 'bulk'
        return this.campaignType === 'bulk';
    }
  },
  // BARU: Untuk penjadualan kempen pukal
  scheduledAt: {
    type: Date,
    required: false // Tidak semua kempen mungkin dijadualkan
  },
  minIntervalSeconds: {
    type: Number,
    default: 5 // Contoh default 5 saat
  },
  maxIntervalSeconds: {
    type: Number,
    default: 10 // Contoh default 10 saat
  },
  // Field untuk Schedule Time yang lebih kompleks (Daytime, Nighttime, Odd, Even, Select Time)
  // Ini mungkin memerlukan pemikiran lanjut bagaimana data ini disimpan dan diguna.
  // Untuk permulaan, kita boleh simpan jenis jadual dan mungkin julat masa.
  campaignScheduleType: { // Contoh: 'anytime', 'specific_daytime', 'specific_nighttime', 'specific_odd', 'specific_even', 'custom_slots'
    type: String,
    default: 'anytime' 
  },
  campaignScheduleDetails: { // Boleh jadi objek atau string JSON untuk simpan detail jadual
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  // Field baru untuk AI
  aiModel: {
    type: String,
    enum: ['gpt-3.5-turbo', 'gpt-4', 'custom'],
    default: 'gpt-3.5-turbo'
  },
  aiTemperature: {
    type: Number,
    min: 0,
    max: 2,
    default: 0.7
  },
  aiMaxTokens: {
    type: Number,
    default: 150
  },
  aiSystemPrompt: {
    type: String
  },
  aiContextWindow: {
    type: Number,
    default: 10
  },
  aiLogs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    input: String,
    output: String,
    tokens: Number,
    duration: Number
  }],
  aiStats: {
    totalInteractions: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 0
    }
  },
  // Scheduler fields
  lastExecutedAt: {
    type: Date,
    required: false
  },
  lastExecutionError: {
    type: String,
    required: false
  },
  lastExecutionAttempt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

// Indexing
campaignSchema.index({ userId: 1, deviceId: 1 });
campaignSchema.index({ userId: 1, campaignType: 1 });
campaignSchema.index({ 'keywords': 1 }); // Untuk pencarian pantas berdasarkan kata kunci

module.exports = mongoose.model('Campaign', campaignSchema); 