import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, ArrowLeft, Upload, AlertCircle, AlertTriangle, Camera, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

// Repairs Needed Component
export default function RepairsNeeded() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [currentRepair, setCurrentRepair] = useState(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [repairPhotos, setRepairPhotos] = useState([]);
  const [showRepairCamera, setShowRepairCamera] = useState(false);
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [viewingRepair, setViewingRepair] = useState(null);
  const [editingProgressNotes, setEditingProgressNotes] = useState(null);
  const [progressNoteText, setProgressNoteText] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [allChecklists, setAllChecklists] = useState([]);
  const navigate = useNavigate();
  const { employee } = useAuth();
  
  const ITEMS_PER_PAGE = 100;
  
  // Get view type from URL parameter (default to 'new')
  const searchParams = new URLSearchParams(window.location.search);
  const viewType = searchParams.get('view') || 'new'; // 'new' or 'acknowledged'

  // Check if employee has workshop control access
  const hasWorkshopAccess = employee?.workshop_control?.toLowerCase() === 'yes';

  useEffect(() => {
    // Check workshop control permission
    if (!hasWorkshopAccess) {
      toast.error('Access denied. You do not have Workshop Control permission.');
      navigate('/');
      return;
    }
    // Clear old localStorage data (migration to database-only storage)
    localStorage.removeItem('acknowledgedMachines');
    localStorage.removeItem('acknowledgedRepairs');
    // Reset state and refetch when viewType changes
    setAllChecklists([]);
    setRepairs([]);
    setLoading(true);
    fetchRepairs();
  }, [hasWorkshopAccess, navigate, viewType]);

  const fetchRepairs = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }
      
      const skip = append ? allChecklists.length : 0;
      // Use optimized endpoint that only fetches checklists with repairs
      const response = await fetch(`${API_BASE_URL}/api/checklists-with-repairs?limit=${ITEMS_PER_PAGE}&skip=${skip}`);
      const checklists = await response.json();
      
      // Store all fetched checklists
      if (append) {
        setAllChecklists(prev => [...prev, ...checklists]);
      } else {
        setAllChecklists(checklists);
      }
      
      // Check if there are more items to load
      setHasMore(checklists.length === ITEMS_PER_PAGE);
      
      // Get repair statuses from DATABASE (no more localStorage!)
      const statusResponse = await fetch(`${API_BASE_URL}/api/repair-status/bulk`);
      const repairStatuses = await statusResponse.json();
      
      // Use all checklists (combined from previous and new fetches)
      const allChecklistsToProcess = append ? allChecklists : checklists;
      
      // Extract all unsatisfactory items from checklists AND general repair records
      const repairItems = [];
      allChecklistsToProcess.forEach(checklist => {
        // Add unsatisfactory checklist items
        if (checklist.checklist_items) {
          checklist.checklist_items.forEach((item, index) => {
            if (item.status === 'unsatisfactory') {
              const repairId = `${checklist.id}-${index}`;
              const status = repairStatuses[repairId] || {};
              repairItems.push({
                id: repairId,
                checklistId: checklist.id,
                itemIndex: index,
                item: item.item,
                notes: item.notes || '',
                machine: `${checklist.machine_make} ${checklist.machine_model}`,
                machine_make: checklist.machine_make,
                machine_model: checklist.machine_model,
                completedAt: checklist.completed_at,
                staffName: checklist.staff_name,
                checkType: checklist.check_type,
                repaired: status.completed || false,
                acknowledged: status.acknowledged || false,
                progress_notes: status.progress_notes || [],
                repairNotes: '',
                repairPhotos: [],
                type: 'unsatisfactory_item'
              });
            }
          });
        }
        
        // Add GENERAL REPAIR records
        if (checklist.check_type === 'GENERAL REPAIR') {
          // Extract problem description from workshop_notes
          const problemDescription = checklist.workshop_notes
            .split('\n')
            .slice(1) // Skip the "GENERAL REPAIR REPORT:" line
            .map(line => line.replace('Problem Description: ', ''))
            .join(' ')
            .trim();
            
          const repairId = `${checklist.id}-general`;
          const status = repairStatuses[repairId] || {};
          repairItems.push({
            id: repairId,
            checklistId: checklist.id,
            itemIndex: -1, // No specific checklist item
            item: 'General Equipment Issue',
            notes: problemDescription,
            machine: `${checklist.machine_make} ${checklist.machine_model}`,
            machine_make: checklist.machine_make,
            machine_model: checklist.machine_model,
            completedAt: checklist.completed_at,
            staffName: checklist.staff_name,
            checkType: checklist.check_type,
            repaired: status.completed || false,
            acknowledged: status.acknowledged || false,
            progress_notes: status.progress_notes || [],
            repairNotes: '',
            repairPhotos: [],
            type: 'general_repair'
          });
        }
      });
      
      // Filter based on view type
      let filteredRepairs = repairItems;
      if (viewType === 'new') {
        // Show only non-acknowledged repairs
        filteredRepairs = repairItems.filter(repair => !repair.acknowledged);
      } else if (viewType === 'acknowledged') {
        // Show only acknowledged but not completed repairs
        filteredRepairs = repairItems.filter(repair => repair.acknowledged && !repair.repaired);
        
        // Sort: Safety checks (unsatisfactory_item) first, then by urgency priority
        filteredRepairs.sort((a, b) => {
          // Safety checks always come first
          if (a.type === 'unsatisfactory_item' && b.type !== 'unsatisfactory_item') return -1;
          if (a.type !== 'unsatisfactory_item' && b.type === 'unsatisfactory_item') return 1;
          
          // If both are same type, sort by urgency priority
          const getUrgencyPriority = (repair) => {
            const urgency = getUrgencyLevel(repair);
            if (!urgency) return 4; // No urgency info = lowest priority
            if (urgency.toLowerCase().includes('stopped')) return 1; // Highest priority
            if (urgency.toLowerCase().includes('asap')) return 2;
            if (urgency.toLowerCase().includes('not urgent')) return 3;
            return 4;
          };
          
          return getUrgencyPriority(a) - getUrgencyPriority(b);
        });
      }
      
      setRepairs(filteredRepairs);
    } catch (error) {
      console.error('Error fetching repairs:', error);
      toast.error('Failed to load repair items');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchRepairs(true);
    }
  };

  const handleRepairComplete = (repair) => {
    setCurrentRepair(repair);
    setRepairNotes('');
    setRepairPhotos([]);
    setShowRepairModal(true);
  };

  const handleViewRepair = (repair) => {
    setViewingRepair(repair);
    setShowViewingModal(true);
  };

  const closeViewingModal = () => {
    setShowViewingModal(false);
    setViewingRepair(null);
  };

  const getUrgencyLevel = (repair) => {
    if (repair.type === 'general_repair' && repair.notes) {
      // The notes contain the full workshop_notes, need to extract from there
      // Check if it contains "Urgency Level:" 
      if (repair.notes.includes('Urgency Level:')) {
        const urgencyMatch = repair.notes.match(/Urgency Level:\s*([^\n]+)/);
        if (urgencyMatch) {
          return urgencyMatch[1].trim();
        }
      }
      
      // Fallback: check if the description itself contains urgency keywords
      if (repair.notes.includes('stopped machine')) {
        return 'Breakdown has stopped machine';
      } else if (repair.notes.includes('asap but still running')) {
        return 'Breakdown will need repair asap but still running';
      } else if (repair.notes.includes('not urgent')) {
        return 'Breakdown is not urgent';
      }
    }
    return null;
  };

  const getCleanDescription = (repair) => {
    if (repair.type === 'general_repair' && repair.notes) {
      // Remove "Urgency Level:" line from the description
      let cleanDescription = repair.notes;
      
      // Remove the urgency level line if it exists
      cleanDescription = cleanDescription.replace(/Urgency Level:\s*[^\n]+\n?/, '');
      
      // If it contains "Problem Description:", get everything after that
      if (cleanDescription.includes('Problem Description:')) {
        cleanDescription = cleanDescription.split('Problem Description:')[1]?.trim() || cleanDescription;
      }
      
      return cleanDescription.trim();
    }
    return repair.notes;
  };

  const getUrgencyColors = (repair) => {
    // Safety checks always get prominent red styling
    if (repair.type === 'unsatisfactory_item') {
      return {
        border: 'border-l-red-600',
        text: 'text-red-800',
        badge: 'border-red-400 text-red-700',
        bg: 'bg-red-50'
      };
    }
    
    // General repairs get color based on urgency level
    const urgencyLevel = getUrgencyLevel(repair);
    
    if (repair.type === 'general_repair' && urgencyLevel) {
      if (urgencyLevel.includes('stopped machine')) {
        return {
          border: 'border-l-red-500',
          text: 'text-red-700',
          badge: 'border-red-300 text-red-600',
          bg: 'bg-white'
        };
      } else if (urgencyLevel.includes('asap but still running')) {
        return {
          border: 'border-l-orange-500',
          text: 'text-orange-700',
          badge: 'border-orange-300 text-orange-600',
          bg: 'bg-white'
        };
      } else if (urgencyLevel.includes('not urgent')) {
        return {
          border: 'border-l-yellow-500',
          text: 'text-yellow-700',
          badge: 'border-yellow-300 text-yellow-600',
          bg: 'bg-white'
        };
      }
    }
    
    // Default colors for general repairs without urgency
    return { 
      border: 'border-l-yellow-500', 
      text: 'text-yellow-700', 
      badge: 'border-yellow-300 text-yellow-600',
      bg: 'bg-white'
    };
  };

  const handleAcknowledge = async (repair) => {
    try {
      // Store in database ONLY (no more localStorage!)
      const response = await fetch(`${API_BASE_URL}/api/repair-status/acknowledge?repair_id=${repair.id}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to acknowledge');
      
      // Update the repairs list
      setRepairs(prev => prev.map(r => 
        r.id === repair.id 
          ? { ...r, acknowledged: true }
          : r
      ));
      
      // If on "new" view, filter out acknowledged repairs
      if (viewType === 'new') {
        setRepairs(prev => prev.filter(r => !r.acknowledged));
      }
      
      toast.success('Repair acknowledged and moved to Repairs Due');
    } catch (error) {
      console.error('Error acknowledging repair:', error);
      toast.error('Failed to acknowledge repair');
    }
  };
  
  const handleAcknowledgeAll = async () => {
    try {
      const newAcknowledgements = repairs.filter(r => !r.acknowledged);
      
      // Acknowledge all in database ONLY
      await Promise.all(newAcknowledgements.map(r => 
        fetch(`${API_BASE_URL}/api/repair-status/acknowledge?repair_id=${r.id}`, { method: 'POST' })
      ));
      
      // Remove all from view if in "new" mode
      if (viewType === 'new') {
        setRepairs([]);
      } else {
        setRepairs(prev => prev.map(r => ({ ...r, acknowledged: true })));
      }
      
      toast.success(`${newAcknowledgements.length} repairs acknowledged and moved to Repairs Due`);
    } catch (error) {
      console.error('Error acknowledging repairs:', error);
      toast.error('Failed to acknowledge all repairs');
    }
  };
  
  const getProgressNotes = (repairId) => {
    // Get from repair object which was loaded from database
    const repair = repairs.find(r => r.id === repairId);
    return repair?.progress_notes || [];
  };
  
  const handleAddProgressNote = (repairId) => {
    setEditingProgressNotes(repairId);
    setProgressNoteText('');
  };
  
  const saveProgressNote = async (repairId) => {
    if (!progressNoteText.trim()) {
      toast.error('Please enter a note');
      return;
    }
    
    try {
      // Save to database ONLY
      const response = await fetch(`${API_BASE_URL}/api/repair-status/add-note?repair_id=${repairId}&note_text=${encodeURIComponent(progressNoteText.trim())}&author=${encodeURIComponent(employee?.name || 'Unknown')}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to add note');
      
      setEditingProgressNotes(null);
      setProgressNoteText('');
      toast.success('Progress note added');
      
      // Refresh to show new note
      fetchRepairs();
    } catch (error) {
      console.error('Error adding progress note:', error);
      toast.error('Failed to add progress note');
    }
  };
  
  const cancelProgressNote = () => {
    setEditingProgressNotes(null);
    setProgressNoteText('');
  };

  const uploadRepairPhoto = () => {
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
          toast.success('Photo uploaded for repair documentation!');
        };
        
        reader.onerror = () => {
          toast.error('Error reading file. Please try again.');
        };
        
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const takeRepairPhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setShowRepairCamera(true);
      
      // Wait for modal to be visible, then set up video
      setTimeout(async () => {
        const video = document.getElementById('repair-camera-video');
        const loadingDiv = document.getElementById('camera-loading');
        if (video) {
          video.srcObject = stream;
          // Store stream reference for cleanup
          window.repairCameraStream = stream;
          
          // Hide loading message when video starts playing
          video.addEventListener('loadedmetadata', () => {
            if (loadingDiv) {
              loadingDiv.style.display = 'none';
            }
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Failed to access camera. Please check camera permissions.');
    }
  };

  const captureRepairPhoto = () => {
    try {
      const video = document.getElementById('repair-camera-video');
      if (!video || !video.videoWidth) {
        toast.error('Camera not ready. Please wait a moment and try again.');
        return;
      }
      
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
      
      // Stop the camera and close modal
      if (window.repairCameraStream) {
        window.repairCameraStream.getTracks().forEach(track => track.stop());
        window.repairCameraStream = null;
      }
      setShowRepairCamera(false);
      
      toast.success('Photo captured for repair documentation!');
    } catch (error) {
      console.error('Error capturing photo:', error);
      toast.error('Failed to capture photo. Please try again.');
    }
  };

  const closeRepairCamera = () => {
    // Stop camera when closing modal
    if (window.repairCameraStream) {
      window.repairCameraStream.getTracks().forEach(track => track.stop());
      window.repairCameraStream = null;
    }
    setShowRepairCamera(false);
  };

  const deleteRepairPhoto = (photoId) => {
    setRepairPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  const submitRepairCompletion = async () => {
    if (!repairNotes.trim()) {
      toast.error('Please add notes describing the repair work completed');
      return;
    }

    try {
      // Create a repair completion record
      const repairTypeDescription = currentRepair.type === 'general_repair' 
        ? 'General Repair Issue' 
        : 'Checklist Item Issue';
        
      const repairRecord = {
        employee_number: '0000', // System record
        staff_name: 'Maintenance Team',
        machine_make: currentRepair.machine_make || 'Unknown',
        machine_model: currentRepair.machine_model || 'Unknown',
        check_type: 'REPAIR COMPLETED',
        checklist_items: [],
        workshop_notes: `REPAIR COMPLETED:\nType: ${repairTypeDescription}\nOriginal Issue: ${currentRepair.item}\nOriginal Notes: ${currentRepair.notes}\nRepair Notes: ${repairNotes.trim()}`,
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
        // Mark as completed in database
        await fetch(`${API_BASE_URL}/api/repair-status/complete?repair_id=${currentRepair.id}`, {
          method: 'POST'
        });
        
        toast.success('Repair completion recorded successfully!');
        
        // Mark repair as completed locally
        setRepairs(prev => prev.map(repair => 
          repair.id === currentRepair.id 
            ? { ...repair, repaired: true, repairNotes: repairNotes, repairPhotos: repairPhotos }
            : repair
        ));
        
        setShowRepairModal(false);
        setCurrentRepair(null);
        setRepairNotes('');
        setRepairPhotos([]);
      } else {
        throw new Error('Failed to record repair completion');
      }
    } catch (error) {
      console.error('Error recording repair completion:', error);
      toast.error('Failed to record repair completion. Please try again.');
    }
  };

  const closeRepairModal = () => {
    setShowRepairModal(false);
    setCurrentRepair(null);
    setRepairNotes('');
    setRepairPhotos([]);
  };

  // Show loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading repair items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Repair Completion Modal */}
      {showRepairModal && currentRepair && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative z-[10000]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-green-600">Mark Repair Complete</h3>
              <Button variant="ghost" size="sm" onClick={closeRepairModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 border rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800">Machine: {currentRepair.machine}</p>
                <p className="text-sm text-gray-600">Issue: {currentRepair.item}</p>
                <p className="text-xs text-gray-500">Original Notes: {currentRepair.notes}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Repair Work Completed *</label>
                <Textarea
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  placeholder="Describe the repair work completed, parts replaced, actions taken..."
                  className="min-h-[100px]"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Repair Photos</label>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={takeRepairPhoto}
                      className="text-sm"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={uploadRepairPhoto}
                      className="text-sm"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo
                    </Button>
                  </div>
                </div>
                
                {repairPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {repairPhotos.map((photo) => (
                      <div key={photo.id} className="relative">
                        <img
                          src={photo.data}
                          alt="Repair photo"
                          className="w-full h-16 object-cover rounded border"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute -top-1 -right-1 w-5 h-5 p-0 rounded-full"
                          onClick={() => deleteRepairPhoto(photo.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={closeRepairModal}>
                Cancel
              </Button>
              <Button 
                onClick={submitRepairCompletion}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!repairNotes.trim()}
              >
                Complete Repair
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Repair Camera Modal */}
      {showRepairCamera && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative z-[10000]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-green-600">Take Repair Photo</h3>
              <Button variant="ghost" size="sm" onClick={closeRepairCamera}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <video
                  id="repair-camera-video"
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg bg-gray-200"
                  style={{ aspectRatio: '4/3' }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg" id="camera-loading">
                  <p className="text-gray-600">Loading camera...</p>
                </div>
              </div>
              <Button 
                onClick={captureRepairPhoto}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capture Photo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Repair Viewing Modal */}
      {showViewingModal && viewingRepair && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 relative z-[10000] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Repair Details</h3>
              <Button variant="ghost" size="sm" onClick={closeViewingModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-6">
              {/* Machine Information */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className={`text-lg font-semibold ${viewingRepair.type === 'general_repair' ? 'text-yellow-700' : 'text-red-700'}`}>
                    {viewingRepair.machine}
                  </h4>
                  {viewingRepair.type === 'general_repair' ? (
                    <Badge variant="outline" className="border-yellow-300 text-yellow-600">
                      General Repair
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-red-300 text-red-600">
                      Safety Check
                    </Badge>
                  )}
                </div>
                <p className="text-gray-700 font-medium">{viewingRepair.item}</p>
                <div className="grid grid-cols-2 gap-4 mt-3 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Reported by:</span> {viewingRepair.staffName}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {new Date(viewingRepair.completedAt).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Check Type:</span> {viewingRepair.checkType}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <span className="ml-1 text-red-600 font-medium">Outstanding</span>
                  </div>
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Problem Description</h4>
                <div className="bg-white border rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed">{viewingRepair.notes}</p>
                </div>
              </div>

              {/* Photos Section */}
              {(() => {
                // Get photos from the original checklist
                const getRepairPhotos = async () => {
                  try {
                    const response = await fetch(`${API_BASE_URL}/api/checklists`);
                    const checklists = await response.json();
                    const originalChecklist = checklists.find(c => c.id === viewingRepair.checklistId);
                    
                    if (originalChecklist) {
                      // For general repair, photos are in workshop_photos
                      if (viewingRepair.type === 'general_repair') {
                        return originalChecklist.workshop_photos || [];
                      }
                      // For checklist items, photos are in the specific item
                      if (originalChecklist.checklist_items && originalChecklist.checklist_items[viewingRepair.itemIndex]) {
                        return originalChecklist.checklist_items[viewingRepair.itemIndex].photos || [];
                      }
                    }
                    return [];
                  } catch (error) {
                    console.error('Error fetching photos:', error);
                    return [];
                  }
                };

                // For now, we'll show a placeholder since this is a viewing modal
                // In a real implementation, you'd want to fetch and store photos in state
                return (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Problem Photos</h4>
                    <div className="bg-gray-50 border rounded-lg p-4">
                      <p className="text-gray-500 text-center py-4">
                        Photos from the original report would be displayed here
                      </p>
                      <p className="text-xs text-gray-400 text-center">
                        Note: Photo viewing functionality can be enhanced to fetch and display original photos
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline" onClick={closeViewingModal}>
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    closeViewingModal();
                    handleRepairComplete(viewingRepair);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Mark as Complete
                </Button>
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
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {viewType === 'new' ? 'New Repairs' : 'Repairs Due'}
            </h1>
            <p className="text-gray-600 mt-2">
              {viewType === 'new' 
                ? 'New repair requests requiring acknowledgment' 
                : 'Acknowledged repairs in priority order - ready for completion'}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                {viewType === 'new' ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                    New Repairs ({repairs.filter(r => !r.repaired).length})
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                    Repairs Due ({repairs.filter(r => !r.repaired).length})
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {viewType === 'new' 
                  ? 'Review and acknowledge new repair requests' 
                  : 'Complete acknowledged repairs - sorted by urgency'}
              </CardDescription>
            </div>
            {viewType === 'new' && repairs.filter(r => !r.repaired && !r.acknowledged).length > 0 && (
              <Button 
                onClick={handleAcknowledgeAll}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Acknowledge All ({repairs.filter(r => !r.repaired && !r.acknowledged).length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {repairs.filter(r => !r.repaired).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-400 mb-4" />
              <p>{viewType === 'new' ? 'No new repairs' : 'No repairs due'}</p>
              <p className="text-sm">
                {viewType === 'new' 
                  ? 'All repair requests have been acknowledged' 
                  : 'All acknowledged repairs have been completed'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {repairs
                .filter(r => !r.repaired)
                .sort((a, b) => {
                  // Sort unacknowledged repairs first
                  if (a.acknowledged === b.acknowledged) return 0;
                  return a.acknowledged ? 1 : -1;
                })
                .map((repair) => {
                  const colors = getUrgencyColors(repair);
                  const urgencyLevel = getUrgencyLevel(repair);
                  
                  return (
                    <Card key={repair.id} className={`border-l-4 ${colors.border} ${colors.bg} cursor-pointer hover:shadow-md transition-shadow`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div 
                            className="flex-1 cursor-pointer min-w-0" 
                            onClick={() => handleViewRepair(repair)}
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className={`font-semibold text-lg ${colors.text}`}>
                                {repair.machine}
                              </h3>
                              {repair.type === 'general_repair' ? (
                                <Badge variant="outline" className={`text-xs ${colors.badge}`}>
                                  General Repair
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-red-300 text-red-600">
                                  Safety Check
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-700 mt-1 font-medium">{repair.item}</p>
                            
                            {/* Urgency Level - separate line */}
                            {urgencyLevel && (
                              <div className="mt-2">
                                <span className={`text-sm font-semibold ${colors.text}`}>
                                  Urgency: {urgencyLevel}
                                </span>
                              </div>
                            )}
                            
                            {/* Problem Description - separate line */}
                            <div className="text-sm text-gray-600 mt-2 italic break-words">
                              <p className="line-clamp-3">
                                "{repair.notes.includes('Problem Description:') 
                                  ? repair.notes.split('Problem Description:')[1]?.trim() || repair.notes
                                  : repair.notes}"
                              </p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500">
                              <span>Reported by: {repair.staffName}</span>
                              <span>•</span>
                              <span>Date: {new Date(repair.completedAt).toLocaleDateString()}</span>
                              {repair.type === 'general_repair' && (
                                <>
                                  <span>•</span>
                                  <span className={colors.text.replace('text-', 'text-').replace('-700', '-600') + ' font-medium'}>
                                    General Report
                                  </span>
                                </>
                              )}
                            </div>
                            
                            {/* Progress Notes Section - Only in acknowledged view */}
                            {viewType === 'acknowledged' && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-semibold text-gray-700">Progress Notes</h4>
                                  {editingProgressNotes !== repair.id && (
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddProgressNote(repair.id);
                                      }}
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-7"
                                    >
                                      + Add Note
                                    </Button>
                                  )}
                                </div>
                                
                                {/* Note input field */}
                                {editingProgressNotes === repair.id && (
                                  <div className="mb-3 bg-white p-3 rounded border border-gray-300">
                                    <Textarea
                                      value={progressNoteText}
                                      onChange={(e) => setProgressNoteText(e.target.value)}
                                      placeholder="Add a progress note (e.g., 'Ordered parts', 'Waiting for technician', etc.)"
                                      className="mb-2"
                                      rows={2}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveProgressNote(repair.id);
                                        }}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700"
                                      >
                                        Save Note
                                      </Button>
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          cancelProgressNote();
                                        }}
                                        variant="outline"
                                        size="sm"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Display existing notes */}
                                <div className="space-y-2">
                                  {getProgressNotes(repair.id).length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">No progress notes yet</p>
                                  ) : (
                                    getProgressNotes(repair.id).map((note, idx) => (
                                      <div key={idx} className="bg-blue-50 p-2 rounded text-xs border border-blue-200">
                                        <p className="text-gray-700">{note.text}</p>
                                        <p className="text-gray-500 mt-1">
                                          {note.author} • {new Date(note.date).toLocaleString()}
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-row lg:flex-col gap-2 lg:space-y-0 lg:space-x-0 space-x-2 flex-shrink-0">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRepair(repair);
                          }}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-300 hover:bg-blue-50 flex-1 lg:flex-none lg:w-24"
                        >
                          View Details
                        </Button>
                        {/* Only show Acknowledge button in 'new' view */}
                        {viewType === 'new' && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcknowledge(repair);
                            }}
                            variant="outline"
                            size="sm"
                            className={`flex-1 lg:flex-none lg:w-24 ${repair.acknowledged 
                              ? 'bg-orange-100 text-orange-700 border-orange-300' 
                              : 'text-orange-600 border-orange-300 hover:bg-orange-50'}`}
                            disabled={repair.acknowledged}
                          >
                            {repair.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                          </Button>
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRepairComplete(repair);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white flex-1 lg:flex-none lg:w-24"
                          size="sm"
                        >
                          Mark Complete
                        </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              
              {/* Load More Button */}
              {hasMore && repairs.length > 0 && (
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
                  <p className="text-sm text-gray-500 mt-2">Showing {repairs.filter(r => !r.repaired).length} repairs</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {repairs.filter(r => r.repaired).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
              Completed Repairs ({repairs.filter(r => r.repaired).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {repairs.filter(r => r.repaired).map((repair) => (
                <Card key={repair.id} className="border-l-4 border-l-green-500 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-green-700">{repair.machine}</h3>
                        <p className="text-gray-700 mt-1">{repair.item}</p>
                        <p className="text-sm text-green-600 mt-2">✓ Repair Completed</p>
                      </div>
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
