const express = require('express');
const router = express.Router();
const { NormalizedEvent } = require('../models/Event');

/**
 * GET /api/aggregates
 * Get aggregated data with filtering support
 */
router.get('/', async (req, res) => {
  try {
    const { client_id, startDate, endDate, groupBy } = req.query;

    // Build query
    const query = {};
    if (client_id) {
      query.client_id = client_id;
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Execute aggregation pipeline
    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: groupBy === 'client' ? '$client_id' : null,
          totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
          averageAmount: { $avg: { $ifNull: ['$amount', 0] } },
          count: { $sum: 1 },
          minAmount: { $min: { $ifNull: ['$amount', 0] } },
          maxAmount: { $max: { $ifNull: ['$amount', 0] } },
          uniqueMetrics: { $addToSet: '$metric' },
          dateRange: {
            $push: '$timestamp'
          }
        }
      },
      {
        $project: {
          _id: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          averageAmount: { $round: ['$averageAmount', 2] },
          count: 1,
          minAmount: 1,
          maxAmount: 1,
          uniqueMetrics: 1,
          dateRange: {
            min: { $min: '$dateRange' },
            max: { $max: '$dateRange' }
          }
        }
      }
    ];

    const results = await NormalizedEvent.aggregate(pipeline);

    // Format results
    const formattedResults = results.map(result => ({
      group: result._id || 'all',
      totals: {
        amount: result.totalAmount,
        count: result.count
      },
      averages: {
        amount: result.averageAmount
      },
      ranges: {
        amount: {
          min: result.minAmount,
          max: result.maxAmount
        },
        date: result.dateRange
      },
      metrics: result.uniqueMetrics.filter(m => m !== null && m !== '')
    }));

    res.json({
      success: true,
      data: formattedResults,
      filters: {
        client_id: client_id || 'all',
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (error) {
    console.error('Error fetching aggregates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/aggregates/by-client
 * Get aggregates grouped by client
 */
router.get('/by-client', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: '$client_id',
          totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
          averageAmount: { $avg: { $ifNull: ['$amount', 0] } },
          count: { $sum: 1 },
          metrics: { $addToSet: '$metric' }
        }
      },
      {
        $project: {
          client_id: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          averageAmount: { $round: ['$averageAmount', 2] },
          count: 1,
          metrics: 1,
          _id: 0
        }
      },
      { $sort: { totalAmount: -1 } }
    ];

    const results = await NormalizedEvent.aggregate(pipeline);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching client aggregates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

