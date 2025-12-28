import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [activeTab, setActiveTab] = useState('submit');
  const [formData, setFormData] = useState({
    source: 'client_A',
    payload: JSON.stringify({
      metric: 'value',
      amount: '1200',
      timestamp: '2024/01/01'
    }, null, 2),
    simulateFailure: false
  });
  const [submitResult, setSubmitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rawEvents, setRawEvents] = useState([]);
  const [normalizedEvents, setNormalizedEvents] = useState([]);
  const [aggregates, setAggregates] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    client_id: '',
    startDate: '',
    endDate: ''
  });

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchRawEvents();
    fetchNormalizedEvents();
    fetchAggregates();
    fetchStats();
  }, [filters]);

  const fetchRawEvents = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.source) params.source = filters.source;
      
      const response = await axios.get(`${API_BASE_URL}/events/raw`, { params });
      setRawEvents(response.data.data || []);
    } catch (error) {
      console.error('Error fetching raw events:', error);
    }
  };

  const fetchNormalizedEvents = async () => {
    try {
      const params = {};
      if (filters.client_id) params.client_id = filters.client_id;
      
      const response = await axios.get(`${API_BASE_URL}/events/normalized`, { params });
      setNormalizedEvents(response.data.data || []);
    } catch (error) {
      console.error('Error fetching normalized events:', error);
    }
  };

  const fetchAggregates = async () => {
    try {
      const params = {};
      if (filters.client_id) params.client_id = filters.client_id;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      
      const response = await axios.get(`${API_BASE_URL}/aggregates`, { params });
      setAggregates(response.data.data || []);
    } catch (error) {
      console.error('Error fetching aggregates:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/events/stats`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitResult(null);

    try {
      let payload;
      try {
        payload = JSON.parse(formData.payload);
      } catch (error) {
        setSubmitResult({
          success: false,
          message: 'Invalid JSON in payload field'
        });
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/events`, {
        source: formData.source,
        payload: payload,
        simulateFailure: formData.simulateFailure
      });

      setSubmitResult(response.data);
      
      // Refresh data
      setTimeout(() => {
        fetchRawEvents();
        fetchNormalizedEvents();
        fetchAggregates();
        fetchStats();
      }, 500);
    } catch (error) {
      setSubmitResult({
        success: false,
        message: error.response?.data?.error || error.message || 'Failed to submit event'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      normalized: 'badge-success',
      failed: 'badge-error',
      duplicate: 'badge-warning',
      processing: 'badge-info',
      pending: 'badge-info'
    };
    return badges[status] || 'badge-info';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Fault-Tolerant Data Processing System</h1>
        <p>Ingest, normalize, and aggregate unreliable data from multiple clients</p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'submit' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('submit')}
          style={{ background: activeTab === 'submit' ? '#667eea' : '#e0e0e0', color: activeTab === 'submit' ? 'white' : '#333' }}
        >
          Submit Event
        </button>
        <button
          className={`btn ${activeTab === 'events' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('events')}
          style={{ background: activeTab === 'events' ? '#667eea' : '#e0e0e0', color: activeTab === 'events' ? 'white' : '#333' }}
        >
          Raw Events
        </button>
        <button
          className={`btn ${activeTab === 'normalized' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('normalized')}
          style={{ background: activeTab === 'normalized' ? '#667eea' : '#e0e0e0', color: activeTab === 'normalized' ? 'white' : '#333' }}
        >
          Normalized Events
        </button>
        <button
          className={`btn ${activeTab === 'aggregates' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('aggregates')}
          style={{ background: activeTab === 'aggregates' ? '#667eea' : '#e0e0e0', color: activeTab === 'aggregates' ? 'white' : '#333' }}
        >
          Aggregates
        </button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{stats.totalProcessed}</h3>
            <p>Processed Events</p>
          </div>
          <div className="stat-card">
            <h3>{stats.totalNormalized}</h3>
            <p>Normalized Events</p>
          </div>
          <div className="stat-card">
            <h3>{stats.totalFailed}</h3>
            <p>Failed Events</p>
          </div>
          <div className="stat-card">
            <h3>{stats.totalDuplicates}</h3>
            <p>Duplicates Detected</p>
          </div>
        </div>
      )}

      {/* Submit Event Tab */}
      {activeTab === 'submit' && (
        <div className="card">
          <h2>Submit New Event</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Source (Client ID)</label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="client_A"
                required
              />
            </div>

            <div className="form-group">
              <label>Payload (JSON)</label>
              <textarea
                value={formData.payload}
                onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
                placeholder='{"metric": "value", "amount": "1200", "timestamp": "2024/01/01"}'
                required
              />
            </div>

            <div className="checkbox-group">
              <input
                type="checkbox"
                id="simulateFailure"
                checked={formData.simulateFailure}
                onChange={(e) => setFormData({ ...formData, simulateFailure: e.target.checked })}
              />
              <label htmlFor="simulateFailure">Simulate Database Failure</label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Event'}
            </button>
          </form>

          {submitResult && (
            <div className={`alert ${submitResult.success ? 'alert-success' : 'alert-error'}`}>
              <strong>{submitResult.success ? 'Success!' : 'Error:'}</strong> {submitResult.message || submitResult.error}
              {submitResult.reason && <div>Reason: {submitResult.reason}</div>}
            </div>
          )}
        </div>
      )}

      {/* Raw Events Tab */}
      {activeTab === 'events' && (
        <div className="card">
          <h2>Raw Events</h2>
          
          <div className="filter-group">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="normalized">Normalized</option>
              <option value="failed">Failed</option>
              <option value="duplicate">Duplicate</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
            </select>
            <input
              type="text"
              placeholder="Filter by source"
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            />
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Payload</th>
                  <th>Error</th>
                  <th>Received At</th>
                </tr>
              </thead>
              <tbody>
                {rawEvents.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                      No raw events found
                    </td>
                  </tr>
                ) : (
                  rawEvents.map((event) => (
                    <tr key={event._id}>
                      <td>{event.source}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(event.status)}`}>
                          {event.status}
                        </span>
                      </td>
                      <td>
                        <pre style={{ margin: 0, fontSize: '12px', maxWidth: '300px', overflow: 'auto' }}>
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </td>
                      <td>{event.errorMessage || '-'}</td>
                      <td>{formatDate(event.receivedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Normalized Events Tab */}
      {activeTab === 'normalized' && (
        <div className="card">
          <h2>Normalized Events</h2>
          
          <div className="filter-group">
            <input
              type="text"
              placeholder="Filter by client_id"
              value={filters.client_id}
              onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
            />
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>Metric</th>
                  <th>Amount</th>
                  <th>Timestamp</th>
                  <th>Processed At</th>
                </tr>
              </thead>
              <tbody>
                {normalizedEvents.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                      No normalized events found
                    </td>
                  </tr>
                ) : (
                  normalizedEvents.map((event) => (
                    <tr key={event._id}>
                      <td>{event.client_id}</td>
                      <td>{event.metric || '-'}</td>
                      <td>{event.amount !== null ? event.amount : '-'}</td>
                      <td>{formatDate(event.timestamp)}</td>
                      <td>{formatDate(event.processedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aggregates Tab */}
      {activeTab === 'aggregates' && (
        <div className="card">
          <h2>Aggregated Results</h2>
          
          <div className="filter-group">
            <input
              type="text"
              placeholder="Filter by client_id"
              value={filters.client_id}
              onChange={(e) => setFilters({ ...filters, client_id: e.target.value })}
            />
            <input
              type="date"
              placeholder="Start Date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
            <input
              type="date"
              placeholder="End Date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          {aggregates.length === 0 ? (
            <div className="loading">No aggregate data available</div>
          ) : (
            aggregates.map((agg, index) => (
              <div key={index} className="aggregate-card">
                <h3>Group: {agg.group}</h3>
                <div className="metric">
                  <span className="metric-label">Total Count:</span>
                  <span className="metric-value">{agg.totals.count}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Total Amount:</span>
                  <span className="metric-value">{agg.totals.amount}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Average Amount:</span>
                  <span className="metric-value">{agg.averages.amount}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Min Amount:</span>
                  <span className="metric-value">{agg.ranges.amount.min}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Max Amount:</span>
                  <span className="metric-value">{agg.ranges.amount.max}</span>
                </div>
                {agg.metrics.length > 0 && (
                  <div className="metric">
                    <span className="metric-label">Unique Metrics:</span>
                    <span className="metric-value">{agg.metrics.join(', ')}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App;

