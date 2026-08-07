import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../services/api';
import { 
  RefreshCw, ArrowLeft, AlertTriangle, Download, Camera, 
  X, MessageSquare, FileText, Edit, AlertCircle, CheckCircle 
} from 'lucide-react';

function NearMissesPage() {
  const [nearMisses, setNearMisses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filter, setFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [newComment, setNewComment] = useState('');
  const navigate = useNavigate();
  const { employee } = useAuth();
  const isAdmin = employee?.admin_control === 'yes';
  const isManager = employee?.manager_control === 'yes';
  const canInvestigate = isAdmin || isManager;
  
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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'red': return 'bg-red-500';
      case 'orange': return 'bg-orange-500';
      case 'green': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  const getProgressLabel = (progress) => {
    switch (progress) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Not Started';
    }
  };

  const filteredItems = nearMisses.filter(item => {
    if (filter === 'new' && item.acknowledged) return false;
    if (filter === 'acknowledged' && !item.acknowledged) return false;
    if (locationFilter !== 'all' && item.location !== locationFilter) return false;
    return true;
  });

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
        
        <div className="flex gap-2 flex-wrap">
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
                      {item.severity && (
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(item.severity)}`} title={`Severity: ${item.severity}`} />
                      )}
                      {!item.acknowledged && (
                        <Badge className="bg-red-500 text-white">New</Badge>
                      )}
                      {item.location && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">{item.location}</Badge>
                      )}
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
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
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

export default NearMissesPage;
