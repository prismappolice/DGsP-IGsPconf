import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import AdminDashboard from './components/AdminDashboard';
import AdminAllocation from './components/AdminAllocation';
import SummaryDashboard from './components/SummaryDashboard';
import ModelOfficeTemplate from './components/ModelOfficeTemplate';
import AdminUserManagement from './components/AdminUserManagement';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f2f4f7' }}>
        <Header />
        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          <Sidebar />
        <div style={{ 
            flex: 1, 
            position: 'relative',
            background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
            marginLeft: '260px'
          }}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/dispatch" element={<AdminAllocation />} />
              <Route path="/admin/summary" element={<SummaryDashboard />} />
              <Route path="/admin/users" element={<AdminUserManagement />} />
              <Route path="/model-office-template" element={<ModelOfficeTemplate />} />
            </Routes>
          </div>
        </div>
        <Footer />
      </div>
    </Router>
  );
}

export default App;