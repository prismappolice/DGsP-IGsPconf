import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css'; // Add CSS import

function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // Start at user selection step
  const [userType, setUserType] = useState(null); // 'user' or 'admin'
  const [userId, setUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const states = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];

  const unionTerritories = [
    'Andaman and Nicobar Islands', 'Chandigarh', 
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  const organizations = [
    'AAI', 'Assam Rifles', 'BCAS', 'BPR&D', 'BSF', 'CAPFs', 'CAPFs/CPOs',
    'CBDT', 'CBI', 'CISF', 'CPOs', 'DGs of CAPFs/CPOs', 'ED', 'FIU-IND',
    'FS CD & HG', 'I4C', 'IB', 'ITBP', 'NATGRID', 'NCB', 'NCRB', 'NDRF',
    'NFSU', 'NIA', 'NTRO', 'R&AW', 'SSB', 'SVPNPA'
  ];

  const ministries = [
    'MEA', 'MHA', 'MOD', 'MoF', 'MORTH', 'MeitY',
    'Ministry of Corporate Affairs', 'Ministry of Education',
    'Ministry of Finance', 'Ministry of Health & Family Welfare',
    'Ministry of I&B', 'Ministry of Labour', 'Ministry of Law & Justice',
    'Ministry of Ports, Shipping & Waterways',
    'Ministry of Social Justice & Empowerment', 'Ministry of Tourism',
    'Ministry of Tribal Affairs', 'Ministry of Women & Child Development',
    'Ministry of Youth Affairs & Sports'
  ];


  const generateCaptcha = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleAdminLogin = async () => {
    if (!userId) {
      setError('Please enter Username');
      return;
    }
    if (!password) {
      setError('Please enter Password');
      return;
    }
    try {
      setError('');
      const response = await axios.post('/api/auth/admin-login', {
        username: userId.trim(),
        password: password
      });
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);
    }
  };

  const handleContinueToOtp = async () => {
    if (!userId) {
      setError('Please enter User ID');
      return;
    }

    try {
      setError('');
      const enteredUserId = userId.trim();
      const res = await axios.post('/api/auth/send-otp', { userId: enteredUserId });

      const newCaptcha = generateCaptcha();
      setCaptcha(newCaptcha);
      setCaptchaInput('');
      setMaskedMobile(res.data?.maskedMobile || '******');
      setOtp('');
      setStep(3);
      setResendTimer(300);
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to send OTP. Please check User ID.';
      setError(msg);
    }
  };

  const handleSubmitOtp = async () => {
    if (!otp) {
      setError('Please enter OTP');
      return;
    }
    if (!captchaInput) {
      setError('Please enter CAPTCHA');
      return;
    }
    if (captchaInput !== captcha) {
      setError('CAPTCHA is incorrect');
      return;
    }

    try {
      await axios.post('/api/auth/verify-otp', { userId: userId.trim(), otp: otp.trim() });
      setStep(4);
      setError('');
    } catch (err) {
      const msg = err.response?.data?.message || 'OTP verification failed';
      setError(msg);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setError('Please enter password');
      return;
    }
    try {
      const response = await axios.post('/api/auth/login', {
        email: userId,
        password: password,
        captchaToken: captchaInput, // or whatever variable holds your CAPTCHA value
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    }
  };

  const handleReset = () => {
    setUserId('');
    setSearchTerm('');
    setPassword('');
    setOtp('');
    setCaptchaInput('');
    setError('');
    setStep(1);
    setUserType(null);
  };

  const handleRefreshCaptcha = () => {
    const newCaptcha = generateCaptcha();
    setCaptcha(newCaptcha);
    setCaptchaInput('');
  };

  const handleResendOtp = async () => {
    if (resendTimer !== 0) return;

    try {
      await axios.post('/api/auth/send-otp', { userId: userId.trim() });
      setOtp('');
      setCaptchaInput('');
      const newCaptcha = generateCaptcha();
      setCaptcha(newCaptcha);
      setResendTimer(300);
      setError('OTP resent successfully');
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to resend OTP';
      setError(msg);
    }
  };

  // Countdown timer
  React.useEffect(() => {
    let interval;
    if (resendTimer > 0 && step === 3) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer, step]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="login-page-container">
      <div className="login-card-wrapper">
        
        {/* Left Information Panel */}
        <div className="login-info-panel">
          <div className="info-brand">
            <h2>DGsP / IGsP Conference Portal</h2>
            <p>Director General of Police / Inspector General of Police Conference Management System</p>
          </div>
          
          <div className="info-section">
            <span className="info-label">VISION</span>
            <p className="info-text">
              To coordinate and facilitate State and Central Police Agencies in conducting effective conferences on law enforcement and public safety.
            </p>
          </div>

          <div className="info-section">
            <span className="info-label">MISSION</span>
            <p className="info-text">
              To implement recommendations from conferences, monitor progress, facilitate coordination between central and state police, and ensure effective policy decisions across all states and union territories.
            </p>
          </div>

          <p className="info-disclaimer">
            This portal is exclusively for authorized police officers and government officials. Unauthorized access is prohibited. All activities are monitored and logged.
          </p>
        </div>

        {/* Right Login Form Panel */}
        <div className="login-form-panel">
          <div className="login-form-header">
            <h2>Welcome Back</h2>
            <p>Please enter your credentials to securely login</p>
          </div>

          {error && (
            <div className="alert-error">
              ⚠️ {error}
            </div>
          )}

          {/* STEP 1: User Type Selection */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="login-selection-grid">
                <div 
                  className="selection-card" 
                  onClick={() => { setUserType('State'); setStep(2); }}
                >
                  <div className="selection-icon">🏛️</div>
                  <div className="selection-content">
                    <h3>States</h3>
                    <p>State-level police department login.</p>
                  </div>
                </div>

                <div 
                  className="selection-card" 
                  onClick={() => { setUserType('Organization'); setStep(2); }}
                >
                  <div className="selection-icon">🏢</div>
                  <div className="selection-content">
                    <h3>Organizations</h3>
                    <p>Central police organization login.</p>
                  </div>
                </div>

                <div 
                  className="selection-card" 
                  onClick={() => { setUserType('UT'); setStep(2); }}
                >
                  <div className="selection-icon">🗺️</div>
                  <div className="selection-content">
                    <h3>Union Territories</h3>
                    <p>UT police department login.</p>
                  </div>
                </div>

                <div 
                  className="selection-card" 
                  onClick={() => { setUserType('Ministry'); setStep(2); }}
                >
                  <div className="selection-icon">📂</div>
                  <div className="selection-content">
                    <h3>Ministries</h3>
                    <p>Central Ministry login.</p>
                  </div>
                </div>

                <div 
                  className="selection-card admin-variant" 
                  onClick={() => { setUserType('admin'); setStep(2); }}
                >
                  <div className="selection-icon">🛡️</div>
                  <div className="selection-content">
                    <h3>Admin Login</h3>
                    <p>System administrator login.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Unified Entity Selection */}
          {step === 2 && userType !== 'admin' && (
            <div className="animate-fade-in">
              <div className="step-badge">
                {`👮‍♂️ SELECT ${userType.toUpperCase()}`}
              </div>
              
              <div className="form-group">
                <label>{`${userType} User ID`}</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter your assigned user ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContinueToOtp()}
                  autoFocus
                />
                <button className="btn-primary" onClick={handleContinueToOtp} style={{ marginTop: '20px' }}>
                  Continue to OTP
                </button>
              </div>
              
              <button className="btn-secondary" onClick={() => { setStep(1); setSearchTerm(''); }} style={{ marginTop: '10px' }}>
                Back to Categories
              </button>
            </div>
          )}

          {/* STEP 2 Admin: Username + Password, no OTP */}
          {step === 2 && userType === 'admin' && (
            <div className="animate-fade-in">
              <div className="step-badge">🛡️ Administrator Mode</div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter admin username"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                />
              </div>

              <button className="btn-primary" onClick={handleAdminLogin} style={{ marginTop: '10px' }}>
                Login
              </button>
              <button className="btn-secondary" onClick={() => { setStep(1); setSearchTerm(''); setUserId(''); setPassword(''); }} style={{ marginTop: '10px' }}>
                Back to Categories
              </button>
            </div>
          )}

          {/* STEP 3: OTP & CAPTCHA */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div className="otp-sent-info">
                <span>An OTP has been sent securely to:</span>
                <strong>📱 {maskedMobile}</strong>
                <strong>🆔 {userId}</strong>
              </div>

              <div className="form-group">
                <label>One Time Password (OTP)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>

              <div className="resend-timer">
                {resendTimer > 0 ? (
                  <span>Resend OTP in <strong>{formatTime(resendTimer)}</strong></span>
                ) : (
                  <span className="resend-link" onClick={handleResendOtp}>Resend OTP Now</span>
                )}
              </div>

              <div className="form-group">
                <label>Verification Code</label>
                <div className="captcha-section">
                  <div className="captcha-display">{captcha}</div>
                  <button className="captcha-refresh-btn" onClick={handleRefreshCaptcha} title="Refresh CAPTCHA">
                    ↻
                  </button>
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type the code from above"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitOtp()}
                />
              </div>

              <button className="btn-primary" onClick={handleSubmitOtp}>
                Verify OTP & Continue
              </button>
              <button className="btn-secondary" onClick={handleReset}>
                Back to User ID
              </button>
            </div>
          )}

          {/* STEP 4: Password */}
          {step === 4 && (
            <div className="animate-fade-in">
              <div className="form-group">
                <label>Verified User ID</label>
                <input
                  type="text"
                  className="form-control user-id-display"
                  value={userId}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter your secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              <button className="btn-primary" onClick={handleLogin}>
                Secure Login
              </button>
              <button className="btn-secondary" onClick={handleReset}>
                Cancel Route
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
