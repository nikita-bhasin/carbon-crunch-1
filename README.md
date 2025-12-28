# Fault-Tolerant Data Processing System

A robust data ingestion and processing service built with the MERN stack (MongoDB, Express.js, React, Node.js) that handles unreliable data from multiple clients with full fault tolerance, idempotency, and deduplication.

## Architecture Overview

The system is designed with clear separation of concerns:

```
┌─────────────┐
│   React     │  Frontend UI
│   Frontend  │
└──────┬──────┘
       │ HTTP/REST
┌──────▼──────────────────────────────┐
│   Express.js API                    │
│  ┌────────────────────────────────┐ │
│  │  Event Ingestion Route        │ │
│  │  Aggregation Route            │ │
│  └───────────┬────────────────────┘ │
│              │                       │
│  ┌───────────▼────────────────────┐ │
│  │  Event Processor Service      │ │
│  │  - Idempotency                │ │
│  │  - Transaction Management     │ │
│  └───────────┬────────────────────┘ │
│              │                       │
│  ┌───────────▼────────────────────┐ │
│  │  Normalizer Service           │ │
│  │  - Field Mapping              │ │
│  │  - Type Conversion            │ │
│  └───────────┬────────────────────┘ │
└──────────────┼───────────────────────┘
               │
      ┌────────▼────────┐
      │    MongoDB      │
      │  - RawEvents    │
      │  - Normalized   │
      │    Events       │
      └─────────────────┘
```

## Key Components

### 1. Normalization Layer (`backend/services/normalizer.js`)

**Purpose**: Converts unreliable raw events into a canonical internal format.

**Design Decisions**:
- **Configurable Field Mappings**: Each client can have custom field mappings stored in the normalizer configuration
- **Flexible Type Conversion**: Handles multiple date formats, string-to-number conversion, and missing fields gracefully
- **Non-Breaking on New Fields**: Unknown fields are ignored, preventing system failures when clients add new fields
- **Content-Based Hashing**: Generates SHA-256 hash of normalized content for deduplication

**Example**:
```javascript
// Raw input (unreliable)
{
  "source": "client_A",
  "payload": {
    "value": "sales",
    "price": "1200",
    "date": "2024/01/01"
  }
}

// Normalized output (canonical)
{
  "client_id": "client_A",
  "metric": "sales",
  "amount": 1200,
  "timestamp": "2024-01-01T00:00:00Z",
  "normalizedHash": "abc123..."
}
```

### 2. Idempotency & Deduplication (`backend/services/eventProcessor.js`)

**Two-Level Deduplication Strategy**:

1. **Raw Event Level**: Content hash of `{source, payload}` prevents processing the exact same raw event twice
2. **Normalized Event Level**: Content hash of normalized data prevents duplicate normalized records

**Why This Approach**:
- **No Reliable Event IDs**: Clients don't provide unique IDs, so we use content hashing
- **Retry Safety**: If a client retries after a partial failure, the raw event hash catches it
- **Semantic Deduplication**: Normalized hash catches events that are semantically identical but formatted differently

### 3. Partial Failure Handling

**Transaction-Based Processing**:
- Uses MongoDB transactions to ensure atomicity
- All database operations (raw event creation, normalized event creation, status updates) happen within a single transaction
- If any step fails, the entire transaction is rolled back

**Failure Scenarios Handled**:

**Scenario 1: Database Write Fails Mid-Request**
```
1. Event received ✓
2. Event validated ✓
3. Database write fails ✗
4. Transaction rolled back ✓
5. Raw event marked as 'failed' ✓
6. Client retries → Detected as duplicate via content hash ✓
```

**Scenario 2: Client Retries After Partial Failure**
```
1. First attempt: Transaction fails → Rolled back
2. Raw event exists with status 'failed'
3. Client retries with same content
4. System detects duplicate via content hash
5. Returns existing event info (idempotent response)
```

