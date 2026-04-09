import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { getAssignedUsers, ALL_STATES, ALL_UTS, ALL_MINISTRIES } from '../utils/recommendationUtils';
import './AdminDashboard.css';

function AdminDashboard() {
  // Modal state for details
  const [showModal, setShowModal] = useState(false);
  const [selectedRec, setSelectedRec] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);

  const [historyLoading, setHistoryLoading] = useState(false);

  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [recommendations, setRecommendations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(true);
  const [isPendingExpanded, setIsPendingExpanded] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  const [allocations, setAllocations] = useState([]);

  const [selectedDownloadEntity, setSelectedDownloadEntity] = useState('All Entities');
  const [selectedCategory, setSelectedCategory] = useState('All States');
  const [viewedEntity, setViewedEntity] = useState('All Entities');
  const [isDownloadingEntity, setIsDownloadingEntity] = useState(false);
  const [timePeriodFilter, setTimePeriodFilter] = useState('All');
  const [specificPeriod, setSpecificPeriod] = useState('');
  const [isDownloadingFiltered, setIsDownloadingFiltered] = useState(false);

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const QUARTERS = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
  const YEARS = [String(new Date().getFullYear() - 1), String(new Date().getFullYear())];

  const entitiesBySelectedCategory = useMemo(() => {
    switch (selectedCategory) {
      case 'All States': return ALL_STATES;
      case 'Ministries': return ALL_MINISTRIES;
      case 'Organizations': return ALL_MINISTRIES;
      case 'Union Territories': return ALL_UTS;
      default: return [];
    }
  }, [selectedCategory]);

  const handleDownloadEntityZip = async () => {
    if (selectedDownloadEntity === 'All Entities') {
      alert("Please select a specific State, UT, or Ministry.");
      return;
    }

    const recIds = recommendations
      .filter(rec => {
        const assigned = getAssignedUsers(rec.actionedBy);
        return assigned.includes(selectedDownloadEntity);
      })
      .map(r => r.recNo || r.id);

    if (recIds.length === 0) {
      alert(`No recommendations assigned to ${selectedDownloadEntity}`);
      return;
    }

    setIsDownloadingEntity(true);
    try {
      const res = await axios.post(
        'http://localhost:5000/api/admin/download-zip/batch',
        { recIds, entityName: selectedDownloadEntity },
        { responseType: 'blob' }
      );
      saveAs(res.data, `${selectedDownloadEntity.replace(/[^a-z0-9]/gi, '_')}_data.zip`);
    } catch (err) {
      console.error('Download error:', err);
      let errMsg = "Failed to download ZIP.";
      try {
        const text = await err.response.data.text();
        const errData = JSON.parse(text);
        errMsg = errData.error || errMsg;
      } catch (parseErr) { }
      alert(errMsg);
    }
    setIsDownloadingEntity(false);
  };

  // Fetch details for modal
  const handleViewDetails = async (rec) => {
    setShowModal(true);
    setSelectedRec(rec);
    setHistoryLoading(true);
    setHistoryRows([]);

    try {
      // Try to fetch latest from backend (if available)
      const res = await axios.get(`http://localhost:5000/api/recs/recommendation/${rec.id}`);
      const tableEntries = res.data?.data?.tableEntries || [];
      setHistoryRows(tableEntries);

    } catch (err) {
      setHistoryRows([]);

    }
    setHistoryLoading(false);
  };

  // Download CSV
  const handleDownloadCSV = () => {
    if (!historyRows || !historyRows.length) return;
    const headers = ["Period", "Frequency", "Signed Copy", "Uploaded At", "Submitted By", "Implementation Details", "Related photos/videos"];
    const rows = historyRows.map(row => {
      return headers.map(h => {
        let val = row[h];
        if (Array.isArray(val)) return `"${val.join(', ')}"`;
        return `"${String(val || '').replace(/"/g, '""')}"`;
      }).join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rec_${selectedRec?.id}_history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all files in a history row as a ZIP
  const handleDownloadRowZip = async (row, recNo) => {
    const zip = new JSZip();
    let filenames = [];

    // Explicitly add Signed Copy and Implementation Details if they exist
    if (typeof row["Signed Copy"] === 'string' && row["Signed Copy"]) filenames.push(row["Signed Copy"]);
    if (typeof row["Implementation Details"] === 'string' && row["Implementation Details"]) filenames.push(row["Implementation Details"]);

    // Related photos/videos could be an array of strings or a single string
    if (Array.isArray(row["Related photos/videos"])) {
      filenames.push(...row["Related photos/videos"]);
    } else if (typeof row["Related photos/videos"] === 'string' && row["Related photos/videos"]) {
      filenames.push(row["Related photos/videos"]);
    }

    // Also include any other string fields that look like files just in case
    Object.entries(row).forEach(([k, v]) => {
      if (k !== "Signed Copy" && k !== "Implementation Details" && k !== "Related photos/videos") {
        if (typeof v === 'string' && v.match(/\.(jpg|jpeg|png|gif|pdf|docx?|txt)$/i)) {
          filenames.push(v);
        }
      }
    });

    // Make filenames unique and valid
    filenames = [...new Set(filenames)].filter(Boolean);

    if (filenames.length === 0) {
      alert('No files to download in this row.');
      return;
    }

    let filesAdded = 0;
    for (const filename of filenames) {
      try {
        const url = `http://localhost:5000/uploads/${filename}`;
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          zip.file(filename, blob);
          filesAdded++;
        }
      } catch (e) { /* skip file if error */ }
    }

    if (filesAdded === 0) {
      alert('Could not fetch any files for this row.');
      return;
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `Recommendation_${recNo || 'Details'}_HistoryRow.zip`);
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [statsRes, allocRes] = await Promise.all([
        axios.get('http://localhost:5000/api/recs/stats', config),
        axios.get('http://localhost:5000/api/recs/allocations', config)
      ]);
      setStats(statsRes.data.stats);
      setRecommendations(statsRes.data.list.sort((a, b) => (parseInt(a.recNo) || 0) - (parseInt(b.recNo) || 0)));
      setAllocations(allocRes.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setLoading(false);
    }
  };

  const getScopedEntries = (rec, entity) => {
    const allEntries = rec.data && rec.data.tableEntries ? rec.data.tableEntries : [];
    return entity === 'All Entities'
      ? allEntries
      : allEntries.filter(h => h["Submitted By"] === entity);
  };

  const getRelevantEntries = (entries) => {
    if (timePeriodFilter === 'All') return entries;
    return entries.filter(h => {
      const freq = (h["Frequency"] || '').trim().toLowerCase();
      if (freq !== timePeriodFilter.toLowerCase()) return false;
      if (specificPeriod) {
        const period = (h["Period"] || '').trim().toLowerCase();
        return period === specificPeriod.toLowerCase();
      }
      return true;
    });
  };

  const isRecCompletedForEntity = (rec, entity) => {
    const entityEntries = getScopedEntries(rec, entity);
    const relevantEntries = getRelevantEntries(entityEntries);
    if (relevantEntries.length > 0) return true;

    // Global fallback only in All-period mode.
    if (timePeriodFilter === 'All' && entity === 'All Entities') {
      let uC = 0;
      if (rec.data && rec.data.filesMeta) Object.values(rec.data.filesMeta).forEach(v => { if (Array.isArray(v)) uC += v.length; else if (v) uC += 1; });
      return uC > 0 || rec.status === 'Completed';
    }
    return false;
  };

  // Count recommendations by frequency
  const getRecByFrequency = (frequency) => {
    return recommendations.filter(rec => {
      const entries = rec.data && rec.data.tableEntries ? rec.data.tableEntries : [];
      const entityEntries = viewedEntity !== 'All Entities'
        ? entries.filter(h => h["Submitted By"] === viewedEntity)
        : entries;
      return entityEntries.some(h => (h["Frequency"] || '').trim().toLowerCase() === frequency.toLowerCase());
    }).length;
  };

  // Count pending recommendations by frequency
  const getPendingByFrequency = (frequency) => {
    return filteredRecs.filter(rec => {
      if (isRecCompletedForEntity(rec, viewedEntity)) return false; // Not pending
      const entries = rec.data && rec.data.tableEntries ? rec.data.tableEntries : [];
      const entityEntries = viewedEntity !== 'All Entities'
        ? entries.filter(h => h["Submitted By"] === viewedEntity)
        : entries;
      return entityEntries.some(h => (h["Frequency"] || '').trim().toLowerCase() === frequency.toLowerCase());
    }).length;
  };

  // Count completely unfilled pending recommendations
  const getPendingNotFilled = () => {
    return filteredRecs.filter(rec => {
      if (isRecCompletedForEntity(rec, viewedEntity)) return false; // Not pending
      const entries = rec.data && rec.data.tableEntries ? rec.data.tableEntries : [];
      const entityEntries = viewedEntity !== 'All Entities'
        ? entries.filter(h => h["Submitted By"] === viewedEntity)
        : entries;
      return entityEntries.length === 0; // No submissions at all
    }).length;
  };

  // Build a map: rec number -> officer/department name
  const officerByRec = {};
  allocations.forEach(alloc => {
    alloc.rec_ids.forEach(id => {
      officerByRec[id] = alloc.department;
    });
  });

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDownloadZip = () => {
    window.location.href = 'http://localhost:5000/api/admin/download-zip';
  };

  const handleDownloadSingleZip = (recId, hasData) => {
    if (!hasData) {
      alert('No data or files available for this recommendation.');
      return;
    }
    window.location.href = `http://localhost:5000/api/admin/download-zip/${recId}`;
  };

  const handleDownloadFilteredZip = async () => {
    const recIds = filteredRecs.map(r => r.recNo || r.id);
    if (recIds.length === 0) {
      alert('No recommendations match the current filters.');
      return;
    }
    const label = specificPeriod
      ? `${timePeriodFilter}_${specificPeriod}`
      : timePeriodFilter !== 'All' ? timePeriodFilter : 'All';
    setIsDownloadingFiltered(true);
    try {
      const res = await axios.post(
        'http://localhost:5000/api/admin/download-zip/batch',
        { recIds, entityName: selectedDownloadEntity !== 'All Entities' ? selectedDownloadEntity : 'All' },
        { responseType: 'blob' }
      );
      saveAs(res.data, `recommendations_${label.replace(/[^a-z0-9]/gi, '_')}.zip`);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download ZIP.');
    }
    setIsDownloadingFiltered(false);
  };

  const filteredRecs = recommendations.filter(r => {
    const officer = officerByRec[r.id] || officerByRec[r.recNo] || '';

    // Frequency selection is status-wise (Completed/Pending), not a visibility blocker.

    if (viewedEntity !== 'All Entities') {
      const assigned = getAssignedUsers(r.actionedBy);
      const entityEntries = r.data && r.data.tableEntries
        ? r.data.tableEntries.filter(h => h["Submitted By"] === viewedEntity)
        : [];
      const hasEntityUpdates = entityEntries.length > 0 || r.last_updated_by === viewedEntity;
      const isAllocatedToEntity = officer === viewedEntity;
      const isAssignedToEntity = assigned.includes(viewedEntity);

      // For entity view, include all recommendations relevant to this entity,
      // so not-started items remain visible under Pending.
      if (!isAssignedToEntity && !isAllocatedToEntity && !hasEntityUpdates) return false;
    }

    const matchesSearch = (
      String(r.id).includes(searchTerm) ||
      (r.last_updated_by && r.last_updated_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
      officer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!matchesSearch) return false;

    // Status filtering logic (frequency-aware)
    const hasData = isRecCompletedForEntity(r, viewedEntity);
    if (statusFilter === 'Completed') return hasData;
    if (statusFilter === 'Pending') return !hasData;
    if (statusFilter === 'In Progress') return hasData;

    return true;
  });

  const renderCard = (rec) => {
    let uC = 0, hC = 0;
    let hasData = false;
    let lastUpdatedByEntity = rec.last_updated_by || 'Not updated';

    if (viewedEntity !== 'All Entities') {
      const entityEntries = getScopedEntries(rec, viewedEntity);
      const relevantEntries = getRelevantEntries(entityEntries);
      hC = relevantEntries.length;
      hasData = isRecCompletedForEntity(rec, viewedEntity);
      lastUpdatedByEntity = viewedEntity;
    } else {
      if (rec.data && rec.data.filesMeta) {
        Object.values(rec.data.filesMeta).forEach(val => {
          if (Array.isArray(val)) uC += val.length;
          else if (val) uC += 1;
        });
      }
      const allEntries = getScopedEntries(rec, 'All Entities');
      hC = getRelevantEntries(allEntries).length;
      hasData = isRecCompletedForEntity(rec, 'All Entities');
    }

    const displayStatus = hasData ? 'Completed' : 'Pending';
    const recommendationText = rec.recommendation || 'No recommendation text available.';

    return (
      <div
        key={rec.id}
        className={`admin-rec-card ${hasData ? 'border-success' : 'border-danger'} shadow-sm`}
      >
        <div className="card-header-custom d-flex justify-content-between align-items-center p-2 border-0">
          <strong className="text-dark" style={{ fontSize: '0.75rem' }}>Rec {rec.id}</strong>
          <span className={`badge ${hasData ? 'bg-success' : 'bg-danger'} text-white rounded-pill px-2 py-1`} style={{ fontSize: '0.6rem' }}>
            {displayStatus}
          </span>
        </div>
        <div className="card-body-custom px-2 pb-2">
          <p className="recommendation-summary text-muted mb-2" style={{ fontSize: '0.6rem', lineHeight: '1.2' }}>
            {recommendationText.length > 120 ? recommendationText.substring(0, 120) + '...' : recommendationText}
          </p>

          <div className="entity-box p-1 rounded mb-2" style={{ backgroundColor: hasData ? '#f0fdf4' : '#fef2f2', borderLeft: `3px solid ${hasData ? '#10b981' : '#ef4444'}` }}>
            <div className={`d-flex align-items-center gap-1 fw-bold ${hasData ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.6rem' }}>
              👤 {viewedEntity !== 'All Entities' ? 'Status for:' : 'Updated by:'} <span>{lastUpdatedByEntity}</span>
            </div>
          </div>

          <div className={`sync-status d-flex align-items-center gap-1 fw-bold mb-2 ${hasData ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.6rem' }}>
            {hasData ? '✓' : '✗'} {viewedEntity !== 'All Entities' ? `${hC} entries submitted` : `${uC} files, ${hC} history rows`}
          </div>

          <div className="card-actions d-flex justify-content-between align-items-center pt-1 border-top">
            <button
              onClick={(e) => { e.stopPropagation(); handleDownloadSingleZip(rec.id, hasData); }}
              className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 px-2 py-1"
              style={{ borderRadius: '6px', fontSize: '0.6rem' }}
            >
              📦 ZIP
            </button>
            <button
              className="btn btn-link p-0 text-decoration-none fw-bold text-primary"
              style={{ fontSize: '0.6rem' }}
              onClick={() => handleViewDetails(rec)}
            >
              Details →
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = (recs) => {
    return (
      <div className="table-responsive bg-white rounded shadow-sm">
        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
          <thead className="table-light text-muted">
            <tr>
              <th style={{ width: '80px' }} className="ps-4 text-center">ID</th>
              <th>Recommendation</th>
              <th className="text-center">{viewedEntity !== 'All Entities' ? 'Status For' : 'Updated By'}</th>
              <th className="text-center">Sync Status</th>
              <th className="text-center">Status</th>
              <th className="text-center pe-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recs.map(rec => {
              let uC = 0, hC = 0;
              let hasData = false;
              let lastUpdatedByEntity = rec.last_updated_by || 'Not updated';

              if (viewedEntity !== 'All Entities') {
                const entityEntries = getScopedEntries(rec, viewedEntity);
                const relevantEntries = getRelevantEntries(entityEntries);
                hC = relevantEntries.length;
                hasData = isRecCompletedForEntity(rec, viewedEntity);
                lastUpdatedByEntity = viewedEntity;
              } else {
                if (rec.data && rec.data.filesMeta) {
                  Object.values(rec.data.filesMeta).forEach(val => {
                    if (Array.isArray(val)) uC += val.length;
                    else if (val) uC += 1;
                  });
                }
                const allEntries = getScopedEntries(rec, 'All Entities');
                hC = getRelevantEntries(allEntries).length;
                hasData = isRecCompletedForEntity(rec, 'All Entities');
              }

              const displayStatus = hasData ? 'Completed' : 'Pending';
              const recommendationText = rec.recommendation || 'No recommendation text available.';

              return (
                <tr key={rec.id}>
                  <td className="ps-4 fw-bold text-dark text-center">#{rec.id}</td>
                  <td>
                    <div className="text-truncate" style={{ maxWidth: '400px' }} title={recommendationText}>
                      {recommendationText}
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: '0.8rem' }}>
                      {lastUpdatedByEntity}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className={`d-flex align-items-center justify-content-center gap-1 fw-semibold ${hasData ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.85rem' }}>
                      {hasData ? '✓' : '✗'} {viewedEntity !== 'All Entities' ? `${hC} entries submitted` : `${uC} files, ${hC} rows`}
                    </div>
                  </td>
                  <td className="text-center">
                    <span className={`badge rounded-pill px-3 py-1 ${hasData ? 'bg-success text-white' : 'bg-danger text-white'}`} style={{ fontSize: '0.75rem' }}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="text-center pe-4">
                    <div className="d-flex justify-content-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadSingleZip(rec.id, hasData); }}
                        className="btn btn-outline-success btn-sm border-0 d-flex align-items-center gap-1 shadow-sm"
                        title="Download ZIP"
                        style={{ borderRadius: '6px' }}
                      >
                        📦
                      </button>
                      <button
                        className="btn btn-link btn-sm p-0 text-decoration-none fw-bold text-primary"
                        style={{ fontSize: '0.85rem' }}
                        onClick={() => handleViewDetails(rec)}
                      >
                        View Details →
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {recs.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-5 text-muted italic">No recommendations found in this category.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) return <div className="p-4 text-center">Loading Admin Dashboard...</div>;

  return (
    <div className="admin-content-wrapper">
      <main className="admin-main-content">
        <div className="container-fluid p-2">

          <div className="title-bar d-flex align-items-center mb-2 p-3 bg-white shadow-sm rounded">
            <h5 className="m-0 text-dark fw-bold" style={{ fontSize: '1.35rem' }}>Admin Dashboard - Recommendation Status</h5>
          </div>

          {/* Stats Row */}
          <div className="admin-stats-row mb-2">
            <div className="admin-stat-card border-secondary">
              <div className="stat-label">Total Recommendations</div>
              <div className="stat-value">{filteredRecs.length}</div>
            </div>
            <div className="admin-stat-card border-success">
              <div className="stat-label">Completed</div>
              <div className="stat-value text-success">
                {filteredRecs.filter(r => isRecCompletedForEntity(r, viewedEntity)).length}
              </div>
            </div>
            <div className="admin-stat-card border-danger">
              <div className="stat-label">Pending</div>
              <div className="stat-value text-danger">
                {filteredRecs.filter(r => !isRecCompletedForEntity(r, viewedEntity)).length}
              </div>
            </div>
            <div className="admin-stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="stat-label">Monthly Filled</div>
              <div className="stat-value" style={{ color: '#3b82f6' }}>{getRecByFrequency('Monthly')}</div>
            </div>
            <div className="admin-stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="stat-label">Quarterly Filled</div>
              <div className="stat-value" style={{ color: '#f59e0b' }}>{getRecByFrequency('Quarterly')}</div>
            </div>
            <div className="admin-stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <div className="stat-label">Yearly Filled</div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>{getRecByFrequency('Yearly')}</div>
            </div>
          </div>
          {/* Entity Filter Row */}
          <div className="admin-actions-bar mb-2 p-1 bg-white shadow-sm rounded d-flex justify-content-between align-items-center flex-wrap gap-1" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="d-flex align-items-center gap-2 px-2">
              <span className="fw-bold text-dark" style={{ fontSize: '0.75rem' }}>Category Filter:</span>
              <select
                className="form-select form-select-sm shadow-sm border-0"
                style={{ width: '150px', borderRadius: '4px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', height: '28px', padding: '2px 8px' }}
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedDownloadEntity('All Entities');
                  setViewedEntity('All Entities');
                }}
              >
                <option value="All States">All States</option>
                <option value="Ministries">Ministries</option>
                <option value="Organizations">Organizations</option>
                <option value="Union Territories">Union Territories</option>
              </select>

              <span className="fw-bold text-dark ms-2" style={{ fontSize: '0.75rem' }}>Submitted:</span>
              <select
                className="form-select form-select-sm shadow-sm border-0"
                style={{ width: '130px', borderRadius: '4px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', height: '28px', padding: '2px 8px' }}
                value={timePeriodFilter}
                onChange={(e) => { setTimePeriodFilter(e.target.value); setSpecificPeriod(''); }}
              >
                <option value="All">All Periods</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>

              {timePeriodFilter !== 'All' && (
                <select
                  className="form-select form-select-sm shadow-sm border-0"
                  style={{ width: '130px', borderRadius: '4px', backgroundColor: '#fef9c3', fontSize: '0.75rem', height: '28px', padding: '2px 8px' }}
                  value={specificPeriod}
                  onChange={(e) => setSpecificPeriod(e.target.value)}
                >
                  <option value="">-- Any {timePeriodFilter === 'Monthly' ? 'Month' : timePeriodFilter === 'Quarterly' ? 'Quarter' : 'Year'} --</option>
                  {timePeriodFilter === 'Monthly' && MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  {timePeriodFilter === 'Quarterly' && QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
                  {timePeriodFilter === 'Yearly' && YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}

              <span className="fw-bold text-dark ms-2" style={{ fontSize: '0.75rem' }}>Select Entity:</span>
              <select
                className="form-select form-select-sm shadow-sm border-0"
                style={{ width: '200px', borderRadius: '4px', backgroundColor: '#f8fafc', fontSize: '0.75rem', height: '28px', padding: '2px 8px' }}
                value={selectedDownloadEntity}
                onChange={(e) => {
                  const nextEntity = e.target.value;
                  setSelectedDownloadEntity(nextEntity);
                  setViewedEntity(nextEntity);
                }}
              >
                <option value="All Entities">-- Select --</option>
                {entitiesBySelectedCategory.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="d-flex align-items-center gap-1 px-2">
              <button
                className="btn btn-success d-flex align-items-center gap-1 px-3 py-1 shadow-sm"
                style={{ borderRadius: '6px', backgroundColor: '#10b981', border: 'none', fontWeight: '700', fontSize: '0.78rem', minHeight: '32px' }}
                onClick={timePeriodFilter !== 'All' ? handleDownloadFilteredZip : handleDownloadEntityZip}
                disabled={isDownloadingEntity || isDownloadingFiltered}
              >
                {(isDownloadingEntity || isDownloadingFiltered) ? 'Downloading...' : '⬇ Download ZIP'}
              </button>
            </div>
          </div>

          {/* Filters and Actions Row */}
          <div className="admin-actions-bar mb-3 p-2 bg-white shadow-sm rounded d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search by ID or detail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '200px', borderRadius: '6px', fontSize: '0.8rem', padding: '4px 8px' }}
              />
              <select
                className="form-select form-select-sm"
                style={{ width: '140px', borderRadius: '6px', fontSize: '0.8rem', padding: '4px 8px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              {/* Removed Grid/Table toggle buttons as requested */}
            </div>


          </div>

          {/* Section 1: Completed */}
          <div className="recommendation-section mb-3">
            <div
              className="section-header bg-success text-white d-flex justify-content-between align-items-center px-3 py-3 rounded-top"
              onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
              style={{ cursor: 'pointer' }}
            >
              <h6 className="m-0 fw-bold" style={{ fontSize: '1.15rem' }}>Completed Recommendations</h6>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-white text-success rounded-pill px-2 py-1" style={{ fontSize: '0.75rem' }}>
                  {filteredRecs.filter(r => isRecCompletedForEntity(r, viewedEntity)).length}
                </span>
                <span style={{ fontSize: '1rem' }}>{isCompletedExpanded ? '▲' : '▼'}</span>
              </div>
            </div>
            {isCompletedExpanded && (
              <div className={`section-body ${viewMode === 'grid' ? 'p-3' : 'p-0'} bg-white border border-success border-top-0 rounded-bottom`}>
                {viewMode === 'grid' ? (
                  <div className="admin-cards-grid">
                    {filteredRecs.filter(r => isRecCompletedForEntity(r, viewedEntity)).map(rec => renderCard(rec))}
                  </div>
                ) : (
                  renderTable(filteredRecs.filter(r => isRecCompletedForEntity(r, viewedEntity)))
                )}
              </div>
            )}
          </div>

          {/* Section 2: Pending */}
          <div className="recommendation-section shadow-sm">
            <div
              className="section-header bg-danger text-white d-flex justify-content-between align-items-center px-3 py-3 rounded-top"
              onClick={() => setIsPendingExpanded(!isPendingExpanded)}
              style={{ cursor: 'pointer' }}
            >
              <div className="d-flex align-items-center gap-3">
                <h6 className="m-0 fw-bold" style={{ fontSize: '1.15rem' }}>Pending Recommendations</h6>
                <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.75rem' }}>
                  <span className="badge bg-light text-danger rounded-pill px-2 py-1" title="Pending with Quarterly filled">Q: {getPendingByFrequency('Quarterly')}</span>
                  <span className="badge bg-light text-danger rounded-pill px-2 py-1" title="Pending with Yearly filled">Y: {getPendingByFrequency('Yearly')}</span>
                  <span className="badge bg-light text-dark rounded-pill px-2 py-1" title="Not filled at all">Not filled: {getPendingNotFilled()}</span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-white text-danger rounded-pill px-2 py-1" style={{ fontSize: '0.75rem' }}>
                  {filteredRecs.filter(r => !isRecCompletedForEntity(r, viewedEntity)).length}
                </span>
                <span style={{ fontSize: '1rem' }}>{isPendingExpanded ? '▲' : '▼'}</span>
              </div>
            </div>
            {isPendingExpanded && (
              <div className={`section-body ${viewMode === 'grid' ? 'p-3' : 'p-0'} bg-white border border-danger border-top-0 rounded-bottom`}>
                {viewMode === 'grid' ? (
                  <div className="admin-cards-grid">
                    {filteredRecs.filter(r => !isRecCompletedForEntity(r, viewedEntity)).map(rec => renderCard(rec))}
                  </div>
                ) : (
                  renderTable(filteredRecs.filter(r => !isRecCompletedForEntity(r, viewedEntity)))
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Details Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Recommendation {selectedRec ? selectedRec.recNo : ''} Details</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          {historyLoading ? (
            <div>Loading history...</div>
          ) : (
            <>
              {/* STATUS & DETAILS */}
              <div className="mb-4 d-flex gap-4">
                <div>
                  <div className="text-secondary fw-bold small mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>STATUS</div>
                  <span className={`badge ${selectedRec?.status === 'Completed' ? 'bg-success text-success' : 'bg-info text-primary'} bg-opacity-25 px-3 py-2 rounded-pill`} style={{ fontSize: '0.85rem' }}>
                    {selectedRec?.status || 'In Progress'}
                  </span>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-secondary fw-bold small mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>DATA ENTERED / DETAILS</div>
                <div className="border rounded p-2 text-dark bg-light shadow-sm" style={{ fontSize: '0.9rem' }}>
                  Last updated by: {selectedRec?.last_updated_by || 'Unknown'}
                </div>
              </div>

              {/* IMPLEMENTATION HISTORY TABLE */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="text-secondary fw-bold small" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>IMPLEMENTATION HISTORY (ENTRIES)</div>
                  <button className="btn btn-success btn-sm shadow-sm" style={{ fontSize: '0.8rem', backgroundColor: '#198754', borderColor: '#198754' }} onClick={handleDownloadCSV}>
                    📊 Download CSV
                  </button>
                </div>
                <div className="table-responsive border rounded shadow-sm bg-white">
                  <table className="table table-bordered table-hover mb-0 align-middle" style={{ fontSize: '0.85rem' }}>
                    <thead className="bg-light text-muted">
                      <tr>
                        <th className="fw-semibold">Period</th>
                        <th className="fw-semibold">Frequency</th>
                        <th className="fw-semibold">Signed Copy</th>
                        <th className="fw-semibold">Uploaded At</th>
                        <th className="fw-semibold">Submitted By</th>
                        <th className="fw-semibold">Implementation Details</th>
                        <th className="fw-semibold">Related photos/videos</th>
                        <th className="fw-semibold text-center">Row Files</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.Period}</td>
                          <td>{row.Frequency}</td>
                          <td>
                            {row["Signed Copy"] ? (
                              <div className="d-flex flex-column gap-2 align-items-start">
                                <span className="text-truncate" style={{ maxWidth: '120px', fontSize: '0.8rem' }} title={row["Signed Copy"]}>{row["Signed Copy"]}</span>
                                <a href={`http://localhost:5000/uploads/${row["Signed Copy"]}`} download className="btn btn-outline-success btn-sm py-1 px-2" style={{ fontSize: '0.75rem' }}>Download</a>
                              </div>
                            ) : null}
                          </td>
                          <td>{row["Uploaded At"]}</td>
                          <td>
                            <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1" style={{ fontSize: '0.75rem' }}>
                              {row["Submitted By"] || 'N/A'}
                            </span>
                          </td>
                          <td>
                            {row["Implementation Details"] ? (
                              <div className="d-flex flex-column gap-1 align-items-start">
                                <span className="text-truncate" style={{ maxWidth: '120px', fontSize: '0.8rem' }} title={row["Implementation Details"]}>{row["Implementation Details"]}</span>
                                <a href={`http://localhost:5000/uploads/${row["Implementation Details"]}`} download className="btn btn-outline-success btn-sm py-1 px-2" style={{ fontSize: '0.75rem' }}>Download</a>
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {row["Related photos/videos"] && row["Related photos/videos"].length > 0 ? (
                              <div className="d-flex flex-column gap-2 align-items-start">
                                {row["Related photos/videos"].map((photo, pIdx) => (
                                  <div key={pIdx} className="d-flex flex-column gap-1 align-items-start mb-2">
                                    <img src={`http://localhost:5000/uploads/${photo}`} alt="preview" className="shadow-sm" style={{ width: 50, height: 35, objectFit: 'cover', border: '1px solid #dee2e6' }} />
                                    <a href={`http://localhost:5000/uploads/${photo}`} download className="btn btn-outline-primary btn-sm py-1 px-2" style={{ fontSize: '0.75rem' }}>Download</a>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </td>
                          <td className="text-center">
                            <Button size="sm" variant="outline-primary" className="shadow-sm fw-bold d-flex flex-column align-items-center justify-content-center mx-auto" onClick={() => handleDownloadRowZip(row, selectedRec?.recNo)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                              <span style={{ fontSize: '1.2rem', color: '#c38755' }}>📦</span>
                              <span>ZIP<br />Download</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {historyRows.length === 0 && (
                        <tr>
                          <td colSpan="8" className="text-center py-4 text-muted">No history entries found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>


            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default AdminDashboard;
