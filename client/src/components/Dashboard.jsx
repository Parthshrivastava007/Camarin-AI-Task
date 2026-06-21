import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import axios from 'axios';
import {
  UploadCloud,
  FileImage,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Bell,
  User,
  LogOut,
  X,
  Eye,
  ShieldAlert,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  
  // Job list state
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  
  // Selected file for upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Detailed modal state
  const [selectedJob, setSelectedJob] = useState(null);
  
  // In-app notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifiedJobIds, setNotifiedJobIds] = useState(new Set());
  
  // Toast overlay states
  const [toasts, setToasts] = useState([]);

  // Drag and drop state
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const serverRoot = API_URL.replace('/api', '');

  // Add toast helper
  const addToast = (title, message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Fetch jobs from server
  const fetchJobs = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingJobs(true);
      const response = await axios.get('/jobs');
      const fetchedJobs = response.data;
      
      setJobs(fetchedJobs);
      
      // Process new notifications for flagged files
      fetchedJobs.forEach((job) => {
        if (job.results?.flagged && !notifiedJobIds.has(job.id)) {
          // Add to notified cache
          setNotifiedJobIds((prev) => new Set([...prev, job.id]));
          
          // Trigger system notification
          const msg = `Your upload '${job.originalName}' was flagged for ${job.results.flaggedCategory || 'content safety'}.`;
          addToast('Content Flagged', msg, 'error');
          
          // Append to persistent notification list
          setNotifications((prev) => [
            {
              id: job.id,
              title: 'Upload Flagged',
              desc: msg,
              time: new Date(job.updatedAt).toLocaleTimeString(),
              type: 'danger',
            },
            ...prev,
          ]);
        }
      });
    } catch (err) {
      console.error('Error fetching jobs:', err);
      if (!isSilent) addToast('Error', 'Failed to retrieve jobs history', 'error');
    } finally {
      if (!isSilent) setLoadingJobs(false);
    }
  };

  // Poll for job updates if any jobs are active (pending or processing)
  useEffect(() => {
    fetchJobs();
    
    const interval = setInterval(() => {
      const activeJobs = jobs.some(
        (job) => job.status === 'pending' || job.status === 'processing'
      );
      
      if (activeJobs || jobs.length === 0) {
        // Poll silently
        fetchJobs(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs.length]);

  // Handle Drag Over
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  // Handle Drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // Handle manual selection
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // Validate file client-side (limits: JPG/PNG/WEBP, 5MB max)
  const validateAndSetFile = (file) => {
    setUploadError('');
    
    const allowedExtensions = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedExtensions.includes(file.type)) {
      setUploadError('Only JPG, PNG, and WEBP formats are allowed.');
      setSelectedFile(null);
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setUploadError('File exceeds the 5MB maximum size limit.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  // Handle media file upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadError('');
    setUploadProgress(10); // initial start

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await axios.post('/jobs/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Scale it to 90% since processing is async
          setUploadProgress(Math.min(90, percentCompleted));
        },
      });

      setUploadProgress(100);
      addToast('Upload Complete', `Job enqueued! ID: ${response.data.jobId}`);
      setSelectedFile(null);
      
      // Fetch list instantly
      fetchJobs(true);
    } catch (err) {
      console.error('Upload Error:', err);
      setUploadError(err.response?.data?.error || 'Failed to complete image upload.');
      addToast('Upload Failed', 'Check file formats and sizes', 'error');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 800);
    }
  };

  // Retry a failed job
  const handleRetryJob = async (jobId, e) => {
    if (e) e.stopPropagation(); // Stop card click handler
    
    try {
      addToast('Retrying...', 'Re-enqueuing job for execution.');
      const response = await axios.post(`/jobs/${jobId}/retry`);
      
      // Update UI state directly or silently refresh
      fetchJobs(true);
      
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(response.data.job);
      }
    } catch (err) {
      console.error('Retry Error:', err);
      addToast('Retry Failed', err.response?.data?.error || 'Failed to re-enqueue job', 'error');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} />;
      case 'processing':
        return <Loader2 size={16} className="animate-spin" />;
      case 'failed':
        return <AlertTriangle size={16} />;
      case 'pending':
      default:
        return <Clock size={16} />;
    }
  };

  const getSafetyColorClass = (value) => {
    if (value === 'LIKELY' || value === 'VERY_LIKELY') return 'safety-value LIKELY';
    if (value === 'POSSIBLE') return 'safety-value POSSIBLE';
    return 'safety-value VERY_UNLIKELY';
  };

  const openJobDetail = (job) => {
    setSelectedJob(job);
  };

  const closeJobDetail = () => {
    setSelectedJob(null);
  };

  return (
    <div className="dashboard-container fade-in">
      {/* Header bar */}
      <header className="dash-header">
        <div className="header-logo">
          <Sparkles size={24} style={{ color: 'var(--primary)' }} />
          <span>AuraMedia <span>Hub</span></span>
        </div>
        
        <div className="header-actions">
          {/* Notifications bell */}
          <div className="notification-bell-container">
            <button
              className="nav-btn"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              <Bell size={20} />
              {notifications.length > 0 && <span className="badge-dot" />}
            </button>

            {showNotifications && (
              <div className="notifications-panel glass-card">
                <div className="notifications-header">Safety alerts ({notifications.length})</div>
                {notifications.length === 0 ? (
                  <div className="no-notifications">No flags triggered. All uploads safe.</div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="notification-item">
                      <div className="notification-title">{notif.title}</div>
                      <div className="notification-desc">{notif.desc}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* User profile details */}
          <div className="user-tag">
            <div className="user-avatar">{user?.username ? user.username[0].toUpperCase() : 'U'}</div>
            <span>{user?.username || 'User'}</span>
          </div>

          {/* Logout */}
          <button className="nav-btn nav-btn-logout" onClick={logout} title="Sign Out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="dash-content">
        
        {/* Left Side: Upload Panel */}
        <section className="dash-sidebar">
          
          <div className="upload-card glass-card">
            <h2 className="upload-card-title">Upload Image</h2>
            <p className="upload-card-subtitle">
              Upload photographs, screenshots, or scans for automated metadata generation.
            </p>

            <form onSubmit={handleUploadSubmit}>
              {/* Drag and drop zone */}
              <div
                className={`dropzone ${isDragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  accept=".jpg,.jpeg,.png,.webp"
                  disabled={uploading}
                />
                <UploadCloud size={40} className="dropzone-icon" />
                <div className="dropzone-text">
                  <span>Click to select</span> or drag & drop<br />JPG, PNG, or WEBP image.
                </div>
                <div className="dropzone-limit">Maximum size: 5 MB</div>
              </div>

              {/* Error warning client/server */}
              {uploadError && (
                <div className="alert-error" style={{ marginTop: '16px', marginBottom: '0' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Selected file confirmation */}
              {selectedFile && !uploading && (
                <div className="selected-file-banner">
                  <div className="selected-file-info">
                    <FileImage size={18} style={{ color: 'var(--primary)' }} />
                    <span className="selected-file-name" title={selectedFile.name}>
                      {selectedFile.name}
                    </span>
                    <span className="selected-file-size">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="clear-file-btn"
                    onClick={() => setSelectedFile(null)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="upload-progress-container">
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div className="progress-text">
                    <span>Uploading file...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              {/* Submit btn */}
              {selectedFile && !uploading && (
                <button
                  type="submit"
                  className="auth-btn"
                  style={{ marginTop: '20px' }}
                >
                  Analyze Image
                </button>
              )}
            </form>
          </div>

          {/* Pipeline stages Info Card */}
          <div className="pipeline-info glass-card">
            <h3 className="pipeline-info-title">
              <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
              Processing Pipeline
            </h3>
            <div className="pipeline-steps">
              <div className="pipeline-step">
                <div className="step-num">1</div>
                <div className="step-details">
                  <span className="step-name">Image Captioning</span>
                  <span className="step-desc">Generates description of visual items</span>
                </div>
              </div>
              <div className="pipeline-step">
                <div className="step-num">2</div>
                <div className="step-details">
                  <span className="step-name">Object & Concept Detection</span>
                  <span className="step-desc">Extracts relevant visual labels</span>
                </div>
              </div>
              <div className="pipeline-step">
                <div className="step-num">3</div>
                <div className="step-details">
                  <span className="step-name">Content Safety Analysis</span>
                  <span className="step-desc">Flags adult, violence, spoof content</span>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* Right Side: Jobs List Grid */}
        <section className="jobs-area">
          
          <div className="jobs-area-header">
            <h2 className="jobs-title">
              Processing Dashboard
              <span className="jobs-count-badge">{jobs.length} jobs</span>
            </h2>
            <button className="job-action-btn" onClick={() => fetchJobs()} title="Refresh list">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {loadingJobs && jobs.length === 0 ? (
            <div className="no-jobs-card glass-card">
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <p>Fetching processing jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="no-jobs-card glass-card">
              <UploadCloud size={48} className="no-jobs-icon" />
              <h3>No images uploaded yet</h3>
              <p>Upload files on the left panel to begin asynchronous processing.</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className={`job-card glass-card ${job.results?.flagged ? 'flagged' : ''}`}
                  onClick={() => openJobDetail(job)}
                >
                  
                  {/* Job Header Info */}
                  <div className="job-card-header">
                    <span className={`job-status-badge ${job.status}`}>
                      {getStatusIcon(job.status)}
                      {job.status}
                    </span>
                    {job.results?.flagged && (
                      <span className="job-flagged-tag">Flagged</span>
                    )}
                  </div>

                  {/* Thumbnail / Image placeholder */}
                  <div className="job-thumbnail-wrapper">
                    {job.status === 'completed' || job.status === 'processing' ? (
                      <img
                        src={`${serverRoot}/${job.imagePath}`}
                        alt={job.originalName}
                        className="job-thumbnail"
                        onError={(e) => {
                          // Fallback to placeholder on error
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="thumbnail-placeholder"
                      style={{
                        display:
                          job.status === 'pending' || job.status === 'failed'
                            ? 'flex'
                            : 'none',
                      }}
                    >
                      <FileImage size={32} />
                      <span>
                        {job.status === 'failed'
                          ? 'Failed'
                          : job.status === 'completed'
                          ? 'Image Error'
                          : 'Pending...'}
                      </span>
                    </div>
                  </div>

                  {/* Body Text */}
                  <div className="job-filename" title={job.originalName}>
                    {job.originalName}
                  </div>
                  <div className="job-date">
                    {new Date(job.createdAt).toLocaleString()}
                  </div>

                  <p className="job-caption-preview">
                    {job.status === 'completed'
                      ? job.results?.caption || 'No caption generated.'
                      : job.status === 'failed'
                      ? `Error: ${job.error || 'Pipeline execution failed.'}`
                      : 'Processing image through pipeline tasks...'}
                  </p>

                  {/* Actions bar */}
                  <div className="job-card-actions">
                    {job.status === 'completed' && job.results?.labels ? (
                      <div className="job-labels-preview">
                        {job.results.labels.slice(0, 2).map((label, idx) => (
                          <span key={idx} className="label-preview-tag">
                            {label}
                          </span>
                        ))}
                        {job.results.labels.length > 2 && (
                          <span className="label-preview-tag">+{job.results.labels.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ flex: 1 }} />
                    )}

                    {job.status === 'failed' ? (
                      <button
                        className="job-action-btn retry-btn"
                        onClick={(e) => handleRetryJob(job.id, e)}
                      >
                        <RefreshCw size={12} /> Retry
                      </button>
                    ) : (
                      <button className="job-action-btn">
                        <Eye size={12} /> Details
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Modal Job Details view overlay */}
      {selectedJob && (
        <div className="modal-overlay" onClick={closeJobDetail}>
          <div className="modal-card glass-card fade-in" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeJobDetail}>
              <X size={18} />
            </button>
            
            {/* Modal Left: Media Image */}
            <div className="modal-media-side">
              <img
                src={`${serverRoot}/${selectedJob.imagePath}`}
                alt={selectedJob.originalName}
                className="modal-image"
              />
            </div>

            {/* Modal Right: Details & Metadata */}
            <div className="modal-info-side">
              <div className="modal-title-wrapper">
                <h2 className="modal-filename">{selectedJob.originalName}</h2>
                <div className="modal-meta">
                  <span>Job ID: {selectedJob.id}</span>
                  <span>|</span>
                  <span>{new Date(selectedJob.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Status information */}
              <div>
                <div className="detail-section-title">Pipeline Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`job-status-badge ${selectedJob.status}`}>
                    {getStatusIcon(selectedJob.status)}
                    {selectedJob.status}
                  </span>
                  {selectedJob.retryCount > 0 && (
                    <span className="label-preview-tag" style={{ background: 'rgba(245,158,11,0.1)', color: '#FBBF24' }}>
                      Retried {selectedJob.retryCount}x
                    </span>
                  )}
                </div>
              </div>

              {/* Results blocks */}
              {selectedJob.status === 'completed' && (
                <>
                  {/* Step 1: Caption */}
                  <div>
                    <div className="detail-section-title">Generated Caption</div>
                    <div className="detail-caption-box">
                      "{selectedJob.results?.caption || 'No caption generated.'}"
                    </div>
                  </div>

                  {/* Step 2: Labels */}
                  <div>
                    <div className="detail-section-title">Detected Concepts / Labels</div>
                    <div className="detail-labels-container">
                      {selectedJob.results?.labels && selectedJob.results.labels.length > 0 ? (
                        selectedJob.results.labels.map((label, idx) => (
                          <span key={idx} className="detail-label-tag">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No labels found.</span>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Content safety SafeSearch */}
                  <div>
                    <div className="detail-section-title">Content Safety check</div>
                    {selectedJob.results?.flagged && (
                      <div className="flagged-notice" style={{ marginBottom: '12px' }}>
                        <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                        <div>
                          <div className="flagged-notice-title">Flagged Content Warning</div>
                          <div className="flagged-notice-desc">
                            This upload contains unsafe content in category: <strong>{selectedJob.results.flaggedCategory}</strong>.
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="safety-grid">
                      {selectedJob.results?.safeSearch && 
                        Object.entries(selectedJob.results.safeSearch).map(([category, value]) => (
                          <div key={category} className="safety-item">
                            <span className="safety-name">{category}</span>
                            <span className={getSafetyColorClass(value)}>{value}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </>
              )}

              {selectedJob.status === 'failed' && (
                <div>
                  <div className="detail-section-title">Pipeline Error Log</div>
                  <div className="alert-error" style={{ marginBottom: '0' }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{selectedJob.error || 'An unexpected error halted pipeline execution.'}</span>
                  </div>
                </div>
              )}

              {selectedJob.status === 'pending' || selectedJob.status === 'processing' ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
                  <p>Asynchronously processing image tasks...</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Results update automatically without refreshing.
                  </p>
                </div>
              ) : null}

              {/* Modal Actions */}
              <div className="modal-actions">
                <button className="modal-btn secondary" onClick={closeJobDetail}>
                  Close
                </button>
                {selectedJob.status === 'failed' && (
                  <button
                    className="modal-btn retry"
                    onClick={() => handleRetryJob(selectedJob.id)}
                  >
                    <RefreshCw size={14} /> Retry Job
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Dynamic Toast Center overlay */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'error' ? (
              <ShieldAlert size={20} className="toast-icon error" />
            ) : (
              <CheckCircle2 size={20} className="toast-icon success" />
            )}
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              className="toast-close"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
};

export default Dashboard;