**Scenario 3: Network Failure During Processing**
```
1. Transaction starts
2. Network fails before commit
3. Transaction automatically aborts
4. No partial state persisted
5. Client can safely retry
```

### 4. Data Models

**RawEvent Schema**:
- Stores original unreliable data exactly as received
- Tracks processing status: `pending`, `processing`, `normalized`, `failed`, `duplicate`
- Content hash for deduplication
- Error messages for debugging

**NormalizedEvent Schema**:
- Canonical format with consistent types
- Reference to original raw event
- Normalized hash for semantic deduplication
- Indexed for efficient querying

## API Endpoints

### Event Ingestion
```
POST /api/events
Body: {
  "source": "client_A",
  "payload": { ... },
  "simulateFailure": false
}
```

### Get Raw Events
```
GET /api/events/raw?status=normalized&source=client_A
```

### Get Normalized Events
```
GET /api/events/normalized?client_id=client_A
```

### Get Aggregates
```
GET /api/aggregates?client_id=client_A&startDate=2024-01-01&endDate=2024-12-31
```

### Statistics
```
GET /api/events/stats
```

## Frontend Features

- **Event Submission**: Manual JSON event submission with validation
- **Failure Simulation**: Toggle to simulate database failures for testing
- **Event Viewing**: 
  - Raw events with status filtering
  - Normalized events with client filtering
  - Failed/rejected events clearly marked
- **Aggregated Results**: Real-time aggregation with time range and client filtering
- **Statistics Dashboard**: Overview of processed, failed, and duplicate events

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or remote instance)

### Backend Setup
```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example)
# Set MONGODB_URI and PORT

# Start server
npm start
# or for development with auto-reload
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

The frontend will run on `http://localhost:3000` and the backend on `http://localhost:5000`.

## Design Decisions & Trade-offs

### 1. Content-Based Hashing vs. Client-Provided IDs

**Decision**: Use SHA-256 hashing of event content for deduplication.

**Rationale**:
- Clients don't provide reliable unique IDs
- Content hashing is deterministic and works across retries
- Trade-off: Slight computational overhead, but ensures correctness

**Alternative Considered**: Timestamp-based deduplication (rejected - timestamps unreliable)

### 2. Two-Level Deduplication

**Decision**: Check both raw event hash and normalized event hash.

**Rationale**:
- Raw hash: Prevents reprocessing exact duplicates
- Normalized hash: Prevents semantic duplicates (same data, different format)
- Trade-off: Additional database queries, but prevents data inconsistency

### 3. MongoDB Transactions

**Decision**: Use MongoDB transactions for all event processing operations.

**Rationale**:
- Ensures atomicity: all-or-nothing processing
- Prevents partial state on failures
- Trade-off: Slight performance overhead, but critical for correctness

**Alternative Considered**: Event sourcing with eventual consistency (rejected - over-engineering for requirements)

### 4. Normalization Strategy

**Decision**: Configurable field mappings with graceful degradation.

**Rationale**:
- Handles schema changes without code changes
- Missing fields set to null (not errors)
- New fields ignored (non-breaking)
- Trade-off: Less strict validation, but more resilient

**Alternative Considered**: Strict schema validation (rejected - would break on client changes)

### 5. Separation of Raw and Normalized Data

**Decision**: Store both raw events and normalized events separately.

**Rationale**:
- Audit trail: Can always see original data
- Debugging: Failed events retain original payload
- Flexibility: Can re-normalize with new rules if needed
- Trade-off: Storage overhead, but provides valuable debugging capability

---

## Answers to Assignment Questions

### 1. What assumptions did you make?

**Assumptions**:

1. **MongoDB Availability**: Assumed MongoDB is available and connection failures are transient. In production, would add connection retry logic and circuit breakers.

2. **Content Uniqueness**: Assumed that if two events have identical content (source + payload), they are the same event. This works for most cases but could theoretically have collisions (extremely rare with SHA-256).

3. **Client Behavior**: Assumed clients retry with identical content on failure. If clients modify payload on retry, they would be treated as new events (which may be desired behavior).

