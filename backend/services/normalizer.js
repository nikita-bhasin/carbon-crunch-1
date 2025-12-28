const crypto = require('crypto');

/**
 * Normalization Service
 * Converts unreliable raw events into a canonical internal format
 */
class Normalizer {
  constructor(config = {}) {
    // Configurable field mappings per client
    // Format: { client_id: { rawField: canonicalField, ... } }
    this.fieldMappings = config.fieldMappings || {
      // Default mappings - can be extended per client
      default: {
        'metric': 'metric',
        'amount': 'amount',
        'timestamp': 'timestamp',
        'value': 'metric', // Alternative field name
        'price': 'amount', // Alternative field name
        'date': 'timestamp', // Alternative field name
        'time': 'timestamp'
      }
    };
    
    // Type converters
    this.typeConverters = {
      amount: (value) => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      },
      timestamp: (value) => {
        if (value instanceof Date) return value;
        if (typeof value === 'string') {
          // Try multiple date formats
          const formats = [
            /^(\d{4})\/(\d{2})\/(\d{2})/, // 2024/01/01
            /^(\d{4})-(\d{2})-(\d{2})/, // 2024-01-01
            /^(\d{4})(\d{2})(\d{2})/, // 20240101
          ];
          
          for (const format of formats) {
            const match = value.match(format);
            if (match) {
              const [, year, month, day] = match;
              const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
              if (!isNaN(date.getTime())) return date;
            }
          }
          
          // Try ISO format
          const isoDate = new Date(value);
          if (!isNaN(isoDate.getTime())) return isoDate;
        }
        return null;
      },
      metric: (value) => {
        return typeof value === 'string' ? value : String(value || '');
      }
    };
  }

  /**
   * Normalize a raw event to canonical format
   * @param {Object} rawEvent - Raw event with source and payload
   * @returns {Object} Normalized event or null if invalid
   */
  normalize(rawEvent) {
    try {
      const { source, payload } = rawEvent;
      
      if (!source || !payload || typeof payload !== 'object') {
        return { error: 'Invalid event: missing source or payload' };
      }

      // Get client-specific mappings or use default
      const mappings = this.fieldMappings[source] || this.fieldMappings.default;
      
      const normalized = {
        client_id: source,
        metric: null,
        amount: null,
        timestamp: null
      };

      // Map fields using configuration
      for (const [rawField, canonicalField] of Object.entries(mappings)) {
        if (payload.hasOwnProperty(rawField) && normalized.hasOwnProperty(canonicalField)) {
          const converter = this.typeConverters[canonicalField];
          if (converter) {
            normalized[canonicalField] = converter(payload[rawField]);
          } else {
            normalized[canonicalField] = payload[rawField];
          }
        }
      }

      // Generate content hash for deduplication
      // Hash based on client_id + normalized content (excluding timestamp for flexibility)
      const hashInput = JSON.stringify({
        client_id: normalized.client_id,
        metric: normalized.metric,
        amount: normalized.amount
      });
      normalized.normalizedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

      return normalized;
    } catch (error) {
      return { error: `Normalization error: ${error.message}` };
    }
  }

  /**
   * Update field mappings for a specific client
   */
  updateFieldMappings(clientId, mappings) {
    this.fieldMappings[clientId] = { ...this.fieldMappings.default, ...mappings };
  }
}

module.exports = new Normalizer();

