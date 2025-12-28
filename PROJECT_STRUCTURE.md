# Project Structure

```
carbon/
├── backend/                    # Express.js Backend
│   ├── models/
│   │   └── Event.js           # MongoDB schemas (RawEvent, NormalizedEvent)
│   ├── routes/
│   │   ├── events.js          # Event ingestion and query endpoints
│   │   └── aggregates.js      # Aggregation API endpoints
│   ├── services/
│   │   ├── normalizer.js      # Normalization service (field mapping, type conversion)
│   │   └── eventProcessor.js # Event processing (idempotency, transactions)
│   └── server.js              # Express server setup and MongoDB connection
│
├── frontend/                   # React Frontend
│   ├── public/
│   │   └── index.html         # HTML template
│   ├── src/
│   │   ├── App.js             # Main React component (UI logic)
│   │   ├── index.js           # React entry point
│   │   └── index.css          # Styling
│   └── package.json           # Frontend dependencies
│
├── package.json                # Backend dependencies and scripts
├── .gitignore                 # Git ignore rules
├── README.md                  # Comprehensive documentation
├── QUICKSTART.md              # Quick setup guide
└── PROJECT_STRUCTURE.md        # This file

```

## Key Files Explained

### Backend

**`backend/server.js`**
- Express server configuration
- MongoDB connection setup
- Route registration
- CORS configuration

**`backend/models/Event.js`**
- `RawEvent` schema: Stores original unreliable events
- `NormalizedEvent` schema: Stores canonical format events
- Indexes for efficient querying and deduplication

**`backend/services/normalizer.js`**
- Configurable field mapping per client
- Type conversion (string to number, date parsing)
- Content hashing for deduplication
- Graceful handling of missing/malformed fields

**`backend/services/eventProcessor.js`**
- Transaction-based event processing
- Two-level deduplication (raw + normalized)
- Partial failure handling
- Idempotent operations

**`backend/routes/events.js`**
- `POST /api/events`: Event ingestion endpoint
- `GET /api/events/raw`: Query raw events
- `GET /api/events/normalized`: Query normalized events
- `GET /api/events/stats`: Processing statistics

**`backend/routes/aggregates.js`**
- `GET /api/aggregates`: Aggregated data with filtering
- `GET /api/aggregates/by-client`: Client-wise aggregation

### Frontend

**`frontend/src/App.js`**
- Main application component
- Tab-based navigation
- Event submission form
- Event viewing tables
- Aggregation display
- Real-time statistics dashboard

## Data Flow

```
Client Request
    ↓
POST /api/events
    ↓
Event Processor Service
    ├─→ Generate Content Hash
    ├─→ Check for Duplicates (Raw Event)
    ├─→ Create/Update Raw Event (Transaction)
    ├─→ Normalize Event
    ├─→ Check for Duplicates (Normalized Event)
    ├─→ Create Normalized Event (Transaction)
    └─→ Commit Transaction
    ↓
Response to Client
    ↓
Frontend Updates
    ├─→ Refresh Raw Events
    ├─→ Refresh Normalized Events
    ├─→ Refresh Aggregates
    └─→ Update Statistics
```

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Frontend**: React (Create React App)
- **HTTP Client**: Axios
- **Styling**: CSS3 with modern gradients and responsive design

## Design Patterns Used

1. **Service Layer Pattern**: Business logic separated from routes
2. **Repository Pattern**: Data access abstracted through Mongoose models
3. **Transaction Pattern**: ACID guarantees for data consistency
4. **Idempotency Pattern**: Safe retries through content hashing
5. **Normalization Pattern**: Canonical data format for consistency