4. **Timestamp Reliability**: Assumed timestamps in payloads, while inconsistent in format, represent valid dates. Invalid dates are set to null rather than causing failures.

5. **Single Instance**: Designed for single-instance deployment. For horizontal scaling, would need distributed locking or message queue.

6. **Network Partition Tolerance**: Assumed network failures result in transaction rollback. In split-brain scenarios, might need additional coordination.

7. **Data Volume**: Designed for moderate volume. At very high scale, would need batching, streaming, and different aggregation strategies.

### 2. How does your system prevent double counting?

**Multi-Layer Deduplication Strategy**:

1. **Raw Event Content Hash**:
   - Before processing, generate SHA-256 hash of `{source, payload}`
   - Check if raw event with this hash already exists with status `normalized` or `processing`
   - If found, return duplicate response (idempotent)

2. **Normalized Event Hash**:
   - After normalization, generate hash of normalized content (excluding timestamp for flexibility)
   - Check if normalized event with this hash already exists
   - If found, mark raw event as `duplicate` but don't create new normalized event

3. **Transaction Isolation**:
   - All checks and writes happen within MongoDB transaction
   - Prevents race conditions where two identical events processed simultaneously
   - Transaction ensures atomic check-and-insert

4. **Status Tracking**:
   - Raw events track status: `pending` → `processing` → `normalized`/`failed`/`duplicate`
   - Status prevents reprocessing events already in progress

**Example Flow**:
```
Event 1 arrives → Hash: abc123 → Not found → Process → Save normalized
Event 1 retry → Hash: abc123 → Found (normalized) → Return duplicate
Event 2 (same data, different format) → Normalize → Hash: xyz789 → Check normalized → Found → Mark duplicate
```

**Why This Works**:
- Deterministic hashing ensures same content = same hash
- Transaction ensures no race conditions
- Two-level check catches both exact and semantic duplicates

### 3. What happens if the database fails mid-request?

**Transaction-Based Protection**:

1. **Transaction Started**: All database operations wrapped in MongoDB transaction
2. **Failure Occurs**: If database fails at any point:
   - Transaction automatically aborts
   - All changes rolled back (atomicity)
   - No partial state persisted

3. **Raw Event Handling**:
   - If raw event was created before failure, it remains with status `failed`
   - Error message stored for debugging
   - On retry, content hash detects duplicate and returns existing event info

4. **Client Retry Behavior**:
   ```
   Attempt 1: Transaction fails → Rolled back → Raw event marked 'failed'
   Attempt 2: Same content → Hash lookup → Found existing raw event → 
              Check status → If 'failed', can reprocess OR return error
   ```

5. **Current Implementation**:
   - If raw event exists with `failed` status, retry will attempt to reprocess
   - Could be enhanced to have retry limit or manual intervention flag

**Enhancement for Production**:
- Add retry counter to raw events
- After N failures, mark as `permanently_failed` and require manual review
- Add dead letter queue for events that consistently fail

**Guarantees**:
- ✅ No data loss: Raw event always persisted before processing
- ✅ No double counting: Transaction ensures normalized event created only once
- ✅ Consistent state: Either fully processed or fully failed, never partial
- ✅ Safe retries: Idempotent operations allow safe retries

### 4. What would break first at scale?

**Bottlenecks in Order of Likely Failure**:

1. **MongoDB Write Throughput** ⚠️ **FIRST TO BREAK**
   - **Issue**: Each event requires multiple database operations (raw event, normalized event, status updates) within transaction
   - **Limit**: MongoDB single instance ~10K-50K writes/sec depending on hardware
   - **Symptoms**: Increasing latency, transaction timeouts, connection pool exhaustion
   - **Solutions**:
     - Sharding: Partition by client_id or hash
     - Write batching: Accumulate events, process in batches
     - Write concern tuning: Reduce durability for speed (trade-off)
     - Separate read/write replicas

