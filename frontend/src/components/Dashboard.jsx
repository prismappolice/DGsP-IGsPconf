import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Dashboard.css';
import DispatchTable from './DispatchTable';
import { expandOfficerToken, ALL_STATES, ALL_UTS, COASTAL_STATES, COASTAL_UTS, IMB_STATES } from '../utils/recommendationUtils';

// MultiRecommendationUpload: loops through all recommendations and displays upload fields for each
function MultiRecommendationUpload({ recommendations }) {
  const [uploads, setUploads] = useState({});

  const handleFileChange = (recId, type, file) => {
    setUploads(prev => ({
      ...prev,
      [recId]: {
        ...prev[recId],
        [type]: file
      }
    }));
  };

  return (
    <div>
      {recommendations.map(rec => (
        <div key={rec.id} className="card mb-4">
          <div className="card-body">
            <h5>Recommendation {rec.recNo}</h5>
            <div className="mb-2 text-muted">{rec.recommendation}</div>
            <div className="row mb-2">
              <div className="col-md-4">
                <label>Upload Word Document</label>
                <input
                  type="file"
                  accept=".doc,.docx"
                  className="form-control"
                  onChange={e => handleFileChange(rec.id, 'word', e.target.files[0])}
                />
              </div>
              <div className="col-md-4">
                <label>📷 Upload Photos</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="form-control"
                  onChange={e => handleFileChange(rec.id, 'photos', e.target.files)}
                />
              </div>
              <div className="col-md-4">
                <label>Upload Signed Copy <span className="text-danger">(Must)</span></label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="form-control"
                  onChange={e => handleFileChange(rec.id, 'signed', e.target.files[0])}
                />
              </div>
            </div>
            <div className="mt-2">
              <strong>Uploaded Files:</strong>
              <ul>
                <li>Word: {uploads[rec.id]?.word?.name || 'None'}</li>
                <li>Photos: {uploads[rec.id]?.photos ? Array.from(uploads[rec.id].photos).map(f => f.name).join(', ') : 'None'}</li>
                <li>Signed Copy: {uploads[rec.id]?.signed?.name || 'None'}</li>
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRec, setSelectedRec] = useState(null);
  const [expandedRecs, setExpandedRecs] = useState(new Set());
  const [activeView, setActiveView] = useState('recommendations');
  const [allocations, setAllocations] = useState([]);

  const ITEMS_PER_PAGE = 12;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  const handleLogout = () => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (e) { }
    navigate('/login');
  };

  const totalPages = Math.max(1, Math.ceil(recommendations.length / ITEMS_PER_PAGE));

  useEffect(() => {
    const recId = searchParams.get('selectRec');
    if (recId) {
      const rec = recommendations.find(r => r.id === parseInt(recId));
      if (rec) setSelectedRec(rec);
    }
  }, [searchParams, recommendations]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);


  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token || token === 'null' || token === 'undefined') {
          navigate('/login');
          return;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };

        const [statsRes, allocRes] = await Promise.all([
          axios.get('http://localhost:5000/api/recs/stats', config),
          axios.get('http://localhost:5000/api/recs/allocations', config)
        ]);
        setRecommendations(statsRes.data.list.sort((a, b) => (parseInt(a.recNo) || 0) - (parseInt(b.recNo) || 0)));
        setAllocations(allocRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleExpand = (id) => {
    setExpandedRecs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatCategory = (c) => {
    if (!c) return c;
    const lower = String(c).toLowerCase().trim();
    if (lower === 'immediately actionable') return 'Immediately Actionable';
    if (lower === 'needs to be developed as a review or implementation framework') return 'Needs to be developed as a review or implementation framework';
    if (lower === 'drafting of guidelines, policies & regulations') return 'Drafting of guidelines, policies & regulations';
    if (lower === 'can be converted to training modules') return 'Can be converted to training modules';
    return c;
  };

  const filtered = recommendations;

  const totalFilteredPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  useEffect(() => {
    if (currentPage > totalFilteredPages) setCurrentPage(totalFilteredPages);
  }, [currentPage, totalFilteredPages]);

  if (loading) return <div className="p-5 text-center">Loading Data...</div>;

  const visibleRecommendations = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  return (
    <div className="dashboard-content-wrapper">
      <main className="dashboard-main-content">
        <div className="container-fluid">
          <div className="d-flex align-items-stretch justify-content-between mb-3 top-controls w-100 gap-2">
            <div className="detail-panel m-0">
              <div className="detail-panel-content w-100">
                {selectedRec ? (
                  <>
                    <h5 className="mb-1 fw-bold text-dark">Recommendation {selectedRec.recNo}</h5>
                    <div className="detail-text text-secondary mb-2">{selectedRec.recommendation}</div>
                    <div className="small text-muted detail-meta d-flex gap-2">
                      <span className="badge border" style={{ background: '#f8fafc', color: '#475569', fontSize: '0.8rem', padding: '6px 10px' }}>Actioned By: {selectedRec.actionedBy}</span>
                      <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.8rem', padding: '6px 10px' }}>Category: {formatCategory(selectedRec.category)}</span>
                    </div>
                  </>
                ) : activeView === 'dispatch' ? (
                  <h5 className="mb-0 fw-bold text-dark" style={{ letterSpacing: '0.5px' }}>Dispatch Control Panel</h5>
                ) : (
                  <h5 className="mb-0 fw-bold text-dark" style={{ letterSpacing: '0.5px' }}>All Recommendations</h5>
                )}
              </div>
            </div>

            {activeView === 'recommendations' && (
              <>
                <div className="top-actions d-flex align-items-center gap-2" style={{ flex: '0 0 auto' }}>
                  {selectedRec && <button className="btn btn-secondary btn-sm h-100" onClick={() => setSelectedRec(null)}>Clear</button>}
                  <button className="btn btn-outline-danger btn-sm whitespace-nowrap h-100" onClick={handleLogout}>Logout</button>
                </div>
              </>
            )}
            {activeView === 'dispatch' && !selectedRec && (
              <div className="top-actions d-flex gap-2 align-items-center">
                <button className="btn btn-outline-danger btn-sm whitespace-nowrap" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>

          {selectedRec ? (
            <section className="recommendation-stage">
              <RecommendationForm rec={selectedRec} onBack={() => setSelectedRec(null)} />
            </section>
          ) : activeView === 'dispatch' ? (
            <DispatchTable isAdmin={isAdmin} onOpenRec={(recId) => {
              const rec = recommendations.find(r => r.id === recId || r.recNo === recId);
              if (rec) {
                setSelectedRec(rec);
                setActiveView('recommendations');
              }
            }} />
          ) : (
            <div className="row g-4">
              {visibleRecommendations.map(rec => {
                const isExpanded = expandedRecs.has(rec.id);
                return (
                  <div key={rec.id} className="col-12 col-sm-6 col-lg-4 col-xxl-3">
                    <div className="rec-card card h-100 d-flex flex-column border-0">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="card-title m-0 fw-bold" style={{ color: '#4f46e5' }}>Recommendation {rec.recNo}</h6>
                        </div>
                        <div className="rec-text mb-3">
                          <p className="mb-1" style={{
                            display: isExpanded ? 'block' : '-webkit-box',
                            WebkitLineClamp: isExpanded ? 'unset' : 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {rec.recommendation}
                          </p>
                          {rec.recommendation && rec.recommendation.length > 100 && (
                            <button
                              className="btn btn-link btn-sm p-0 text-decoration-none fw-bold mt-1"
                              style={{ color: '#4f46e5' }}
                              onClick={() => toggleExpand(rec.id)}
                            >
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </div>
                        <div className="mb-3 mt-auto">
                          <div className="text-muted small fw-bold mb-1" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actioned By</div>
                          <span className="badge rounded" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', whiteSpace: 'normal', textAlign: 'left', lineHeight: '1.4', padding: '4px 8px', display: 'block', fontSize: '0.7rem' }}>
                            {rec.actionedBy}
                          </span>
                        </div>
                        <div className="mb-3">
                          <div className="text-muted small fw-bold mb-1" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</div>
                          <span className="badge rounded" style={{ background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', whiteSpace: 'normal', textAlign: 'left', lineHeight: '1.4', padding: '4px 8px', display: 'block', fontSize: '0.7rem' }}>
                            {formatCategory(rec.category)}
                          </span>
                        </div>
                        <div className="pt-3 border-top mt-2">
                          <button
                            className="btn btn-primary w-100 rounded-pill shadow-sm d-flex justify-content-center align-items-center gap-2"
                            style={{ background: 'linear-gradient(to right, #4f46e5, #3b82f6)', border: 'none' }}
                            onClick={() => setSelectedRec(rec)}
                          >
                            Open Details <span>→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeView === 'recommendations' && !selectedRec && (
            <div className="pagination-wrap">
              <nav aria-label="Recommendations pagination">
                <ul className="premium-pagination">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} aria-label="Previous">&laquo;</button>
                  </li>
                  {Array.from({ length: totalFilteredPages }).map((_, i) => {
                    const page = i + 1;
                    if (page === 1 || page === totalFilteredPages || (page >= currentPage - 2 && page <= currentPage + 2)) {
                      return (
                        <li key={page} className={`page-item ${page === currentPage ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => setCurrentPage(page)}>{page}</button>
                        </li>
                      );
                    }
                    if (page === currentPage - 3 || page === currentPage + 3) {
                      return <li key={page} className="page-item disabled"><span className="page-link border-0">...</span></li>;
                    }
                    return null;
                  })}
                  <li className={`page-item ${currentPage === totalFilteredPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(p => Math.min(totalFilteredPages, p + 1))} aria-label="Next">&raquo;</button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;

function TableSection({ recNo, sectionIndex, fields }) {
  // MULTI-PHOTO: Add support for multiple photo URLs in 'Related photos/videos' field
  const addPhotoUrl = (rowIdx, field) => {
    setRows(r => {
      const copy = [...r];
      const urls = Array.isArray(copy[rowIdx][field]) ? copy[rowIdx][field] : (copy[rowIdx][field] ? [copy[rowIdx][field]] : []);
      urls.push('');
      copy[rowIdx] = { ...copy[rowIdx], [field]: urls };
      return copy;
    });
  };
  const updatePhotoUrl = (rowIdx, field, urlIdx, value) => {
    setRows(r => {
      const copy = [...r];
      const urls = Array.isArray(copy[rowIdx][field]) ? [...copy[rowIdx][field]] : [];
      urls[urlIdx] = value;
      copy[rowIdx] = { ...copy[rowIdx], [field]: urls };
      return copy;
    });
  };
  const removePhotoUrl = (rowIdx, field, urlIdx) => {
    setRows(r => {
      const copy = [...r];
      const urls = Array.isArray(copy[rowIdx][field]) ? [...copy[rowIdx][field]] : [];
      urls.splice(urlIdx, 1);
      copy[rowIdx] = { ...copy[rowIdx], [field]: urls };
      return copy;
    });
  };
  const storageKey = `rec_table_${recNo}_section_${sectionIndex}`;
  // Filter out short file-related field names only (not descriptive fields)
  const displayFields = fields.filter(f => {
    const lower = String(f).toLowerCase().trim();
    // Only filter out very short field names like "photo", "video", "file", "pdf", "upload"
    const shortFileFields = ['photo', 'video', 'file', 'pdf', 'upload'];
    return !shortFileFields.includes(lower);
  });

  const [rows, setRows] = useState([]);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    // Initialize rows from passed fields if empty
    if (fields && rows.length === 0) {
      const emptyRows = [];
      for (let i = 0; i < 2; i++) {
        const obj = {};
        fields.forEach(f => { obj[f] = ''; });
        emptyRows.push(obj);
      }
      setRows(emptyRows);
    }
  }, [fields]);

  // Sync rows from localStorage as backup or initial load
  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v) setRows(JSON.parse(v));
    } catch (e) { }
  }, [storageKey]);

  useEffect(() => {
    try { const v = localStorage.getItem(storageKey); setRows(v ? JSON.parse(v) : []); } catch (e) { }
  }, [storageKey]);

  // autosave rows to localStorage when they change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch (e) { }
  }, [rows, storageKey]);

  const addRow = () => {
    const obj = {};
    displayFields.forEach(f => { obj[f] = ''; });
    setRows(r => [...r, obj]);
  };

  const updateCell = (rowIdx, field, value) => {
    setRows(r => {
      const copy = [...r];
      copy[rowIdx] = { ...copy[rowIdx], [field]: value };
      return copy;
    });
  };

  const handleCellFileChange = async (rowIdx, field, file) => {
    if (!file) {
      setRows(r => {
        const copy = [...r];
        copy[rowIdx] = { ...copy[rowIdx], [field]: '' };
        return copy;
      });
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5000/api/recs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      setRows(r => {
        const copy = [...r];
        copy[rowIdx] = { ...copy[rowIdx], [field]: res.data.fileName };
        return copy;
      });
    } catch (err) {
      alert('File upload failed');
    }
  };

  const removeRow = (rowIdx) => setRows(r => r.filter((_, i) => i !== rowIdx));



  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>Implementation Details</strong>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? '👁️ Hide History' : '👁️ Show History'}
        </button>
      </div>

      {showHistory && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered">
            <thead>
              <tr>
                {displayFields.map((f, i) => <th key={i}>{f}</th>)}
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={displayFields.length + 1} className="text-center text-muted">No rows yet. Use "Add Row" to create entries.</td>
                </tr>
              )}
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {displayFields.map((f, fi) => {
                    const lower = String(f).toLowerCase();
                    if (lower.includes('related photos/videos')) {
                      const urls = Array.isArray(row[f]) ? row[f] : (row[f] ? [row[f]] : []);
                      return (
                        <td key={fi}>
                          {urls.map((url, urlIdx) => (
                            <div key={urlIdx} className="d-flex align-items-center mb-1">
                              <input
                                type="text"
                                className="form-control me-1"
                                placeholder="Photo/Video URL"
                                value={url}
                                onChange={e => updatePhotoUrl(rIdx, f, urlIdx, e.target.value)}
                              />
                              <input
                                type="file"
                                accept="image/*,video/*"
                                className="form-control-file me-1"
                                style={{ width: 120 }}
                                onChange={async e => {
                                  const file = e.target.files && e.target.files[0];
                                  if (!file) return;
                                  try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    const token = localStorage.getItem('token');
                                    const res = await axios.post('http://localhost:5000/api/recs/upload', formData, {
                                      headers: {
                                        'Content-Type': 'multipart/form-data',
                                        'Authorization': `Bearer ${token}`
                                      }
                                    });
                                    updatePhotoUrl(rIdx, f, urlIdx, res.data.fileName);
                                  } catch (err) {
                                    alert('File upload failed');
                                  }
                                }}
                              />
                              {/* Show preview if image or video */}
                              {url && url.match(/\.(jpg|jpeg|png|gif)$/i) && (
                                <img src={`http://localhost:5000/uploads/${url}`} alt="Preview" style={{ maxWidth: 40, maxHeight: 30, marginLeft: 4, border: '1px solid #ccc' }} />
                              )}
                              {url && url.match(/\.(mp4|webm|ogg)$/i) && (
                                <video src={`http://localhost:5000/uploads/${url}`} controls style={{ maxWidth: 40, maxHeight: 30, marginLeft: 4, border: '1px solid #ccc' }} />
                              )}
                              <button
                                className="btn btn-outline-danger btn-sm"
                                style={{ marginLeft: 2 }}
                                onClick={() => removePhotoUrl(rIdx, f, urlIdx)}
                                title="Remove Photo"
                              >
                                &times;
                              </button>
                              {urlIdx === urls.length - 1 && (
                                <button
                                  className="btn btn-outline-success btn-sm"
                                  style={{ marginLeft: 2 }}
                                  onClick={() => addPhotoUrl(rIdx, f)}
                                  title="Add Photo"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          ))}
                          {urls.length === 0 && (
                            <button
                              className="btn btn-outline-success btn-sm"
                              onClick={() => addPhotoUrl(rIdx, f)}
                              title="Add Photo"
                            >
                              +
                            </button>
                          )}
                        </td>
                      );
                    } else if (lower.includes('date')) {
                      return (
                        <td key={fi}>
                          <input type="date" className="form-control" value={row[f] || ''} onChange={e => updateCell(rIdx, f, e.target.value)} />
                        </td>
                      );
                    } else if (lower.includes('photo') || lower.includes('upload') || lower.includes('file')) {
                      return (
                        <td key={fi}>
                          {row[f] && row[f].toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? (
                            <img src={`http://localhost:5000/uploads/${row[f]}`} alt="Uploaded" style={{ maxWidth: 200 }} />
                          ) : (
                            <input type="file" accept="image/*,video/*,application/pdf" className="form-control" value="" onChange={e => handleCellFileChange(rIdx, f, e.target.files && e.target.files[0])} />
                          )}
                        </td>
                      );
                    } else {
                      return (
                        <td key={fi}>
                          <textarea className="form-control" rows={3} value={row[f] || ''} onChange={e => updateCell(rIdx, f, e.target.value)} />
                        </td>
                      );
                    }
                  })}
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => removeRow(rIdx)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2">
        <button className="btn btn-success btn-sm" onClick={addRow}>Add Row</button>
      </div>
    </div>
  );
}

// Removed local constants, imported from recommendationUtils instead

function RecommendationForm({ rec, onBack }) {
  // Get logged-in user from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  // Always use user's state/org/ministry/UT for Actioned By
  const getUserDisplay = () => {
    // Try common keys for state/org/ministry/UT
    return (
      user?.name ||
      user?.state ||
      user?.organization ||
      user?.ministry ||
      user?.unionTerritory ||
      user?.username ||
      user?.officerName ||
      ''
    );
  };
  const [actionedBy, setActionedBy] = useState(getUserDisplay());
  const [formData, setFormData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`rec_form_${rec.recNo}`)) || {}; } catch (e) { return {}; }
  });
  const [filesMeta, setFilesMeta] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`rec_files_${rec.recNo}`)) || {}; } catch (e) { return {}; }
  });
  const [frequency, setFrequency] = useState('Monthly');
  const [period, setPeriod] = useState('');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const quarters = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
  const years = [new Date().getFullYear().toString()];

  const officerOptions = useMemo(() => {
    if (!rec || !rec.actionedBy) return [...ALL_STATES, ...ALL_UTS];
    let rawTokens = rec.actionedBy.split(',').map(s => s.trim());
    let expanded = rawTokens.flatMap(t => expandOfficerToken(t) || []);
    let unique = [...new Set(expanded)].filter(Boolean);
    return unique.length > 0 ? unique : [...ALL_STATES, ...ALL_UTS];
  }, [rec.actionedBy]);

  useEffect(() => {
    // Only set from officerOptions if no logged-in user info at all
    if (!getUserDisplay()) {
      if (officerOptions.length > 0) {
        setActionedBy(officerOptions[0]);
      }
    } else {
      setActionedBy(getUserDisplay());
    }
  }, [officerOptions, user]);

  const handleFieldChange = (sectionIdx, fieldName, value) => {
    setFormData(d => {
      const copy = { ...d };
      copy[sectionIdx] = { ...(copy[sectionIdx] || {}) };
      copy[sectionIdx][fieldName] = value;
      return copy;
    });
  };

  const handleFileChange = (key, file) => {
    setFilesMeta(m => {
      const copy = { ...m };
      // If file is a string (filename) or array (filenames), use it directly.
      // If it's a File object (not likely here as it's called after upload), use .name.
      if (typeof file === 'string' || Array.isArray(file)) {
        copy[key] = file;
      } else if (file && file.name) {
        copy[key] = file.name;
      } else {
        copy[key] = null;
      }
      return copy;
    });
  };

  const saveForm = async () => {
    try {
      // Save locally as backup
      localStorage.setItem(`rec_form_${rec.recNo}`, JSON.stringify(formData));
      localStorage.setItem(`rec_files_${rec.recNo}`, JSON.stringify(filesMeta));
      localStorage.setItem(`rec_actionedby_${rec.recNo}`, actionedBy);

      // Fetch existing data to properly append
      let existingData = {};
      try {
        const token = localStorage.getItem('token');
        if (!token || token === 'null' || token === 'undefined') {
          alert('Session expired. Please login again.');
          navigate('/login');
          return;
        }
        const res = await axios.get(`http://localhost:5000/api/recs/recommendation/${rec.id}`, { headers: { Authorization: `Bearer ${token}` } });
        existingData = res.data?.data || {};
      } catch (err) {
        console.warn('No existing data or fetch failed, creating new record.');
      }

      // Create a new History Row combining the form fields + Required Documents
      const newHistoryRow = {
        Period: period || '',
        Frequency: frequency || 'Monthly',
        "Signed Copy": filesMeta.doc_2 || '',
        "Uploaded At": new Date().toLocaleString(),
        "Implementation Details": filesMeta.doc_0 || '',
        "Related photos/videos": filesMeta.doc_1 || [],
        "Submitted By": actionedBy || 'Unknown'
      };

      const existingTableEntries = Array.isArray(existingData.tableEntries) ? existingData.tableEntries : [];
      let updatedTableEntries = [];
      const hasAnyInput = newHistoryRow.Period || newHistoryRow["Signed Copy"] || newHistoryRow["Implementation Details"] || (newHistoryRow["Related photos/videos"] && newHistoryRow["Related photos/videos"].length > 0);

      // Only append if they actually filled something in
      if (hasAnyInput) {
        updatedTableEntries = [...existingTableEntries, newHistoryRow];
      } else {
        updatedTableEntries = existingTableEntries;
      }

      // Merge filesMeta for the flat list at the bottom of the modal
      const updatedFilesMeta = existingData.filesMeta ? { ...existingData.filesMeta } : {};
      Object.keys(filesMeta).forEach(key => {
        if (Array.isArray(filesMeta[key]) && filesMeta[key].length > 0) {
          updatedFilesMeta[key] = [...(updatedFilesMeta[key] || []), ...filesMeta[key]];
        } else if (filesMeta[key] && !Array.isArray(filesMeta[key])) {
          const prev = updatedFilesMeta[key];
          if (Array.isArray(prev)) {
            updatedFilesMeta[key] = [...prev, filesMeta[key]];
          } else if (prev && prev !== filesMeta[key]) {
            updatedFilesMeta[key] = [prev, filesMeta[key]];
          } else {
            updatedFilesMeta[key] = [filesMeta[key]];
          }
        }
      });

      const hasFiles = Object.keys(updatedFilesMeta).length > 0;
      const payload = {
        status: (updatedTableEntries.length > 0 || hasFiles) ? 'Completed' : 'Pending',
        details: `Last updated by: ${actionedBy}`,
        data: {
          formData: { ...existingData.formData, ...formData },
          filesMeta: updatedFilesMeta,
          tableEntries: updatedTableEntries,
          updatedAt: new Date().toISOString()
        },
        last_updated_by: actionedBy
      };

      const token = localStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        alert('Session expired. Please login again.');
        navigate('/login');
        return;
      }
      await axios.post(`http://localhost:5000/api/recs/update/${rec.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });

      alert('Successfully synced with Admin Dashboard');

      // Clear localStorage for this recommendation (Auto-Hide/Clear Data)
      localStorage.removeItem(`rec_form_${rec.recNo}`);
      localStorage.removeItem(`rec_files_${rec.recNo}`);
      localStorage.removeItem(`rec_table_${rec.recNo}_section_0`);

      // Auto-Hide the form by returning to the dashboard list
      onBack();
    } catch (e) {
      console.error(e);
      alert('Save failed or server unreachable');
    }
  };

  const downloadForm = (recNo) => {
    try {
      const savedData = localStorage.getItem(`rec_form_${recNo}`);
      const savedFiles = localStorage.getItem(`rec_files_${recNo}`);
      const savedActionedBy = localStorage.getItem(`rec_actionedby_${recNo}`);

      const data = {
        recNo,
        recommendation: rec.recommendation,
        actionedBy: savedActionedBy || actionedBy,
        formData: JSON.parse(savedData || '{}'),
        filesMeta: JSON.parse(savedFiles || '{}'),
        downloadedAt: new Date().toISOString()
      };

      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recommendation_${recNo}_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) { alert('Download failed'); }
  };



  const documentFields = rec.documentFields || [
    { field: "Upload Word Document", type: "file", accept: ".doc,.docx" },
    { field: "Upload Photos or Videos", type: "file", accept: "image/*,video/*", multiple: true },
    { field: "Upload Signed Copy", type: "file", accept: ".pdf,image/*" }
  ];

  return (
    <div className="recommendation-form-portrait">
      <div className="card mb-3 form-header-card">
        <div className="card-body">
          <h5 className="form-title mb-0">Recommendation {rec.recNo} - Implementation Report</h5>
        </div>
      </div>

      <div className="card mb-3 form-meta-card">
        <div className="card-body">
          <div className="row mb-2 form-stack-row">
            <div className="col-md-4">
              <label className="form-label"><strong>Frequency</strong></label>
              <select className="form-select" value={frequency} onChange={e => { setFrequency(e.target.value); setPeriod(''); }}>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label"><strong>Period</strong></label>
              <select className="form-select" value={period} onChange={e => setPeriod(e.target.value)}>
                <option value="">-- Select Period --</option>
                {frequency === 'Monthly' && months.map(m => <option key={m} value={m}>{m}</option>)}
                {frequency === 'Quarterly' && quarters.map(q => <option key={q} value={q}>{q}</option>)}
                {frequency === 'Yearly' && years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label"><strong>Actioned By / Officer</strong></label>
              <input
                className="form-control shadow-sm"
                value={actionedBy}
                readOnly
                style={{ background: '#f8fafc', color: '#475569' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-3 form-docs-card">
        <div className="card-body">
          <h6 className="docs-title mb-3 border-bottom pb-2 text-dark fw-bold">Required Documents</h6>
          <div className="row align-items-start docs-grid-row">
            {documentFields.map((field, idx) => {
              const fileKey = `doc_${idx}`;
              const isMultiple = field.multiple;
              const currentFiles = filesMeta[fileKey] || (isMultiple ? [] : null);
              return (
                <div key={idx} className="col-md-4 mb-3 doc-upload-item">
                  <label className="form-label mb-1" style={{ fontSize: '0.9rem' }}>
                    <strong>{isMultiple ? field.field.replace('Upload Photos', 'Upload Photos or Videos') : field.field} {field.field.toLowerCase().includes('signed') && <span className="text-danger">* (Must)</span>}</strong>
                  </label>
                  <input
                    type="file"
                    accept={isMultiple ? 'image/*,video/*' : field.accept}
                    multiple={isMultiple}
                    className="form-control form-control-sm mb-2 shadow-sm"
                    onChange={async e => {
                      if (!e.target.files?.length) return;
                      try {
                        if (isMultiple) {
                          const uploadedNames = [];
                          for (let i = 0; i < e.target.files.length; i++) {
                            const singleForm = new FormData();
                            singleForm.append('file', e.target.files[i]);
                            const res = await axios.post('http://localhost:5000/api/recs/upload', singleForm);
                            uploadedNames.push(res.data.fileName);
                          }
                          const existing = Array.isArray(currentFiles) ? currentFiles : [];
                          handleFileChange(fileKey, [...existing, ...uploadedNames]);
                        } else {
                          const formData = new FormData();
                          formData.append('file', e.target.files[0]);
                          const res = await axios.post('http://localhost:5000/api/recs/upload', formData);
                          handleFileChange(fileKey, res.data.fileName);
                        }
                      } catch (err) {
                        alert('File upload failed');
                      }
                    }}
                  />
                  {/* Display uploaded files */}
                  <div className="mt-1">
                    {isMultiple && Array.isArray(currentFiles) && currentFiles.length > 0 && (
                      <div className="bg-light p-2 rounded border border-light shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="small fw-semibold text-muted" style={{ fontSize: '0.8rem' }}>
                            {currentFiles.length} file{currentFiles.length > 1 ? 's' : ''} uploaded
                          </span>
                          <button className="btn btn-outline-danger btn-sm py-0 px-2" style={{ fontSize: '0.7rem' }} onClick={() => handleFileChange(fileKey, [])}>Clear all</button>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {currentFiles.map((f, i) => (
                            <div key={i} className="position-relative shadow-sm" style={{ display: 'inline-block' }}>
                              {f.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img src={`http://localhost:5000/uploads/${f}`} alt={`Photo ${i + 1}`} style={{ height: 60, width: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd', display: 'block' }} />                                ) : f.match(/\.(mp4|mov|avi|webm|mkv|wmv|3gp)$/i) ? (
                                  <video src={`http://localhost:5000/uploads/${f}`} style={{ height: 60, width: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd', display: 'block' }} />                              ) : (
                                <div className="badge bg-secondary p-2 d-flex align-items-center justify-content-center" style={{ fontSize: '0.65rem', height: 60, width: 60, whiteSpace: 'normal', overflow: 'hidden' }}>{f.slice(0, 10)}...</div>
                              )}
                              <button
                                className="btn btn-danger btn-sm position-absolute top-0 end-0 rounded-circle shadow"
                                style={{ padding: '0', width: '20px', height: '20px', transform: 'translate(40%, -40%)', lineHeight: 1, fontSize: '0.7rem' }}
                                onClick={() => {
                                  const newFiles = currentFiles.filter((_, index) => index !== i);
                                  handleFileChange(fileKey, newFiles);
                                }}
                              >×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!isMultiple && typeof currentFiles === 'string' && currentFiles !== '' && (
                      <div className="d-flex align-items-start gap-2 bg-light p-2 rounded border border-light shadow-sm mt-1">
                        {currentFiles.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <div className="position-relative shadow-sm" style={{ display: 'inline-block' }}>
                            <img src={`http://localhost:5000/uploads/${currentFiles}`} alt="Uploaded" style={{ height: 60, width: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd', display: 'block' }} />
                            <button
                              className="btn btn-danger btn-sm position-absolute top-0 end-0 rounded-circle shadow"
                              style={{ padding: '0', width: '20px', height: '20px', transform: 'translate(40%, -40%)', lineHeight: 1, fontSize: '0.7rem' }}
                              onClick={() => handleFileChange(fileKey, null)}
                            >×</button>
                          </div>
                        ) : (
                          <>
                            <div className="text-success small fw-semibold text-truncate" style={{ maxWidth: '75%', fontSize: '0.8rem', lineHeight: '1.2' }} title={currentFiles}>
                              ✓ {currentFiles}
                            </div>
                            <button className="btn btn-outline-danger btn-sm py-0 px-2 ms-auto" style={{ fontSize: '0.7rem' }} onClick={() => handleFileChange(fileKey, null)}>Remove</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 form-action-row">
        <button className="btn btn-success btn-save-action" onClick={saveForm}>Save</button>
        <button className="btn btn-secondary btn-back-action" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
