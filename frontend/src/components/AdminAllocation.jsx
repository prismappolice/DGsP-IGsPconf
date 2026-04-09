import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './AdminDashboard.css'; // Use common admin styles
import './AdminAllocation.css';

import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getAssignedUsers } from '../utils/recommendationUtils';

// Path to the template in public folder
const MODEL_OFFICER_TEMPLATE_URL = "/templates/model-officer-template-recommendation-1.docx";

const AdminAllocation = () => {
  // Get user role from localStorage (declare only once)
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ department: '', rec_ids: '' });
  const [recommendations, setRecommendations] = useState([]);
  const [recSearch, setRecSearch] = useState('');
  const [editingRecId, setEditingRecId] = useState(null);
  const [recFormData, setRecFormData] = useState({ recommendation: '', actionedBy: '', category: 'Immediately Actionable' });
  const [viewMode, setViewMode] = useState('allocations'); // 'allocations' or 'properties'
  const [isAddingRec, setIsAddingRec] = useState(false);
  const navigate = useNavigate();

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  // For history modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [historyRows, setHistoryRows] = useState([]);
  const [historyRec, setHistoryRec] = useState(null);

  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    // If not admin, redirect or show message? 
    // Usually admin pages should be protected.
    if (!isAdmin && user.role) {
      // navigate('/dashboard'); // Optional: redirect non-admins
    }
  }, [isAdmin, user.role, navigate]);

  const fetchAllocations = async () => {
    try {
      const res = await axios.get('/api/recs/allocations', getAuthConfig());
      setAllocations(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching allocations:', err);
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await axios.get('/api/recs/recommendations', config);
      setRecommendations(res.data);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
  };

  useEffect(() => {
    fetchAllocations();
    fetchRecommendations();
  }, []);

  const handleEdit = (alloc) => {
    if (!isAdmin) return;
    setEditingId(alloc._id);
    setEditFormData({
      department: alloc.department,
      rec_ids: [...alloc.rec_ids].sort((a, b) => a - b).join(', ')
    });
  };

  const handleSave = async () => {
    if (!isAdmin) {
      alert('Only admin can edit assignments.');
      return;
    }
    try {
      const payload = {
        department: editFormData.department,
        rec_ids: editFormData.rec_ids.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)).sort((a, b) => a - b),
        month: '2025 Conference'
      };
      
      if (editingId && editingId !== 'new') {
        await axios.put(`/api/recs/allocations/${editingId}`, payload, getAuthConfig());
      } else {
        await axios.post('/api/recs/allocations', payload, getAuthConfig());
      }
      
      setEditingId(null);
      fetchAllocations();
    } catch (err) {
      alert('Failed to save allocation');
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) {
      alert('Only admin can delete assignments.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this allocation?')) return;
    try {
      await axios.delete(`/api/recs/allocations/${id}`, getAuthConfig());
      fetchAllocations();
    } catch (err) {
      alert('Failed to delete allocation');
    }
  };

  const addNewAllocation = () => {
    if (!isAdmin) return;
    setEditingId('new');
    setEditFormData({ department: '', rec_ids: '' });
  };

  const handleEditRec = (rec) => {
    if (!isAdmin) return;
    setEditingRecId(rec.id);
    setRecFormData({
      recommendation: rec.recommendation || '',
      actionedBy: rec.actionedBy || '',
      category: rec.category || ''
    });
  };

  const handleUpdateRec = async (id) => {
    if (!isAdmin) {
      alert('Only admin can update recommendation properties.');
      return;
    }
    try {
      await axios.post(`/api/recs/update-json/${id}`, recFormData, getAuthConfig());
      setEditingRecId(null);
      fetchRecommendations();
      alert('Recommendation updated successfully');
    } catch (err) {
      alert('Failed to update recommendation');
    }
  };

  const handleAddRec = async () => {
    if (!isAdmin) {
      alert('Only admin can add recommendations.');
      return;
    }
    if (!recFormData.recommendation) {
      alert('Recommendation text is required');
      return;
    }
    try {
      await axios.post('/api/recs/recommendations', recFormData, getAuthConfig());
      setIsAddingRec(false);
      setRecFormData({ recommendation: '', actionedBy: '', category: 'Immediately Actionable' });
      fetchRecommendations();
      alert('New recommendation added successfully');
    } catch (err) {
      alert(`Failed to add recommendation: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteRec = async (id) => {
    if (!isAdmin) {
      alert('Only admin can delete recommendations.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this recommendation? This will remove it from the master list.')) return;
    try {
      await axios.delete(`/api/recs/recommendation/${id}`, getAuthConfig());
      fetchRecommendations();
      alert('Recommendation deleted successfully');
    } catch (err) {
      alert('Failed to delete recommendation');
    }
  };

  const filteredRecs = recommendations.filter(r => 
    String(r.recNo).includes(recSearch) || 
    (r.recommendation && r.recommendation.toLowerCase().includes(recSearch.toLowerCase())) ||
    (r.actionedBy && r.actionedBy.toLowerCase().includes(recSearch.toLowerCase()))
  );


  // Remove navigation for View Details; only open modal
  const handleRecClick = (recNo) => {
    navigate(`/dashboard?selectRec=${recNo}`);
  };

  // Show history modal for a recommendation
  const handleViewDetails = async (recId) => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    setHistoryRows([]);
    setHistoryRec(null);

    try {
      // Find rec object
      const rec = recommendations.find(r => r.id === recId || r.recNo === recId);
      setHistoryRec(rec);
      // Try to fetch latest from backend (if available)
      const res = await axios.get(`/api/recs/recommendation/${recId}`);
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
    link.setAttribute("download", `Rec_${historyRec?.id || 'Details'}_history.csv`);
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
        const url = `/uploads/${filename}`;
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

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (

    <div className="admin-allocation-wrapper">
      <main className="admin-allocation-main">
        <div className="container-fluid">
          <div className="d-flex align-items-center mb-4 mt-2 p-3 bg-white shadow-sm rounded justify-content-between">
            <h4 className="m-0 text-dark fw-bold">Admin Dispatch Control</h4>
            <a
              href={MODEL_OFFICER_TEMPLATE_URL}
              download
              className="btn btn-success ms-3"
              style={{ whiteSpace: 'nowrap' }}
            >
              Download Model Officer Word Template
            </a>
          </div>

          <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="btn-group shadow-sm">
            <button 
              className={`btn ${viewMode === 'allocations' ? 'btn-primary' : 'btn-outline-primary'}`} 
              onClick={() => setViewMode('allocations')}
            >
              Recommendation Assigned
            </button>
            {isAdmin && (
              <button 
                className={`btn ${viewMode === 'properties' ? 'btn-primary' : 'btn-outline-primary'}`} 
                onClick={() => setViewMode('properties')}
              >
                Manage Recommendation Properties
              </button>
            )}
          </div>
          <div className="actions-right">
            {isAdmin && viewMode === 'allocations' && (
              <button className="btn btn-primary me-2 shadow-sm" onClick={addNewAllocation}>+ New Assignment</button>
            )}
            <Link to="/admin" className="btn btn-secondary shadow-sm">Back to Dashboard</Link>
          </div>
        </div>

        {viewMode === 'allocations' ? (
          <div className="table-wrapper bg-white shadow-sm rounded">
            <table className="table conference-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S.No</th>
                  <th style={{ width: '350px' }}>State / Organization</th>
                  <th>Recommendation Numbers</th>
                  <th style={{ width: '80px' }} className="text-center">Total</th>
                  <th style={{ width: '180px' }} className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc, index) => (
                  <tr key={alloc._id}>
                    <td className="text-center">{index + 1}</td>
                    <td>
                      {editingId === alloc._id ? (
                        <input 
                          className="form-control" 
                          value={editFormData.department} 
                          onChange={e => setEditFormData({...editFormData, department: e.target.value})} 
                        />
                      ) : (
                        <span className="officer-name">{alloc.department}</span>
                      )}
                    </td>
                    <td>
                      {editingId === alloc._id ? (
                        <input 
                          className="form-control" 
                          placeholder="Numbers separated by commas (e.g. 1, 2, 3)"
                          value={editFormData.rec_ids} 
                          onChange={e => setEditFormData({...editFormData, rec_ids: e.target.value})} 
                        />
                      ) : (
                        <div className="d-flex flex-wrap gap-2">
                          {[...alloc.rec_ids].sort((a, b) => a - b).map(id => (
                            <button 
                              key={id} 
                              className="btn btn-rec-badge"
                              onClick={() => handleRecClick(id)}
                            >
                              {id}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="badge bg-primary rounded-pill" style={{ fontSize: '0.85rem', padding: '5px 10px' }}>
                        {editingId === alloc._id
                          ? editFormData.rec_ids.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)).length
                          : alloc.rec_ids.length}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-2 justify-content-center">
                        {editingId === alloc._id ? (
                          <>
                            <button className="btn btn-success btn-sm" onClick={handleSave}>Save</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                          </>
                        ) : (
                          isAdmin ? (
                            <>
                              <button className="btn btn-outline-primary btn-sm" onClick={() => handleEdit(alloc)}>Edit</button>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(alloc._id)}>Delete</button>
                            </>
                          ) : (
                            <span className="text-muted small">Read only</span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {editingId === 'new' && (
                  <tr className="table-primary border-top border-primary">
                    <td className="text-center">*</td>
                    <td>
                      <input 
                        className="form-control" 
                        placeholder="Officer Name"
                        value={editFormData.department} 
                        onChange={e => setEditFormData({...editFormData, department: e.target.value})} 
                      />
                    </td>
                    <td>
                      <input 
                        className="form-control" 
                        placeholder="Rec numbers (1, 2, 3...)"
                        value={editFormData.rec_ids} 
                        onChange={e => setEditFormData({...editFormData, rec_ids: e.target.value})} 
                      />
                    </td>
                    <td className="text-center">
                      <span className="badge bg-secondary rounded-pill" style={{ fontSize: '0.85rem', padding: '5px 10px' }}>
                        {editFormData.rec_ids.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)).length}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-2 justify-content-center">
                        <button className="btn btn-success btn-sm" onClick={handleSave}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="properties-view pb-5">
            <div className="mb-4 d-flex justify-content-between align-items-center bg-white p-3 rounded shadow-sm">
               <input 
                 type="text" 
                 className="form-control w-50" 
                 placeholder="🔍 Search recommendations..." 
                 value={recSearch}
                 onChange={e => setRecSearch(e.target.value)}
               />
               {isAdmin && (
                 <button className="btn btn-primary" onClick={() => { setIsAddingRec(true); setEditingRecId(null); setRecFormData({ recommendation: '', actionedBy: '', category: 'Immediately Actionable' }); }}>
                   ➕ Add Recommendation
                 </button>
               )}
            </div>

            {isAdmin && isAddingRec && (
              <div className="card mb-4 shadow-sm border-primary">
                <div className="card-header bg-primary text-white">Add New Recommendation</div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-bold">Recommendation Details</label>
                      <textarea 
                        className="form-control" 
                        rows="3" 
                        value={recFormData.recommendation}
                        onChange={e => setRecFormData({...recFormData, recommendation: e.target.value})}
                        placeholder="Enter recommendation text..."
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold">Actioned By</label>
                      <input 
                        className="form-control" 
                        value={recFormData.actionedBy}
                        onChange={e => setRecFormData({...recFormData, actionedBy: e.target.value})}
                        placeholder="e.g. DGsP of States/UTs"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold">Category</label>
                      <select 
                        className="form-select" 
                        value={recFormData.category}
                        onChange={e => setRecFormData({...recFormData, category: e.target.value})}
                      >
                        <option value="Immediately Actionable">Immediately Actionable</option>
                        <option value="Drafting of guidelines, policies & regulations">Drafting of guidelines, policies & regulations</option>
                        <option value="Needs to be developed as a review or implementation framework">Needs to be developed as a review or implementation framework</option>
                        <option value="Can be converted to training modules">Can be converted to training modules</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-12 d-flex gap-2">
                      <button className="btn btn-success" onClick={handleAddRec}>Save Recommendation</button>
                      <button className="btn btn-secondary" onClick={() => setIsAddingRec(false)}>Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="table-wrapper bg-white shadow-sm rounded">
               <table className="table table-hover align-middle mb-0">
                 <thead className="table-light">
                   <tr>
                     <th style={{ width: '100px' }} className="text-center">Rec No</th>
                     <th>Recommendation Details</th>
                     <th style={{ width: '250px' }}>Actioned By</th>
                     <th style={{ width: '250px' }}>Category</th>
                     <th style={{ width: '120px' }} className="text-center">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                    {filteredRecs.slice(0, 50).map(rec => (
                     <tr key={rec.id}>
                       <td className="text-center"><strong>{rec.recNo}</strong></td>
                       <td>
                         {editingRecId === rec.id ? (
                           <textarea 
                             className="form-control form-control-sm" 
                             rows="4"
                             value={recFormData.recommendation} 
                             onChange={e => setRecFormData({...recFormData, recommendation: e.target.value})} 
                           />
                         ) : (
                           <div className="rec-text-preview">
                             {rec.recommendation}
                           </div>
                         )}
                       </td>
                       <td>
                         {editingRecId === rec.id ? (
                           <textarea 
                             className="form-control form-control-sm" 
                             rows="3"
                             value={recFormData.actionedBy} 
                             onChange={e => setRecFormData({...recFormData, actionedBy: e.target.value})} 
                           />
                         ) : (
                           <span className="text-wrap d-block" style={{ fontSize: '0.85rem' }}>{rec.actionedBy}</span>
                         )}
                       </td>
                       <td>
                         {editingRecId === rec.id ? (
                           <select 
                             className="form-select form-select-sm" 
                             value={recFormData.category} 
                             onChange={e => setRecFormData({...recFormData, category: e.target.value})}
                           >
                             <option value="Immediately Actionable">Immediately Actionable</option>
                             <option value="Drafting of guidelines, policies & regulations">Drafting of guidelines, policies & regulations</option>
                             <option value="Needs to be developed as a review or implementation framework">Needs to be developed as a review or implementation framework</option>
                             <option value="Can be converted to training modules">Can be converted to training modules</option>
                             <option value="Other">Other</option>
                           </select>
                         ) : (
                           <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1" style={{ fontSize: '0.75rem', whiteSpace: 'normal' }}>
                             {rec.category}
                           </span>
                         )}
                       </td>
                       <td>
                         <div className="d-flex flex-column gap-1 align-items-center">
                           {editingRecId === rec.id ? (
                             <>
                               <button className="btn btn-success btn-xs w-100" onClick={() => handleUpdateRec(rec.id)}>Update</button>
                               <button className="btn btn-secondary btn-xs w-100" onClick={() => setEditingRecId(null)}>Cancel</button>
                             </>
                           ) : (
                             <>
                               {isAdmin && <button className="btn btn-outline-primary btn-xs px-3" onClick={() => handleEditRec(rec)}>Edit</button>}
                               <button className="btn btn-link btn-xs px-1 text-decoration-none" style={{fontSize:'0.8rem'}} onClick={() => handleViewDetails(rec.id)}>View Details</button>
                               {isAdmin && <button className="btn btn-outline-danger btn-xs px-3 mt-1" onClick={() => handleDeleteRec(rec.id)}>Delete</button>}
                             </>
                           )}
                         </div>
                       </td>
                     </tr>
                    ))}

                    {filteredRecs.length > 50 && (
                      <tr className="table-light">
                        <td colSpan="5" className="text-center text-muted py-3">
                          Showing top 50 matches. Refine your search to find specific items.
                        </td>
                      </tr>
                    )}
                 </tbody>
               </table>
            </div>
          </div>
        )}
        </div>

        {/* History Modal */}
        <Modal show={showHistoryModal} onHide={() => setShowHistoryModal(false)} size="xl" centered>
          <Modal.Header closeButton>
            <Modal.Title>Recommendation {historyRec ? historyRec.recNo : ''} Details</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{maxHeight:'80vh',overflowY:'auto'}}>
            {historyLoading ? (
              <div>Loading history...</div>
            ) : (
              <>
                {/* STATUS & DETAILS */}
                <div className="mb-4 d-flex gap-4">
                  <div>
                      <div className="text-secondary fw-bold small mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>STATUS</div>
                      <span className={`badge ${historyRec?.status === 'Completed' ? 'bg-success text-success' : 'bg-info text-primary'} bg-opacity-25 px-3 py-2 rounded-pill`} style={{ fontSize: '0.85rem' }}>
                        {historyRec?.status || 'In Progress'}
                      </span>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="text-secondary fw-bold small mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>DATA ENTERED / DETAILS</div>
                  <div className="border rounded p-2 text-dark bg-light shadow-sm" style={{ fontSize: '0.9rem' }}>
                      Last updated by: {historyRec?.last_updated_by || 'Unknown'}
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
                                  <a href={`/uploads/${row["Signed Copy"]}`} download className="btn btn-outline-success btn-sm py-1 px-2" style={{ fontSize: '0.75rem' }}>Download</a>
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
                                  <a href={`/uploads/${row["Implementation Details"]}`} download className="btn btn-outline-success btn-sm py-1 px-2" style={{ fontSize: '0.75rem' }}>Download</a>
                                </div>
                              ) : null}
                            </td>
                            <td>
                              {row["Related photos/videos"] && row["Related photos/videos"].length > 0 ? (
                                <div className="d-flex flex-column gap-2 align-items-start">
                                  {row["Related photos/videos"].map((photo, pIdx) => (
                                    <div key={pIdx} className="d-flex flex-column gap-1 align-items-start mb-2">
                                      <img src={`/uploads/${photo}`} alt="preview" className="shadow-sm" style={{ width: 50, height: 35, objectFit: 'cover', border: '1px solid #dee2e6' }} />
                                      <a href={`/uploads/${photo}`} download className="btn btn-outline-primary btn-sm py-1 px-2" style={{ fontSize: '0.75rem' }}>Download</a>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </td>
                            <td className="text-center">
                              <Button size="sm" variant="outline-primary" className="shadow-sm fw-bold d-flex flex-column align-items-center justify-content-center mx-auto" onClick={() => handleDownloadRowZip(row, historyRec?.recNo)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                                <span style={{ fontSize: '1.2rem', color: '#c38755' }}>📦</span>
                                <span>ZIP<br/>Download</span>
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
            <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Close</Button>
          </Modal.Footer>
        </Modal>
      </main>
    </div>
  );
};

export default AdminAllocation;
