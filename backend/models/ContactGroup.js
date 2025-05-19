const mongoose = require('mongoose');

const contactGroupSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    groupName: {
      type: String,
      required: [true, 'Nama kumpulan diperlukan'],
      trim: true,
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
      },
    ],
    contactCount: {
        type: Number,
        default: 0
    }
  },
  {
    timestamps: true,
  }
);

contactGroupSchema.index({ user: 1, groupName: 1 }, { unique: true });

module.exports = mongoose.model('ContactGroup', contactGroupSchema); 