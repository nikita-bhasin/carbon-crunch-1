# Quick Start Guide

## Prerequisites
- Node.js (v14 or higher)
- MongoDB installed and running locally, or MongoDB Atlas account

## Setup Steps

### 1. Install Backend Dependencies
```bash
npm install
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/data-processing
NODE_ENV=development
```

For MongoDB Atlas, use:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/data-processing
```

### 4. Start MongoDB

**Local MongoDB:**
```bash
# Windows
net start MongoDB

# macOS/Linux
mongod
```

Or use MongoDB Atlas (cloud) - no local installation needed.

### 5. Start Backend Server
```bash
npm start
# or for development with auto-reload
npm run dev
```

Server will run on `http://localhost:5000`

### 6. Start Frontend (in a new terminal)
```bash
cd frontend
npm start
```

Frontend will run on `http://localhost:3000` and automatically open in your browser.

## Testing the System

1. **Submit a Test Event:**
   - Go to "Submit Event" tab
   - Use default values or modify
   - Click "Submit Event"
   - Check "Simulate Failure" to test error handling

2. **View Results:**
   - "Raw Events" tab: See all ingested events with status
   - "Normalized Events" tab: See processed canonical data
   - "Aggregates" tab: See aggregated statistics

3. **Test Duplicate Detection:**
   - Submit the same event twice
   - Second submission should show as duplicate

4. **Test Failure Handling:**
   - Check "Simulate Failure" checkbox
   - Submit event
   - Event should be marked as failed
   - Retry without the checkbox - should process successfully

## API Testing with cURL

### Submit Event
```bash
curl -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "client_A",
    "payload": {
      "metric": "sales",
      "amount": "1200",
      "timestamp": "2024/01/01"
    }
  }'
```

### Get Aggregates
```bash
curl http://localhost:5000/api/aggregates?client_id=client_A
```

### Get Statistics
```bash
curl http://localhost:5000/api/events/stats
```

## Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running
- Check MONGODB_URI in .env file
- For Atlas: Check network access and credentials

**Port Already in Use:**
- Change PORT in .env file
- Update frontend proxy in `frontend/package.json` if needed

**Frontend Can't Connect to Backend:**
- Ensure backend is running on port 5000
- Check CORS settings in `backend/server.js`
- Verify proxy setting in `frontend/package.json`

