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
  },
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
  }
}, {
  timestamps: true
});

// Indexing
campaignSchema.index({ userId: 1, deviceId: 1 });
campaignSchema.index({ userId: 1, campaignType: 1 });

module.exports = mongoose.model('Campaign', campaignSchema); 