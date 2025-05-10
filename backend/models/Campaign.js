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
    required: [true, 'Campaign name is required']
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
  // Simpan path ke fail media yang diupload, bukan fail itu sendiri
  mediaPath: {
    type: String,
    required: false
  },
  // Simpan original name dan mime type jika perlu
  mediaOriginalName: { type: String },
  mediaMimeType: { type: String },
  caption: {
    type: String,
    required: false
  },
  aiAgentTraining: {
    type: String,
    required: false
  },
  useAI: {
    type: Boolean,
    default: false
  },
  presenceDelay: {
    type: String,
    enum: ['typing', 'recording', 'none'],
    default: 'typing'
  },
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexing
campaignSchema.index({ userId: 1, deviceId: 1 });
campaignSchema.index({ userId: 1, campaignType: 1 });

module.exports = mongoose.model('Campaign', campaignSchema); 