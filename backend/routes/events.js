const express = require('express');
const router = express.Router();
const eventProcessor = require('../services/eventProcessor');
const { RawEvent, NormalizedEvent } = require('../models/Event');

/**
 * POST /api/events
 * Ingest a new event from a client
 */
router.post('/', async (req, res) => {
  try {
    const { source, payload, simulateFailure } = req.body;

    if (!source || !payload) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: source and payload'
      });
    }

    const result = await eventProcessor.processEvent(
      { source, payload },
      simulateFailure === true
    );

    if (result.success) {
      return res.status(201).json(result);
    } else {
      const statusCode = result.reason === 'duplicate' ? 200 : 400;
      return res.status(statusCode).json(result);
    }
  } catch (error) {
    console.error('Event ingestion error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/events/raw
 * Get all raw events with filtering
 */
router.get('/raw', async (req, res) => {
  try {
    const { status, source, limit = 100, skip = 0 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (source) query.source = source;

    const events = await RawEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await RawEvent.countDocuments(query);

    res.json({
      success: true,
      data: events,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('Error fetching raw events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/events/normalized
 * Get all normalized events with filtering
 */
router.get('/normalized', async (req, res) => {
  try {
    const { client_id, limit = 100, skip = 0 } = req.query;
    
    const query = {};
    if (client_id) query.client_id = client_id;

    const events = await NormalizedEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await NormalizedEvent.countDocuments(query);

    res.json({
      success: true,
      data: events,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('Error fetching normalized events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/events/stats
 * Get processing statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await eventProcessor.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

