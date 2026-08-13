import React, { useState, useEffect, useRef, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Select } from './components/ui/select';
import { Checkbox } from './components/ui/checkbox';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from './LanguageContext';
import { CheckCircle2, ClipboardList, Settings, FileText, ArrowLeft, Download, User, Wrench, RefreshCw, Database, Upload, AlertCircle, AlertTriangle, Camera, X, Truck, QrCode, Printer, ScanLine, CheckCircle, Loader2, RotateCcw, Plus, Trash2, TrendingUp, Target, Search, ShieldAlert, MessageSquare, Edit, Clock, FileCheck, CalendarDays, MapPin } from 'lucide-react';
import WorkplanEditor from './pages/WorkplanEditor';
import { AuthProvider, useAuth } from './context/AuthContext';
import { API_BASE_URL } from './lib/api';
import Dashboard from './pages/Dashboard';
import NewChecklist from './pages/NewChecklist';
import RepairsNeeded from './pages/RepairsNeeded';
import './App.css';

// Use SharePointAdminComponent directly for now


// Employee Login Component
function EmployeeLogin() {
  const { login } = useAuth();
  const { language, changeLanguage, t } = useTranslation();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!employeeNumber.trim()) {
      toast.error('Please enter an employee number');
      return;
    }

    setIsLoading(true);
    try {
      // Call backend API to validate employee
      const response = await fetch(`${API_BASE_URL}/api/auth/employee-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_number: employeeNumber })
      });

      const data = await response.json();

      if (data.success) {
        // Login with full employee object from backend
        login(data.employee);
        toast.success(`Welcome, ${data.employee.name}!`);
      } else {
        toast.error('Invalid employee number');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-3">
            <img src="/abreys-logo.png" alt="Abreys" className="h-16 w-auto" />
          </div>
          <p className="text-center text-[10px] tracking-[3px] uppercase text-green-700 font-extrabold">Safety &middot; Ownership &middot; Team &middot; Driven &middot; Excellence</p>
          <CardTitle className="text-2xl text-center">{t('loginTitle')}</CardTitle>
          <CardDescription className="text-center">
            {t('loginSubtitle')}
          </CardDescription>
          <p className="text-xs text-center text-gray-400 pt-1">Version 2.4 &mdash; August 2026</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="employee-number" className="text-sm font-medium text-gray-700">
                {t('employeeNumber')}
              </label>
              <input
                id="employee-number"
                type="text"
                placeholder={t('employeeNumberPlaceholder')}
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={isLoading}
                autoFocus
                data-testid="employee-number-input"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isLoading}
              data-testid="login-btn"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('loading')}
                </>
              ) : (
                t('login')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
// Work Progress Admin Component
function WorkProgressAdmin() {
  const { employee } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showEditJobModal, setShowEditJobModal] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [newJob, setNewJob] = useState({ name: '', total_area: '', target_date: '' });
  const [newEntry, setNewEntry] = useState({ hectares_completed: '', date_completed: '' });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/jobs`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!newJob.name.trim() || !newJob.total_area) {
      toast.error('Please enter job name and total area');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newJob.name.trim(),
          total_area: parseFloat(newJob.total_area),
          target_date: newJob.target_date || null
        })
      });

      if (response.ok) {
        toast.success('Job created successfully');
        setShowAddJobModal(false);
        setNewJob({ name: '', total_area: '', target_date: '' });
        fetchJobs();
      } else {
        toast.error('Failed to create job');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Failed to create job');
    }
  };

  const openEditJobModal = (job) => {
    setEditingJob({
      id: job.id,
      name: job.name,
      total_area: job.total_area,
      target_date: job.target_date || ''
    });
    setShowEditJobModal(true);
  };

  const handleUpdateJob = async () => {
    if (!editingJob.name.trim() || !editingJob.total_area) {
      toast.error('Please enter job name and total area');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingJob.name.trim(),
          total_area: parseFloat(editingJob.total_area),
          target_date: editingJob.target_date || null
        })
      });

      if (response.ok) {
        toast.success('Job updated successfully');
        setShowEditJobModal(false);
        setEditingJob(null);
        fetchJobs();
      } else {
        toast.error('Failed to update job');
      }
    } catch (error) {
      console.error('Error updating job:', error);
      toast.error('Failed to update job');
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.hectares_completed || !selectedJob) {
      toast.error('Please enter hectares completed');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${selectedJob.id}/work-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hectares_completed: parseFloat(newEntry.hectares_completed),
          date_completed: newEntry.date_completed || new Date().toISOString().split('T')[0],
          entered_by: employee?.name || 'Admin'
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setShowAddEntryModal(false);
        setNewEntry({ hectares_completed: '', date_completed: '' });
        setSelectedJob(null);
        fetchJobs();
      } else {
        toast.error('Failed to add work entry');
      }
    } catch (error) {
      console.error('Error adding work entry:', error);
      toast.error('Failed to add work entry');
    }
  };

  const handleDeleteJob = async (jobId, jobName) => {
    if (!window.confirm(`Are you sure you want to delete "${jobName}"? This will also delete all work entries.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Job deleted');
        fetchJobs();
      } else {
        toast.error('Failed to delete job');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    }
  };

  const handleReopenJob = async (jobId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/jobs/${jobId}/reopen`, {
        method: 'PUT'
      });

      if (response.ok) {
        toast.success('Job reopened');
        fetchJobs();
      } else {
        toast.error('Failed to reopen job');
      }
    } catch (error) {
      console.error('Error reopening job:', error);
      toast.error('Failed to reopen job');
    }
  };

  const activeJobs = jobs.filter(j => j.status === 'active');
  const completedJobs = jobs.filter(j => j.status === 'complete');

  return (
    <>
      {/* Add Job Modal */}
      {showAddJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add New Job</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAddJobModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Job Name</label>
                <input
                  type="text"
                  value={newJob.name}
                  onChange={(e) => setNewJob(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Carrot Drilling"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Area (Ha)</label>
                <input
                  type="number"
                  value={newJob.total_area}
                  onChange={(e) => setNewJob(prev => ({ ...prev, total_area: e.target.value }))}
                  placeholder="e.g., 345"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Completion Date</label>
                <input
                  type="date"
                  value={newJob.target_date}
                  onChange={(e) => setNewJob(prev => ({ ...prev, target_date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional - Set a deadline for this job</p>
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => setShowAddJobModal(false)}>Cancel</Button>
                <Button onClick={handleCreateJob} className="bg-orange-600 hover:bg-orange-700">
                  Create Job
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditJobModal && editingJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Job</h3>
              <Button variant="ghost" size="sm" onClick={() => { setShowEditJobModal(false); setEditingJob(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Job Name</label>
                <input
                  type="text"
                  value={editingJob.name}
                  onChange={(e) => setEditingJob(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Area (Ha)</label>
                <input
                  type="number"
                  value={editingJob.total_area}
                  onChange={(e) => setEditingJob(prev => ({ ...prev, total_area: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Completion Date</label>
                <input
                  type="date"
                  value={editingJob.target_date}
                  onChange={(e) => setEditingJob(prev => ({ ...prev, target_date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">Set a deadline - shows required daily Ha on dashboard</p>
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => { setShowEditJobModal(false); setEditingJob(null); }}>Cancel</Button>
                <Button onClick={handleUpdateJob} className="bg-orange-600 hover:bg-orange-700">
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Work Entry Modal */}
      {showAddEntryModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Completed Work</h3>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddEntryModal(false); setSelectedJob(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mb-4 p-3 bg-orange-50 rounded-lg">
              <p className="font-medium text-orange-900">{selectedJob.name}</p>
              <p className="text-sm text-orange-700">
                {selectedJob.area_left} Ha remaining of {selectedJob.total_area} Ha
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hectares Completed</label>
                <input
                  type="number"
                  step="0.1"
                  value={newEntry.hectares_completed}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, hectares_completed: e.target.value }))}
                  placeholder="e.g., 50"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date (optional, defaults to today)</label>
                <input
                  type="date"
                  value={newEntry.date_completed}
                  onChange={(e) => setNewEntry(prev => ({ ...prev, date_completed: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => { setShowAddEntryModal(false); setSelectedJob(null); }}>Cancel</Button>
                <Button onClick={handleAddEntry} className="bg-green-600 hover:bg-green-700">
                  Add Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-orange-600" />
                <span>Work Progress Tracking</span>
              </CardTitle>
              <CardDescription>
                Track field work progress - jobs, areas, and completion rates
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddJobModal(true)} className="bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin text-orange-600" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No jobs created yet</p>
              <p className="text-sm">Click "Add Job" to create your first work tracking job</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Jobs */}
              {activeJobs.length > 0 && (
                <div>
                  <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Active Jobs ({activeJobs.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeJobs.map(job => (
                      <Card key={job.id} className="border-orange-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h5 className="font-semibold text-lg">{job.name}</h5>
                              <p className="text-sm text-gray-600">
                                Total: {job.total_area} Ha
                                {job.target_date && (
                                  <span className="ml-2 text-purple-600">| Target: {new Date(job.target_date).toLocaleDateString()}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => openEditJobModal(job)}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteJob(job.id, job.name);
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-green-600 font-medium">{job.total_completed} Ha done</span>
                              <span className="text-orange-600 font-medium">{job.area_left} Ha left</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (job.total_completed / job.total_area) * 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {Math.round((job.total_completed / job.total_area) * 100)}% complete
                            </p>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2 mb-3">
                            <div>
                              <span className="text-gray-600">Avg: </span>
                              <span className="font-semibold text-blue-600">{job.ha_per_day} Ha/day</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Entries: </span>
                              <span className="font-semibold">{job.entries_count}</span>
                            </div>
                          </div>

                          <Button 
                            onClick={() => { setSelectedJob(job); setShowAddEntryModal(true); }}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Completed Ha
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Jobs */}
              {completedJobs.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Completed Jobs ({completedJobs.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {completedJobs.map(job => (
                      <Card key={job.id} className="border-green-200 bg-green-50/50">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h5 className="font-semibold text-lg flex items-center gap-2">
                                {job.name}
                                <Badge className="bg-green-600">Complete</Badge>
                              </h5>
                              <p className="text-sm text-gray-600">
                                {job.total_completed} Ha completed
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleReopenJob(job.id);
                                }}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                title="Reopen job"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteJob(job.id, job.name);
                                }}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">
                            Avg rate: {job.ha_per_day} Ha/day over {job.entries_count} entries
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// SharePoint Sync Status Component
function SharePointSyncStatus() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null); // null, 'staff', 'assets', 'all'
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sharepoint/sync-status`);
      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (type) => {
    setSyncing(type);
    const endpoint = type === 'all' ? 'sync-all' : type === 'assets' ? 'sync-assets' : 'sync-now';
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sharepoint/${endpoint}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (response.ok) {
        if (type === 'all') {
          toast.success(`Synced ${data.staff?.count || 0} staff and ${data.assets?.assets_count || 0} assets`);
        } else if (type === 'assets') {
          toast.success(`Synced ${data.assets_count} assets and ${data.templates_count} checklist templates`);
        } else {
          toast.success(`Synced ${data.count} staff members`);
        }
        fetchSyncStatus();
      } else {
        toast.error(data.detail || 'Sync failed');
      }
    } catch (error) {
      toast.error('Failed to sync from SharePoint');
      console.error('Sync error:', error);
    } finally {
      setSyncing(null);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/sharepoint/test-connection`);
      const data = await response.json();
      
      if (data.success) {
        const staffInfo = data.files?.staff;
        const assetsInfo = data.files?.assets;
        toast.success(`Connected! Staff: ${staffInfo?.file_name} (${Math.round(staffInfo?.file_size / 1024)}KB), Assets: ${assetsInfo?.file_name} (${Math.round(assetsInfo?.file_size / 1024)}KB)`);
      } else {
        toast.error(data.message || 'Connection failed');
      }
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-purple-600"><RefreshCw className="h-4 w-4 animate-spin" /> Loading status...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${syncStatus?.scheduler_running ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">
            {syncStatus?.scheduler_running ? 'Auto-sync active (9AM daily)' : 'Auto-sync inactive'}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={testConnection}
          disabled={testing}
          className="text-purple-700 border-purple-300"
        >
          {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Test Connection'}
        </Button>
      </div>

      {/* Sync Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => triggerSync('staff')}
          disabled={syncing !== null}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {syncing === 'staff' ? <><RefreshCw className="h-4 w-4 animate-spin mr-1" /> Syncing...</> : 'Sync Staff'}
        </Button>
        <Button
          size="sm"
          onClick={() => triggerSync('assets')}
          disabled={syncing !== null}
          className="bg-green-600 hover:bg-green-700"
        >
          {syncing === 'assets' ? <><RefreshCw className="h-4 w-4 animate-spin mr-1" /> Syncing...</> : 'Sync Assets'}
        </Button>
        <Button
          size="sm"
          onClick={() => triggerSync('all')}
          disabled={syncing !== null}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {syncing === 'all' ? <><RefreshCw className="h-4 w-4 animate-spin mr-1" /> Syncing...</> : 'Sync All'}
        </Button>
      </div>

      {/* Last Sync Info */}
      {syncStatus?.last_sync && (
        <div className="bg-white p-3 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Last Sync</p>
              <p className="text-xs text-gray-500">
                {new Date(syncStatus.last_sync.timestamp).toLocaleString()} ({syncStatus.last_sync.type})
              </p>
            </div>
            <div className="text-right">
              {syncStatus.last_sync.success ? (
                <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Success
                </span>
              ) : (
                <span className="text-red-600 text-sm font-medium flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Failed
                </span>
              )}
            </div>
          </div>
          {syncStatus.last_sync.message && (
            <p className="text-xs text-gray-600 mt-1">{syncStatus.last_sync.message}</p>
          )}
        </div>
      )}

      {/* Next Scheduled Sync */}
      {syncStatus?.next_scheduled_sync && (
        <div className="text-sm text-purple-700">
          <Clock className="h-4 w-4 inline mr-1" />
          Next sync: {new Date(syncStatus.next_scheduled_sync).toLocaleString()}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Files: SharePoint → Crops → General → Apps → Checklist App → (Name List.xlsx, AssetList.xlsx)
      </p>
    </div>
  );
}

// Template Diagnostics Component - verify check_type to template mappings
function TemplateDiagnostics() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/template-diagnostics`);
      const data = await response.json();
      setDiagnostics(data);
      setExpanded(true);
    } catch (error) {
      toast.error('Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-testid="template-diagnostics-card" className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileCheck className="h-5 w-5 text-blue-600" />
          <span>Template Diagnostics</span>
        </CardTitle>
        <CardDescription>
          Verify which checklist template is assigned to each check type
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={fetchDiagnostics} disabled={loading} className="bg-blue-600 hover:bg-blue-700" data-testid="run-diagnostics-btn">
          {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
          {loading ? 'Loading...' : 'Check Template Mappings'}
        </Button>

        {diagnostics && expanded && (
          <div className="space-y-3 mt-4">
            <p className="text-sm font-medium text-gray-700">Total Assets: {diagnostics.total_assets}</p>
            
            {diagnostics.missing_templates?.length > 0 && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                <p className="text-red-800 font-medium text-sm">Missing templates for: {diagnostics.missing_templates.join(', ')}</p>
              </div>
            )}
            
            <div className="space-y-2">
              {diagnostics.templates?.map((t, i) => (
                <div key={i} className="p-3 bg-white rounded-lg border shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">{t.check_type}</span>
                      <span className="text-xs text-gray-500 ml-2">(sheet: "{t.sheet_name}")</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.item_count} items</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t.assets_using_this} assets</span>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {t.first_3_items?.map((item, j) => (
                      <span key={j} className="block truncate">• {item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// SharePoint Admin Component
function SharePointAdminComponent() {
  const [uploadResults, setUploadResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setUploadResults(null);
      
      const formData = new FormData();
      formData.append('file', file);

      let endpoint;
      switch (type) {
        case 'staff':
          endpoint = 'upload-staff-file';
          break;
        case 'assets':
          endpoint = 'upload-assets-file';
          break;
        case 'daily_check':
          endpoint = 'upload-checklist-file/daily_check';
          break;
        case 'grader_startup':
          endpoint = 'upload-checklist-file/grader_startup';
          break;
        case 'workshop_service':
          endpoint = 'upload-checklist-file/workshop_service';
          break;
        default:
          toast.error('Invalid upload type');
          return;
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/${endpoint}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setUploadResults(data);
        toast.success(data.message || 'File uploaded successfully!');
      } else {
        toast.error(`Upload failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('File upload failed. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };
  // All SharePoint functions removed - using direct file upload only

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')} data-testid="back-to-dashboard-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-2">Upload Excel files and print QR labels</p>
          </div>
        </div>
      </div>

      {/* QR Code Labels Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5 text-purple-600" />
            <span>Machine QR Code Labels</span>
          </CardTitle>
          <CardDescription>
            Generate and print QR code labels to stick on machines for quick scanning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-purple-200 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">Print QR Labels</h3>
                    <p className="text-sm text-gray-600">Generate labels for all machines</p>
                  </div>
                  <Printer className="h-8 w-8 text-purple-600" />
                </div>
                <Button 
                  onClick={() => navigate('/qr-labels')}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  View & Print Labels
                </Button>
              </CardContent>
            </Card>
            
            <Card className="border-pink-200 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">How It Works</h3>
                    <p className="text-sm text-gray-600">Using QR codes for checks</p>
                  </div>
                  <ScanLine className="h-8 w-8 text-pink-600" />
                </div>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-100 text-pink-700 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                    <span>Print QR labels and stick them on machines</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-100 text-pink-700 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                    <span>Staff scan the code when starting a check</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-pink-100 text-pink-700 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                    <span>Machine is automatically selected - no searching!</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* SharePoint Auto-Sync */}
      <Card data-testid="sharepoint-sync-card" className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 text-purple-600" />
            <span>SharePoint Auto-Sync</span>
          </CardTitle>
          <CardDescription>
            Staff list and asset list sync automatically from SharePoint every day at 9:00 AM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SharePointSyncStatus />
        </CardContent>
      </Card>

      {/* Template Diagnostics */}
      <TemplateDiagnostics />

      {/* Staff Upload */}
      <Card data-testid="staff-upload-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-green-600" />
            <span>Upload Staff List</span>
          </CardTitle>
          <CardDescription>
            Upload Excel file with employee numbers and names (Name List.xlsx)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-2">Excel Format Required:</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Column A: Employee Number (e.g., 101, 102, 103)</li>
              <li>• Column B: Name (e.g., John Smith, Jane Doe)</li>
              <li>• Column C: Workshop Control (yes/no) - optional</li>
              <li>• Column D: Admin Control (yes/no) - optional</li>
              <li>• Column E: Manager (yes/no) - optional</li>
            </ul>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileUpload(e, 'staff')}
              disabled={loading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-green-600" />}
          </div>
        </CardContent>
      </Card>

      {/* Assets Upload */}
      <Card data-testid="assets-upload-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            <span>Upload Asset List</span>
          </CardTitle>
          <CardDescription>
            Upload Excel file with machine makes and models (AssetList.xlsx)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Excel Format Required:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Column A: Make (e.g., "John Deere", "Cat")</li>
              <li>• Column B: Model (e.g., "6145R", "DP30NTD")</li>
            </ul>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileUpload(e, 'assets')}
              disabled={loading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />}
          </div>
        </CardContent>
      </Card>

      {/* Note: Checklist templates are now managed through AssetList.xlsx Check Type column */}
      {/* Upload Results */}
      {uploadResults && (
        <Card data-testid="upload-results-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>Upload Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-green-800 font-medium">{uploadResults.message}</p>
              {uploadResults.processed_items && (
                <p className="text-green-700 text-sm mt-2">
                  Processed {uploadResults.processed_items} items successfully
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
// Records Component
function Records() {
  const { t, tItem } = useTranslation();
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  
  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }
      
      const skip = append ? checklists.length : 0;
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=${ITEMS_PER_PAGE}&skip=${skip}`);
      const data = await response.json();
      
      // Filter out GENERAL REPAIR records - keep those only on Repairs Needed page
      const filteredChecklists = data.filter(checklist => checklist.check_type !== 'GENERAL REPAIR');
      
      if (append) {
        setChecklists(prev => [...prev, ...filteredChecklists]);
      } else {
        setChecklists(filteredChecklists);
      }
      
      // Check if there are more items to load
      setHasMore(filteredChecklists.length === ITEMS_PER_PAGE);
      
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast.error('Failed to load checklist records');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchChecklists(true);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists/export/csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'machine_checklists.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Records exported successfully');
    } catch (error) {
      console.error('Error exporting records:', error);
      toast.error('Failed to export records');
    }
  };

  const viewPhotos = (checklist) => {
    const photos = [];
    
    // Collect photos from checklist items
    if (checklist.checklist_items) {
      checklist.checklist_items.forEach((item, itemIndex) => {
        if (item.photos && item.photos.length > 0) {
          item.photos.forEach((photo) => {
            photos.push({
              ...photo,
              title: `${item.item}`,
              type: 'checklist_item',
              itemIndex
            });
          });
        }
      });
    }
    
    // Collect workshop photos
    if (checklist.workshop_photos && checklist.workshop_photos.length > 0) {
      checklist.workshop_photos.forEach((photo) => {
        photos.push({
          ...photo,
          title: 'Workshop Photo',
          type: 'workshop'
        });
      });
    }
    
    if (photos.length > 0) {
      setSelectedPhotos(photos);
      setCurrentPhotoIndex(0);
      setShowPhotoModal(true);
    } else {
      toast.info('No photos found for this checklist');
    }
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhotos([]);
    setCurrentPhotoIndex(0);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % selectedPhotos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + selectedPhotos.length) % selectedPhotos.length);
  };

  const getPhotoCount = (checklist) => {
    let count = 0;
    
    // Count checklist item photos
    if (checklist.checklist_items) {
      checklist.checklist_items.forEach(item => {
        if (item.photos) {
          count += item.photos.length;
        }
      });
    }
    
    // Count workshop photos
    if (checklist.workshop_photos) {
      count += checklist.workshop_photos.length;
    }
    
    return count;
  };

  const handleViewDetails = (checklist) => {
    setSelectedChecklist(checklist);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedChecklist(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Checklist Detail Modal */}
      {showDetailModal && selectedChecklist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Checklist Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeDetailModal}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Machine</h3>
                  <p className="text-lg font-semibold">{selectedChecklist.machine_make} {selectedChecklist.machine_model}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Check Type</h3>
                  <p className="text-lg">{selectedChecklist.check_type === 'daily_check' ? 'Daily Check' : 
                                          selectedChecklist.check_type === 'grader_startup' ? 'Grader Startup' : 
                                          selectedChecklist.check_type === 'workshop_service' ? 'Workshop Service' : 
                                          selectedChecklist.check_type === 'NEW MACHINE' ? 'New Machine' : 
                                          selectedChecklist.check_type === 'REPAIR COMPLETED' ? 'Repair Completed' : 
                                          selectedChecklist.check_type}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Completed By</h3>
                  <p className="text-lg">{selectedChecklist.staff_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Completed At</h3>
                  <p className="text-lg">{new Date(selectedChecklist.completed_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Checklist Items */}
              {selectedChecklist.checklist_items && selectedChecklist.checklist_items.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Checklist Items</h3>
                  <div className="space-y-3">
                    {selectedChecklist.checklist_items.map((item, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${item.status === 'unsatisfactory' ? 'bg-red-50 border-red-200' : item.status === 'na' ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              {item.status === 'satisfactory' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                              {item.status === 'unsatisfactory' && <X className="h-5 w-5 text-red-600" />}
                              {item.status === 'na' && <span className="text-sm font-medium text-gray-600">N/A</span>}
                              <p className="font-medium">{tItem(item.item)}</p>
                            </div>
                            {item.notes && (
                              <p className="text-sm text-gray-700 mt-2 italic">"{item.notes}"</p>
                            )}
                          </div>
                          <Badge variant={item.status === 'unsatisfactory' ? 'destructive' : item.status === 'na' ? 'secondary' : 'default'}>
                            {item.status === 'satisfactory' ? 'OK' : item.status === 'unsatisfactory' ? 'Issue' : 'N/A'}
                          </Badge>
                        </div>
                        {/* Item Photos */}
                        {item.photos && item.photos.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {item.photos.map((photo, photoIndex) => (
                              <img
                                key={photoIndex}
                                src={photo.data}
                                alt={`${item.item} - Photo ${photoIndex + 1}`}
                                className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-75"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const photos = [{...photo, title: item.item, type: 'checklist_item'}];
                                  setSelectedPhotos(photos);
                                  setCurrentPhotoIndex(0);
                                  setShowPhotoModal(true);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Workshop Notes */}
              {selectedChecklist.workshop_notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notes</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedChecklist.workshop_notes}</p>
                  </div>
                </div>
              )}

              {/* Fuel and Mileage Record */}
              {(selectedChecklist.check_type === 'fuel_mileage' || selectedChecklist.fuel_mileage || selectedChecklist.fuel_added || selectedChecklist.adblue_added) && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Fuel and Mileage Record</h3>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                    {selectedChecklist.fuel_mileage && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">Mileage / Hours:</span>
                        <span className="font-bold text-blue-700 text-lg">{selectedChecklist.fuel_mileage}</span>
                      </div>
                    )}
                    {selectedChecklist.fuel_added && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">Fuel Added:</span>
                        <span className="font-bold text-green-700 text-lg">{selectedChecklist.fuel_added} Litres</span>
                      </div>
                    )}
                    {selectedChecklist.adblue_added && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">AdBlue Added:</span>
                        <span className="font-bold text-purple-700 text-lg">{selectedChecklist.adblue_added} Litres</span>
                      </div>
                    )}
                    {selectedChecklist.fuel_notes && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-sm text-gray-600"><strong>Notes:</strong> {selectedChecklist.fuel_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Workshop Photos */}
              {selectedChecklist.workshop_photos && selectedChecklist.workshop_photos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Workshop Photos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedChecklist.workshop_photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo.data}
                        alt={`Workshop Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-75"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhotos(selectedChecklist.workshop_photos.map(p => ({...p, title: 'Workshop Photo', type: 'workshop'})));
                          setCurrentPhotoIndex(index);
                          setShowPhotoModal(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhotos.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999]">
          <div className="relative max-w-4xl w-full mx-4">
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
              onClick={closePhotoModal}
            >
              <X className="h-6 w-6" />
            </Button>
            
            {/* Navigation buttons */}
            {selectedPhotos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={prevPhoto}
                >
                  <ArrowLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20"
                  onClick={nextPhoto}
                >
                  <ArrowLeft className="h-6 w-6 rotate-180" />
                </Button>
              </>
            )}
            
            {/* Photo content */}
            <div className="text-center">
              <img
                src={selectedPhotos[currentPhotoIndex]?.data}
                alt={selectedPhotos[currentPhotoIndex]?.title}
                className="max-h-[80vh] max-w-full object-contain mx-auto rounded"
              />
              
              <div className="mt-4 text-white">
                <p className="text-lg font-medium">{selectedPhotos[currentPhotoIndex]?.title}</p>
                <p className="text-sm opacity-75">
                  {selectedPhotos[currentPhotoIndex]?.type === 'workshop' ? 'Workshop Photo' : 'Checklist Item'}
                </p>
                {selectedPhotos.length > 1 && (
                  <p className="text-sm opacity-75 mt-2">
                    {currentPhotoIndex + 1} of {selectedPhotos.length}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            data-testid="back-to-dashboard-from-records-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Checklist Records</h1>
            <p className="text-gray-600 mt-2">View and export completed equipment inspections</p>
          </div>
        </div>
        <Button 
          onClick={handleExport} 
          variant="outline"
          data-testid="export-records-btn"
        >
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <Card data-testid="records-list-card">
        <CardHeader>
          <CardTitle>Completed Checklists</CardTitle>
          <CardDescription>{checklists.length} total records</CardDescription>
        </CardHeader>
        <CardContent>
          {checklists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No checklist records found</p>
              <p className="text-sm">Complete your first equipment check to see records here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {checklists.map((checklist) => {
                const completedDate = new Date(checklist.completed_at);
                let statusInfo;
                
                if (checklist.check_type === 'daily_check' || checklist.check_type === 'grader_startup') {
                  const itemsSatisfactory = checklist.checklist_items.filter(item => item.status === 'satisfactory').length;
                  const itemsUnsatisfactory = checklist.checklist_items.filter(item => item.status === 'unsatisfactory').length;
                  const totalItems = checklist.checklist_items.length;
                  statusInfo = (
                    <div className="space-y-1">
                      <Badge 
                        variant={itemsUnsatisfactory === 0 ? "default" : "secondary"}
                        className={`mb-1 ${checklist.check_type === 'grader_startup' ? 'bg-orange-100 text-orange-800' : ''}`}
                      >
                        ✓{itemsSatisfactory} ✗{itemsUnsatisfactory} of {totalItems} items
                      </Badge>
                      {itemsUnsatisfactory > 0 && (
                        <div className="text-xs text-red-600 font-medium space-y-1">
                          <div className="flex items-center">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Issues Found:
                          </div>
                          <div className="pl-4 space-y-0.5">
                            {checklist.checklist_items
                              .filter(item => item.status === 'unsatisfactory')
                              .map((item, index) => (
                                <div key={index} className="text-xs text-red-700">
                                  • {item.item}
                                  {item.notes && (
                                    <div className="text-xs text-red-600 italic ml-2">
                                      "{item.notes}"
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  statusInfo = (
                    <Badge variant="outline" className="mb-1">
                      {checklist.check_type === 'NEW MACHINE' ? 'New Machine' : 
                       checklist.check_type === 'REPAIR COMPLETED' ? 'Repair Completed' : 
                       checklist.check_type === 'GENERAL REPAIR' ? 'General Repair' : 
                       'Workshop Service'}
                    </Badge>
                  );
                }

                const getCheckTypeDisplay = (type) => {
                  switch(type) {
                    case 'daily_check': return 'Daily check';
                    case 'grader_startup': return 'Grader startup';
                    case 'workshop_service': return 'Workshop service';
                    case 'NEW MACHINE': return 'New Machine';
                    case 'REPAIR COMPLETED': return 'Repair Completed';
                    case 'GENERAL REPAIR': return 'General Repair';
                    default: return 'Check';
                  }
                };

                const getIconAndColor = (type) => {
                  switch(type) {
                    case 'daily_check': 
                      return { bg: 'bg-green-100', icon: <CheckCircle2 className="h-6 w-6 text-green-600" /> };
                    case 'grader_startup': 
                      return { bg: 'bg-orange-100', icon: <AlertCircle className="h-6 w-6 text-orange-600" /> };
                    case 'workshop_service': 
                      return { bg: 'bg-blue-100', icon: <Settings className="h-6 w-6 text-blue-600" /> };
                    case 'NEW MACHINE': 
                      return { bg: 'bg-purple-100', icon: <Database className="h-6 w-6 text-purple-600" /> };
                    case 'REPAIR COMPLETED': 
                      return { bg: 'bg-emerald-100', icon: <Wrench className="h-6 w-6 text-emerald-600" /> };
                    case 'GENERAL REPAIR': 
                      return { bg: 'bg-red-100', icon: <AlertTriangle className="h-6 w-6 text-red-600" /> };
                    default: 
                      return { bg: 'bg-gray-100', icon: <CheckCircle2 className="h-6 w-6 text-gray-600" /> };
                  }
                };

                const iconConfig = getIconAndColor(checklist.check_type);
                
                return (
                  <Card 
                    key={checklist.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer" 
                    data-testid={`record-item-${checklist.id}`}
                    onClick={() => handleViewDetails(checklist)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-lg ${iconConfig.bg}`}>
                            {iconConfig.icon}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{checklist.machine_make} {checklist.machine_model}</h3>
                            <p className="text-gray-600">{getCheckTypeDisplay(checklist.check_type)} by {checklist.staff_name}</p>
                            <p className="text-sm text-gray-500">ID: {checklist.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {statusInfo}
                          <p className="text-sm text-gray-500">
                            {completedDate.toLocaleDateString()} at {completedDate.toLocaleTimeString()}
                          </p>
                          
                          {/* Photo information */}
                          {(() => {
                            const photoCount = getPhotoCount(checklist);
                            return photoCount > 0 ? (
                              <div className="mt-2 flex items-center justify-end space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  <Camera className="h-3 w-3 mr-1" />
                                  {photoCount} photo{photoCount > 1 ? 's' : ''}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewPhotos(checklist)}
                                  className="text-xs px-2 py-1 h-auto"
                                >
                                  View Photos
                                </Button>
                              </div>
                            ) : null;
                          })()}
                          
                          {/* NEW MACHINE details */}
                          {checklist.check_type === 'NEW MACHINE' && checklist.workshop_notes && (
                            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <h4 className="text-sm font-semibold text-purple-800 mb-2">Machine Details:</h4>
                              <div className="text-xs text-purple-700 space-y-1">
                                {checklist.workshop_notes.split('\n').slice(1).map((line, index) => (
                                  line.trim() && (
                                    <div key={index} className="flex">
                                      <span className="font-medium">{line.trim()}</span>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* GENERAL REPAIR details */}
                          {checklist.check_type === 'GENERAL REPAIR' && checklist.workshop_notes && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <h4 className="text-sm font-semibold text-red-800 mb-2">Problem Report:</h4>
                              <div className="text-xs text-red-700">
                                {checklist.workshop_notes.split('\n').slice(1).map((line, index) => (
                                  line.trim() && (
                                    <div key={index}>
                                      <span>{line.trim()}</span>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* Load More Button */}
              {hasMore && checklists.length > 0 && (
                <div className="mt-6 text-center">
                  <Button 
                    onClick={loadMore} 
                    disabled={loadingMore}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                        Loading more...
                      </>
                    ) : (
                      `Load More Records (${ITEMS_PER_PAGE} at a time)`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// All Checks Completed Component
function AllChecksCompleted() {
  const { t, tItem } = useTranslation();
  const [checklists, setChecklists] = useState([]);
  const [filteredChecklists, setFilteredChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  
  const ITEMS_PER_PAGE = 100;
  
  // Check if we're filtering for today's checks
  const urlParams = new URLSearchParams(window.location.search);
  const filterToday = urlParams.get('filter') === 'today';

  useEffect(() => {
    fetchChecklists();
  }, [filterToday]); // Re-fetch when filter changes

  useEffect(() => {
    filterChecklists();
  }, [selectedMake, selectedModel, checklists]);

  const fetchChecklists = async (append = false) => {
    try {
      setLoading(true);
      setLoadError(null);
      
      // Create abort controller for timeout - 30 seconds for production
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // Use dedicated today endpoint if filtering for today
      if (filterToday && !append) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/checklists/today`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              const regularChecks = data.filter(c => c.check_type !== 'GENERAL REPAIR');
              setChecklists(regularChecks);
              setFilteredChecklists(regularChecks);
              setHasMore(false);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          clearTimeout(timeoutId);
        }
        
        // Fallback: fetch recent 50 and filter client-side (smaller = faster)
        try {
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 30000);
          const response = await fetch(`${API_BASE_URL}/api/checklists?limit=50`, {
            signal: controller2.signal
          });
          clearTimeout(timeoutId2);
          const data = await response.json();
          if (Array.isArray(data)) {
            const today = new Date().toISOString().split('T')[0];
            const todayChecks = data.filter(c => c.completed_at && c.completed_at.startsWith(today) && c.check_type !== 'GENERAL REPAIR');
            setChecklists(todayChecks);
            setFilteredChecklists(todayChecks);
          }
        } catch (e) {
          console.error('Checklists API timeout:', e.message);
          setLoadError('Server is slow - please try again in a moment');
          setChecklists([]);
          setFilteredChecklists([]);
        }
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      if (append) {
        setLoadingMore(true);
      }
      
      const skip = append ? checklists.length : 0;
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=${ITEMS_PER_PAGE}&skip=${skip}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      
      // Exclude GENERAL REPAIR records
      const regularChecks = Array.isArray(data) ? data.filter(c => c.check_type !== 'GENERAL REPAIR') : [];
      
      if (append) {
        setChecklists(prev => [...prev, ...regularChecks]);
      } else {
        setChecklists(regularChecks);
      }
      
      // Extract unique makes and models
      const allChecklists = append ? [...checklists, ...regularChecks] : regularChecks;
      const uniqueMakes = [...new Set(allChecklists.map(c => c.machine_make))].sort();
      setMakes(uniqueMakes);
      
      // Check if there are more items to load
      setHasMore(regularChecks.length === ITEMS_PER_PAGE);
      
    } catch (error) {
      console.error('Error fetching checklists:', error);
      if (error.name === 'AbortError') {
        setLoadError('Request timed out - server is busy. Please try again.');
        toast.error('Request timed out. The server is busy.');
      } else {
        setLoadError('Failed to load checklists. Please try again.');
        toast.error('Failed to load checklists');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMore = () => {
    if (!loadingMore && hasMore && !selectedMake && !selectedModel) {
      fetchChecklists(true);
    }
  };

  const filterChecklists = () => {
    let filtered = checklists;
    
    // Filter for today's checks if specified
    if (filterToday) {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(c => c.completed_at && c.completed_at.startsWith(today));
    }
    
    if (selectedMake) {
      filtered = filtered.filter(c => c.machine_make === selectedMake);
      
      // Update available models based on selected make
      const availableModels = [...new Set(filtered.map(c => c.machine_model))].sort();
      setModels(availableModels);
    } else {
      setModels([]);
      setSelectedModel('');
    }
    
    if (selectedModel) {
      filtered = filtered.filter(c => c.machine_model === selectedModel);
    }
    
    setFilteredChecklists(filtered);
  };

  const handleViewDetails = (checklist) => {
    setSelectedChecklist(checklist);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedChecklist(null);
  };

  const handleMakeChange = (make) => {
    setSelectedMake(make);
    setSelectedModel(''); // Reset model when make changes
  };

  const handleExport = async () => {
    try {
      toast.info('Generating Excel export... This may take a moment for large datasets.');
      
      // Use a longer timeout for large exports
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      const response = await fetch(`${API_BASE_URL}/api/checklists/export/excel`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_checks_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Checks exported successfully to Excel');
    } catch (error) {
      console.error('Export error:', error);
      if (error.name === 'AbortError') {
        toast.error('Export timed out. Try the faster CSV format instead.');
      } else {
        toast.error('Failed to export checks. Try CSV format for large datasets.');
      }
    }
  };

  const handleExportCSV = async () => {
    try {
      toast.info('Generating CSV export...');
      const response = await fetch(`${API_BASE_URL}/api/checklists/export/csv`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_checks_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Checks exported successfully to CSV');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export checks');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading checks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Detail Modal - reuse from Records */}
      {showDetailModal && selectedChecklist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Check Details</h2>
              <Button variant="ghost" size="sm" onClick={closeDetailModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Machine</h3>
                  <p className="text-lg font-semibold">{selectedChecklist.machine_make} {selectedChecklist.machine_model}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Check Type</h3>
                  <p className="text-lg">{selectedChecklist.check_type === 'daily_check' ? 'Daily Check' : 
                                          selectedChecklist.check_type === 'grader_startup' ? 'Grader Startup' : 
                                          selectedChecklist.check_type === 'workshop_service' ? 'Workshop Service' : 
                                          selectedChecklist.check_type}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Completed By</h3>
                  <p className="text-lg">{selectedChecklist.staff_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Completed At</h3>
                  <p className="text-lg">{new Date(selectedChecklist.completed_at).toLocaleString()}</p>
                </div>
              </div>

              {selectedChecklist.checklist_items && selectedChecklist.checklist_items.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Checklist Items</h3>
                  <div className="space-y-3">
                    {selectedChecklist.checklist_items.map((item, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${item.status === 'unsatisfactory' ? 'bg-red-50 border-red-200' : item.status === 'na' ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              {item.status === 'satisfactory' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                              {item.status === 'unsatisfactory' && <X className="h-5 w-5 text-red-600" />}
                              {item.status === 'na' && <span className="text-sm font-medium text-gray-600">N/A</span>}
                              <p className="font-medium">{tItem(item.item)}</p>
                            </div>
                            {item.notes && (
                              <p className="text-sm text-gray-700 mt-2 italic">"{item.notes}"</p>
                            )}
                          </div>
                          <Badge variant={item.status === 'unsatisfactory' ? 'destructive' : item.status === 'na' ? 'secondary' : 'default'}>
                            {item.status === 'satisfactory' ? 'OK' : item.status === 'unsatisfactory' ? 'Issue' : 'N/A'}
                          </Badge>
                        </div>
                        {item.photos && item.photos.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {item.photos.map((photo, photoIndex) => (
                              <img
                                key={photoIndex}
                                src={photo.data}
                                alt={`${item.item} - Photo ${photoIndex + 1}`}
                                className="w-full h-24 object-cover rounded"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedChecklist.workshop_notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notes</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedChecklist.workshop_notes}</p>
                  </div>
                </div>
              )}

              {selectedChecklist.workshop_photos && selectedChecklist.workshop_photos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Workshop Photos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedChecklist.workshop_photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo.data}
                        alt={`Workshop Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {filterToday ? "Today's Checks" : "All Checks Completed"}
            </h1>
            <p className="text-gray-600 mt-2">
              {filterToday 
                ? `Checks completed today - ${filteredChecklists.length} records` 
                : `View all equipment checks - ${filteredChecklists.length} records`
              }
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleExport} 
            variant="outline"
            className="bg-green-600 hover:bg-green-700 text-white"
            title="Download as Excel file"
          >
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button 
            onClick={handleExportCSV} 
            variant="outline"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Faster for large datasets"
          >
            <Download className="mr-2 h-4 w-4" />
            CSV (Fast)
          </Button>
          <Button 
            onClick={() => window.open(`${API_BASE_URL}/api/checklists/export/excel`, '_blank')}
            variant="outline"
            className="text-gray-600"
            title="Opens in new tab - use if other exports timeout"
          >
            <Download className="mr-2 h-4 w-4" />
            Direct Link
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Machine Make</label>
              <select
                value={selectedMake}
                onChange={(e) => handleMakeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Makes</option>
                {makes.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Machine Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!selectedMake}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              >
                <option value="">All Models</option>
                {models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checks List */}
      <Card>
        <CardContent className="p-6">
          {loadError ? (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <p className="text-red-600 font-medium">{loadError}</p>
              <Button 
                onClick={() => fetchChecklists()} 
                variant="outline" 
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : filteredChecklists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No checks found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredChecklists.map((checklist) => (
                <Card
                  key={checklist.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleViewDetails(checklist)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-lg bg-green-100">
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{checklist.machine_make} {checklist.machine_model}</h3>
                          <p className="text-gray-600">{checklist.check_type} by {checklist.staff_name}</p>
                          <p className="text-sm text-gray-500">ID: {checklist.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(checklist.completed_at).toLocaleDateString()} at {new Date(checklist.completed_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Load More Button - only show when not filtering */}
              {hasMore && filteredChecklists.length > 0 && !selectedMake && !selectedModel && (
                <div className="mt-6 text-center">
                  <Button 
                    onClick={loadMore} 
                    disabled={loadingMore}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                        Loading more...
                      </>
                    ) : (
                      `Load More Checks (${ITEMS_PER_PAGE} at a time)`
                    )}
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">Showing {filteredChecklists.length} checks</p>
                </div>
              )}
              
              {/* Info message when filtering */}
              {(selectedMake || selectedModel) && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  <p>Filtering applied. Clear filters to load more records.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Repairs Completed Component
function RepairsCompletedPage() {
  const [repairs, setRepairs] = useState([]);
  const [filteredRepairs, setFilteredRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  
  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    fetchRepairs();
  }, []);

  useEffect(() => {
    filterRepairs();
  }, [selectedMake, selectedModel, repairs]);

  const fetchRepairs = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }
      
      const skip = append ? repairs.length : 0;
      // Fetch only REPAIR COMPLETED records from backend
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=${ITEMS_PER_PAGE}&skip=${skip}&check_type=REPAIR COMPLETED`);
      const completedRepairs = await response.json();
      
      if (append) {
        setRepairs(prev => [...prev, ...completedRepairs]);
      } else {
        setRepairs(completedRepairs);
      }
      
      // Extract unique makes
      const allRepairs = append ? [...repairs, ...completedRepairs] : completedRepairs;
      const uniqueMakes = [...new Set(allRepairs.map(c => c.machine_make))].sort();
      setMakes(uniqueMakes);
      
      // Check if there are more items to load
      setHasMore(completedRepairs.length === ITEMS_PER_PAGE);
      
    } catch (error) {
      console.error('Error fetching repairs:', error);
      toast.error('Failed to load repairs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMore = () => {
    if (!loadingMore && hasMore && !selectedMake && !selectedModel) {
      fetchRepairs(true);
    }
  };

  const filterRepairs = () => {
    let filtered = repairs;
    
    if (selectedMake) {
      filtered = filtered.filter(r => r.machine_make === selectedMake);
      
      // Update available models
      const availableModels = [...new Set(filtered.map(r => r.machine_model))].sort();
      setModels(availableModels);
    } else {
      setModels([]);
      setSelectedModel('');
    }
    
    if (selectedModel) {
      filtered = filtered.filter(r => r.machine_model === selectedModel);
    }
    
    setFilteredRepairs(filtered);
  };

  const handleMakeChange = (make) => {
    setSelectedMake(make);
    setSelectedModel('');
  };

  const handleViewDetails = (repair) => {
    setSelectedRepair(repair);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRepair(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading repairs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      {showDetailModal && selectedRepair && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Repair Details</h2>
              <Button variant="ghost" size="sm" onClick={closeDetailModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Machine</h3>
                  <p className="text-lg font-semibold">{selectedRepair.machine_make} {selectedRepair.machine_model}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Repaired By</h3>
                  <p className="text-lg">{selectedRepair.staff_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Completed At</h3>
                  <p className="text-lg">{new Date(selectedRepair.completed_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Repair Notes */}
              {selectedRepair.workshop_notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Repair Notes</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedRepair.workshop_notes}</p>
                  </div>
                </div>
              )}

              {/* Workshop Photos */}
              {selectedRepair.workshop_photos && selectedRepair.workshop_photos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Photos</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedRepair.workshop_photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo.data}
                        alt={`Repair Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-75"
                        onClick={() => window.open(photo.data, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Repairs Completed</h1>
            <p className="text-gray-600 mt-2">All completed repairs - {filteredRepairs.length} records</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Repairs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Machine Make</label>
              <select
                value={selectedMake}
                onChange={(e) => handleMakeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Makes</option>
                {makes.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Machine Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={!selectedMake}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
              >
                <option value="">All Models</option>
                {models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Repairs List */}
      <Card>
        <CardContent className="p-6">
          {filteredRepairs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wrench className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No completed repairs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRepairs.map((repair) => (
                <Card
                  key={repair.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleViewDetails(repair)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-lg bg-emerald-100">
                          <Wrench className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{repair.machine_make} {repair.machine_model}</h3>
                          <p className="text-gray-600">Repaired by {repair.staff_name}</p>
                          {repair.workshop_notes && (
                            <p className="text-sm text-gray-600 mt-1 italic line-clamp-2">{repair.workshop_notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>
                        <p className="text-sm text-gray-500 mt-2">
                          {new Date(repair.completed_at).toLocaleDateString()} at {new Date(repair.completed_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Load More Button */}
              {hasMore && filteredRepairs.length > 0 && !selectedMake && !selectedModel && (
                <div className="mt-6 text-center">
                  <Button 
                    onClick={loadMore} 
                    disabled={loadingMore}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                        Loading more...
                      </>
                    ) : (
                      `Load More Repairs (${ITEMS_PER_PAGE} at a time)`
                    )}
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">Showing {filteredRepairs.length} repairs</p>
                </div>
              )}
              
              {/* Info message when filtering */}
              {(selectedMake || selectedModel) && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  <p>Filtering applied. Clear filters to load more records.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Near Misses Page Component
function NearMissesPage() {
  const [nearMisses, setNearMisses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState('all'); // all, new, acknowledged
  const [locationFilter, setLocationFilter] = useState('all'); // all, Farm, Field, Storage, Grading
  const [newComment, setNewComment] = useState('');
  const navigate = useNavigate();
  const { employee } = useAuth();
  const isAdmin = employee?.admin_control === 'yes';
  const isManager = employee?.manager_control === 'yes';
  const canInvestigate = isAdmin || isManager;
  
  // Investigation form state
  const [investigationMode, setInvestigationMode] = useState(false);
  const [investigationData, setInvestigationData] = useState({
    severity: '',
    action_required: '',
    progress: 'not_started',
    investigation_notes: '',
    no_swp_or_not_covered: false,
    swp_training_not_received: false,
    trained_but_not_following: false
  });
  const [savingInvestigation, setSavingInvestigation] = useState(false);

  useEffect(() => {
    fetchNearMisses();
  }, []);

  const fetchNearMisses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/near-misses?limit=200`);
      const data = await response.json();
      setNearMisses(data);
    } catch (error) {
      console.error('Error fetching near misses:', error);
      toast.error('Failed to load near misses');
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeNearMiss = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/near-misses/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: employee?.name || 'Admin' })
      });
      
      if (response.ok) {
        toast.success('Near miss acknowledged');
        fetchNearMisses();
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Error acknowledging near miss:', error);
      toast.error('Failed to acknowledge');
    }
  };

  const addComment = async (id) => {
    if (!newComment.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/near-misses/${id}/comment?comment=${encodeURIComponent(newComment)}&commented_by=${encodeURIComponent(employee?.name || 'Admin')}`, {
        method: 'POST'
      });
      if (response.ok) {
        toast.success('Comment added');
        setNewComment('');
        fetchNearMisses();
        const updatedItems = await (await fetch(`${API_BASE_URL}/api/near-misses?limit=200`)).json();
        const updated = updatedItems.find(a => a.id === id);
        if (updated) setSelectedItem(updated);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  // Open investigation mode with existing data
  const openInvestigation = (item) => {
    setInvestigationData({
      severity: item.severity || '',
      action_required: item.action_required || '',
      progress: item.progress || 'not_started',
      investigation_notes: item.investigation_notes || '',
      no_swp_or_not_covered: item.no_swp_or_not_covered || false,
      swp_training_not_received: item.swp_training_not_received || false,
      trained_but_not_following: item.trained_but_not_following || false
    });
    setInvestigationMode(true);
  };

  // Save investigation data
  const saveInvestigation = async () => {
    if (!selectedItem) return;
    setSavingInvestigation(true);
    try {
      const params = new URLSearchParams({
        severity: investigationData.severity,
        action_required: investigationData.action_required,
        progress: investigationData.progress,
        investigation_notes: investigationData.investigation_notes,
        no_swp_or_not_covered: investigationData.no_swp_or_not_covered,
        swp_training_not_received: investigationData.swp_training_not_received,
        trained_but_not_following: investigationData.trained_but_not_following,
        investigated_by: employee?.name || 'Admin'
      });
      
      const response = await fetch(`${API_BASE_URL}/api/near-misses/${selectedItem.id}/investigate?${params}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        toast.success('Investigation saved successfully');
        setInvestigationMode(false);
        fetchNearMisses();
        // Refresh the selected item
        const updatedItems = await (await fetch(`${API_BASE_URL}/api/near-misses?limit=200`)).json();
        const updated = updatedItems.find(a => a.id === selectedItem.id);
        if (updated) setSelectedItem(updated);
      } else {
        toast.error('Failed to save investigation');
      }
    } catch (error) {
      console.error('Error saving investigation:', error);
      toast.error('Failed to save investigation');
    } finally {
      setSavingInvestigation(false);
    }
  };

  // Helper to get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'red': return 'bg-red-500';
      case 'orange': return 'bg-orange-500';
      case 'green': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  // Helper to get progress label
  const getProgressLabel = (progress) => {
    switch (progress) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Not Started';
    }
  };

  const filteredItems = nearMisses.filter(item => {
    // Status filter
    if (filter === 'new' && item.acknowledged) return false;
    if (filter === 'acknowledged' && !item.acknowledged) return false;
    // Location filter
    if (locationFilter !== 'all' && item.location !== locationFilter) return false;
    return true;
  });

  // Get unique locations for filter dropdown
  const locations = [...new Set(nearMisses.map(item => item.location).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Near Misses</h1>
              <p className="text-sm text-gray-600">{filteredItems.length} reports</p>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            data-testid="near-miss-location-filter"
          >
            <option value="all">All Locations</option>
            <option value="Farm">Farm</option>
            <option value="Field">Field</option>
            <option value="Storage">Storage</option>
            <option value="Grading">Grading</option>
          </select>
          
          {/* Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            data-testid="near-miss-filter"
          >
            <option value="all">All Reports</option>
            <option value="new">New (Unacknowledged)</option>
            <option value="acknowledged">Acknowledged</option>
          </select>
          
          {/* Export Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${API_BASE_URL}/api/near-misses/export/excel`, '_blank')}
            className="flex items-center gap-1"
            data-testid="near-miss-export-btn"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No near misses reported yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                !item.acknowledged ? 'border-red-200 bg-red-50' : ''
              }`}
              onClick={() => { setSelectedItem(item); setInvestigationMode(false); }}
              data-testid={`near-miss-item-${item.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {/* Severity indicator */}
                      {item.severity && (
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(item.severity)}`} title={`Severity: ${item.severity}`} />
                      )}
                      {!item.acknowledged && (
                        <Badge className="bg-red-500 text-white">New</Badge>
                      )}
                      {item.location && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">{item.location}</Badge>
                      )}
                      {/* Progress indicator */}
                      {item.progress && item.progress !== 'not_started' && (
                        <Badge 
                          variant="outline" 
                          className={item.progress === 'completed' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-blue-50 text-blue-700 border-blue-300'}
                        >
                          {getProgressLabel(item.progress)}
                        </Badge>
                      )}
                      {item.is_anonymous ? (
                        <Badge variant="outline" className="text-gray-500">Anonymous</Badge>
                      ) : (
                        <span className="text-sm font-medium text-gray-700">{item.submitted_by}</span>
                      )}
                    </div>
                    <p className="text-gray-800 line-clamp-2">{item.description}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                    {/* Display actual comments/notes */}
                    {item.comments && item.comments.length > 0 && (
                      <div className="mt-2 space-y-1 border-t pt-2">
                        <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Notes ({item.comments.length})
                        </p>
                        {item.comments.slice(-2).map((comment, idx) => (
                          <div key={idx} className="text-xs bg-blue-50 p-2 rounded border-l-2 border-blue-400">
                            <p className="text-gray-700">{comment.text}</p>
                            <p className="text-gray-400 mt-1">{comment.by || comment.commented_by} • {comment.at || comment.commented_at ? new Date(comment.at || comment.commented_at).toLocaleDateString() : ''}</p>
                          </div>
                        ))}
                        {item.comments.length > 2 && (
                          <p className="text-xs text-blue-600">+{item.comments.length - 2} more note{item.comments.length - 2 !== 1 ? 's' : ''}...</p>
                        )}
                      </div>
                    )}
                  </div>
                  {item.photos && item.photos.length > 0 && (
                    <div className="ml-4 flex items-center gap-1">
                      <Camera className="h-5 w-5 text-gray-400" />
                      <span className="text-xs text-gray-400">{item.photos.length}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto relative z-[10000]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Near Miss Report</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {!selectedItem.acknowledged ? (
                  <Badge className="bg-red-500 text-white">Unacknowledged</Badge>
                ) : (
                  <Badge className="bg-green-500 text-white">Acknowledged</Badge>
                )}
                {selectedItem.is_anonymous ? (
                  <Badge variant="outline">Anonymous</Badge>
                ) : (
                  <span className="text-sm text-gray-600">By: {selectedItem.submitted_by}</span>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-gray-800">{selectedItem.description}</p>
              </div>

              {selectedItem.location && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Location</p>
                  <p className="text-gray-800">{selectedItem.location}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 mb-1">Reported</p>
                <p className="text-gray-800">{new Date(selectedItem.created_at).toLocaleString()}</p>
              </div>

              {selectedItem.acknowledged && selectedItem.acknowledged_by && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700">
                    Acknowledged by {selectedItem.acknowledged_by} on {new Date(selectedItem.acknowledged_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Photos */}
              {selectedItem.photos && selectedItem.photos.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Photos ({selectedItem.photos.length})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedItem.photos.map((photo, idx) => (
                      <img 
                        key={idx}
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Investigation Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Investigation
                  </h4>
                  {canInvestigate && !investigationMode && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openInvestigation(selectedItem)}
                      data-testid="edit-investigation-btn"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      {selectedItem.severity ? 'Edit' : 'Add Investigation'}
                    </Button>
                  )}
                </div>

                {investigationMode ? (
                  /* Investigation Edit Form */
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    {/* Severity */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Severity *</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'red', label: 'High (Red)', color: 'bg-red-500 hover:bg-red-600' },
                          { value: 'orange', label: 'Medium (Orange)', color: 'bg-orange-500 hover:bg-orange-600' },
                          { value: 'green', label: 'Low (Green)', color: 'bg-green-500 hover:bg-green-600' }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setInvestigationData({...investigationData, severity: opt.value})}
                            className={`flex-1 px-3 py-2 rounded-md text-white text-sm font-medium transition-all ${opt.color} ${
                              investigationData.severity === opt.value ? 'ring-2 ring-offset-2 ring-gray-800' : 'opacity-60'
                            }`}
                            data-testid={`severity-${opt.value}-btn`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Progress</label>
                      <select
                        value={investigationData.progress}
                        onChange={(e) => setInvestigationData({...investigationData, progress: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        data-testid="investigation-progress-select"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    {/* Action Required */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Action to be Taken</label>
                      <textarea
                        value={investigationData.action_required}
                        onChange={(e) => setInvestigationData({...investigationData, action_required: e.target.value})}
                        placeholder="Describe the action to be taken..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        data-testid="investigation-action-textarea"
                      />
                    </div>

                    {/* Investigation Notes */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Investigation Notes</label>
                      <textarea
                        value={investigationData.investigation_notes}
                        onChange={(e) => setInvestigationData({...investigationData, investigation_notes: e.target.value})}
                        placeholder="Additional notes..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        data-testid="investigation-notes-textarea"
                      />
                    </div>

                    {/* SWP Checkboxes */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">Safe Working Procedure (SWP) Assessment</p>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={investigationData.no_swp_or_not_covered}
                          onChange={(e) => setInvestigationData({...investigationData, no_swp_or_not_covered: e.target.checked})}
                          className="mt-1"
                          data-testid="swp-not-covered-checkbox"
                        />
                        <span className="text-sm text-gray-700">No SWP in place or existing SWP doesn't cover this</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={investigationData.swp_training_not_received}
                          onChange={(e) => setInvestigationData({...investigationData, swp_training_not_received: e.target.checked})}
                          className="mt-1"
                          data-testid="swp-training-checkbox"
                        />
                        <span className="text-sm text-gray-700">Training on SWP not received by person</span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={investigationData.trained_but_not_following}
                          onChange={(e) => setInvestigationData({...investigationData, trained_but_not_following: e.target.checked})}
                          className="mt-1"
                          data-testid="swp-not-following-checkbox"
                        />
                        <span className="text-sm text-gray-700">Trained but individual not following SWP</span>
                      </label>
                    </div>

                    {/* Save/Cancel Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setInvestigationMode(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={saveInvestigation}
                        disabled={savingInvestigation || !investigationData.severity}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        data-testid="save-investigation-btn"
                      >
                        {savingInvestigation ? 'Saving...' : 'Save Investigation'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Investigation Display */
                  selectedItem.severity ? (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Severity:</span>
                          <div className={`px-3 py-1 rounded-full text-white text-xs font-medium ${getSeverityColor(selectedItem.severity)}`}>
                            {selectedItem.severity.charAt(0).toUpperCase() + selectedItem.severity.slice(1)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Progress:</span>
                          <Badge variant="outline" className={
                            selectedItem.progress === 'completed' ? 'bg-green-50 text-green-700' :
                            selectedItem.progress === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }>
                            {getProgressLabel(selectedItem.progress)}
                          </Badge>
                        </div>
                      </div>

                      {selectedItem.action_required && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Action to be Taken</p>
                          <p className="text-sm text-gray-800">{selectedItem.action_required}</p>
                        </div>
                      )}

                      {selectedItem.investigation_notes && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Investigation Notes</p>
                          <p className="text-sm text-gray-800">{selectedItem.investigation_notes}</p>
                        </div>
                      )}

                      {/* SWP Assessment Display */}
                      {(selectedItem.no_swp_or_not_covered || selectedItem.swp_training_not_received || selectedItem.trained_but_not_following) && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">SWP Assessment</p>
                          <div className="space-y-1">
                            {selectedItem.no_swp_or_not_covered && (
                              <div className="flex items-center gap-2 text-sm text-amber-700">
                                <AlertCircle className="h-4 w-4" />
                                <span>No SWP in place or doesn't cover this</span>
                              </div>
                            )}
                            {selectedItem.swp_training_not_received && (
                              <div className="flex items-center gap-2 text-sm text-amber-700">
                                <AlertCircle className="h-4 w-4" />
                                <span>Training on SWP not received</span>
                              </div>
                            )}
                            {selectedItem.trained_but_not_following && (
                              <div className="flex items-center gap-2 text-sm text-amber-700">
                                <AlertCircle className="h-4 w-4" />
                                <span>Trained but not following SWP</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedItem.investigated_by && (
                        <p className="text-xs text-gray-400 pt-2 border-t">
                          Investigated by {selectedItem.investigated_by} on {new Date(selectedItem.investigated_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No investigation recorded yet</p>
                  )
                )}
              </div>

              {/* Comments Section */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Comments
                </h4>
                {selectedItem.comments?.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {selectedItem.comments.map((comment, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                        <p className="text-gray-800">{comment.text}</p>
                        <p className="text-xs text-gray-500 mt-1">{comment.by} - {new Date(comment.at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-3">No comments yet</p>
                )}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)} 
                    placeholder="Add a comment..." 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" 
                  />
                  <Button size="sm" onClick={() => addComment(selectedItem.id)} disabled={!newComment.trim()}>Add</Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => { setSelectedItem(null); setNewComment(''); setInvestigationMode(false); }} className="flex-1">
                  Close
                </Button>
                {isAdmin && !selectedItem.acknowledged && (
                  <Button 
                    onClick={() => acknowledgeNearMiss(selectedItem.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    data-testid="acknowledge-near-miss-btn"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Suggestions Page Component
function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState('all'); // all, new, reviewed, implemented, declined
  const [locationFilter, setLocationFilter] = useState('all'); // all, Farm, Field, Storage, Grading
  const [reviewNotes, setReviewNotes] = useState('');
  const [newComment, setNewComment] = useState('');
  const navigate = useNavigate();
  const { employee } = useAuth();
  const isAdmin = employee?.admin_control === 'yes';

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/suggestions?limit=200`);
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const reviewSuggestion = async (id, status) => {
    try {
      const params = new URLSearchParams({
        status,
        reviewed_by: employee?.name || 'Admin',
        ...(reviewNotes && { review_notes: reviewNotes })
      });
      
      const response = await fetch(`${API_BASE_URL}/api/suggestions/${id}/review?${params}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        toast.success(`Suggestion marked as ${status}`);
        fetchSuggestions();
        setSelectedItem(null);
        setReviewNotes('');
      }
    } catch (error) {
      console.error('Error reviewing suggestion:', error);
      toast.error('Failed to review suggestion');
    }
  };

  const addComment = async (id) => {
    if (!newComment.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/suggestions/${id}/comment?comment=${encodeURIComponent(newComment)}&commented_by=${encodeURIComponent(employee?.name || 'Admin')}`, {
        method: 'POST'
      });
      if (response.ok) {
        toast.success('Comment added');
        setNewComment('');
        fetchSuggestions();
        const updatedItems = await (await fetch(`${API_BASE_URL}/api/suggestions?limit=200`)).json();
        const updated = updatedItems.find(a => a.id === id);
        if (updated) setSelectedItem(updated);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const filteredItems = suggestions.filter(item => {
    // Status filter
    if (filter === 'new' && item.status !== 'new') return false;
    if (filter === 'reviewed' && item.status !== 'reviewed') return false;
    if (filter === 'implemented' && item.status !== 'implemented') return false;
    if (filter === 'declined' && item.status !== 'declined') return false;
    // Location filter
    if (locationFilter !== 'all' && item.location !== locationFilter) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new': return <Badge className="bg-blue-500 text-white">New</Badge>;
      case 'reviewed': return <Badge className="bg-yellow-500 text-white">Reviewed</Badge>;
      case 'implemented': return <Badge className="bg-green-500 text-white">Implemented</Badge>;
      case 'declined': return <Badge className="bg-gray-500 text-white">Declined</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category) => {
    if (!category) return null;
    const colors = {
      'Financial': 'bg-green-100 text-green-700',
      'Well Being': 'bg-blue-100 text-blue-700',
      'Health and Safety': 'bg-red-100 text-red-700',
      safety: 'bg-red-100 text-red-700',
      efficiency: 'bg-blue-100 text-blue-700',
      equipment: 'bg-orange-100 text-orange-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return <Badge variant="outline" className={colors[category] || colors.other}>{category}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Suggestions</h1>
              <p className="text-sm text-gray-600">{filteredItems.length} suggestions</p>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="suggestion-location-filter"
          >
            <option value="all">All Locations</option>
            <option value="Farm">Farm</option>
            <option value="Field">Field</option>
            <option value="Storage">Storage</option>
            <option value="Grading">Grading</option>
          </select>
          
          {/* Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="suggestion-filter"
          >
            <option value="all">All Suggestions</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="implemented">Implemented</option>
            <option value="declined">Declined</option>
          </select>
          
          {/* Export Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${API_BASE_URL}/api/suggestions/export/excel`, '_blank')}
            className="flex items-center gap-1"
            data-testid="suggestion-export-btn"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No suggestions submitted yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                item.status === 'new' ? 'border-indigo-200 bg-indigo-50' : ''
              }`}
              onClick={() => setSelectedItem(item)}
              data-testid={`suggestion-item-${item.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatusBadge(item.status)}
                      {getCategoryBadge(item.category)}
                      {item.location && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">{item.location}</Badge>
                      )}
                      {item.is_anonymous ? (
                        <Badge variant="outline" className="text-gray-500">Anonymous</Badge>
                      ) : (
                        <span className="text-sm font-medium text-gray-700">{item.submitted_by}</span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2 mt-1">{item.description}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                    {/* Display actual comments/notes */}
                    {item.comments && item.comments.length > 0 && (
                      <div className="mt-2 space-y-1 border-t pt-2">
                        <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Notes ({item.comments.length})
                        </p>
                        {item.comments.slice(-2).map((comment, idx) => (
                          <div key={idx} className="text-xs bg-indigo-50 p-2 rounded border-l-2 border-indigo-400">
                            <p className="text-gray-700">{comment.text}</p>
                            <p className="text-gray-400 mt-1">{comment.by || comment.commented_by} • {comment.at || comment.commented_at ? new Date(comment.at || comment.commented_at).toLocaleDateString() : ''}</p>
                          </div>
                        ))}
                        {item.comments.length > 2 && (
                          <p className="text-xs text-indigo-600">+{item.comments.length - 2} more note{item.comments.length - 2 !== 1 ? 's' : ''}...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto relative z-[10000]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Suggestion Details</h3>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(null); setReviewNotes(''); }}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(selectedItem.status)}
                {getCategoryBadge(selectedItem.category)}
                {selectedItem.is_anonymous ? (
                  <Badge variant="outline">Anonymous</Badge>
                ) : (
                  <span className="text-sm text-gray-600">By: {selectedItem.submitted_by}</span>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Title</p>
                <p className="text-gray-900 font-medium">{selectedItem.title}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-gray-800">{selectedItem.description}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Submitted</p>
                <p className="text-gray-800">{new Date(selectedItem.created_at).toLocaleString()}</p>
              </div>

              {selectedItem.reviewed_at && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">
                    Reviewed by {selectedItem.reviewed_by} on {new Date(selectedItem.reviewed_at).toLocaleString()}
                  </p>
                  {selectedItem.review_notes && (
                    <p className="text-sm text-gray-700 mt-1">Notes: {selectedItem.review_notes}</p>
                  )}
                </div>
              )}

              {/* Admin Actions */}
              {/* Comments Section */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Comments
                </h4>
                {selectedItem.comments?.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {selectedItem.comments.map((comment, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                        <p className="text-gray-800">{comment.text}</p>
                        <p className="text-xs text-gray-500 mt-1">{comment.by} - {new Date(comment.at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-3">No comments yet</p>
                )}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)} 
                    placeholder="Add a comment..." 
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" 
                  />
                  <Button size="sm" onClick={() => addComment(selectedItem.id)} disabled={!newComment.trim()}>Add</Button>
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && selectedItem.status === 'new' && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Review this suggestion</p>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add review notes (optional)"
                    rows={2}
                    className="mb-3"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      onClick={() => reviewSuggestion(selectedItem.id, 'reviewed')}
                      variant="outline"
                      size="sm"
                      className="border-yellow-500 text-yellow-700"
                    >
                      Mark Reviewed
                    </Button>
                    <Button 
                      onClick={() => reviewSuggestion(selectedItem.id, 'implemented')}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Mark Implemented
                    </Button>
                    <Button 
                      onClick={() => reviewSuggestion(selectedItem.id, 'declined')}
                      variant="outline"
                      size="sm"
                      className="border-gray-400 text-gray-600"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {/* Close button for non-new or non-admin */}
              {(!isAdmin || selectedItem.status !== 'new') && (
                <div className="flex justify-end mt-6">
                  <Button onClick={() => { setSelectedItem(null); setReviewNotes(''); setNewComment(''); }}>
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Accidents Page Component
function AccidentsPage() {
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState('all');
  const [newComment, setNewComment] = useState('');
  const [investigationNotes, setInvestigationNotes] = useState('');
  // RIDDOR Section 5 state
  const [riddorReportable, setRiddorReportable] = useState(false);
  const [riddorHowReported, setRiddorHowReported] = useState('');
  const [riddorDateReported, setRiddorDateReported] = useState('');
  const navigate = useNavigate();
  const { employee } = useAuth();
  const isAdmin = employee?.admin_control === 'yes';

  useEffect(() => {
    fetchAccidents();
  }, []);

  const fetchAccidents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accidents?limit=200`);
      const data = await response.json();
      setAccidents(data);
    } catch (error) {
      console.error('Error fetching accidents:', error);
      toast.error('Failed to load accidents');
    } finally {
      setLoading(false);
    }
  };

  // Update RIDDOR details
  const updateRiddor = async (id) => {
    try {
      const params = new URLSearchParams({
        riddor_reportable: riddorReportable.toString(),
        ...(riddorHowReported && { how_reported: riddorHowReported }),
        ...(riddorDateReported && { date_reported: riddorDateReported })
      });
      
      const response = await fetch(`${API_BASE_URL}/api/accidents/${id}/riddor?${params}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        toast.success('RIDDOR details updated');
        fetchAccidents();
        // Refresh selected item
        const updatedAccidents = await (await fetch(`${API_BASE_URL}/api/accidents?limit=200`)).json();
        const updated = updatedAccidents.find(a => a.id === id);
        if (updated) setSelectedItem(updated);
      }
    } catch (error) {
      console.error('Error updating RIDDOR:', error);
      toast.error('Failed to update RIDDOR details');
    }
  };

  const investigateAccident = async (id, status) => {
    try {
      const params = new URLSearchParams({
        status,
        investigated_by: employee?.name || 'Admin',
        ...(investigationNotes && { investigation_notes: investigationNotes })
      });
      
      const response = await fetch(`${API_BASE_URL}/api/accidents/${id}/investigate?${params}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        toast.success(`Accident marked as ${status}`);
        fetchAccidents();
        setSelectedItem(null);
        setInvestigationNotes('');
      }
    } catch (error) {
      console.error('Error updating accident:', error);
      toast.error('Failed to update accident');
    }
  };

  const addComment = async (id) => {
    if (!newComment.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/accidents/${id}/comment?comment=${encodeURIComponent(newComment)}&commented_by=${encodeURIComponent(employee?.name || 'Admin')}`, {
        method: 'POST'
      });
      if (response.ok) {
        toast.success('Comment added');
        setNewComment('');
        fetchAccidents();
        // Refresh selected item
        const updatedAccidents = await (await fetch(`${API_BASE_URL}/api/accidents?limit=200`)).json();
        const updated = updatedAccidents.find(a => a.id === id);
        if (updated) setSelectedItem(updated);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const filteredItems = accidents.filter(item => {
    if (filter === 'new') return item.status === 'new';
    if (filter === 'investigating') return item.status === 'investigating';
    if (filter === 'closed') return item.status === 'closed';
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'new': return <Badge className="bg-red-500 text-white">New</Badge>;
      case 'investigating': return <Badge className="bg-yellow-500 text-white">Investigating</Badge>;
      case 'closed': return <Badge className="bg-green-500 text-white">Closed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShieldAlert className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Accidents</h1>
              <p className="text-sm text-gray-600">{filteredItems.length} reports</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            data-testid="accident-filter"
          >
            <option value="all">All Reports</option>
            <option value="new">New</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </select>
          
          {/* Export Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${API_BASE_URL}/api/accidents/export/excel`, '_blank')}
            className="flex items-center gap-1"
            data-testid="accident-export-btn"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No accidents reported</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                item.status === 'new' ? 'border-red-200 bg-red-50' : item.status === 'investigating' ? 'border-yellow-200 bg-yellow-50' : ''
              }`}
              onClick={() => setSelectedItem(item)}
              data-testid={`accident-item-${item.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatusBadge(item.status)}
                      {item.report_number && <Badge variant="outline" className="text-gray-600">#{item.report_number}</Badge>}
                      {item.accident_location && <Badge variant="outline" className="bg-orange-50 text-orange-700">{item.accident_location}</Badge>}
                      {item.riddor_reportable && <Badge className="bg-orange-600 text-white text-xs">RIDDOR</Badge>}
                    </div>
                    <p className="font-medium text-gray-900">{item.injured_name || 'Unknown'}</p>
                    <p className="text-gray-600 text-sm line-clamp-2 mt-1">{item.accident_description || item.description}</p>
                    {item.injury_details && (
                      <p className="text-sm text-red-600 mt-1">Injury: {item.injury_details}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {item.accident_date} {item.accident_time} | Reported by: {item.reporter_name || item.reported_by}
                    </p>
                    {/* Display actual comments/notes */}
                    {item.comments && item.comments.length > 0 && (
                      <div className="mt-2 space-y-1 border-t pt-2">
                        <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Notes ({item.comments.length})
                        </p>
                        {item.comments.slice(-2).map((comment, idx) => (
                          <div key={idx} className="text-xs bg-purple-50 p-2 rounded border-l-2 border-purple-400">
                            <p className="text-gray-700">{comment.text}</p>
                            <p className="text-gray-400 mt-1">{comment.by || comment.commented_by} • {comment.at || comment.commented_at ? new Date(comment.at || comment.commented_at).toLocaleDateString() : ''}</p>
                          </div>
                        ))}
                        {item.comments.length > 2 && (
                          <p className="text-xs text-purple-600">+{item.comments.length - 2} more note{item.comments.length - 2 !== 1 ? 's' : ''}...</p>
                        )}
                      </div>
                    )}
                  </div>
                  {item.photos && item.photos.length > 0 && (
                    <div className="ml-4 flex items-center gap-1">
                      <Camera className="h-5 w-5 text-gray-400" />
                      <span className="text-xs text-gray-400">{item.photos.length}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto relative z-[10000]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Accident Report</h3>
                {selectedItem.report_number && <p className="text-sm text-gray-500">Report #{selectedItem.report_number}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(null); setInvestigationNotes(''); setRiddorReportable(false); setRiddorHowReported(''); setRiddorDateReported(''); }}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(selectedItem.status)}
                {selectedItem.riddor_reportable && <Badge className="bg-orange-600 text-white">RIDDOR Reported</Badge>}
              </div>

              {/* Section 1: About the person who had the accident */}
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-2 text-sm">Section 1: Person who had the accident</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-gray-500">Name</p><p className="text-gray-800">{selectedItem.injured_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Occupation</p><p className="text-gray-800">{selectedItem.injured_occupation || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Address</p><p className="text-gray-800">{selectedItem.injured_address || '-'} {selectedItem.injured_postcode}</p></div>
                </div>
              </div>

              {/* Section 2: About the person filling in this record */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2 text-sm">Section 2: Person filling in this record</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-xs text-gray-500">Name</p><p className="text-gray-800">{selectedItem.reporter_name || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Occupation</p><p className="text-gray-800">{selectedItem.reporter_occupation || '-'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-gray-500">Address</p><p className="text-gray-800">{selectedItem.reporter_address || '-'} {selectedItem.reporter_postcode}</p></div>
                </div>
              </div>

              {/* Section 3: About the accident */}
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-900 mb-2 text-sm">Section 3: About the accident</h4>
                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div><p className="text-xs text-gray-500">Date</p><p className="text-gray-800">{selectedItem.accident_date || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Time</p><p className="text-gray-800">{selectedItem.accident_time || '-'}</p></div>
                </div>
                <div className="mb-2"><p className="text-xs text-gray-500">Where did the accident happen?</p><p className="text-gray-800">{selectedItem.accident_location || '-'}</p></div>
                <div className="mb-2"><p className="text-xs text-gray-500">How did the accident happen?</p><p className="text-gray-800">{selectedItem.accident_description || '-'}</p></div>
                {selectedItem.injury_details && <div><p className="text-xs text-gray-500">Injury suffered</p><p className="text-gray-800">{selectedItem.injury_details}</p></div>}
              </div>

              {/* Section 4: Employee consent */}
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2 text-sm">Section 4: Employee Consent</h4>
                <p className="text-sm text-gray-700">
                  {selectedItem.employee_consent 
                    ? '✓ Employee consented to disclosure of information to health and safety representatives'
                    : '✗ Employee did not consent to disclosure'}
                </p>
              </div>

              {/* Section 5: For the employer only - RIDDOR */}
              <div className="p-3 bg-gray-100 rounded-lg border border-gray-300">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Section 5: For the employer only (RIDDOR)</h4>
                {selectedItem.riddor_reportable ? (
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">Reportable under RIDDOR:</span> <span className="text-green-700 font-medium">Yes</span></p>
                    {selectedItem.riddor_how_reported && <p><span className="text-gray-500">How reported:</span> {selectedItem.riddor_how_reported}</p>}
                    {selectedItem.riddor_date_reported && <p><span className="text-gray-500">Date reported:</span> {selectedItem.riddor_date_reported}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Not yet marked as RIDDOR reportable</p>
                )}
                
                {isAdmin && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs text-gray-500 mb-2">Update RIDDOR details (Admin only)</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={riddorReportable || selectedItem.riddor_reportable}
                          onChange={(e) => setRiddorReportable(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm">Reportable under RIDDOR</span>
                      </label>
                      <div>
                        <label className="text-xs text-gray-500">How was it reported?</label>
                        <select
                          value={riddorHowReported || selectedItem.riddor_how_reported || ''}
                          onChange={(e) => setRiddorHowReported(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm mt-1"
                        >
                          <option value="">Select method...</option>
                          <option value="Online">Online</option>
                          <option value="Telephone">Telephone</option>
                          <option value="Written">Written</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Date reported to RIDDOR</label>
                        <input
                          type="date"
                          value={riddorDateReported || selectedItem.riddor_date_reported || ''}
                          onChange={(e) => setRiddorDateReported(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm mt-1"
                        />
                      </div>
                      <Button size="sm" onClick={() => updateRiddor(selectedItem.id)} className="mt-2">
                        Save RIDDOR Details
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Photos */}
              {selectedItem.photos?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Photos ({selectedItem.photos.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedItem.photos.map((photo, idx) => (
                      <img key={idx} src={photo} alt={`Photo ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border" />
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.investigated_at && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Investigation by {selectedItem.investigated_by} on {new Date(selectedItem.investigated_at).toLocaleString()}</p>
                  {selectedItem.investigation_notes && <p className="text-sm text-gray-700 mt-1">{selectedItem.investigation_notes}</p>}
                </div>
              )}

              {/* Comments Section */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</h4>
                {selectedItem.comments?.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {selectedItem.comments.map((comment, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
                        <p className="text-gray-800">{comment.text}</p>
                        <p className="text-xs text-gray-500 mt-1">{comment.by} - {new Date(comment.at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-3">No comments yet</p>
                )}
                <div className="flex gap-2">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  <Button size="sm" onClick={() => addComment(selectedItem.id)} disabled={!newComment.trim()}>Add</Button>
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && selectedItem.status !== 'closed' && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Update Investigation Status</p>
                  <Textarea value={investigationNotes} onChange={(e) => setInvestigationNotes(e.target.value)} placeholder="Investigation notes (optional)" rows={2} className="mb-3" />
                  <div className="flex gap-2 flex-wrap">
                    {selectedItem.status === 'new' && (
                      <Button onClick={() => investigateAccident(selectedItem.id, 'investigating')} variant="outline" className="border-yellow-500 text-yellow-700">
                        Start Investigation
                      </Button>
                    )}
                    <Button onClick={() => investigateAccident(selectedItem.id, 'closed')} className="bg-green-600 hover:bg-green-700">
                      Close Investigation
                    </Button>
                  </div>
                </div>
              )}

              {(!isAdmin || selectedItem.status === 'closed') && (
                <div className="flex justify-end mt-6">
                  <Button onClick={() => { setSelectedItem(null); setInvestigationNotes(''); }}>Close</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Whistleblowing Page Component
function WhistleblowingPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [newComment, setNewComment] = useState('');
  const [investigationNotes, setInvestigationNotes] = useState('');
  const navigate = useNavigate();
  const { employee } = useAuth();
  const isAdmin = employee?.admin_control === 'yes';

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/whistleblowing?limit=200`);
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const investigateReport = async (id, status) => {
    try {
      const params = new URLSearchParams({
        status,
        investigated_by: employee?.name || 'Admin',
        ...(investigationNotes && { investigation_notes: investigationNotes })
      });
      const response = await fetch(`${API_BASE_URL}/api/whistleblowing/${id}/investigate?${params}`, { method: 'PUT' });
      if (response.ok) {
        toast.success(`Report marked as ${status}`);
        fetchReports();
        setSelectedItem(null);
        setInvestigationNotes('');
      }
    } catch (error) {
      toast.error('Failed to update report');
    }
  };

  const addComment = async (id) => {
    if (!newComment.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/whistleblowing/${id}/comment?comment=${encodeURIComponent(newComment)}&commented_by=${encodeURIComponent(employee?.name || 'Admin')}`, { method: 'POST' });
      if (response.ok) {
        toast.success('Comment added');
        setNewComment('');
        fetchReports();
        const updated = (await (await fetch(`${API_BASE_URL}/api/whistleblowing?limit=200`)).json()).find(a => a.id === id);
        if (updated) setSelectedItem(updated);
      }
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const filteredItems = reports.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (locationFilter !== 'all' && item.location !== locationFilter) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    const badges = {
      'new': <Badge className="bg-amber-500 text-white">New</Badge>,
      'investigating': <Badge className="bg-yellow-500 text-white">Investigating</Badge>,
      'resolved': <Badge className="bg-green-500 text-white">Resolved</Badge>,
      'dismissed': <Badge className="bg-gray-500 text-white">Dismissed</Badge>
    };
    return badges[status] || <Badge variant="outline">{status}</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center p-8"><RefreshCw className="h-8 w-8 animate-spin text-amber-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 rounded-lg"><AlertCircle className="h-6 w-6 text-amber-600" /></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Whistleblowing Reports</h1>
              <p className="text-sm text-gray-600">{filteredItems.length} reports</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
            <option value="all">All Locations</option>
            <option value="Farm">Farm</option>
            <option value="Field">Field</option>
            <option value="Storage">Storage</option>
            <option value="Grading">Grading</option>
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
            <option value="all">All Reports</option>
            <option value="new">New</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          
          {/* Export Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`${API_BASE_URL}/api/whistleblowing/export/excel`, '_blank')}
            className="flex items-center gap-1"
            data-testid="whistleblowing-export-btn"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">No reports submitted</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className={`hover:shadow-md cursor-pointer ${item.status === 'new' ? 'border-amber-200 bg-amber-50' : ''}`} onClick={() => setSelectedItem(item)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {getStatusBadge(item.status)}
                  {item.category && <Badge variant="outline">{item.category}</Badge>}
                  {item.location && <Badge variant="outline" className="bg-orange-50 text-orange-700">{item.location}</Badge>}
                  {item.is_anonymous ? <Badge variant="outline" className="text-gray-500">Anonymous</Badge> : <span className="text-sm text-gray-700">{item.submitted_by}</span>}
                </div>
                <h3 className="font-medium text-gray-900">{item.title}</h3>
                <p className="text-gray-600 text-sm line-clamp-2 mt-1">{item.description}</p>
                <p className="text-xs text-gray-400 mt-2">{new Date(item.created_at).toLocaleString()}</p>
                {/* Display actual comments/notes */}
                {item.comments && item.comments.length > 0 && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Notes ({item.comments.length})
                    </p>
                    {item.comments.slice(-2).map((comment, idx) => (
                      <div key={idx} className="text-xs bg-amber-50 p-2 rounded border-l-2 border-amber-400">
                        <p className="text-gray-700">{comment.text}</p>
                        <p className="text-gray-400 mt-1">{comment.by || comment.commented_by} • {comment.at || comment.commented_at ? new Date(comment.at || comment.commented_at).toLocaleDateString() : ''}</p>
                      </div>
                    ))}
                    {item.comments.length > 2 && (
                      <p className="text-xs text-amber-600">+{item.comments.length - 2} more note{item.comments.length - 2 !== 1 ? 's' : ''}...</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Whistleblowing Report</h3>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(null); setInvestigationNotes(''); }}><X className="h-5 w-5" /></Button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(selectedItem.status)}
                {selectedItem.category && <Badge variant="outline">{selectedItem.category}</Badge>}
                {selectedItem.is_anonymous ? <Badge variant="outline">Anonymous</Badge> : <span className="text-sm text-gray-600">By: {selectedItem.submitted_by}</span>}
              </div>
              <div><p className="text-xs text-gray-500">Title</p><p className="font-medium">{selectedItem.title}</p></div>
              <div><p className="text-xs text-gray-500">Description</p><p>{selectedItem.description}</p></div>
              {selectedItem.location && <div><p className="text-xs text-gray-500">Location</p><p>{selectedItem.location}</p></div>}
              <div><p className="text-xs text-gray-500">Submitted</p><p>{new Date(selectedItem.created_at).toLocaleString()}</p></div>
              {selectedItem.investigated_at && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Investigated by {selectedItem.investigated_by} on {new Date(selectedItem.investigated_at).toLocaleString()}</p>
                  {selectedItem.investigation_notes && <p className="text-sm mt-1">{selectedItem.investigation_notes}</p>}
                </div>
              )}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4" />Comments</h4>
                {selectedItem.comments?.length > 0 ? (
                  <div className="space-y-2 mb-3">{selectedItem.comments.map((c, i) => (<div key={i} className="p-2 bg-gray-50 rounded text-sm"><p>{c.text}</p><p className="text-xs text-gray-500 mt-1">{c.by} - {new Date(c.at).toLocaleString()}</p></div>))}</div>
                ) : <p className="text-sm text-gray-500 mb-3">No comments yet</p>}
                <div className="flex gap-2">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 px-3 py-2 border rounded-md text-sm" />
                  <Button size="sm" onClick={() => addComment(selectedItem.id)} disabled={!newComment.trim()}>Add</Button>
                </div>
              </div>
              {isAdmin && !['resolved', 'dismissed'].includes(selectedItem.status) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Update Status</p>
                  <Textarea value={investigationNotes} onChange={(e) => setInvestigationNotes(e.target.value)} placeholder="Investigation notes..." rows={2} className="mb-3" />
                  <div className="flex gap-2 flex-wrap">
                    {selectedItem.status === 'new' && <Button onClick={() => investigateReport(selectedItem.id, 'investigating')} variant="outline" className="border-yellow-500 text-yellow-700">Start Investigation</Button>}
                    <Button onClick={() => investigateReport(selectedItem.id, 'resolved')} className="bg-green-600 hover:bg-green-700">Mark Resolved</Button>
                    <Button onClick={() => investigateReport(selectedItem.id, 'dismissed')} variant="outline" className="border-gray-400 text-gray-600">Dismiss</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Training Records Page Component
function TrainingPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const location = window.location;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [pendingSignatures, setPendingSignatures] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [filter, setFilter] = useState('all');
  
  // Form state
  const [formData, setFormData] = useState({
    swp_number: '',
    swp_version: '',
    department: '',
    training_date: new Date().toISOString().split('T')[0],
    notes: '',
    selectedEmployees: [],
    agencyStaff: ''
  });
  
  const [signatureData, setSignatureData] = useState('');
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signingTrainee, setSigningTrainee] = useState(null);

  const isAdmin = employee?.admin_control === 'yes';

  const departments = [
    'Farm', 'Field', 'Grading', 'Storage', 'Transport', 'Workshop', 'Office', 'Other'
  ];

  useEffect(() => {
    fetchRecords();
    fetchStaff();
    if (employee?.employee_number) {
      fetchPendingSignatures();
    }
    // Auto-open create modal if ?create=true is in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      setShowCreateModal(true);
      // Clear the URL parameter
      window.history.replaceState({}, '', '/training');
    }
  }, [employee]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/training`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Error fetching training records:', error);
      toast.error('Failed to load training records');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff`);
      if (response.ok) {
        const data = await response.json();
        setStaffList(data);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchPendingSignatures = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/training/pending/${employee.employee_number}`);
      if (response.ok) {
        const data = await response.json();
        setPendingSignatures(data);
      }
    } catch (error) {
      console.error('Error fetching pending signatures:', error);
    }
  };

  const handleCreateRecord = async () => {
    if (!formData.swp_number || !formData.department || !formData.training_date) {
      toast.error('Please fill in SWP Number, Department, and Training Date');
      return;
    }

    const trainees = [];
    
    // Add selected employees
    formData.selectedEmployees.forEach(emp => {
      trainees.push({
        employee_id: emp.employee_number,
        employee_name: emp.name,
        is_agency: false
      });
    });
    
    // Add agency staff
    if (formData.agencyStaff.trim()) {
      formData.agencyStaff.split('\n').forEach(name => {
        if (name.trim()) {
          trainees.push({
            employee_id: null,
            employee_name: name.trim(),
            is_agency: true
          });
        }
      });
    }

    if (trainees.length === 0) {
      toast.error('Please add at least one trainee');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          swp_number: formData.swp_number,
          swp_version: formData.swp_version,
          department: formData.department,
          training_date: formData.training_date,
          notes: formData.notes,
          trainer_name: employee.name,
          trainer_employee_number: employee.employee_number,
          trainees
        })
      });

      if (response.ok) {
        toast.success('Training record created');
        setShowCreateModal(false);
        setFormData({
          swp_number: '',
          swp_version: '',
          department: '',
          training_date: new Date().toISOString().split('T')[0],
          notes: '',
          selectedEmployees: [],
          agencyStaff: ''
        });
        fetchRecords();
      } else {
        toast.error('Failed to create training record');
      }
    } catch (error) {
      console.error('Error creating training record:', error);
      toast.error('Failed to create training record');
    }
  };

  const handleSign = async () => {
    if (!signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    try {
      // Use signingTrainee if set (collecting signature for someone else), otherwise use current employee
      const traineeToSign = signingTrainee || { employee_id: employee.employee_number, employee_name: employee.name };
      
      const params = new URLSearchParams();
      if (traineeToSign.employee_id) {
        params.append('employee_id', traineeToSign.employee_id);
      }
      if (traineeToSign.employee_name) {
        params.append('employee_name', traineeToSign.employee_name);
      }
      params.append('signature_data', signatureData);
      
      const response = await fetch(`${API_BASE_URL}/api/training/${selectedRecord.id}/sign?${params.toString()}`, {
        method: 'PUT'
      });

      if (response.ok) {
        toast.success(`Signature recorded for ${traineeToSign.employee_name}`);
        setShowSignModal(false);
        setSignatureData('');
        setSigningTrainee(null);
        fetchRecords();
        fetchPendingSignatures();
        // Refresh the selected record
        const updatedResponse = await fetch(`${API_BASE_URL}/api/training/${selectedRecord.id}`);
        if (updatedResponse.ok) {
          setSelectedRecord(await updatedResponse.json());
        }
      } else {
        toast.error('Failed to record signature');
      }
    } catch (error) {
      console.error('Error signing:', error);
      toast.error('Failed to record signature');
    }
  };

  // Canvas drawing functions for signature
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        setSignatureData(canvas.toDataURL());
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData('');
    }
  };

  const filteredRecords = records.filter(record => {
    if (filter === 'all') return true;
    return record.status === filter;
  });

  const toggleEmployeeSelection = (emp) => {
    setFormData(prev => {
      const isSelected = prev.selectedEmployees.some(e => e.employee_number === emp.employee_number);
      if (isSelected) {
        return { ...prev, selectedEmployees: prev.selectedEmployees.filter(e => e.employee_number !== emp.employee_number) };
      } else {
        return { ...prev, selectedEmployees: [...prev.selectedEmployees, emp] };
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Training Records</h1>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-2" /> New Training Record
        </Button>
      </div>

      {/* Pending Signatures Alert */}
      {pendingSignatures.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">You have {pendingSignatures.length} training record(s) awaiting your signature</span>
          </div>
          <div className="mt-2 space-y-2">
            {pendingSignatures.map(record => (
              <div key={record.id} className="flex items-center justify-between bg-white p-2 rounded border">
                <span className="text-sm">SWP {record.swp_number} - {record.department} ({record.training_date})</span>
                <Button size="sm" onClick={() => { setSelectedRecord(record); setShowSignModal(true); }}>
                  Sign Now
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md">
          <option value="all">All Records</option>
          <option value="pending_signatures">Pending Signatures</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Records List */}
      {loading ? (
        <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No training records found</div>
      ) : (
        <div className="grid gap-4">
          {filteredRecords.map(record => (
            <Card key={record.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between cursor-pointer" onClick={() => { setSelectedRecord(record); setShowDetailModal(true); }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">SWP {record.swp_number}</h3>
                      {record.swp_version && <Badge variant="outline">v{record.swp_version}</Badge>}
                      <Badge className={record.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}>
                        {record.status === 'completed' ? 'Completed' : 'Pending Signatures'}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mt-1">{record.department}</p>
                    <p className="text-sm text-gray-500">Training Date: {record.training_date}</p>
                    <p className="text-sm text-gray-500">Trainer: {record.trainer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{record.trainees?.length || 0} trainees</p>
                    <p className="text-xs text-gray-400">{record.trainees?.filter(t => t.signed).length || 0} signed</p>
                  </div>
                </div>
                {/* Sage HR Checkbox - directly on card */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={record.added_to_sage_hr || false}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        try {
                          const response = await fetch(`${API_BASE_URL}/api/training/${record.id}/sage-hr?added=${checked}&updated_by=${encodeURIComponent(employee.name)}`, {
                            method: 'PUT'
                          });
                          if (response.ok) {
                            toast.success(checked ? 'Marked as added to Sage HR' : 'Sage HR status removed');
                            fetchRecords();
                          }
                        } catch (error) {
                          toast.error('Failed to update Sage HR status');
                        }
                      }}
                      className="w-4 h-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-purple-700 font-medium">Added to Sage HR</span>
                    {record.added_to_sage_hr && record.added_to_sage_hr_at && (
                      <span className="text-xs text-purple-500 ml-1">
                        ({new Date(record.added_to_sage_hr_at).toLocaleDateString()} by {record.added_to_sage_hr_by || 'Unknown'})
                      </span>
                    )}
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Training Record Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">New Training Record</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">SWP Number *</label>
                  <input
                    type="text"
                    value={formData.swp_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, swp_number: e.target.value }))}
                    placeholder="e.g., SWP-001"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Version</label>
                  <input
                    type="text"
                    value={formData.swp_version}
                    onChange={(e) => setFormData(prev => ({ ...prev, swp_version: e.target.value }))}
                    placeholder="e.g., 1.0"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Department/Area *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select department...</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Training Date *</label>
                  <input
                    type="date"
                    value={formData.training_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, training_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional training notes..."
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Employees</label>
                <div className="border rounded-md max-h-48 overflow-auto p-2">
                  {staffList.map(emp => (
                    <label key={emp.employee_number} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.selectedEmployees.some(e => e.employee_number === emp.employee_number)}
                        onChange={() => toggleEmployeeSelection(emp)}
                        className="rounded"
                      />
                      <span>{emp.name}</span>
                      <span className="text-xs text-gray-400">({emp.employee_number})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{formData.selectedEmployees.length} employee(s) selected</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Agency Staff (one per line)</label>
                <Textarea
                  value={formData.agencyStaff}
                  onChange={(e) => setFormData(prev => ({ ...prev, agencyStaff: e.target.value }))}
                  placeholder="Enter agency staff names, one per line..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button onClick={handleCreateRecord} className="bg-teal-600 hover:bg-teal-700">Create Record</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Training Record Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div><p className="text-xs text-gray-500">SWP Number</p><p className="font-medium">{selectedRecord.swp_number}</p></div>
                <div><p className="text-xs text-gray-500">Version</p><p className="font-medium">{selectedRecord.swp_version || 'N/A'}</p></div>
                <div><p className="text-xs text-gray-500">Department</p><p className="font-medium">{selectedRecord.department}</p></div>
                <div><p className="text-xs text-gray-500">Training Date</p><p className="font-medium">{selectedRecord.training_date}</p></div>
                <div><p className="text-xs text-gray-500">Trainer</p><p className="font-medium">{selectedRecord.trainer_name}</p></div>
                <div><p className="text-xs text-gray-500">Status</p><Badge className={selectedRecord.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}>{selectedRecord.status === 'completed' ? 'Completed' : 'Pending'}</Badge></div>
              </div>

              {selectedRecord.notes && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm">{selectedRecord.notes}</p>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-2">Trainees ({selectedRecord.trainees?.length || 0})</h4>
                <div className="border rounded-lg divide-y">
                  {selectedRecord.trainees?.map((trainee, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{trainee.employee_name}</p>
                        <p className="text-xs text-gray-500">{trainee.is_agency ? 'Agency Staff' : `Employee #${trainee.employee_id}`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {trainee.signed ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="text-xs text-green-600">Signed {trainee.signed_at ? new Date(trainee.signed_at).toLocaleDateString() : ''}</span>
                          </>
                        ) : (
                          <>
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pending</Badge>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-teal-600 border-teal-300 ml-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSigningTrainee(trainee);
                                setShowSignModal(true);
                              }}
                            >
                              Collect Signature
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sage HR Checkbox */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRecord.added_to_sage_hr || false}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/training/${selectedRecord.id}/sage-hr?added=${checked}&updated_by=${encodeURIComponent(employee.name)}`, {
                          method: 'PUT'
                        });
                        if (response.ok) {
                          toast.success(checked ? 'Marked as added to Sage HR' : 'Sage HR status removed');
                          // Update the selected record locally
                          setSelectedRecord(prev => ({
                            ...prev,
                            added_to_sage_hr: checked,
                            added_to_sage_hr_at: checked ? new Date().toISOString() : null,
                            added_to_sage_hr_by: checked ? employee.name : null
                          }));
                          fetchRecords();
                        }
                      } catch (error) {
                        toast.error('Failed to update Sage HR status');
                      }
                    }}
                    className="w-5 h-5 rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-medium text-purple-900">Added to Sage HR</span>
                    {selectedRecord.added_to_sage_hr && selectedRecord.added_to_sage_hr_at && (
                      <p className="text-xs text-purple-600">
                        Added on {new Date(selectedRecord.added_to_sage_hr_at).toLocaleDateString()} by {selectedRecord.added_to_sage_hr_by || 'Unknown'}
                      </p>
                    )}
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                {isAdmin && (
                  <Button variant="outline" className="text-red-600 border-red-300" onClick={async () => {
                    if (window.confirm('Are you sure you want to delete this training record?')) {
                      await fetch(`${API_BASE_URL}/api/training/${selectedRecord.id}`, { method: 'DELETE' });
                      toast.success('Training record deleted');
                      setShowDetailModal(false);
                      fetchRecords();
                    }
                  }}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowDetailModal(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Sign Training Record</h3>
              <Button variant="ghost" size="sm" onClick={() => { setShowSignModal(false); clearSignature(); setSigningTrainee(null); }}><X className="h-4 w-4" /></Button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm"><strong>SWP:</strong> {selectedRecord.swp_number}</p>
                <p className="text-sm"><strong>Department:</strong> {selectedRecord.department}</p>
                <p className="text-sm"><strong>Date:</strong> {selectedRecord.training_date}</p>
              </div>

              {signingTrainee && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-sm font-medium text-teal-800">Collecting signature for:</p>
                  <p className="text-lg font-bold text-teal-900">{signingTrainee.employee_name}</p>
                  {signingTrainee.is_agency && <p className="text-xs text-teal-600">(Agency Staff)</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">{signingTrainee ? `${signingTrainee.employee_name}'s Signature` : 'Your Signature'}</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-1">
                  <canvas
                    ref={canvasRef}
                    width={350}
                    height={150}
                    className="w-full bg-white cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={clearSignature}>Clear Signature</Button>
              </div>

              <p className="text-xs text-gray-500">By signing, I confirm that I have received and understood the training for SWP {selectedRecord.swp_number}.</p>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowSignModal(false); clearSignature(); }}>Cancel</Button>
                <Button onClick={handleSign} className="bg-teal-600 hover:bg-teal-700">Submit Signature</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Machine Additions Page Component
function MachineAdditionsPage() {
  const [machineRequests, setMachineRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  
  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    // Clear old localStorage data (migration to database-only storage)
    localStorage.removeItem('acknowledgedMachines');
    localStorage.removeItem('acknowledgedRepairs');
    fetchMachineRequests();
  }, []);

  const fetchMachineRequests = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }
      
      const skip = append ? machineRequests.length : 0;
      // Fetch only MACHINE ADD or NEW MACHINE records from backend
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=${ITEMS_PER_PAGE}&skip=${skip}&check_type=MACHINE ADD,NEW MACHINE`);
      const machineAddRequests = await response.json();
      
      // Get acknowledged machines from DATABASE (no more localStorage!)
      const machineIds = machineAddRequests.map(m => m.id);
      const statusResponse = await fetch(`${API_BASE_URL}/api/repair-status/bulk`);
      const repairStatuses = await statusResponse.json();
      
      // Mark machines as acknowledged based on database
      const requestsWithAckStatus = machineAddRequests.map(req => ({
        ...req,
        acknowledged: repairStatuses[req.id]?.acknowledged || false
      }));
      
      if (append) {
        setMachineRequests(prev => [...prev, ...requestsWithAckStatus]);
        setFilteredRequests(prev => [...prev, ...requestsWithAckStatus.filter(r => !r.acknowledged)]);
      } else {
        setMachineRequests(requestsWithAckStatus);
        // Show only non-acknowledged by default
        setFilteredRequests(requestsWithAckStatus.filter(r => !r.acknowledged));
      }
      
      // Check if there are more items to load
      setHasMore(machineAddRequests.length === ITEMS_PER_PAGE);
      
    } catch (error) {
      console.error('Error fetching machine requests:', error);
      toast.error('Failed to load machine requests');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchMachineRequests(true);
    }
  };

  const handleAcknowledge = async (request) => {
    try {
      // Save to database
      const response = await fetch(`${API_BASE_URL}/api/repair-status/acknowledge?repair_id=${request.id}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to acknowledge');
      
      // Update local state
      setMachineRequests(prev => prev.map(r => 
        r.id === request.id ? { ...r, acknowledged: true } : r
      ));
      setFilteredRequests(prev => prev.filter(r => r.id !== request.id));
      
      toast.success('Machine request acknowledged');
    } catch (error) {
      console.error('Error acknowledging machine:', error);
      toast.error('Failed to acknowledge machine request');
    }
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading machine requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Machine Request Details</h2>
              <Button variant="ghost" size="sm" onClick={closeDetailModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Machine Make</h3>
                  <p className="text-lg font-semibold">{selectedRequest.machine_make}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Machine Model</h3>
                  <p className="text-lg font-semibold">{selectedRequest.machine_model}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Requested By</h3>
                  <p className="text-lg">{selectedRequest.staff_name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Request Date</h3>
                  <p className="text-lg">{new Date(selectedRequest.completed_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Request Details */}
              {selectedRequest.workshop_notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Request Details</h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedRequest.workshop_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Machine Requests</h1>
            <p className="text-gray-600 mt-2">Machines added by staff pending review</p>
          </div>
        </div>
      </div>

      {/* Machine Requests List */}
      <Card>
        <CardContent className="p-6">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Truck className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No machine requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <Card
                  key={request.id}
                  className="hover:shadow-md transition-shadow border-blue-200 bg-blue-50"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-4 flex-1 cursor-pointer"
                        onClick={() => handleViewDetails(request)}
                      >
                        <div className="p-3 rounded-lg bg-blue-200">
                          <Truck className="h-6 w-6 text-blue-700" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-blue-900">{request.machine_make} {request.machine_model}</h3>
                          <p className="text-blue-700">Requested by {request.staff_name}</p>
                          {request.workshop_notes && (
                            <p className="text-sm text-blue-600 mt-1 italic line-clamp-2">{request.workshop_notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end space-y-2">
                        <Badge className="bg-blue-200 text-blue-800">Pending Review</Badge>
                        <p className="text-sm text-blue-600">
                          {new Date(request.completed_at).toLocaleDateString()} at {new Date(request.completed_at).toLocaleTimeString()}
                        </p>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcknowledge(request);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Acknowledge
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Load More Button */}
              {hasMore && filteredRequests.length > 0 && (
                <div className="mt-6 text-center">
                  <Button 
                    onClick={loadMore} 
                    disabled={loadingMore}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                        Loading more...
                      </>
                    ) : (
                      `Load More Requests (${ITEMS_PER_PAGE} at a time)`
                    )}
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">Showing {filteredRequests.length} requests</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// General Repair Record Component
function GeneralRepairRecord() {
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [availableNames, setAvailableNames] = useState([]);
  const [makes, setMakes] = useState([]);
  const [problemDescription, setProblemDescription] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('');
  const [repairPhotos, setRepairPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const { employee } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMakes();
  }, []);

  useEffect(() => {
    if (selectedMake) {
      fetchNames(selectedMake);
    } else {
      setAvailableNames([]);
    }
  }, [selectedMake]);

  const fetchMakes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/makes`);
      const makesData = await response.json();
      setMakes(makesData);
    } catch (error) {
      console.error('Error fetching makes:', error);
      toast.error('Failed to load machine makes');
    }
  };

  const fetchNames = async (make) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/names/${encodeURIComponent(make)}`);
      const namesData = await response.json();
      setAvailableNames(namesData);
    } catch (error) {
      console.error('Error fetching names:', error);
      toast.error('Failed to load machine names');
    }
  };

  const takePhoto = () => {
    setShowCamera(true);
  };

  const uploadPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error('File size must be less than 5MB');
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const photoData = {
            id: Date.now(),
            data: e.target.result,
            timestamp: new Date().toISOString()
          };
          setRepairPhotos(prev => [...prev, photoData]);
          toast.success('Photo uploaded for repair record!');
        };
        
        reader.onerror = () => {
          toast.error('Error reading file. Please try again.');
        };
        
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const capturePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.getElementById('camera-video');
      video.srcObject = stream;
      
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const photoData = {
          id: Date.now(),
          data: canvas.toDataURL('image/jpeg', 0.8),
          timestamp: new Date().toISOString()
        };
        
        setRepairPhotos(prev => [...prev, photoData]);
        
        // Stop the camera
        stream.getTracks().forEach(track => track.stop());
        setShowCamera(false);
        
        toast.success('Photo captured for repair record!');
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Failed to access camera. Please try uploading a photo instead.');
    }
  };

  const deletePhoto = (photoId) => {
    setRepairPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  const handleSubmit = async () => {
    if (!selectedMake || !selectedName) {
      toast.error('Please select a machine');
      return;
    }

    if (!problemDescription.trim()) {
      toast.error('Please describe the problem');
      return;
    }

    if (!urgencyLevel) {
      toast.error('Please select the urgency level');
      return;
    }

    setIsSubmitting(true);
    try {
      
      const repairRecord = {
        employee_number: employee.employee_number,
        staff_name: employee.name,
        machine_make: selectedMake,
        machine_model: selectedName,
        check_type: 'GENERAL REPAIR',
        checklist_items: [],
        workshop_notes: `GENERAL REPAIR REPORT:\nUrgency Level: ${urgencyLevel}\nProblem Description: ${problemDescription.trim()}`,
        workshop_photos: repairPhotos
      };


      const response = await fetch(`${API_BASE_URL}/api/checklists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(repairRecord)
      });

      if (response.ok) {
        toast.success('Repair record submitted successfully!');
        navigate('/');
      } else {
        const errorData = await response.text();
        console.error('Server response:', response.status, errorData);
        throw new Error(`Server error: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error('Error submitting repair record:', error);
      toast.error('Failed to submit repair record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Camera Modal */}
      {showCamera && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative z-[10000]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Take Photo</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowCamera(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <video
                id="camera-video"
                autoPlay
                playsInline
                className="w-full rounded-lg"
              />
              <Button 
                onClick={capturePhoto}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capture Photo
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">General Repair Record</h1>
            <p className="text-gray-600 mt-2">Report equipment problems and maintenance issues</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wrench className="h-5 w-5 text-orange-600 mr-2" />
            Equipment Selection
          </CardTitle>
          <CardDescription>Select the machine that requires repair or attention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Machine Make Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Machine Make *</label>
            <select 
              value={selectedMake} 
              onChange={(e) => {
                setSelectedMake(e.target.value);
                setSelectedName('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              data-testid="make-select"
            >
              <option value="">Select Machine Make</option>
              {makes.map((make) => (
                <option key={make} value={make}>{make}</option>
              ))}
            </select>
          </div>

          {/* Machine Name Selection */}
          {selectedMake && (
            <div>
              <label className="block text-sm font-medium mb-2">Machine Name/Model *</label>
              <select 
                value={selectedName} 
                onChange={(e) => setSelectedName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                data-testid="name-select"
              >
                <option value="">Select Machine Name</option>
                {availableNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedMake && selectedName && (
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm font-medium text-orange-900">
                Selected Machine: <span className="text-orange-700">{selectedMake} - {selectedName}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            Urgency Level
          </CardTitle>
          <CardDescription>Select the urgency level for this breakdown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                id="stopped"
                name="urgency"
                value="Breakdown has stopped machine"
                checked={urgencyLevel === 'Breakdown has stopped machine'}
                onChange={(e) => setUrgencyLevel(e.target.value)}
                className="w-4 h-4 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="stopped" className="text-sm font-medium text-gray-900 cursor-pointer">
                <span className="text-red-600 font-semibold">Breakdown has stopped machine</span>
                <p className="text-xs text-gray-600 mt-1">Machine is not operational and requires immediate attention</p>
              </label>
            </div>
            
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                id="urgent"
                name="urgency"
                value="Breakdown will need repair asap but still running"
                checked={urgencyLevel === 'Breakdown will need repair asap but still running'}
                onChange={(e) => setUrgencyLevel(e.target.value)}
                className="w-4 h-4 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="urgent" className="text-sm font-medium text-gray-900 cursor-pointer">
                <span className="text-orange-600 font-semibold">Breakdown will need repair asap but still running</span>
                <p className="text-xs text-gray-600 mt-1">Machine is operational but needs urgent repair to prevent failure</p>
              </label>
            </div>
            
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                id="not-urgent"
                name="urgency"
                value="Breakdown is not urgent"
                checked={urgencyLevel === 'Breakdown is not urgent'}
                onChange={(e) => setUrgencyLevel(e.target.value)}
                className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
              />
              <label htmlFor="not-urgent" className="text-sm font-medium text-gray-900 cursor-pointer">
                <span className="text-yellow-600 font-semibold">Breakdown is not urgent</span>
                <p className="text-xs text-gray-600 mt-1">Machine is operational with minor issues that can be scheduled</p>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 text-orange-600 mr-2" />
            Problem Description
          </CardTitle>
          <CardDescription>Describe the issue, fault, or repair needed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Problem Details *</label>
            <Textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Describe the problem in detail: What's not working? What symptoms are you observing? When did it start? Any error messages or unusual sounds?"
              className="min-h-[120px]"
              data-testid="problem-description"
            />
            <p className="text-xs text-gray-500 mt-1">
              Be as specific as possible to help maintenance teams diagnose and fix the issue
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Problem Photos</label>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={takePhoto}
                  className="text-sm"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={uploadPhoto}
                  className="text-sm"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
              </div>
            </div>
            
            {repairPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                {repairPhotos.map((photo) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.data}
                      alt="Problem photo"
                      className="w-full h-20 object-cover rounded border"
                      loading="lazy"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute -top-1 -right-1 w-5 h-5 p-0 rounded-full"
                      onClick={() => deletePhoto(photo.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {repairPhotos.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Photos help maintenance teams understand the problem better
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start space-x-4">
        <Button 
          onClick={handleSubmit}
          disabled={!selectedMake || !selectedName || !problemDescription.trim() || !urgencyLevel || isSubmitting}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Repair Record'}
        </Button>
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}


// QR Labels Page Component
function QRLabelsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'printed'
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/assets/qr-labels`);
      if (response.ok) {
        const data = await response.json();
        setAssets(data);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  // Filter assets based on QR printed status and search
  const newAssets = assets.filter(a => !a.qr_printed && 
    (searchTerm === '' || 
     a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     a.make?.toLowerCase().includes(searchTerm.toLowerCase())));
  
  const printedAssets = assets.filter(a => a.qr_printed &&
    (searchTerm === '' || 
     a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     a.make?.toLowerCase().includes(searchTerm.toLowerCase())));

  const currentAssets = activeTab === 'new' ? newAssets : printedAssets;

  const handleSelectAll = () => {
    if (selectedAssets.length === currentAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(currentAssets.map(a => a.id));
    }
  };

  const handleSelectAsset = (assetId) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handlePrintLabels = async () => {
    const assetsToPrint = selectedAssets.length > 0 
      ? assets.filter(a => selectedAssets.includes(a.id))
      : currentAssets;

    if (assetsToPrint.length === 0) {
      toast.error('No assets selected to print');
      return;
    }

    setPrinting(true);

    // HTML-escape helper to prevent XSS
    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Create a print window with QR codes
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print QR codes.');
      setPrinting(false);
      return;
    }
    
    const htmlContent = `
      <html>
        <head>
          <title>QR Code Labels - Machine Checklist</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .label-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              padding: 10px;
            }
            .label {
              border: 1px dashed #ccc;
              padding: 10px;
              text-align: center;
              page-break-inside: avoid;
            }
            .label img {
              width: 100px;
              height: 100px;
            }
            .label-text {
              font-size: 10px;
              margin-top: 5px;
              word-break: break-word;
            }
            .label-make {
              font-weight: bold;
              font-size: 11px;
            }
            @media print {
              .label { border: 1px dashed #999; }
            }
          </style>
        </head>
        <body>
          <div class="label-grid">
            ${assetsToPrint.map(asset => `
              <div class="label">
                <img src="${escapeHtml(API_BASE_URL)}${escapeHtml(asset.qr_url)}" alt="QR Code" />
                <div class="label-make">${escapeHtml(asset.make)}</div>
                <div class="label-text">${escapeHtml(asset.name)}</div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `;
    
    // Use safe DOM methods instead of document.write
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Trigger print after content loads
    printWindow.onload = function() {
      setTimeout(function() {
        printWindow.print();
      }, 1000);
    };

    // Mark assets as printed
    const assetIds = assetsToPrint.map(a => a.id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/mark-qr-printed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assetIds)
      });
      
      if (response.ok) {
        toast.success(`Marked ${assetIds.length} assets as printed`);
        // Refresh the list
        await fetchAssets();
        setSelectedAssets([]);
      }
    } catch (error) {
      console.error('Error marking assets as printed:', error);
    }

    setPrinting(false);
  };

  const handleResetPrintStatus = async () => {
    if (selectedAssets.length === 0) {
      toast.error('Select assets to reset print status');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/reset-qr-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedAssets)
      });
      
      if (response.ok) {
        toast.success(`Reset print status for ${selectedAssets.length} assets`);
        await fetchAssets();
        setSelectedAssets([]);
      }
    } catch (error) {
      console.error('Error resetting print status:', error);
      toast.error('Failed to reset print status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-2">Loading assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Print QR Code Labels</h1>
            <p className="text-gray-600">Generate and print QR labels for machines</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700">New (No QR)</p>
                <p className="text-3xl font-bold text-orange-600">{assets.filter(a => !a.qr_printed).length}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Already Printed</p>
                <p className="text-3xl font-bold text-green-600">{assets.filter(a => a.qr_printed).length}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700">Total Machines</p>
                <p className="text-3xl font-bold text-purple-600">{assets.length}</p>
              </div>
              <QrCode className="h-10 w-10 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex space-x-2">
              <Button 
                variant={activeTab === 'new' ? 'default' : 'outline'}
                onClick={() => { setActiveTab('new'); setSelectedAssets([]); }}
                className={activeTab === 'new' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                New Machines ({assets.filter(a => !a.qr_printed).length})
              </Button>
              <Button 
                variant={activeTab === 'printed' ? 'default' : 'outline'}
                onClick={() => { setActiveTab('printed'); setSelectedAssets([]); }}
                className={activeTab === 'printed' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Already Printed ({assets.filter(a => a.qr_printed).length})
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search machines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border rounded-md w-48"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" onClick={handleSelectAll}>
              {selectedAssets.length === currentAssets.length ? 'Deselect All' : 'Select All'}
            </Button>
            
            <Button 
              onClick={handlePrintLabels}
              disabled={printing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {printing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Print {selectedAssets.length > 0 ? `Selected (${selectedAssets.length})` : `All ${activeTab === 'new' ? 'New' : 'Printed'} (${currentAssets.length})`}
            </Button>
            
            {activeTab === 'printed' && selectedAssets.length > 0 && (
              <Button 
                variant="outline"
                onClick={handleResetPrintStatus}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Print Status ({selectedAssets.length})
              </Button>
            )}
          </div>

          {/* Assets List */}
          {currentAssets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {activeTab === 'new' ? (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-4" />
                  <p className="text-lg font-medium">All machines have QR codes printed!</p>
                  <p className="text-sm">Upload a new asset list to add more machines.</p>
                </>
              ) : (
                <>
                  <QrCode className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No printed QR codes yet</p>
                  <p className="text-sm">Print labels from the "New Machines" tab.</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentAssets.map(asset => (
                <Card 
                  key={asset.id}
                  className={`cursor-pointer transition-all ${
                    selectedAssets.includes(asset.id) 
                      ? 'ring-2 ring-purple-500 bg-purple-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleSelectAsset(asset.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedAssets.includes(asset.id)}
                          onChange={() => {}}
                          className="h-4 w-4 rounded"
                        />
                      </div>
                      <div className="flex-shrink-0">
                        <img 
                          src={`${API_BASE_URL}${asset.qr_url}`}
                          alt="QR Code"
                          className="w-16 h-16"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{asset.make}</p>
                        <p className="text-xs text-gray-600 truncate">{asset.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{asset.check_type}</p>
                        {asset.qr_printed_at && (
                          <p className="text-xs text-green-600 mt-1">
                            Printed: {new Date(asset.qr_printed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// Admin Login Component
function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    // Admin password - you can change this in your .env file or here
    const adminPassword = process.env.REACT_APP_ADMIN_PASSWORD || 'abreys2024admin';
    
    if (password === adminPassword) {
      onLogin();
      toast.success('Admin access granted');
    } else {
      setError('Invalid admin password');
      toast.error('Invalid admin password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Admin Access Required</CardTitle>
          <CardDescription className="text-center">
            Enter admin password to access sync functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter admin password"
              data-testid="admin-password-input"
            />
            {error && (
              <p className="text-red-600 text-sm mt-1">{error}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={handleLogin} 
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-testid="admin-login-btn"
            >
              Access Admin
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
              className="flex-1"
            >
              Back to App
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <EmployeeLogin />;
  }
  
  return children;
}

// Admin Protected Route Component
function AdminProtectedRoute({ children }) {
  const { isAuthenticated, employee, loading } = useAuth();
  const navigate = useNavigate();
  
  // Check if employee has admin control access
  const hasAdminAccess = employee?.admin_control?.toLowerCase() === 'yes';
  
  React.useEffect(() => {
    if (!loading && isAuthenticated && !hasAdminAccess) {
      toast.error('Access denied. You do not have Admin Control permission.');
      navigate('/');
    }
  }, [hasAdminAccess, isAuthenticated, loading, navigate]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <EmployeeLogin />;
  }
  
  if (!hasAdminAccess) {
    return null; // Will redirect in useEffect
  }
  
  return children;
}

// Manager Protected Route Component
function ManagerProtectedRoute({ children }) {
  const { isAuthenticated, employee, loading } = useAuth();
  const navigate = useNavigate();
  
  // Check if employee has manager OR admin control access (admins can access manager page)
  const hasManagerAccess = employee?.manager_control?.toLowerCase() === 'yes' || 
                           employee?.admin_control?.toLowerCase() === 'yes';
  
  React.useEffect(() => {
    if (!loading && isAuthenticated && !hasManagerAccess) {
      toast.error('Access denied. You do not have Manager permission.');
      navigate('/');
    }
  }, [hasManagerAccess, isAuthenticated, loading, navigate]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <EmployeeLogin />;
  }
  
  if (!hasManagerAccess) {
    return null; // Will redirect in useEffect
  }
  
  return children;
}

// Manager Page Component
function ManagerPage() {
  const { employee } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')} data-testid="back-to-dashboard-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
            <p className="text-gray-600 mt-2">Track work progress</p>
          </div>
        </div>
      </div>

      {/* Work Progress Tracking Section */}
      <WorkProgressAdmin />
    </div>
  );
}

// Main App Content Component
function AppContent() {
  const { isAuthenticated, employee, logout } = useAuth();
  
  // Check if employee has admin control access
  const hasAdminAccess = employee?.admin_control?.toLowerCase() === 'yes';
  // Check if employee has manager OR admin access
  const hasManagerAccess = employee?.manager_control?.toLowerCase() === 'yes' || 
                           employee?.admin_control?.toLowerCase() === 'yes';

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-gray-800 shadow-md">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <Link to="/" className="flex items-center space-x-2" data-testid="logo-link">
                <div className="flex items-center">
                  <img 
                    src="/abreys-logo.png" 
                    alt="Abreys Logo" 
                    className="h-8 sm:h-10 w-auto rounded-lg bg-white p-0.5"
                    loading="eager"
                  />
                  <span className="text-xs sm:text-sm text-gray-300 ml-2 sm:ml-3 font-medium hidden sm:block">Day to Day Work App</span>
                </div>
              </Link>
              <nav className="flex items-center space-x-1 sm:space-x-4">
                <Link 
                  to="/" 
                  className="text-gray-200 hover:text-green-400 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                  data-testid="nav-dashboard"
                >
                  Home
                </Link>
                {/* Manager link - visible for users with manager or admin access */}
                {hasManagerAccess && (
                  <Link 
                    to="/manager" 
                    className="text-gray-200 hover:text-orange-400 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                    data-testid="nav-manager"
                  >
                    Manager
                  </Link>
                )}
                {/* Admin link - only visible for admin users */}
                {hasAdminAccess && (
                  <Link 
                    to="/admin" 
                    className="text-gray-200 hover:text-green-400 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                    data-testid="nav-admin"
                  >
                    Admin
                  </Link>
                )}
                {hasManagerAccess && (
                  <Link 
                    to="/workplan" 
                    className="text-gray-200 hover:text-green-400 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors inline-flex items-center"
                    data-testid="nav-workplan"
                  >
                    <CalendarDays className="h-4 w-4 mr-1" /> Workplan
                  </Link>
                )}
                {/* Cropping Map button - opens Map-only view */}
                <button
                  onClick={() => window.open(`${API_BASE_URL}/api/fieldmap`, '_blank')}
                  className="text-gray-200 hover:text-green-400 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors inline-flex items-center"
                  data-testid="nav-cropping-map"
                >
                  <MapPin className="h-4 w-4 mr-1" /> Map
                </button>
                
                {/* User info and logout */}
                {isAuthenticated && employee && (
                  <div className="flex items-center space-x-2 border-l border-gray-600 pl-2 sm:pl-4 ml-2 sm:ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-white">{employee.name}</p>
                      <p className="text-xs text-gray-300">#{employee.employee_number}</p>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={logout}
                      className="text-gray-200 hover:text-red-400 text-xs sm:text-sm font-medium px-2 sm:px-3"
                      data-testid="logout-btn"
                    >
                      Logout
                    </Button>
                  </div>
                )}
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
          <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/new-checklist" element={
              <ProtectedRoute>
                <NewChecklist />
              </ProtectedRoute>
            } />
            <Route path="/records" element={
              <ProtectedRoute>
                <Records />
              </ProtectedRoute>
            } />
            <Route path="/all-checks" element={
              <ProtectedRoute>
                <AllChecksCompleted />
              </ProtectedRoute>
            } />
            <Route path="/repairs-completed" element={
              <ProtectedRoute>
                <RepairsCompletedPage />
              </ProtectedRoute>
            } />
            <Route path="/machine-additions" element={
              <ProtectedRoute>
                <MachineAdditionsPage />
              </ProtectedRoute>
            } />
            <Route path="/repairs-needed" element={
              <ProtectedRoute>
                <RepairsNeeded />
              </ProtectedRoute>
            } />
            {/* HIDDEN FOR DEPLOYMENT - Near Misses, Suggestions, Accidents, Whistleblowing, Training routes
            <Route path="/near-misses" element={
              <ProtectedRoute>
                <NearMissesPage />
              </ProtectedRoute>
            } />
            <Route path="/suggestions" element={
              <AdminProtectedRoute>
                <SuggestionsPage />
              </AdminProtectedRoute>
            } />
            <Route path="/accidents" element={
              <ManagerProtectedRoute>
                <AccidentsPage />
              </ManagerProtectedRoute>
            } />
            <Route path="/whistleblowing" element={
              <ManagerProtectedRoute>
                <WhistleblowingPage />
              </ManagerProtectedRoute>
            } />
            <Route path="/training" element={
              <ProtectedRoute>
                <TrainingPage />
              </ProtectedRoute>
            } />
            */}
            <Route path="/general-repair-record" element={
              <ProtectedRoute>
                <GeneralRepairRecord />
              </ProtectedRoute>
            } />
            <Route path="/qr-labels" element={
              <AdminProtectedRoute>
                <QRLabelsPage />
              </AdminProtectedRoute>
            } />
            <Route 
              path="/manager" 
              element={
                <ManagerProtectedRoute>
                  <ManagerPage />
                </ManagerProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <AdminProtectedRoute>
                  <SharePointAdminComponent />
                </AdminProtectedRoute>
              } 
            />
            <Route 
              path="/workplan" 
              element={
                <ManagerProtectedRoute>
                  <div className="fixed inset-0 top-16 bg-white overflow-auto z-10">
                    <WorkplanEditor />
                  </div>
                </ManagerProtectedRoute>
              } 
            />
            <Route 
              path="/auth/callback" 
              element={
                <AdminProtectedRoute>
                  <SharePointAdminComponent />
                </AdminProtectedRoute>
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// Main App Component with Auth Provider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
