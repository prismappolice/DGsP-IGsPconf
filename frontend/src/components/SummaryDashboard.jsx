import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  getAssignedUsers,
  ALL_STATES,
  ALL_UTS,
  ALL_MINISTRIES
} from '../utils/recommendationUtils';
import { saveAs } from 'file-saver';
import './AdminDashboard.css'; // Reuse existing styles for consistency

function SummaryDashboard() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('recommendations'); // 'recommendations' or 'entities'
  const [summaryPanelMode, setSummaryPanelMode] = useState('entity'); // 'entity' | 'recommendation'
  const [selectedRecFilter, setSelectedRecFilter] = useState(null); // rec id for rec-wise drill-down

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await axios.get('http://localhost:5000/api/recs/stats', config);
        setRecommendations(res.data.list || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching summary data:', err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadEntityZip = async (e, entityName) => {
    e.stopPropagation();
    
    // Find all recNos belonging to this entity based on current search/category filters
    // Or just grab all for that entity. We'll grab all for that entity since it says "vise all recoomandation download zip"
    const recIds = processedData.filter(rec => rec.assignedUsers.includes(entityName)).map(r => r.recNo);
    
    if (recIds.length === 0) {
      alert(`No recommendations assigned to ${entityName}`);
      return;
    }

    setIsDownloading(true);
    try {
      const res = await axios.post(
        'http://localhost:5000/api/admin/download-zip/batch', 
        { recIds, entityName },
        { responseType: 'blob' }
      );
      saveAs(res.data, `${entityName.replace(/[^a-z0-9]/gi, '_')}_data.zip`);
    } catch (err) {
      console.error('Download error:', err);
      let errMsg = "Failed to download ZIP.";
      try {
          const text = await err.response.data.text();
          const errData = JSON.parse(text);
          errMsg = errData.error || errMsg;
      } catch (parseErr) {}
      alert(errMsg);
    }
    setIsDownloading(false);
  };

  const categories = [
    'Immediately actionable',
    'Needs to be developed as a review or implementation framework',
    'Drafting of guidelines, policies & regulations',
    'Can be converted to training modules'
  ];

  const allEntities = useMemo(() => {
    return ['All', ...ALL_STATES, ...ALL_UTS, ...ALL_MINISTRIES].sort();
  }, []);

  const processedData = useMemo(() => {
    return recommendations.map(rec => {
      const assignedUsers = getAssignedUsers(rec.actionedBy);
      const history = rec.data?.tableEntries || [];

      const userStatus = assignedUsers.map(user => {
        const userEntries = history.filter(h => h["Submitted By"] === user);

        if (userEntries.length === 0) return { user, status: 'Pending' };

        // If any entry has a signed copy, mark as Completed
        const hasSignedCopy = userEntries.some(h => h["Signed Copy"] && h["Signed Copy"] !== '');
        if (hasSignedCopy) return { user, status: 'Completed' };

        // Otherwise, it's Processing (In Progress)
        return { user, status: 'Processing' };
      });

      const counts = {
        total: assignedUsers.length,
        completed: userStatus.filter(s => s.status === 'Completed').length,
        processing: userStatus.filter(s => s.status === 'Processing').length,
        pending: userStatus.filter(s => s.status === 'Pending').length
      };

      return {
        ...rec,
        assignedUsers,
        userStatus,
        counts,
        percentage: counts.total > 0 ? ((counts.completed / counts.total) * 100).toFixed(1) : '0'
      };
    });
  }, [recommendations]);

  const entitySummary = useMemo(() => {
    // Determine entity statuses across filtered recommendations (ignoring currently selected entity)
    const filteredForEntities = processedData.filter(rec => {
      const matchesSearch = rec.recNo.toString().includes(searchTerm) ||
        rec.recommendation.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || rec.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    const summary = {};
    allEntities.forEach(e => {
      if (e !== 'All') {
        summary[e] = { name: e, completed: 0, processing: 0, pending: 0, total: 0 };
      }
    });

    filteredForEntities.forEach(rec => {
      rec.userStatus.forEach(statusObj => {
        const e = statusObj.user;
        if (summary[e]) {
          summary[e].total += 1;
          if (statusObj.status === 'Completed') summary[e].completed += 1;
          else if (statusObj.status === 'Processing') summary[e].processing += 1;
          else summary[e].pending += 1;
        }
      });
    });

    const completedEntities = [];
    const processingEntities = [];
    const pendingEntities = [];

    const activeList = Object.values(summary).filter(ent => ent.total > 0);

    activeList.forEach(ent => {
      ent.percentage = ent.total > 0 ? ((ent.completed / ent.total) * 100).toFixed(1) : "0";
      if (ent.completed === ent.total && ent.total > 0) {
        completedEntities.push(ent);
      } else if (ent.pending === ent.total && ent.total > 0) {
        pendingEntities.push(ent);
      } else {
        processingEntities.push(ent);
      }
    });

    // Sort alphabetically
    completedEntities.sort((a, b) => a.name.localeCompare(b.name));
    processingEntities.sort((a, b) => a.name.localeCompare(b.name));
    pendingEntities.sort((a, b) => a.name.localeCompare(b.name));
    activeList.sort((a, b) => a.name.localeCompare(b.name));

    return { completedEntities, processingEntities, pendingEntities, allActive: activeList };
  }, [processedData, searchTerm, selectedCategory, allEntities]);

  const recWiseSummary = useMemo(() => {
    const filtered = processedData.filter(rec => {
      const matchesSearch = rec.recNo.toString().includes(searchTerm) ||
        rec.recommendation.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || rec.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    const fullyCompleted = [];
    const partial = [];
    const notStarted = [];

    filtered.forEach(rec => {
      if (rec.counts.total === 0) { notStarted.push(rec); return; }
      if (rec.counts.completed === rec.counts.total) fullyCompleted.push(rec);
      else if (rec.counts.completed > 0 || rec.counts.processing > 0) partial.push(rec);
      else notStarted.push(rec);
    });

    return { fullyCompleted, partial, notStarted };
  }, [processedData, searchTerm, selectedCategory]);

  const filteredData = useMemo(() => {
    return processedData.filter(rec => {
      const matchesSearch = rec.recNo.toString().includes(searchTerm) ||
        rec.recommendation.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || rec.category === selectedCategory;
      const matchesEntity = selectedEntity === 'All' || rec.assignedUsers.includes(selectedEntity);

      return matchesSearch && matchesCategory && matchesEntity;
    });
  }, [processedData, searchTerm, selectedCategory, selectedEntity]);

  const overallStats = useMemo(() => {
    let totalAssigned = 0;
    let totalCompleted = 0;
    let totalProcessing = 0;
    let totalPending = 0;

    filteredData.forEach(rec => {
      if (selectedEntity !== 'All') {
        const statusObj = rec.userStatus.find(s => s.user === selectedEntity);
        if (statusObj) {
          totalAssigned += 1;
          if (statusObj.status === 'Completed') totalCompleted += 1;
          else if (statusObj.status === 'Processing') totalProcessing += 1;
          else totalPending += 1;
        }
      } else {
        totalAssigned += rec.counts.total;
        totalCompleted += rec.counts.completed;
        totalProcessing += rec.counts.processing;
        totalPending += rec.counts.pending;
      }
    });

    return {
      total: totalAssigned,
      completed: totalCompleted,
      processing: totalProcessing,
      pending: totalPending,
      percentage: totalAssigned > 0 ? ((totalCompleted / totalAssigned) * 100).toFixed(1) : '0'
    };
  }, [filteredData, selectedEntity]);

  if (loading) return <div className="p-5 text-center">Loading Summary Dashboard...</div>;

  return (
    <div className="summary-content-wrapper">
      <main className="summary-main-content">
        <div className="container-fluid p-2">
            <h5 className="m-0 text-dark fw-bold" style={{ fontSize: '1rem' }}>Recommendation Summary Dashboard</h5>

          <div className="table-responsive mb-2">
            <table className="table table-bordered align-middle mb-0" style={{ minWidth: '600px', textAlign: 'center' }}>
              <thead className="table-light">
                <tr>
                  <th>Total Assigned Users</th>
                  <th className="text-success">Completed</th>
                  <th className="text-warning">Processing</th>
                  <th className="text-danger">Pending</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>{overallStats.total}</strong></td>
                  <td className="text-success"><strong>{overallStats.completed}</strong><br /><small>({overallStats.total > 0 ? ((overallStats.completed / overallStats.total) * 100).toFixed(1) : 0}%)</small></td>
                  <td className="text-warning"><strong>{overallStats.processing}</strong><br /><small>({overallStats.total > 0 ? ((overallStats.processing / overallStats.total) * 100).toFixed(1) : 0}%)</small></td>
                  <td className="text-danger"><strong>{overallStats.pending}</strong><br /><small>({overallStats.total > 0 ? ((overallStats.pending / overallStats.total) * 100).toFixed(1) : 0}%)</small></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Panel Toggle */}
          <div className="d-flex justify-content-center align-items-center gap-3 mb-3">
            <span className="fw-bold text-dark" style={{ fontSize: '1rem' }}>Summary View:</span>
            <div className="btn-group shadow">
              <button
                className={`btn ${summaryPanelMode === 'entity' ? 'btn-dark' : 'btn-outline-dark'}`}
                style={{ fontSize: '0.95rem', padding: '8px 24px', fontWeight: 600 }}
                onClick={() => { setSummaryPanelMode('entity'); setSelectedRecFilter(null); }}
              >🏢 State-wise</button>
              <button
                className={`btn ${summaryPanelMode === 'recommendation' ? 'btn-dark' : 'btn-outline-dark'}`}
                style={{ fontSize: '0.95rem', padding: '8px 24px', fontWeight: 600 }}
                onClick={() => { setSummaryPanelMode('recommendation'); setSelectedEntity('All'); }}
              >📋 Recommendation-wise</button>
            </div>
          </div>

          {/* Entity Status Panel */}
          {summaryPanelMode === 'entity' && (
          <div className="row mb-2 g-2">
            <div className="col-md-4">
              <div className="card shadow-sm border-success h-100">
                <div className="card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.85rem' }}>
                  <span>✅ Completed</span>
                  <span className="badge bg-light text-success rounded-pill px-2">{entitySummary.completedEntities.length}</span>
                </div>
                <div className="card-body p-0" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <ul className="list-group list-group-flush">
                    {entitySummary.completedEntities.map(e => (
                      <button key={e.name} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedEntity(e.name)}>
                        <span className="text-truncate me-2">{e.name}</span>
                        <span className="badge bg-success rounded-pill" style={{ fontSize: '0.7em' }}>{e.completed}/{e.total}</span>
                      </button>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card shadow-sm border-warning h-100">
                <div className="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.85rem' }}>
                  <span>🟡 Incomplete</span>
                  <span className="badge bg-dark text-warning rounded-pill px-2">{entitySummary.processingEntities.length}</span>
                </div>
                <div className="card-body p-0" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <ul className="list-group list-group-flush">
                    {entitySummary.processingEntities.map(e => (
                      <button key={e.name} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedEntity(e.name)}>
                        <span className="text-truncate me-2">{e.name}</span>
                        <span className="badge bg-warning text-dark rounded-pill" style={{ fontSize: '0.7em' }}>{e.completed}/{e.total}</span>
                      </button>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card shadow-sm border-danger h-100">
                <div className="card-header bg-danger text-white fw-bold d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.85rem' }}>
                  <span>🔴 Not Started</span>
                  <span className="badge bg-light text-danger rounded-pill px-2">{entitySummary.pendingEntities.length}</span>
                </div>
                <div className="card-body p-0" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <ul className="list-group list-group-flush">
                    {entitySummary.pendingEntities.map(e => (
                      <button key={e.name} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedEntity(e.name)}>
                        <span className="text-truncate me-2">{e.name}</span>
                        <span className="badge bg-danger rounded-pill" style={{ fontSize: '0.7em' }}>{e.pending}/{e.total}</span>
                      </button>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Recommendation-wise Summary Panel */}
          {summaryPanelMode === 'recommendation' && (
          <div className="row mb-2 g-2">
            <div className="col-md-4">
              <div className="card shadow-sm border-success h-100">
                <div className="card-header bg-success text-white fw-bold d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.85rem' }}>
                  <span>✅ Fully Completed Recs</span>
                  <span className="badge bg-light text-success rounded-pill px-2">{recWiseSummary.fullyCompleted.length}</span>
                </div>
                <div className="card-body p-0" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <ul className="list-group list-group-flush">
                    {recWiseSummary.fullyCompleted.map(r => (
                      <button key={r.id} className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2 ${selectedRecFilter === r.id ? 'bg-success bg-opacity-10' : ''}`} style={{ fontSize: '0.72rem' }} onClick={() => setSelectedRecFilter(selectedRecFilter === r.id ? null : r.id)}>
                        <span className="text-truncate me-2 fw-bold">Rec {r.recNo}</span>
                        <span className="badge bg-success rounded-pill" style={{ fontSize: '0.7em' }}>{r.counts.completed}/{r.counts.total}</span>
                      </button>
                    ))}
                    {recWiseSummary.fullyCompleted.length === 0 && <li className="list-group-item text-muted py-2 px-2" style={{ fontSize: '0.72rem' }}>None</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card shadow-sm border-warning h-100">
                <div className="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.85rem' }}>
                  <span>🟡 Partial Progress Recs</span>
                  <span className="badge bg-dark text-warning rounded-pill px-2">{recWiseSummary.partial.length}</span>
                </div>
                <div className="card-body p-0" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <ul className="list-group list-group-flush">
                    {recWiseSummary.partial.map(r => (
                      <button key={r.id} className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2 ${selectedRecFilter === r.id ? 'bg-warning bg-opacity-10' : ''}`} style={{ fontSize: '0.72rem' }} onClick={() => setSelectedRecFilter(selectedRecFilter === r.id ? null : r.id)}>
                        <span className="text-truncate me-2 fw-bold">Rec {r.recNo}</span>
                        <span className="badge bg-warning text-dark rounded-pill" style={{ fontSize: '0.7em' }}>{r.counts.completed}/{r.counts.total}</span>
                      </button>
                    ))}
                    {recWiseSummary.partial.length === 0 && <li className="list-group-item text-muted py-2 px-2" style={{ fontSize: '0.72rem' }}>None</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card shadow-sm border-danger h-100">
                <div className="card-header bg-danger text-white fw-bold d-flex justify-content-between align-items-center py-1 px-2" style={{ fontSize: '0.85rem' }}>
                  <span>🔴 Not Started Recs</span>
                  <span className="badge bg-light text-danger rounded-pill px-2">{recWiseSummary.notStarted.length}</span>
                </div>
                <div className="card-body p-0" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <ul className="list-group list-group-flush">
                    {recWiseSummary.notStarted.map(r => (
                      <button key={r.id} className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-1 px-2 ${selectedRecFilter === r.id ? 'bg-danger bg-opacity-10' : ''}`} style={{ fontSize: '0.72rem' }} onClick={() => setSelectedRecFilter(selectedRecFilter === r.id ? null : r.id)}>
                        <span className="text-truncate me-2 fw-bold">Rec {r.recNo}</span>
                        <span className="badge bg-danger rounded-pill" style={{ fontSize: '0.7em' }}>{r.counts.pending}/{r.counts.total}</span>
                      </button>
                    ))}
                    {recWiseSummary.notStarted.length === 0 && <li className="list-group-item text-muted py-2 px-2" style={{ fontSize: '0.72rem' }}>None</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Rec-wise drill-down: show entity statuses for selected recommendation */}
          {summaryPanelMode === 'recommendation' && selectedRecFilter !== null && (() => {
            const rec = processedData.find(r => r.id === selectedRecFilter);
            if (!rec) return null;
            return (
              <div className="card shadow-sm mb-2 border-0" style={{ borderLeft: '4px solid #6366f1' }}>
                <div className="card-header bg-white d-flex justify-content-between align-items-center py-2 px-3" style={{ borderLeft: '4px solid #6366f1' }}>
                  <div>
                    <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Rec #{rec.recNo} — Entity Breakdown</span>
                    <div className="text-muted text-truncate" style={{ fontSize: '0.7rem', maxWidth: '600px' }}>{rec.recommendation}</div>
                  </div>
                  <button className="btn btn-sm btn-outline-secondary py-0 px-2" style={{ fontSize: '0.7rem' }} onClick={() => setSelectedRecFilter(null)}>✕ Close</button>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3">Entity / State</th>
                          <th className="text-center">Status</th>
                          <th className="text-center">Entries Submitted</th>
                          <th className="text-center">Has Signed Copy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rec.userStatus.map(({ user, status }) => {
                          const entries = rec.data?.tableEntries?.filter(h => h["Submitted By"] === user) || [];
                          const hasSigned = entries.some(h => h["Signed Copy"] && h["Signed Copy"] !== '');
                          return (
                            <tr key={user}>
                              <td className="ps-3 fw-semibold">{user}</td>
                              <td className="text-center">
                                <span className={`badge rounded-pill px-2 ${status === 'Completed' ? 'bg-success' : status === 'Processing' ? 'bg-warning text-dark' : 'bg-danger'}`} style={{ fontSize: '0.7em' }}>
                                  {status}
                                </span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${entries.length > 0 ? 'bg-primary' : 'bg-light text-muted border'}`}>{entries.length}</span>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${hasSigned ? 'bg-success' : 'bg-light text-muted border'}`}>{hasSigned ? '✓ Yes' : '✗ No'}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {rec.userStatus.length === 0 && (
                          <tr><td colSpan="4" className="text-center py-3 text-muted">No entities assigned to this recommendation.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white p-2 rounded shadow-sm mb-2">
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label mb-0 fw-bold" style={{ fontSize: '0.7rem' }}>Search Recommendation</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="ID or text..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label mb-0 fw-bold" style={{ fontSize: '0.7rem' }}>Filter by Entity</label>
                <select className="form-select form-select-sm" style={{ fontSize: '0.75rem', padding: '2px 8px' }} value={selectedEntity} onChange={e => setSelectedEntity(e.target.value)}>
                  {allEntities.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label mb-0 fw-bold" style={{ fontSize: '0.7rem' }}>Filter by Category</label>
                <select className="form-select form-select-sm" style={{ fontSize: '0.75rem', padding: '2px 8px' }} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button className="btn btn-secondary btn-sm w-100" style={{ fontSize: '0.75rem', padding: '2px 0' }} onClick={() => { setSearchTerm(''); setSelectedEntity('All'); setSelectedCategory('All'); }}>Reset</button>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-end mb-2">
            <div className="btn-group shadow-sm">
              <button className={`btn btn-sm ${viewMode === 'recommendations' ? 'btn-primary' : 'btn-outline-primary'}`} style={{ fontSize: '0.75rem', padding: '2px 10px' }} onClick={() => setViewMode('recommendations')}>Recommendation View</button>
              <button className={`btn btn-sm ${viewMode === 'entities' ? 'btn-primary' : 'btn-outline-primary'}`} style={{ fontSize: '0.75rem', padding: '2px 10px' }} onClick={() => setViewMode('entities')}>Entity View</button>
            </div>
          </div>

          {viewMode === 'recommendations' ? (
            <div className="table-responsive bg-white rounded shadow-sm mb-5">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '80px' }}>ID</th>
                    <th>Recommendation</th>
                    <th className="text-center">Assigned Users</th>
                    <th className="text-center">Completed</th>
                    <th className="text-center">Processing</th>
                    <th className="text-center">Pending</th>
                    <th className="text-center">Progress %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map(rec => {
                    const selectedStatus = selectedEntity !== 'All'
                      ? rec.userStatus.find(s => s.user === selectedEntity)?.status
                      : null;

                    return (
                    <tr key={rec.id}>
                      <td className="fw-bold">#{rec.recNo}</td>
                      <td style={{ maxWidth: '400px' }}>
                        <div className="text-truncate" title={rec.recommendation}>{rec.recommendation}</div>
                        <div className="xsmall text-muted" style={{ fontSize: '0.7rem' }}>{rec.category}</div>
                      </td>
                      <td className="text-center"><span className="badge bg-light text-dark border">{selectedEntity !== 'All' ? '1' : rec.counts.total}</span></td>
                      <td className="text-center">
                        <span className={`badge ${selectedEntity !== 'All' ? (selectedStatus === 'Completed' ? 'bg-success' : 'bg-light text-muted border') : (rec.counts.completed > 0 ? 'bg-success' : 'bg-light text-muted border')}`}>
                          {selectedEntity !== 'All' ? (selectedStatus === 'Completed' ? '1' : '0') : rec.counts.completed}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge ${selectedEntity !== 'All' ? (selectedStatus === 'Processing' ? 'bg-warning text-dark' : 'bg-light text-muted border') : (rec.counts.processing > 0 ? 'bg-warning text-dark' : 'bg-light text-muted border')}`}>
                          {selectedEntity !== 'All' ? (selectedStatus === 'Processing' ? '1' : '0') : rec.counts.processing}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`badge ${selectedEntity !== 'All' ? (selectedStatus === 'Pending' ? 'bg-danger' : 'bg-light text-muted border') : (rec.counts.pending > 0 ? 'bg-danger' : 'bg-light text-muted border')}`}>
                          {selectedEntity !== 'All' ? (selectedStatus === 'Pending' ? '1' : '0') : rec.counts.pending}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="progress" style={{ height: '10px' }}>
                          <div
                            className={`progress-bar ${selectedEntity !== 'All' ? (selectedStatus === 'Completed' ? 'bg-success' : 'bg-light') : 'bg-success'}`}
                            role="progressbar"
                            style={{ width: `${selectedEntity !== 'All' ? (selectedStatus === 'Completed' ? 100 : 0) : rec.percentage}%` }}
                          ></div>
                        </div>
                        <small className="fw-bold">{selectedEntity !== 'All' ? (selectedStatus === 'Completed' ? '100%' : '0%') : `${rec.percentage}%`}</small>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredData.length === 0 && <div className="p-5 text-center text-muted">No recommendations match your filters.</div>}
            </div>
          ) : (
            <div className="table-responsive bg-white rounded shadow-sm mb-5">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
                <thead className="table-light">
                  <tr>
                    <th>Entity Name</th>
                    <th className="text-center">Assigned Recs</th>
                    <th className="text-center">Completed</th>
                    <th className="text-center">Processing</th>
                    <th className="text-center">Pending (Not Started)</th>
                    <th className="text-center">Overall Progress %</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entitySummary.allActive
                    .filter(e => selectedEntity === 'All' || e.name === selectedEntity)
                    .map(e => (
                      <tr key={e.name}>
                        <td className="fw-bold text-primary" style={{ cursor: 'pointer' }} onClick={() => setSelectedEntity(e.name)}>{e.name}</td>
                        <td className="text-center"><span className="badge bg-light text-dark border">{e.total}</span></td>
                        <td className="text-center"><span className={`badge ${e.completed > 0 ? 'bg-success' : 'bg-light text-muted border'}`}>{e.completed}</span></td>
                        <td className="text-center"><span className={`badge ${e.processing > 0 ? 'bg-warning text-dark' : 'bg-light text-muted border'}`}>{e.processing}</span></td>
                        <td className="text-center"><span className={`badge ${e.pending > 0 ? 'bg-danger' : 'bg-light text-muted border'}`}>{e.pending}</span></td>
                        <td className="text-center" style={{ width: '150px' }}>
                          <div className="progress" style={{ height: '10px', marginBottom: '4px' }}>
                            <div className="progress-bar bg-success" role="progressbar" style={{ width: `${e.percentage}%` }}></div>
                          </div>
                          <small className="fw-bold">{e.percentage}%</small>
                        </td>
                        <td className="text-center">
                          <button 
                             className="btn btn-sm btn-outline-success py-1 px-2 d-flex align-items-center justify-content-center gap-1 mx-auto shadow-sm"
                             onClick={(evt) => handleDownloadEntityZip(evt, e.name)}
                             title={`Download ZIP for ${e.name}`}
                             disabled={isDownloading}
                          >
                             <span style={{ fontSize: '1.2rem', color: '#c38755' }}>📦</span>
                             <span className="fw-bold" style={{ fontSize: '0.8rem' }}>ZIP</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  {entitySummary.allActive.filter(e => selectedEntity === 'All' || e.name === selectedEntity).length === 0 &&
                    <tr><td colSpan="6" className="text-center p-5 text-muted">No entities found based on current active filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default SummaryDashboard;