2. **Content Hash Lookups** ⚠️ **SECOND**
   - **Issue**: Every event requires 2-3 hash-based lookups (raw hash, normalized hash)
   - **Limit**: Index performance degrades with large collections
   - **Symptoms**: Slow query performance, index size growth
   - **Solutions**:
     - TTL indexes: Archive old events
     - Compound indexes: Optimize query patterns
     - Bloom filters: Pre-filter before database lookup
     - Separate deduplication service with in-memory cache

3. **Transaction Overhead** ⚠️ **THIRD**
   - **Issue**: Transactions add latency and lock contention
   - **Limit**: Transaction duration and concurrency limits
   - **Symptoms**: Deadlocks, timeout errors, reduced throughput
   - **Solutions**:
     - Reduce transaction scope (only critical operations)
     - Optimistic concurrency control for non-critical paths
     - Event sourcing: Append-only, process asynchronously

4. **Normalization CPU** ⚠️ **FOURTH**
   - **Issue**: JSON parsing, type conversion, hashing for every event
   - **Limit**: Single-threaded Node.js event loop
   - **Symptoms**: High CPU usage, event loop blocking
   - **Solutions**:
     - Worker threads for normalization
     - Stream processing: Process in parallel
     - Pre-compiled normalization rules

5. **Frontend API Calls** ⚠️ **FIFTH**
   - **Issue**: Frontend polls/refreshes data frequently
   - **Limit**: HTTP connection limits, server resources
   - **Symptoms**: Slow UI, connection errors
   - **Solutions**:
     - WebSocket for real-time updates
     - Pagination and lazy loading
     - Client-side caching

**Recommended Scaling Strategy**:

**Phase 1 (1K-10K events/sec)**:
- Add connection pooling
- Implement write batching (100-1000 events per batch)
- Add Redis cache for recent hash lookups

**Phase 2 (10K-100K events/sec)**:
- MongoDB sharding by client_id
- Separate normalization workers
- Message queue (RabbitMQ/Kafka) for async processing
- Read replicas for aggregation queries

**Phase 3 (100K+ events/sec)**:
- Distributed event processing (Kafka Streams, Apache Flink)
- Separate aggregation pipeline (pre-computed aggregates)
- CQRS pattern: Separate write and read models
- Microservices: Split ingestion, normalization, aggregation

**Architectural Changes Needed**:
- Move from request-response to event-driven architecture
- Replace synchronous transactions with eventual consistency
- Implement distributed deduplication (Redis, distributed cache)
- Pre-aggregate data instead of computing on-demand

---

## Testing the System

### Test Scenarios

1. **Normal Event Submission**:
   ```bash
   curl -X POST http://localhost:5000/api/events \
     -H "Content-Type: application/json" \
     -d '{
       "source": "client_A",
       "payload": {"metric": "sales", "amount": "1200", "timestamp": "2024/01/01"}
     }'
   ```

2. **Duplicate Detection**:
   - Submit same event twice
   - Second submission should return duplicate status

3. **Failure Simulation**:
   - Submit event with `simulateFailure: true`
   - Should fail gracefully, event marked as failed
   - Retry should detect duplicate

4. **Schema Variations**:
   - Submit events with different field names but same data
   - Should normalize to same canonical format
   - Should detect as semantic duplicate

5. **Malformed Data**:
   - Submit invalid JSON, missing fields, invalid types
   - Should handle gracefully, mark as failed with error message

---

## Future Enhancements

1. **Configuration Management**: External config for field mappings (database or config service)
2. **Monitoring & Alerting**: Metrics for processing rate, failure rate, duplicate rate
3. **Dead Letter Queue**: Persistent queue for events requiring manual review
4. **Replay Capability**: Ability to re-process failed events with updated normalization rules
5. **Multi-tenancy**: Support for multiple organizations with data isolation
6. **Streaming Aggregation**: Real-time aggregation using change streams
7. **API Rate Limiting**: Prevent abuse and ensure fair resource usage

---

## License

This project is created for assignment purposes.

