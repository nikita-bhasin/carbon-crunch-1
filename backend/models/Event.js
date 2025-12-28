const mongoose = require('mongoose');
const crypto = require('crypto');

const rawEventSchema = new mongoose.Schema({
  source: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  receivedAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'normalized', 'failed', 'duplicate'],
    default: 'pending'
  },
  errorMessage: String,
  // Content hash for deduplication
  contentHash: { type: String, index: true }
}, { timestamps: true });

// Index for efficient duplicate detection
rawEventSchema.index({ contentHash: 1, status: 1 });

const normalizedEventSchema = new mongoose.Schema({
  client_id: { type: String, required: true, index: true },
  metric: String,
  amount: Number,
  timestamp: { type: Date, index: true },
  // Store original raw event reference
  rawEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawEvent', required: true },
  // Deduplication hash
  normalizedHash: { type: String, required: true, unique: true, index: true },
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for efficient querying
normalizedEventSchema.index({ client_id: 1, timestamp: 1 });
normalizedEventSchema.index({ normalizedHash: 1 });

const RawEvent = mongoose.model('RawEvent', rawEventSchema);
const NormalizedEvent = mongoose.model('NormalizedEvent', normalizedEventSchema);

module.exports = { RawEvent, NormalizedEvent };

