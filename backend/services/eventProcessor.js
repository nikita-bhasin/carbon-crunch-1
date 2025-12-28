const mongoose = require('mongoose');
const { RawEvent, NormalizedEvent } = require('../models/Event');
const normalizer = require('./normalizer');
const crypto = require('crypto');

/**
 * Event Processing Service
 * Handles idempotency, deduplication, and partial failure scenarios
 */
class EventProcessor {
  /**
   * Process a raw event with full fault tolerance
   * @param {Object} rawEventData - Raw event from client
   * @param {boolean} simulateFailure - For testing: simulate database failure
   * @returns {Object} Processing result
   */
  async processEvent(rawEventData, simulateFailure = false) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step 1: Generate content hash for raw event deduplication
      const rawContentHash = this._generateRawHash(rawEventData);

      // Step 2: Check if we've already processed this exact raw event
      const existingRaw = await RawEvent.findOne({ 
        contentHash: rawContentHash,
        status: { $in: ['normalized', 'processing'] }
      }).session(session);

      if (existingRaw && existingRaw.status === 'normalized') {
        await session.abortTransaction();
        return {
          success: false,
          reason: 'duplicate',
          message: 'Event already processed',
          eventId: existingRaw._id
        };
      }

      // Step 3: Create or update raw event record
      let rawEvent = await RawEvent.findOneAndUpdate(
        { contentHash: rawContentHash },
        {
          $setOnInsert: {
            source: rawEventData.source,
            payload: rawEventData.payload,
            contentHash: rawContentHash,
            status: 'processing'
          }
        },
        { 
          upsert: true, 
          new: true,
          session 
        }
      );

      // Step 4: Normalize the event
      const normalized = normalizer.normalize(rawEventData);
      
      if (normalized.error) {
        await RawEvent.findByIdAndUpdate(
          rawEvent._id,
          { status: 'failed', errorMessage: normalized.error },
          { session }
        );
        await session.commitTransaction();
        return {
          success: false,
          reason: 'validation_error',
          message: normalized.error,
          eventId: rawEvent._id
        };
      }

      // Step 5: Check for duplicate normalized event (idempotency)
      const existingNormalized = await NormalizedEvent.findOne({
        normalizedHash: normalized.normalizedHash
      }).session(session);

      if (existingNormalized) {
        // Update raw event status but don't create duplicate normalized event
        await RawEvent.findByIdAndUpdate(
          rawEvent._id,
          { status: 'duplicate' },
          { session }
        );
        await session.commitTransaction();
        return {
          success: false,
          reason: 'duplicate',
          message: 'Normalized event already exists',
          eventId: rawEvent._id,
          normalizedEventId: existingNormalized._id
        };
      }

      // Step 6: Simulate failure if requested (for testing)
      if (simulateFailure) {
        throw new Error('Simulated database failure');
      }

      // Step 7: Save normalized event (within transaction)
      const normalizedEvent = new NormalizedEvent({
        ...normalized,
        rawEventId: rawEvent._id
      });
      await normalizedEvent.save({ session });

      // Step 8: Update raw event status
      await RawEvent.findByIdAndUpdate(
        rawEvent._id,
        { status: 'normalized' },
        { session }
      );

      // Step 9: Commit transaction (all or nothing)
      await session.commitTransaction();

      return {
        success: true,
        message: 'Event processed successfully',
        rawEventId: rawEvent._id,
        normalizedEventId: normalizedEvent._id,
        normalizedData: normalized
      };

    } catch (error) {
      // Rollback on any error
      await session.abortTransaction();
      
      // Try to update raw event status if we have an ID
      try {
        const rawEvent = await RawEvent.findOne({ 
          contentHash: this._generateRawHash(rawEventData) 
        });
        if (rawEvent) {
          await RawEvent.findByIdAndUpdate(rawEvent._id, {
            status: 'failed',
            errorMessage: error.message
          });
        }
      } catch (updateError) {
        console.error('Failed to update raw event status:', updateError);
      }

      return {
        success: false,
        reason: 'processing_error',
        message: error.message,
        error: error.toString()
      };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Generate hash for raw event content
   */
  _generateRawHash(rawEventData) {
    const hashInput = JSON.stringify({
      source: rawEventData.source,
      payload: rawEventData.payload
    });
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Get processing statistics
   */
  async getStatistics() {
    const stats = await Promise.all([
      RawEvent.countDocuments({ status: 'normalized' }),
      RawEvent.countDocuments({ status: 'failed' }),
      RawEvent.countDocuments({ status: 'duplicate' }),
      NormalizedEvent.countDocuments()
    ]);

    return {
      totalProcessed: stats[0],
      totalFailed: stats[1],
      totalDuplicates: stats[2],
      totalNormalized: stats[3]
    };
  }
}

module.exports = new EventProcessor();

