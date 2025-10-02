import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Checkbox } from './components/ui/checkbox';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardList, Settings, FileText, ArrowLeft, Download, Calendar, User, Wrench, RefreshCw, Link, Database } from 'lucide-react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

// Dashboard Component
function Dashboard() {
  const [recentChecklists, setRecentChecklists] = useState([]);
  const [stats, setStats] = useState({ total: 0, today: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentChecklists();
  }, []);

  const fetchRecentChecklists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=5`);
      const checklists = await response.json();
      setRecentChecklists(checklists);
      
      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const todayCount = checklists.filter(c => c.completed_at.startsWith(today)).length;
      setStats({ total: checklists.length, today: todayCount });
    } catch (error) {
      console.error('Error fetching checklists:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Machine Checklist Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage equipment startup checklists and safety inspections</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => navigate('/new-checklist')} 
            className="bg-green-600 hover:bg-green-700"
            data-testid="new-checklist-btn"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            New Checklist
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/records')}
            data-testid="view-records-btn"
          >
            <FileText className="mr-2 h-4 w-4" />
            View Records
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card data-testid="total-checklists-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Checklists</CardTitle>
            <ClipboardList className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.total}</div>
            <p className="text-xs text-gray-600">All time</p>
          </CardContent>
        </Card>
        
        <Card data-testid="today-checklists-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Checks</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.today}</div>
            <p className="text-xs text-gray-600">Completed today</p>
          </CardContent>
        </Card>
        
        <Card data-testid="safety-status-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Safety Status</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Active</div>
            <p className="text-xs text-gray-600">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Checklists */}
      <Card data-testid="recent-checklists-card">
        <CardHeader>
          <CardTitle>Recent Checklists</CardTitle>
          <CardDescription>Latest equipment inspections and startup checks</CardDescription>
        </CardHeader>
        <CardContent>
          {recentChecklists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No checklists completed yet</p>
              <p className="text-sm">Start your first equipment check</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentChecklists.map((checklist) => {
                let statusBadge;
                if (checklist.check_type === 'daily_check') {
                  const itemsSatisfactory = checklist.checklist_items.filter(item => item.status === 'satisfactory').length;
                  const itemsUnsatisfactory = checklist.checklist_items.filter(item => item.status === 'unsatisfactory').length;
                  const totalItems = checklist.checklist_items.length;
                  statusBadge = (
                    <Badge variant={itemsUnsatisfactory === 0 ? "secondary" : "destructive"} className="mb-1">
                      ✓{itemsSatisfactory} ✗{itemsUnsatisfactory}/{totalItems}
                    </Badge>
                  );
                } else {
                  statusBadge = (
                    <Badge variant="outline" className="mb-1">
                      Workshop Service
                    </Badge>
                  );
                }
                
                return (
                  <div key={checklist.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50" data-testid={`checklist-item-${checklist.id}`}>
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${checklist.check_type === 'daily_check' ? 'bg-green-100' : 'bg-blue-100'}`}>
                        {checklist.check_type === 'daily_check' ? 
                          <CheckCircle2 className="h-4 w-4 text-green-600" /> : 
                          <Settings className="h-4 w-4 text-blue-600" />
                        }
                      </div>
                      <div>
                        <p className="font-medium">{checklist.machine_make} {checklist.machine_model}</p>
                        <p className="text-sm text-gray-600">{checklist.check_type === 'daily_check' ? 'Daily check' : 'Workshop service'} by {checklist.staff_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {statusBadge}
                      <p className="text-xs text-gray-500">
                        {new Date(checklist.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// New Checklist Component
function NewChecklist() {
  const [step, setStep] = useState(1);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [checkType, setCheckType] = useState('');
  const [checklistItems, setChecklistItems] = useState([]);
  const [workshopNotes, setWorkshopNotes] = useState('');
  const [staff, setStaff] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const defaultChecklistItems = [
    { item: "Oil level check - Engine oil at correct level", status: "unchecked", notes: "" },
    { item: "Fuel level check - Adequate fuel for operation", status: "unchecked", notes: "" },
    { item: "Hydraulic fluid level - Within acceptable range", status: "unchecked", notes: "" },
    { item: "Battery condition - Terminals clean, voltage adequate", status: "unchecked", notes: "" },
    { item: "Tire/track condition - No visible damage or excessive wear", status: "unchecked", notes: "" },
    { item: "Safety guards in place - All protective covers secured", status: "unchecked", notes: "" },
    { item: "Emergency stop function - Test emergency stop button", status: "unchecked", notes: "" },
    { item: "Warning lights operational - All safety lights working", status: "unchecked", notes: "" },
    { item: "Operator seat condition - Seat belt and controls functional", status: "unchecked", notes: "" },
    { item: "Air filter condition - Clean and properly sealed", status: "unchecked", notes: "" },
    { item: "Cooling system - Radiator clear, coolant level adequate", status: "unchecked", notes: "" },
    { item: "Brake system function - Service and parking brakes operational", status: "unchecked", notes: "" },
    { item: "Steering operation - Smooth operation, no excessive play", status: "unchecked", notes: "" },
    { item: "Lights and signals - All operational lights working", status: "unchecked", notes: "" },
    { item: "Fire extinguisher - Present and within service date", status: "unchecked", notes: "" }
  ];

  useEffect(() => {
    fetchStaff();
    fetchMakes();
  }, []);

  useEffect(() => {
    if (selectedMake) {
      fetchModels(selectedMake);
    }
  }, [selectedMake]);

  useEffect(() => {
    if (step === 4 && checkType === 'daily_check') {
      setChecklistItems(defaultChecklistItems);
    }
  }, [step, checkType]);

  const fetchStaff = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/staff`);
      const data = await response.json();
      setStaff(data);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff list');
    }
  };

  const fetchMakes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/makes`);
      const data = await response.json();
      setMakes(data);
    } catch (error) {
      console.error('Error fetching makes:', error);
      toast.error('Failed to load machine makes');
    }
  };

  const fetchModels = async (make) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/models/${encodeURIComponent(make)}`);
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error('Error fetching models:', error);
      toast.error('Failed to load machine models');
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...checklistItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setChecklistItems(updatedItems);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const checklist = {
        staff_name: selectedStaff,
        machine_make: selectedMake,
        machine_model: selectedModel,
        check_type: checkType,
        checklist_items: checkType === 'daily_check' ? checklistItems : [],
        workshop_notes: checkType === 'workshop_service' ? workshopNotes : null
      };

      const response = await fetch(`${API_BASE_URL}/api/checklists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checklist)
      });

      if (response.ok) {
        toast.success('Checklist completed successfully!');
        navigate('/');
      } else {
        throw new Error('Failed to save checklist');
      }
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast.error('Failed to save checklist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedToStep2 = selectedStaff !== '';
  const canProceedToStep3 = selectedMake !== '' && selectedModel !== '';
  const canProceedToStep4 = checkType !== '';
  const allItemsAddressed = checkType === 'workshop_service' ? workshopNotes.trim() !== '' : checklistItems.every(item => item.status !== 'unchecked');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Equipment Checklist</h1>
            <p className="text-gray-600 mt-2">Complete startup safety inspection</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>1</div>
          <span>Staff</span>
        </div>
        <div className={`w-12 h-1 ${step >= 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>2</div>
          <span>Machine</span>
        </div>
        <div className={`w-12 h-1 ${step >= 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>3</div>
          <span>Check Type</span>
        </div>
        <div className={`w-12 h-1 ${step >= 4 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        <div className={`flex items-center space-x-2 ${step >= 4 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>4</div>
          <span>Checklist</span>
        </div>
      </div>

      <Card data-testid="checklist-form-card">
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Select Staff Member</h3>
                <Select value={selectedStaff} onValueChange={setSelectedStaff} data-testid="staff-select">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose staff member performing the check" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.name}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!canProceedToStep2}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="proceed-to-machine-btn"
                >
                  Next: Select Machine
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <User className="h-5 w-5 text-green-600" />
                <span className="font-medium">Staff: {selectedStaff}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Machine Make</h3>
                  <Select value={selectedMake} onValueChange={(value) => { setSelectedMake(value); setSelectedModel(''); }} data-testid="make-select">
                    <SelectTrigger>
                      <SelectValue placeholder="Choose machine manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      {makes.map((make) => (
                        <SelectItem key={make} value={make}>
                          {make}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Machine Model</h3>
                  <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedMake} data-testid="model-select">
                    <SelectTrigger>
                      <SelectValue placeholder="Choose machine model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} data-testid="back-to-staff-btn">
                  Back: Staff Selection
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  disabled={!canProceedToStep3}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="proceed-to-check-type-btn"
                >
                  Next: Check Type
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <User className="h-5 w-5 text-green-600" />
                <span className="font-medium">Staff: {selectedStaff}</span>
                <Wrench className="h-5 w-5 text-green-600 ml-4" />
                <span className="font-medium">Machine: {selectedMake} {selectedModel}</span>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600">Select the type of check you want to perform. Clicking will take you directly to the appropriate form.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card 
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg hover:border-green-400 border-2 ${checkType === 'daily_check' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                  onClick={() => {
                    setCheckType('daily_check');
                    setStep(4);
                  }}
                  data-testid="daily-check-option"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Daily Check</h3>
                      <p className="text-gray-600">Complete pre-startup safety inspection</p>
                      <p className="text-sm text-gray-500 mt-1">15-item checklist with ✓/✗ options</p>
                      <p className="text-xs text-green-600 font-medium mt-2">Click to start →</p>
                    </div>
                  </div>
                </Card>
                
                <Card 
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg hover:border-blue-400 border-2 ${checkType === 'workshop_service' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                  onClick={() => {
                    setCheckType('workshop_service');
                    setStep(4);
                  }}
                  data-testid="workshop-service-option"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Settings className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Workshop Service</h3>
                      <p className="text-gray-600">Record maintenance or repair work</p>
                      <p className="text-sm text-gray-500 mt-1">Document work completed on machine</p>
                      <p className="text-xs text-blue-600 font-medium mt-2">Click to start →</p>
                    </div>
                  </div>
                </Card>
              </div>
              
              <div className="flex justify-start pt-6">
                <Button variant="outline" onClick={() => setStep(2)} data-testid="back-to-machine-btn">
                  Back: Machine Selection
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Staff: {selectedStaff}</span>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Wrench className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Machine: {selectedMake} {selectedModel}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Type: {checkType === 'daily_check' ? 'Daily Check' : 'Workshop Service'}</span>
                  </div>
                </div>
                {checkType === 'daily_check' && (
                  <Badge variant={allItemsAddressed ? "default" : "secondary"} className="px-3 py-1">
                    {checklistItems.filter(item => item.status !== 'unchecked').length} / {checklistItems.length} Complete
                  </Badge>
                )}
              </div>
              
              <Separator />
              
              {checkType === 'daily_check' ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pre-Startup Safety Checklist</h3>
                  <p className="text-sm text-gray-600">Mark each item as satisfactory (✓) or unsatisfactory (✗). You can submit even with unsatisfactory items.</p>
                  {checklistItems.map((item, index) => (
                    <Card key={index} className="p-4" data-testid={`checklist-item-${index}`}>
                      <div className="flex items-start space-x-3">
                        <div className="flex flex-col space-y-2 mt-1">
                          <Button
                            variant={item.status === 'satisfactory' ? 'default' : 'outline'}
                            size="sm"
                            className={`w-8 h-8 p-0 ${item.status === 'satisfactory' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50'}`}
                            onClick={() => handleItemChange(index, 'status', item.status === 'satisfactory' ? 'unchecked' : 'satisfactory')}
                            data-testid={`checklist-satisfactory-${index}`}
                          >
                            ✓
                          </Button>
                          <Button
                            variant={item.status === 'unsatisfactory' ? 'default' : 'outline'}
                            size="sm"
                            className={`w-8 h-8 p-0 ${item.status === 'unsatisfactory' ? 'bg-red-600 hover:bg-red-700 text-white' : 'hover:bg-red-50 text-red-600'}`}
                            onClick={() => handleItemChange(index, 'status', item.status === 'unsatisfactory' ? 'unchecked' : 'unsatisfactory')}
                            data-testid={`checklist-unsatisfactory-${index}`}
                          >
                            ✗
                          </Button>
                        </div>
                        <div className="flex-1">
                          <label className={`text-sm font-medium cursor-pointer ${item.status === 'unsatisfactory' ? 'text-red-700' : ''}`}>
                            {item.item}
                          </label>
                          {item.status === 'unsatisfactory' && (
                            <div className="mt-1 text-xs text-red-600 font-medium">⚠ Unsatisfactory - Requires attention</div>
                          )}
                          <Textarea
                            placeholder="Add notes (optional)"
                            value={item.notes}
                            onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                            className="mt-2 text-sm"
                            rows={2}
                            data-testid={`checklist-notes-${index}`}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Workshop Service Record</h3>
                  <p className="text-sm text-gray-600">Document the maintenance or repair work completed on this machine.</p>
                  <Card className="p-4">
                    <label className="text-sm font-medium mb-2 block">Work Completed</label>
                    <Textarea
                      placeholder="Describe the service, maintenance, or repairs performed on this machine..."
                      value={workshopNotes}
                      onChange={(e) => setWorkshopNotes(e.target.value)}
                      className="min-h-[120px]"
                      data-testid="workshop-notes-input"
                    />
                  </Card>
                </div>
              )}
              
              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => setStep(3)} data-testid="back-to-check-type-btn">
                  Back: Check Type
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!allItemsAddressed || isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="submit-checklist-btn"
                >
                  {isSubmitting ? 'Saving...' : `Complete ${checkType === 'daily_check' ? 'Checklist' : 'Service Record'}`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// SharePoint Admin Component
function SharePointAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have auth code in URL (callback from SharePoint)
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    
    if (authCode) {
      handleAuthCallback(authCode);
    }
  }, []);

  const handleAuthCallback = async (authCode) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/sharepoint/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: authCode })
      });

      if (response.ok) {
        setIsAuthenticated(true);
        toast.success('SharePoint authentication successful!');
        // Remove auth code from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        testConnection();
      } else {
        const error = await response.json();
        toast.error(`Authentication failed: ${error.detail}`);
      }
    } catch (error) {
      toast.error('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const authenticateSharePoint = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/sharepoint/auth-url`);
      const data = await response.json();
      
      if (response.ok) {
        // Redirect to SharePoint authentication
        window.location.href = data.auth_url;
      } else {
        toast.error('Failed to get authentication URL');
      }
    } catch (error) {
      toast.error('Failed to start authentication');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/sharepoint/test`);
      const data = await response.json();
      
      if (response.ok) {
        setConnectionStatus(data);
        setIsAuthenticated(true);
      } else {
        toast.error('Connection test failed');
        setIsAuthenticated(false);
      }
    } catch (error) {
      toast.error('Connection test failed');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const syncData = async (type) => {
    try {
      setLoading(true);
      const endpoint = type === 'all' ? 'sync-all' : type === 'staff' ? 'sync-staff' : 'sync-assets';
      
      const response = await fetch(`${API_BASE_URL}/api/admin/sharepoint/${endpoint}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSyncResults(data);
        toast.success(data.message);
      } else {
        toast.error(`Sync failed: ${data.detail}`);
      }
    } catch (error) {
      toast.error('Sync operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')} data-testid="back-to-dashboard-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SharePoint Integration</h1>
            <p className="text-gray-600 mt-2">Sync staff names and machine data from your Excel files</p>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <Card data-testid="auth-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Link className="h-5 w-5 text-blue-600" />
              <span>Connect to SharePoint</span>
            </CardTitle>
            <CardDescription>
              Connect to your Microsoft 365 account to access Excel files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Your Excel Files:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Staff Names: Name List.xlsx</li>
                <li>• Machine Assets: AssetList.xlsx</li>
              </ul>
            </div>
            <Button 
              onClick={authenticateSharePoint} 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
              data-testid="authenticate-btn"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Connect to SharePoint
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && (
        <>
          {connectionStatus && (
            <Card data-testid="connection-status-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-green-600" />
                  <span>File Connection Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Staff File Status */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${connectionStatus.staff_file?.status === 'accessible' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <p className="font-medium">Staff Names File</p>
                      <p className="text-sm text-gray-600">
                        {connectionStatus.staff_file?.name || 'Name List.xlsx'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={connectionStatus.staff_file?.status === 'accessible' ? 'default' : 'destructive'}>
                    {connectionStatus.staff_file?.status || 'Unknown'}
                  </Badge>
                </div>

                {/* Asset File Status */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${connectionStatus.asset_file?.status === 'accessible' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <p className="font-medium">Machine Assets File</p>
                      <p className="text-sm text-gray-600">
                        {connectionStatus.asset_file?.name || 'AssetList.xlsx'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={connectionStatus.asset_file?.status === 'accessible' ? 'default' : 'destructive'}>
                    {connectionStatus.asset_file?.status || 'Unknown'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <Card data-testid="sync-controls-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 text-green-600" />
                <span>Data Synchronization</span>
              </CardTitle>
              <CardDescription>
                Update your app with the latest data from SharePoint Excel files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => syncData('staff')} 
                  disabled={loading}
                  variant="outline"
                  className="h-20 flex-col space-y-2"
                  data-testid="sync-staff-btn"
                >
                  <User className="h-6 w-6" />
                  <span>Sync Staff Names</span>
                </Button>
                
                <Button 
                  onClick={() => syncData('assets')} 
                  disabled={loading}
                  variant="outline"
                  className="h-20 flex-col space-y-2"
                  data-testid="sync-assets-btn"
                >
                  <Wrench className="h-6 w-6" />
                  <span>Sync Machine Assets</span>
                </Button>
                
                <Button 
                  onClick={() => syncData('all')} 
                  disabled={loading}
                  className="h-20 flex-col space-y-2 bg-green-600 hover:bg-green-700"
                  data-testid="sync-all-btn"
                >
                  {loading ? (
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  ) : (
                    <Database className="h-6 w-6" />
                  )}
                  <span>Sync All Data</span>
                </Button>
              </div>

              <Button 
                onClick={testConnection} 
                disabled={loading}
                variant="ghost"
                className="w-full"
                data-testid="test-connection-btn"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Test Connection
              </Button>
            </CardContent>
          </Card>

          {syncResults && (
            <Card data-testid="sync-results-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Sync Results</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto">
                  {JSON.stringify(syncResults, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Records Component
function Records() {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists`);
      const data = await response.json();
      setChecklists(data);
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast.error('Failed to load checklist records');
    } finally {
      setLoading(false);
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
                
                if (checklist.check_type === 'daily_check') {
                  const itemsSatisfactory = checklist.checklist_items.filter(item => item.status === 'satisfactory').length;
                  const itemsUnsatisfactory = checklist.checklist_items.filter(item => item.status === 'unsatisfactory').length;
                  const totalItems = checklist.checklist_items.length;
                  statusInfo = (
                    <div className="space-y-1">
                      <Badge 
                        variant={itemsUnsatisfactory === 0 ? "default" : "secondary"}
                        className="mb-1"
                      >
                        ✓{itemsSatisfactory} ✗{itemsUnsatisfactory} of {totalItems} items
                      </Badge>
                      {itemsUnsatisfactory > 0 && (
                        <div className="text-xs text-red-600 font-medium">⚠ Issues found</div>
                      )}
                    </div>
                  );
                } else {
                  statusInfo = (
                    <Badge variant="outline" className="mb-1">
                      Workshop Service
                    </Badge>
                  );
                }
                
                return (
                  <Card key={checklist.id} className="hover:shadow-md transition-shadow" data-testid={`record-item-${checklist.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-lg ${checklist.check_type === 'daily_check' ? 'bg-green-100' : 'bg-blue-100'}`}>
                            {checklist.check_type === 'daily_check' ? 
                              <CheckCircle2 className="h-6 w-6 text-green-600" /> : 
                              <Settings className="h-6 w-6 text-blue-600" />
                            }
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{checklist.machine_make} {checklist.machine_model}</h3>
                            <p className="text-gray-600">{checklist.check_type === 'daily_check' ? 'Daily check' : 'Workshop service'} by {checklist.staff_name}</p>
                            <p className="text-sm text-gray-500">ID: {checklist.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {statusInfo}
                          <p className="text-sm text-gray-500">
                            {completedDate.toLocaleDateString()} at {completedDate.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center space-x-3" data-testid="logo-link">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-gray-900">Abreys</span>
                  <span className="text-sm text-gray-500 ml-2">Machine Checklist</span>
                </div>
              </Link>
              <nav className="flex items-center space-x-4">
                <Link 
                  to="/" 
                  className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  data-testid="nav-dashboard"
                >
                  Dashboard
                </Link>
                <Link 
                  to="/new-checklist" 
                  className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  data-testid="nav-new-checklist"
                >
                  New Check
                </Link>
                <Link 
                  to="/records" 
                  className="text-gray-600 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  data-testid="nav-records"
                >
                  Records
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-checklist" element={<NewChecklist />} />
            <Route path="/records" element={<Records />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;