import React, { useState, useEffect, createContext, useContext, lazy, Suspense, memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Checkbox } from './components/ui/checkbox';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { toast } from 'sonner';
import { useTranslation } from './LanguageContext';
import { languages } from './translations';
import { CheckCircle2, ClipboardList, Settings, FileText, ArrowLeft, Download, Calendar, User, Wrench, RefreshCw, Link2, Database, Upload, AlertCircle, AlertTriangle, Camera, X, Truck } from 'lucide-react';
import './App.css';

// Use SharePointAdminComponent directly for now

// Authentication Context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user was previously authenticated (session storage for now)
    const storedEmployee = sessionStorage.getItem('authenticated_employee');
    if (storedEmployee) {
      try {
        const empData = JSON.parse(storedEmployee);
        setEmployee(empData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing stored employee data:', error);
        sessionStorage.removeItem('authenticated_employee');
      }
    }
    setLoading(false);
  }, []);

  const login = (employeeData) => {
    setEmployee(employeeData);
    setIsAuthenticated(true);
    sessionStorage.setItem('authenticated_employee', JSON.stringify(employeeData));
  };

  const logout = () => {
    setEmployee(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('authenticated_employee');
  };

  return (
    <AuthContext.Provider value={{ 
      employee, 
      isAuthenticated, 
      login, 
      logout, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

// Dashboard Component
function Dashboard() {
  const [recentChecklists, setRecentChecklists] = useState([]);
  const [stats, setStats] = useState({ total: 0, todayByType: {}, todayTotal: 0, repairsDue: 0, nonAcknowledgedRepairs: 0, repairsCompletedLast7Days: 0, pendingMachineAdditions: 0 });
  const [showRepairWarning, setShowRepairWarning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentChecklists();
  }, []);

  const fetchRecentChecklists = async () => {
    try {
      // Fetch recent checklists for display
      const recentResponse = await fetch(`${API_BASE_URL}/api/checklists?limit=5`);
      const recentChecklistsData = await recentResponse.json();
      // Filter out GENERAL REPAIR records from recent display
      const filteredRecentChecklists = recentChecklistsData.filter(c => c.check_type !== 'GENERAL REPAIR');
      setRecentChecklists(filteredRecentChecklists);
      
      // Fetch all checklists for accurate stats (limit=0 means get all)
      const allResponse = await fetch(`${API_BASE_URL}/api/checklists?limit=0`);
      const allChecklists = await allResponse.json();
      
      // Calculate total checks completed (excluding GENERAL REPAIR)
      const regularChecklists = allChecklists.filter(c => c.check_type !== 'GENERAL REPAIR');
      const totalCompleted = regularChecklists.length;
      
      // Calculate today's checks by type (excluding GENERAL REPAIR)
      const today = new Date().toISOString().split('T')[0];
      const todayChecklists = regularChecklists.filter(c => c.completed_at.startsWith(today));
      
      // Group today's checks by machine type
      const todayByType = todayChecklists.reduce((acc, checklist) => {
        // Convert check_type to user-friendly names with consistent formatting
        let typeName = checklist.check_type;
        if (typeName === 'daily_check' || typeName === 'grader_startup') {
          // Use machine check type if available, otherwise classify by make
          if (checklist.machine_make.toLowerCase().includes('cat')) {
            typeName = 'Mounted machines';
          } else if (checklist.machine_make.toLowerCase().includes('john deere')) {
            typeName = 'Vehicles';
          } else {
            typeName = 'Other equipment';
          }
        } else if (typeName === 'workshop_service') {
          typeName = 'Workshop service';
        } else if (typeName === 'NEW MACHINE' || typeName === 'MACHINE ADD') {
          typeName = 'Machine add';
        } else if (typeName === 'REPAIR COMPLETED') {
          typeName = 'Repairs completed';
        }
        
        acc[typeName] = (acc[typeName] || 0) + 1;
        return acc;
      }, {});
      
      // Calculate repair statistics
      const repairItems = [];
      allChecklists.forEach(checklist => {
        // Add unsatisfactory checklist items
        if (checklist.checklist_items) {
          checklist.checklist_items.forEach((item, index) => {
            if (item.status === 'unsatisfactory') {
              repairItems.push({
                id: `${checklist.id}-${index}`,
                completedAt: checklist.completed_at,
                type: 'unsatisfactory_item'
              });
            }
          });
        }
        
        // Add GENERAL REPAIR records
        if (checklist.check_type === 'GENERAL REPAIR') {
          repairItems.push({
            id: `${checklist.id}-general`,
            completedAt: checklist.completed_at,
            type: 'general_repair'
          });
        }
      });
      
      // Calculate non-acknowledged repairs using localStorage
      const acknowledgedRepairs = JSON.parse(localStorage.getItem('acknowledgedRepairs') || '[]');
      const completedRepairs = JSON.parse(localStorage.getItem('completedRepairs') || '[]');
      const nonAcknowledgedRepairs = repairItems.filter(repair => !acknowledgedRepairs.includes(repair.id)).length;
      
      // Calculate repairs due (acknowledged but not completed repairs)
      const repairsDue = repairItems.filter(repair => 
        acknowledgedRepairs.includes(repair.id) && !completedRepairs.includes(repair.id)
      ).length;
      
      // Calculate repairs completed in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const repairsCompletedLast7Days = allChecklists.filter(checklist => 
        checklist.check_type === 'REPAIR COMPLETED' && 
        new Date(checklist.completed_at) >= sevenDaysAgo
      ).length;
      
      // Calculate pending machine additions (MACHINE ADD records)
      const acknowledgedMachines = JSON.parse(localStorage.getItem('acknowledgedMachines') || '[]');
      const machineAdditions = allChecklists.filter(checklist => 
        checklist.check_type === 'MACHINE ADD' || checklist.check_type === 'NEW MACHINE'
      );
      const pendingMachineAdditions = machineAdditions.filter(machine => 
        !acknowledgedMachines.includes(machine.id)
      ).length;
      
      setStats({ 
        total: totalCompleted, 
        todayByType: todayByType,
        todayTotal: todayChecklists.length,
        repairsDue: repairsDue,
        nonAcknowledgedRepairs: nonAcknowledgedRepairs,
        repairsCompletedLast7Days: repairsCompletedLast7Days,
        pendingMachineAdditions: pendingMachineAdditions
      });
    } catch (error) {
      console.error('Error fetching checklists:', error);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* General Repair Warning Modal */}
      {showRepairWarning && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative z-[10000]">
            <div className="flex items-center mb-4">
              <AlertCircle className="h-6 w-6 text-orange-600 mr-3" />
              <h3 className="text-lg font-semibold text-orange-800">Important Notice</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 leading-relaxed">
                This is for general repair reporting. If this repair is <strong>urgent</strong> or is a <strong>health and safety issue</strong>, please report directly to your manager immediately.
              </p>
              <div className="mt-4 p-3 bg-orange-50 border-l-4 border-orange-400 rounded">
                <p className="text-sm text-orange-800">
                  <strong>⚠ Remember:</strong> Critical safety issues require immediate supervisor notification.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={() => {
                  setShowRepairWarning(false);
                  navigate('/general-repair-record');
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                I Understand - Continue
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center sm:text-left">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Machine Checklist Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Manage equipment startup checklists and safety inspections</p>
          <p className="text-xs text-gray-400 mt-1">v3.0-nav-buttons</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6 w-full">
          <Button 
            onClick={() => navigate('/new-checklist')} 
            className="bg-green-600 hover:bg-green-700 flex-1 text-sm sm:text-base py-4 sm:py-6"
            data-testid="daily-check-btn"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Checks and Servicing
          </Button>
          <Button 
            onClick={() => setShowRepairWarning(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6"
            data-testid="breakdown-repair-btn"
          >
            <Wrench className="mr-2 h-4 w-4" />
            Breakdown and repair reporting
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
        {/* 1. New Repairs - First */}
        <Card 
          data-testid="non-acknowledged-repairs-card"
          className="hover:shadow-lg transition-shadow"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Repairs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.nonAcknowledgedRepairs}</div>
            <p className="text-xs text-gray-600 mb-2">Need acknowledgment</p>
            <Button 
              onClick={() => navigate('/repairs-needed?view=new')}
              variant="outline"
              size="sm"
              className="w-full"
            >
              View New Repairs
            </Button>
          </CardContent>
        </Card>

        {/* 2. New Machines Added - Second */}
        <Card 
          data-testid="machine-additions-card"
          className="hover:shadow-lg transition-shadow border-blue-200 bg-blue-50"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">New Machines Added</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.pendingMachineAdditions}</div>
            <p className="text-xs text-blue-700 mb-2">Pending review</p>
            <Button 
              onClick={() => navigate('/machine-additions')}
              variant="outline"
              size="sm"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              View Machine Requests
            </Button>
          </CardContent>
        </Card>

        {/* 3. Repairs Due - Third */}
        <Card 
          data-testid="repairs-due-card"
          className="hover:shadow-lg transition-shadow"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repairs Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.repairsDue}</div>
            <p className="text-xs text-gray-600 mb-2">Acknowledged repairs</p>
            <Button 
              onClick={() => navigate('/repairs-needed?view=acknowledged')}
              variant="outline"
              size="sm"
              className="w-full"
            >
              View Repairs Due
            </Button>
          </CardContent>
        </Card>

        {/* 4. Today's Checks - Fourth */}
        <Card data-testid="today-checklists-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Checks</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.todayTotal}</div>
            {Object.keys(stats.todayByType).length > 0 && (
              <div className="mt-2 space-y-1">
                {(() => {
                  // Define the desired order
                  const order = ['Vehicles', 'Mounted machines', 'Other equipment', 'Machine add', 'Repairs completed', 'Workshop service'];
                  
                  // Sort entries based on the defined order
                  const sortedEntries = Object.entries(stats.todayByType).sort(([typeA], [typeB]) => {
                    const indexA = order.indexOf(typeA);
                    const indexB = order.indexOf(typeB);
                    
                    // If type not in order array, put at end
                    if (indexA === -1 && indexB === -1) return 0;
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    
                    return indexA - indexB;
                  });
                  
                  return sortedEntries.map(([type, count]) => (
                    <p key={type} className="text-xs text-gray-600">
                      {type}: {count}
                    </p>
                  ));
                })()}
              </div>
            )}
            {Object.keys(stats.todayByType).length === 0 && (
              <p className="text-xs text-gray-600">No checks completed today</p>
            )}
          </CardContent>
        </Card>
        
        {/* 5. Total Checks - Fifth */}
        <Card 
          data-testid="total-checklists-card"
          className="hover:shadow-lg transition-shadow"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Checks Completed</CardTitle>
            <ClipboardList className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.total}</div>
            <p className="text-xs text-gray-600 mb-2">All time</p>
            <Button 
              onClick={() => navigate('/all-checks')}
              variant="outline"
              size="sm"
              className="w-full"
            >
              View All Checks
            </Button>
          </CardContent>
        </Card>

        {/* 6. Repairs Completed - Last */}
        <Card 
          data-testid="repairs-completed-card"
          className="hover:shadow-lg transition-shadow"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repairs Completed</CardTitle>
            <Wrench className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.repairsCompletedLast7Days}</div>
            <p className="text-xs text-gray-600 mb-2">Last 7 days</p>
            <Button 
              onClick={() => navigate('/repairs-completed')}
              variant="outline"
              size="sm"
              className="w-full"
            >
              View Completed Repairs
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {/* Language Selector */}
          <div className="flex justify-center mb-4">
            <Select value={language} onValueChange={changeLanguage}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('selectLanguage')} />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <ClipboardList className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{t('loginTitle')}</CardTitle>
          <CardDescription className="text-center">
            {t('loginSubtitle')}
          </CardDescription>
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

// New Checklist Component
function NewChecklist() {
  const { employee, isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [machineCheckType, setMachineCheckType] = useState('');
  const [selectedCheckType, setSelectedCheckType] = useState(''); // daily or workshop
  const [checklistItems, setChecklistItems] = useState([]);
  const [workshopNotes, setWorkshopNotes] = useState('');
  const [workshopPhotos, setWorkshopPhotos] = useState([]);
  const [makes, setMakes] = useState([]);
  const [names, setNames] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(-1); // -1 for workshop photos
  const [showFaultModal, setShowFaultModal] = useState(false);
  const [currentFaultIndex, setCurrentFaultIndex] = useState(-1);
  const [faultExplanation, setFaultExplanation] = useState('');
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [newMachine, setNewMachine] = useState({
    make: '',
    name: '',
    yearMade: '',
    serialNumber: ''
  });
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

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

  const graderStartupChecklistItems = [
    { item: "Emergency stops working and present - Test all emergency stop buttons", status: "unchecked", notes: "" },
    { item: "Walkways clear of debris and gates closed - All access areas safe", status: "unchecked", notes: "" },
    { item: "Guards are all in place - All safety guards properly secured", status: "unchecked", notes: "" },
    { item: "All personnel accounted for and out of reach of dangers - Safety zone clear", status: "unchecked", notes: "" },
    { item: "Oil level check - Engine oil at correct level", status: "unchecked", notes: "" },
    { item: "Fuel level check - Adequate fuel for operation", status: "unchecked", notes: "" },
    { item: "Hydraulic fluid level - Within acceptable range", status: "unchecked", notes: "" },
    { item: "Battery condition - Terminals clean, voltage adequate", status: "unchecked", notes: "" },
    { item: "Track/blade condition - No visible damage or excessive wear", status: "unchecked", notes: "" },
    { item: "Blade operation - Hydraulic lift and angle functions working", status: "unchecked", notes: "" },
    { item: "Warning beacon - Rotating warning light operational", status: "unchecked", notes: "" },
    { item: "Backup alarm - Reverse warning signal functional", status: "unchecked", notes: "" }
  ];

  useEffect(() => {
    fetchMakes();
  }, []);

  useEffect(() => {
    if (selectedMake) {
      fetchNames(selectedMake);
      setSelectedName(''); // Reset name when make changes
      setMachineCheckType(''); // Reset check type
    }
  }, [selectedMake]);

  useEffect(() => {
    if (selectedMake && selectedName) {
      fetchCheckType(selectedMake, selectedName);
    }
  }, [selectedMake, selectedName]);

  useEffect(() => {
    if (step === 3 && selectedCheckType === 'daily_check' && machineCheckType) {
      loadChecklistTemplate(machineCheckType);
    }
  }, [step, selectedCheckType, machineCheckType]);

  const loadChecklistTemplate = async (type) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklist-templates/${encodeURIComponent(type)}`);
      const template = await response.json();
      
      if (response.ok && template.items) {
        const items = template.items.map(templateItem => ({
          item: typeof templateItem === 'string' ? templateItem : templateItem.item,
          status: "unchecked",
          notes: ""
        }));
        setChecklistItems(items);
      } else {
        // Fallback to default items if template not found
        const fallbackItems = type === 'daily_check' ? defaultChecklistItems : graderStartupChecklistItems;
        setChecklistItems(fallbackItems);
      }
    } catch (error) {
      console.error('Error loading checklist template:', error);
      // Fallback to default items on error
      const fallbackItems = type === 'daily_check' ? defaultChecklistItems : graderStartupChecklistItems;
      setChecklistItems(fallbackItems);
    }
  };

  // fetchStaff function removed - no longer needed since staff selection was replaced with employee authentication

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

  const fetchNames = async (make) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/names/${encodeURIComponent(make)}`);
      const data = await response.json();
      setNames(data);
    } catch (error) {
      console.error('Error fetching machine names:', error);
      toast.error('Failed to load machine names');
    }
  };

  const fetchCheckType = async (make, name) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/checktype/${encodeURIComponent(make)}/${encodeURIComponent(name)}`);
      const data = await response.json();
      setMachineCheckType(data.check_type);
    } catch (error) {
      console.error('Error fetching check type:', error);
      toast.error('Failed to load check type');
    }
  };

  // Photo functionality
  const takePhoto = async (itemIndex = -1) => {
    console.log('takePhoto called with itemIndex:', itemIndex);
    
    // Check if camera is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        console.log('Requesting camera access...');
        setCurrentPhotoIndex(itemIndex);
        setShowCamera(true);  // Show modal first
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },  // Prefer back camera but allow front
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        console.log('Camera access granted, setting up video...');
        
        // Create video element for camera preview
        setTimeout(() => {
          const video = document.getElementById('camera-video');
          if (video) {
            video.srcObject = stream;
            console.log('Video stream set up successfully');
          } else {
            console.log('Video element not found');
          }
        }, 200);
        
      } catch (error) {
        console.error('Error accessing camera:', error);
        setShowCamera(false);  // Hide modal on error
        // Fallback to file upload
        triggerFileUpload(itemIndex);
      }
    } else {
      // Fallback to file upload if camera not available
      console.log('Camera not available, using file upload fallback');
      triggerFileUpload(itemIndex);
    }
  };

  const triggerFileUpload = (itemIndex) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Prefer back camera on mobile
    input.onchange = (e) => handleFileSelect(e, itemIndex);
    input.click();
  };

  const handleFileSelect = (event, itemIndex) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoData = e.target.result;
        
        if (itemIndex === -1) {
          // Workshop photo
          setWorkshopPhotos(prev => [...prev, {
            id: Date.now(),
            data: photoData,
            timestamp: new Date().toISOString()
          }]);
          toast.success('Workshop photo added!');
        } else {
          // Checklist item photo
          const updatedItems = [...checklistItems];
          if (!updatedItems[itemIndex].photos) {
            updatedItems[itemIndex].photos = [];
          }
          updatedItems[itemIndex].photos.push({
            id: Date.now(),
            data: photoData,
            timestamp: new Date().toISOString()
          });
          setChecklistItems(updatedItems);
          toast.success('Photo added to checklist item!');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const capturePhoto = () => {
    const video = document.getElementById('camera-video');
    const canvas = document.createElement('canvas');
    
    if (video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      // Convert to base64
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      
      if (currentPhotoIndex === -1) {
        // Workshop photo
        setWorkshopPhotos(prev => [...prev, {
          id: Date.now(),
          data: photoData,
          timestamp: new Date().toISOString()
        }]);
        toast.success('Workshop photo captured!');
      } else {
        // Checklist item photo
        const updatedItems = [...checklistItems];
        if (!updatedItems[currentPhotoIndex].photos) {
          updatedItems[currentPhotoIndex].photos = [];
        }
        updatedItems[currentPhotoIndex].photos.push({
          id: Date.now(),
          data: photoData,
          timestamp: new Date().toISOString()
        });
        setChecklistItems(updatedItems);
        toast.success('Photo captured for checklist item!');
      }
    }
    
    closeCamera();
  };

  const closeCamera = () => {
    const video = document.getElementById('camera-video');
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setShowCamera(false);
    setCurrentPhotoIndex(-1);
  };

  const deletePhoto = (itemIndex, photoId) => {
    if (itemIndex === -1) {
      // Workshop photo
      setWorkshopPhotos(prev => prev.filter(photo => photo.id !== photoId));
    } else {
      // Checklist item photo
      const updatedItems = [...checklistItems];
      updatedItems[itemIndex].photos = updatedItems[itemIndex].photos.filter(photo => photo.id !== photoId);
      setChecklistItems(updatedItems);
    }
  };

  const uploadPhoto = (itemIndex) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        // Check file size (limit to 5MB)
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

          if (itemIndex === -1) {
            // Workshop photo
            setWorkshopPhotos(prev => [...prev, photoData]);
            toast.success('Photo uploaded for workshop notes!');
          } else {
            // Checklist item photo
            const updatedItems = [...checklistItems];
            if (!updatedItems[itemIndex].photos) {
              updatedItems[itemIndex].photos = [];
            }
            updatedItems[itemIndex].photos.push(photoData);
            setChecklistItems(updatedItems);
            toast.success('Photo uploaded for checklist item!');
          }
        };
        
        reader.onerror = () => {
          toast.error('Error reading file. Please try again.');
        };
        
        reader.readAsDataURL(file);
      }
    };
    
    input.click();
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...checklistItems];
    
    // Special handling for unsatisfactory status
    if (field === 'status' && value === 'unsatisfactory') {
      // Show fault explanation modal
      setCurrentFaultIndex(index);
      setFaultExplanation(updatedItems[index].notes || '');
      setShowFaultModal(true);
      
      // Set status to unsatisfactory
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      setChecklistItems(updatedItems);
    } else {
      // Normal handling for other changes
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      setChecklistItems(updatedItems);
    }
  };

  const handleFaultExplanation = () => {
    if (!faultExplanation.trim()) {
      toast.error('Please provide an explanation for the fault');
      return;
    }
    
    // Update the notes for the current item
    const updatedItems = [...checklistItems];
    updatedItems[currentFaultIndex].notes = faultExplanation.trim();
    setChecklistItems(updatedItems);
    
    // Close modal and reset state
    setShowFaultModal(false);
    setCurrentFaultIndex(-1);
    setFaultExplanation('');
    
    toast.success('Fault explanation recorded');
  };

  const closeFaultModal = () => {
    // If closing without explanation, revert the status back to unchecked
    if (!faultExplanation.trim() && currentFaultIndex >= 0) {
      const updatedItems = [...checklistItems];
      updatedItems[currentFaultIndex].status = 'unchecked';
      setChecklistItems(updatedItems);
    }
    
    setShowFaultModal(false);
    setCurrentFaultIndex(-1);
    setFaultExplanation('');
  };

  const handleAddMachine = async () => {
    // Validate all fields
    if (!newMachine.make.trim() || !newMachine.name.trim() || 
        !newMachine.yearMade.trim() || !newMachine.serialNumber.trim()) {
      toast.error('Please fill in all machine details');
      return;
    }

    // Validate safety confirmation
    if (!safetyConfirmed) {
      toast.error('Please confirm that you have checked similar machine safety procedures');
      return;
    }

    // Create a MACHINE ADD record
    try {
      const machineAddRecord = {
        employee_number: employee.employee_number,
        staff_name: employee.name,
        machine_make: newMachine.make.trim(),
        machine_model: newMachine.name.trim(),
        check_type: 'NEW MACHINE',
        checklist_items: [],
        workshop_notes: `New machine added:\nMake: ${newMachine.make.trim()}\nName/Model: ${newMachine.name.trim()}\nYear Made: ${newMachine.yearMade.trim()}\nSerial Number: ${newMachine.serialNumber.trim()}`,
        workshop_photos: []
      };

      const response = await fetch(`${API_BASE_URL}/api/checklists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(machineAddRecord)
      });

      if (response.ok) {
        toast.success('Machine addition request recorded successfully!');
        setShowAddMachineModal(false);
        setNewMachine({ make: '', name: '', yearMade: '', serialNumber: '' });
        setSafetyConfirmed(false);
        navigate('/');
      } else {
        throw new Error('Failed to record machine addition');
      }
    } catch (error) {
      console.error('Error recording machine addition:', error);
      toast.error('Failed to record machine addition. Please try again.');
    }
  };

  const closeAddMachineModal = () => {
    setShowAddMachineModal(false);
    setNewMachine({ make: '', name: '', yearMade: '', serialNumber: '' });
    setSafetyConfirmed(false);
  };

  const handleSubmit = async () => {
    // Check for unsatisfactory items without explanations
    if (selectedCheckType === 'daily_check') {
      const unsatisfactoryWithoutNotes = checklistItems.find(item => 
        item.status === 'unsatisfactory' && (!item.notes || item.notes.trim() === '')
      );
      
      if (unsatisfactoryWithoutNotes) {
        toast.error('Do not carry on with this check or until this issue is recorded and sorted.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const checklist = {
        employee_number: employee.employee_number,
        staff_name: employee.name,
        machine_make: selectedMake,
        machine_model: selectedName,
        check_type: selectedCheckType,
        checklist_items: selectedCheckType === 'daily_check' ? checklistItems : [],
        workshop_notes: selectedCheckType === 'workshop_service' ? workshopNotes : null,
        workshop_photos: selectedCheckType === 'workshop_service' ? workshopPhotos : []
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

  const canProceedToStep2 = selectedCheckType !== '';
  const allItemsAddressed = selectedCheckType === 'workshop_service' 
    ? workshopNotes.trim() !== '' 
    : checklistItems.every(item => 
        (item.status === 'satisfactory' || item.status === 'n/a' || 
         (item.status === 'unsatisfactory' && item.notes && item.notes.trim() !== ''))
      );

  return (
    <div className="space-y-6">
      {/* Camera Modal */}
      {showCamera && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4 relative z-[10000]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Take Photo</h3>
              <Button variant="ghost" size="sm" onClick={closeCamera}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative mb-4">
              <video
                id="camera-video"
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg bg-gray-200"
                style={{ maxHeight: '300px' }}
              />
            </div>
            
            <div className="flex justify-center space-x-4">
              <Button variant="outline" onClick={closeCamera}>
                Cancel
              </Button>
              <Button onClick={capturePhoto} className="bg-green-600 hover:bg-green-700">
                <Camera className="h-4 w-4 mr-2" />
                Capture Photo
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Fault Explanation Modal */}
      {showFaultModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative z-[10000]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-red-600">⚠ Fault Explanation Required</h3>
              <Button variant="ghost" size="sm" onClick={closeFaultModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-3">
                {currentFaultIndex >= 0 && checklistItems[currentFaultIndex] && (
                  <span className="font-medium">Item: {checklistItems[currentFaultIndex].item}</span>
                )}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-700 font-medium text-sm">
                  Do not carry on with this check or until this issue is recorded and sorted.
                </p>
                <p className="text-red-600 text-xs mt-2 italic">
                  Example: "Low tread on tyres, Have notified [manager name] to order a new tyre" or "Fixed issue with lights"
                </p>
              </div>
              <label className="block text-sm font-medium mb-2">
                Please explain the fault:
              </label>
              <Textarea
                value={faultExplanation}
                onChange={(e) => setFaultExplanation(e.target.value)}
                placeholder="Describe the issue and any immediate actions taken..."
                className="min-h-[100px] border-red-300 focus:border-red-500"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={closeFaultModal}>
                Cancel
              </Button>
              <Button 
                onClick={handleFaultExplanation}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!faultExplanation.trim()}
              >
                Record Fault
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Machine Modal */}
      {showAddMachineModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative z-[10000]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-green-600">
                <Database className="h-5 w-5 inline mr-2" />
                Add New Machine
              </h3>
              <Button variant="ghost" size="sm" onClick={closeAddMachineModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-700 text-sm">
                  This will create a "NEW MACHINE" record for review by administrators.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Machine Make *</label>
                <input
                  type="text"
                  value={newMachine.make}
                  onChange={(e) => setNewMachine(prev => ({...prev, make: e.target.value}))}
                  placeholder="e.g., John Deere, Caterpillar, JCB"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Machine Name/Model *</label>
                <input
                  type="text"
                  value={newMachine.name}
                  onChange={(e) => setNewMachine(prev => ({...prev, name: e.target.value}))}
                  placeholder="e.g., 6145R, DP30NTD, 320E"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Year Made *</label>
                <input
                  type="text"
                  value={newMachine.yearMade}
                  onChange={(e) => setNewMachine(prev => ({...prev, yearMade: e.target.value}))}
                  placeholder="e.g., 2020, 2023"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Serial Number / Machine Number *</label>
                <input
                  type="text"
                  value={newMachine.serialNumber}
                  onChange={(e) => setNewMachine(prev => ({...prev, serialNumber: e.target.value}))}
                  placeholder="e.g., CT14F04465, ABC123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            
            {/* Safety Confirmation */}
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="safety-confirmation"
                  checked={safetyConfirmed}
                  onCheckedChange={setSafetyConfirmed}
                  className="mt-1"
                />
                <label 
                  htmlFor="safety-confirmation" 
                  className="text-sm text-orange-800 cursor-pointer"
                >
                  I have checked along similar machine checks and confirm it is safe to take out.
                </label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={closeAddMachineModal}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddMachine}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={!newMachine.make.trim() || !newMachine.name.trim() || 
                         !newMachine.yearMade.trim() || !newMachine.serialNumber.trim() || 
                         !safetyConfirmed}
              >
                Submit Request
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

      {/* Employee Info */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <User className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-gray-900">Logged in as: {employee.name}</p>
              <p className="text-sm text-gray-600">Employee #{employee.employee_number}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Steps - Machine → Check Type → Checklist */}
      <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-4 sm:mb-8 overflow-x-auto">
        <div className={`flex items-center space-x-1 sm:space-x-2 ${step >= 1 ? 'text-green-600' : 'text-gray-400'} whitespace-nowrap`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${step >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>1</div>
          <span className="text-xs sm:text-sm">Machine</span>
        </div>
        <div className={`w-6 sm:w-12 h-1 ${step >= 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        <div className={`flex items-center space-x-1 sm:space-x-2 ${step >= 2 ? 'text-green-600' : 'text-gray-400'} whitespace-nowrap`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${step >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>2</div>
          <span className="text-xs sm:text-sm">Check Type</span>
        </div>
        <div className={`w-6 sm:w-12 h-1 ${step >= 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        <div className={`flex items-center space-x-1 sm:space-x-2 ${step >= 3 ? 'text-green-600' : 'text-gray-400'} whitespace-nowrap`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>3</div>
          <span className="text-xs sm:text-sm">Checklist</span>
        </div>
      </div>

      <Card data-testid="checklist-form-card">
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Machine Make</h3>
                  <Select value={selectedMake} onValueChange={(value) => { setSelectedMake(value); setSelectedName(''); }} data-testid="make-select">
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
                  <h3 className="text-lg font-semibold mb-4">Select Machine Name</h3>
                  <Select value={selectedName} onValueChange={setSelectedName} disabled={!selectedMake} data-testid="name-select">
                    <SelectTrigger>
                      <SelectValue placeholder="Choose machine name" />
                    </SelectTrigger>
                    <SelectContent>
                      {names.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Add Machine Section */}
              <div className="border-t pt-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800">Machine Not Listed?</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    If your machine is not available in the list above, you can request it to be added to the system.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddMachineModal(true)}
                    className="border-green-300 text-green-700 hover:bg-green-50"
                    data-testid="add-machine-btn"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Add New Machine
                  </Button>
                </div>
              </div>
              
              {/* Next: Check Type Button - moved to left side below Add New Machine */}
              <div className="mt-4">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!selectedMake || !selectedName}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="proceed-to-check-type-btn"
                >
                  Next: Check Type
                </Button>
              </div>
              
              {machineCheckType && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    Checklist Type: <span className="text-blue-700">{machineCheckType}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <Wrench className="h-5 w-5 text-green-600" />
                <span className="font-medium">Machine: {selectedMake} - {selectedName}</span>
              </div>
              
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-900 font-medium">Checklist Type: {machineCheckType}</p>
                <p className="text-blue-700 text-sm mt-1">This machine uses the "{machineCheckType}" checklist template</p>
              </div>
              
              <div className="mb-4">
                <p className="text-gray-600">Select the type of check you want to perform:</p>
              </div>
              
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <Card 
                  className={`p-4 sm:p-6 cursor-pointer transition-all hover:shadow-lg hover:border-green-400 border-2 ${selectedCheckType === 'daily_check' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                  onClick={() => {
                    setSelectedCheckType('daily_check');
                    setStep(3);
                  }}
                  data-testid="daily-check-option"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg sm:text-xl">Daily Check</h3>
                      <p className="text-gray-600 text-sm sm:text-base">Complete {machineCheckType} checklist inspection</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">Uses "{machineCheckType}" specific checklist</p>
                      <p className="text-sm text-green-600 font-medium mt-2">Tap to start →</p>
                    </div>
                  </div>
                </Card>

                <Card 
                  className={`p-4 sm:p-6 cursor-pointer transition-all hover:shadow-lg hover:border-orange-400 border-2 ${selectedCheckType === 'workshop_service' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
                  onClick={() => {
                    setSelectedCheckType('workshop_service');
                    setStep(3);
                  }}
                  data-testid="workshop-service-option"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Settings className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg sm:text-xl">Workshop Service</h3>
                      <p className="text-gray-600 text-sm sm:text-base">Record maintenance or repair work</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">Document work completed on machine</p>
                      <p className="text-sm text-orange-600 font-medium mt-2">Tap to start →</p>
                    </div>
                  </div>
                </Card>
              </div>
              
              <div className="flex justify-start pt-6">
                <Button variant="outline" onClick={() => setStep(1)} data-testid="back-to-machine-btn">
                  Back: Machine Selection
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Staff: {employee.name}</span>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Wrench className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Machine: {selectedMake} - {selectedName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ClipboardList className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Check Type: {selectedCheckType === 'daily_check' ? `Daily Check (${machineCheckType})` : 'Workshop Service'}</span>
                  </div>
                </div>
                {selectedCheckType === 'daily_check' && (
                  <Badge variant={allItemsAddressed ? "default" : "secondary"} className="px-3 py-1">
                    {checklistItems.filter(item => item.status !== 'unchecked').length} / {checklistItems.length} Complete
                  </Badge>
                )}
              </div>
              
              <Separator />
              
              {selectedCheckType === 'daily_check' ? (
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
                          <Button
                            variant={item.status === 'n/a' ? 'default' : 'outline'}
                            size="sm"
                            className={`w-8 h-8 p-0 text-xs ${item.status === 'n/a' ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                            onClick={() => handleItemChange(index, 'status', item.status === 'n/a' ? 'unchecked' : 'n/a')}
                            data-testid={`checklist-na-${index}`}
                          >
                            N/A
                          </Button>
                        </div>
                        <div className="flex-1">
                          <label className={`text-sm font-medium cursor-pointer ${
                            item.status === 'unsatisfactory' ? 'text-red-700' : 
                            item.status === 'n/a' ? 'text-gray-500' : ''
                          }`}>
                            {item.item}
                          </label>
                          {item.status === 'unsatisfactory' && (
                            <div className="mt-1 text-xs text-red-600 font-medium">⚠ Unsatisfactory - Requires attention</div>
                          )}
                          {item.status === 'n/a' && (
                            <div className="mt-1 text-xs text-gray-500 font-medium">ℹ Not Applicable</div>
                          )}
                          
                          {/* Photo section */}
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => takePhoto(index)}
                                className="text-xs"
                              >
                                <Camera className="h-3 w-3 mr-1" />
                                Take Photo
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => uploadPhoto(index)}
                                className="text-xs"
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Upload Photo
                              </Button>
                              {item.photos && item.photos.length > 0 && (
                                <span className="text-xs text-gray-600">
                                  {item.photos.length} photo{item.photos.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            
                            {/* Photo thumbnails */}
                            {item.photos && item.photos.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {item.photos.map((photo) => (
                                  <div key={photo.id} className="relative">
                                    <img
                                      src={photo.data}
                                      alt="Checklist item photo"
                                      className="w-16 h-16 object-cover rounded border"
                                    />
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="absolute -top-1 -right-1 w-5 h-5 p-0 rounded-full"
                                      onClick={() => deletePhoto(index, photo.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <Textarea
                            placeholder={item.status === 'unsatisfactory' ? "REQUIRED: Please explain the fault" : "Add notes (optional)"}
                            value={item.notes}
                            onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                            className={`mt-2 text-sm ${item.status === 'unsatisfactory' ? 'border-red-300 bg-red-50' : ''}`}
                            rows={2}
                            data-testid={`checklist-notes-${index}`}
                            required={item.status === 'unsatisfactory'}
                          />
                          {item.status === 'unsatisfactory' && !item.notes?.trim() && (
                            <div className="mt-1 text-xs text-red-600 font-medium">
                              ⚠ Fault explanation is required
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : selectedCheckType === 'workshop_service' ? (
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
                  
                  {/* Workshop Photos Section */}
                  <Card className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Photos</label>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => takePhoto(-1)}
                            className="text-sm"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Take Photo
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => uploadPhoto(-1)}
                            className="text-sm"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Photo
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-orange-600 font-medium bg-orange-50 p-2 rounded">
                        📸 Please take photos before leaving the workshop
                      </p>
                      
                      {/* Workshop Photo Thumbnails */}
                      {workshopPhotos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">{workshopPhotos.length} photo{workshopPhotos.length > 1 ? 's' : ''} captured</p>
                          <div className="grid grid-cols-3 gap-2">
                            {workshopPhotos.map((photo) => (
                              <div key={photo.id} className="relative">
                                <img
                                  src={photo.data}
                                  alt="Workshop photo"
                                  className="w-full h-20 object-cover rounded border"
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="absolute -top-1 -right-1 w-5 h-5 p-0 rounded-full"
                                  onClick={() => deletePhoto(-1, photo.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Grader Start Up Safety Checklist</h3>
                  <p className="text-sm text-gray-600">Complete all safety checks before operating grader. Mark each item as satisfactory (✓) or unsatisfactory (✗).</p>
                  {checklistItems.map((item, index) => (
                    <Card key={index} className={`p-4 ${index < 4 && machineCheckType === 'grader_startup' ? 'border-orange-200 bg-orange-50' : ''}`} data-testid={`checklist-item-${index}`}>
                      <div className="flex items-start space-x-3">
                        <div className="flex flex-col space-y-2 mt-1">
                          <Button
                            variant={item.status === 'satisfactory' ? 'default' : 'outline'}
                            size="sm"
                            className={`w-10 h-10 sm:w-8 sm:h-8 p-0 text-lg sm:text-base ${item.status === 'satisfactory' ? (machineCheckType === 'grader_startup' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700') : (machineCheckType === 'grader_startup' ? 'hover:bg-orange-50' : 'hover:bg-green-50')}`}
                            onClick={() => handleItemChange(index, 'status', item.status === 'satisfactory' ? 'unchecked' : 'satisfactory')}
                            data-testid={`checklist-satisfactory-${index}`}
                          >
                            ✓
                          </Button>
                          <Button
                            variant={item.status === 'unsatisfactory' ? 'default' : 'outline'}
                            size="sm"
                            className={`w-10 h-10 sm:w-8 sm:h-8 p-0 text-lg sm:text-base ${item.status === 'unsatisfactory' ? 'bg-red-600 hover:bg-red-700 text-white' : 'hover:bg-red-50 text-red-600'}`}
                            onClick={() => handleItemChange(index, 'status', item.status === 'unsatisfactory' ? 'unchecked' : 'unsatisfactory')}
                            data-testid={`checklist-unsatisfactory-${index}`}
                          >
                            ✗
                          </Button>
                          <Button
                            variant={item.status === 'n/a' ? 'default' : 'outline'}
                            size="sm"
                            className={`w-10 h-10 sm:w-8 sm:h-8 p-0 text-xs sm:text-xs ${item.status === 'n/a' ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                            onClick={() => handleItemChange(index, 'status', item.status === 'n/a' ? 'unchecked' : 'n/a')}
                            data-testid={`checklist-na-${index}`}
                          >
                            N/A
                          </Button>
                        </div>
                        <div className="flex-1">
                          <label className={`text-sm font-medium cursor-pointer ${
                            item.status === 'unsatisfactory' ? 'text-red-700' : 
                            item.status === 'n/a' ? 'text-gray-500' : ''
                          } ${index < 4 && machineCheckType === 'grader_startup' ? 'text-orange-800' : ''}`}>
                            {item.item}
                          </label>
                          {item.status === 'unsatisfactory' && (
                            <div className="mt-1 text-xs text-red-600 font-medium">⚠ Unsatisfactory - Requires attention</div>
                          )}
                          {item.status === 'n/a' && (
                            <div className="mt-1 text-xs text-gray-500 font-medium">ℹ Not Applicable</div>
                          )}
                          {index < 4 && machineCheckType === 'grader_startup' && (
                            <div className="mt-1 text-xs text-orange-600 font-medium">🚨 Critical Safety Check</div>
                          )}
                          <Textarea
                            placeholder={item.status === 'unsatisfactory' ? "REQUIRED: Please explain the fault" : "Add notes (optional)"}
                            value={item.notes}
                            onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                            className={`mt-2 text-sm ${item.status === 'unsatisfactory' ? 'border-red-300 bg-red-50' : ''}`}
                            rows={2}
                            data-testid={`checklist-notes-${index}`}
                            required={item.status === 'unsatisfactory'}
                          />
                          {item.status === 'unsatisfactory' && !item.notes?.trim() && (
                            <div className="mt-1 text-xs text-red-600 font-medium">
                              ⚠ Fault explanation is required
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              
              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => setStep(2)} data-testid="back-to-check-type-btn">
                  Back: Check Type
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!allItemsAddressed || isSubmitting}
                  className={machineCheckType === 'grader_startup' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
                  data-testid="submit-checklist-btn"
                >
                  {isSubmitting ? 'Saving...' : `Complete ${
                    selectedCheckType === 'daily_check' ? 'Checklist' : 
                    'Service Record'
                  }`}
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
            <p className="text-gray-600 mt-2">Upload Excel files to update staff, machines, and checklists</p>
          </div>
        </div>
      </div>

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
              <li>• Column B: Name (e.g., "John Smith", "Jane Doe")</li>
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
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=0`);
      const data = await response.json();
      // Filter out GENERAL REPAIR records - keep those only on Repairs Needed page
      const filteredChecklists = data.filter(checklist => checklist.check_type !== 'GENERAL REPAIR');
      setChecklists(filteredChecklists);
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
                              <p className="font-medium">{item.item}</p>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// All Checks Completed Component
function AllChecksCompleted() {
  const [checklists, setChecklists] = useState([]);
  const [filteredChecklists, setFilteredChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChecklists();
  }, []);

  useEffect(() => {
    filterChecklists();
  }, [selectedMake, selectedModel, checklists]);

  const fetchChecklists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=0`);
      const data = await response.json();
      // Exclude GENERAL REPAIR records
      const regularChecks = data.filter(c => c.check_type !== 'GENERAL REPAIR');
      setChecklists(regularChecks);
      
      // Extract unique makes and models
      const uniqueMakes = [...new Set(regularChecks.map(c => c.machine_make))].sort();
      setMakes(uniqueMakes);
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  };

  const filterChecklists = () => {
    let filtered = checklists;
    
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
      const response = await fetch(`${API_BASE_URL}/api/checklists/export/excel`);
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
                              <p className="font-medium">{item.item}</p>
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
            <h1 className="text-3xl font-bold text-gray-900">All Checks Completed</h1>
            <p className="text-gray-600 mt-2">View all equipment checks - {filteredChecklists.length} records</p>
          </div>
        </div>
        <Button 
          onClick={handleExport} 
          variant="outline"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
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
          {filteredChecklists.length === 0 ? (
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
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRepairs();
  }, []);

  useEffect(() => {
    filterRepairs();
  }, [selectedMake, selectedModel, repairs]);

  const fetchRepairs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=0`);
      const data = await response.json();
      // Only get REPAIR COMPLETED records
      const completedRepairs = data.filter(c => c.check_type === 'REPAIR COMPLETED');
      setRepairs(completedRepairs);
      
      // Extract unique makes
      const uniqueMakes = [...new Set(completedRepairs.map(c => c.machine_make))].sort();
      setMakes(uniqueMakes);
    } catch (error) {
      console.error('Error fetching repairs:', error);
      toast.error('Failed to load repairs');
    } finally {
      setLoading(false);
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Machine Additions Page Component
function MachineAdditionsPage() {
  const [machineRequests, setMachineRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMachineRequests();
  }, []);

  const fetchMachineRequests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=0`);
      const data = await response.json();
      // Get MACHINE ADD or NEW MACHINE records
      const machineAddRequests = data.filter(c => 
        c.check_type === 'MACHINE ADD' || c.check_type === 'NEW MACHINE'
      );
      
      // Get acknowledged machines from localStorage
      const acknowledgedMachines = JSON.parse(localStorage.getItem('acknowledgedMachines') || '[]');
      
      // Mark machines as acknowledged
      const requestsWithAckStatus = machineAddRequests.map(req => ({
        ...req,
        acknowledged: acknowledgedMachines.includes(req.id)
      }));
      
      setMachineRequests(requestsWithAckStatus);
      // Show only non-acknowledged by default
      setFilteredRequests(requestsWithAckStatus.filter(r => !r.acknowledged));
    } catch (error) {
      console.error('Error fetching machine requests:', error);
      toast.error('Failed to load machine requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = (request) => {
    // Add to acknowledged machines in localStorage
    const acknowledgedMachines = JSON.parse(localStorage.getItem('acknowledgedMachines') || '[]');
    if (!acknowledgedMachines.includes(request.id)) {
      acknowledgedMachines.push(request.id);
      localStorage.setItem('acknowledgedMachines', JSON.stringify(acknowledgedMachines));
    }
    
    // Update local state
    setMachineRequests(prev => prev.map(r => 
      r.id === request.id ? { ...r, acknowledged: true } : r
    ));
    setFilteredRequests(prev => prev.filter(r => r.id !== request.id));
    
    toast.success('Machine request acknowledged');
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
      console.log('Submitting repair record...', { selectedMake, selectedName, problemDescription });
      
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

      console.log('Repair record payload:', repairRecord);
      console.log('API URL:', `${API_BASE_URL}/api/checklists`);

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

// Repairs Needed Component
function RepairsNeeded() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [currentRepair, setCurrentRepair] = useState(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [repairPhotos, setRepairPhotos] = useState([]);
  const [showRepairCamera, setShowRepairCamera] = useState(false);
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [viewingRepair, setViewingRepair] = useState(null);
  const navigate = useNavigate();
  const { employee } = useAuth();
  
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
    fetchRepairs();
  }, [hasWorkshopAccess, navigate, viewType]);

  const fetchRepairs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checklists?limit=0`);
      const checklists = await response.json();
      
      // Get acknowledged and completed repairs from localStorage
      const acknowledgedRepairs = JSON.parse(localStorage.getItem('acknowledgedRepairs') || '[]');
      const completedRepairs = JSON.parse(localStorage.getItem('completedRepairs') || '[]');
      
      // Extract all unsatisfactory items from checklists AND general repair records
      const repairItems = [];
      checklists.forEach(checklist => {
        // Add unsatisfactory checklist items
        if (checklist.checklist_items) {
          checklist.checklist_items.forEach((item, index) => {
            if (item.status === 'unsatisfactory') {
              const repairId = `${checklist.id}-${index}`;
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
                repaired: completedRepairs.includes(repairId),
                acknowledged: acknowledgedRepairs.includes(repairId),
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
            repaired: completedRepairs.includes(repairId),
            acknowledged: acknowledgedRepairs.includes(repairId),
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

  const handleAcknowledge = (repair) => {
    // Store acknowledged repair in localStorage
    const acknowledgedRepairs = JSON.parse(localStorage.getItem('acknowledgedRepairs') || '[]');
    if (!acknowledgedRepairs.includes(repair.id)) {
      acknowledgedRepairs.push(repair.id);
      localStorage.setItem('acknowledgedRepairs', JSON.stringify(acknowledgedRepairs));
    }
    
    // Mark repair as acknowledged locally
    setRepairs(prev => prev.map(r => 
      r.id === repair.id 
        ? { ...r, acknowledged: true }
        : r
    ));
    toast.success('Repair acknowledged');
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
        toast.success('Repair completion recorded successfully!');
        
        // Mark repair as completed locally
        setRepairs(prev => prev.map(repair => 
          repair.id === currentRepair.id 
            ? { ...repair, repaired: true, repairNotes: repairNotes, repairPhotos: repairPhotos }
            : repair
        ));
        
        // Add to completedRepairs in localStorage to persist completion status
        const completedRepairs = JSON.parse(localStorage.getItem('completedRepairs') || '[]');
        if (!completedRepairs.includes(currentRepair.id)) {
          completedRepairs.push(currentRepair.id);
          localStorage.setItem('completedRepairs', JSON.stringify(completedRepairs));
        }
        
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

// Main App Content Component
function AppContent() {
  const { isAuthenticated, employee, logout } = useAuth();
  
  // Check if employee has admin control access
  const hasAdminAccess = employee?.admin_control?.toLowerCase() === 'yes';

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <Link to="/" className="flex items-center space-x-2" data-testid="logo-link">
                <div className="flex items-center">
                  <img 
                    src="/abreys-logo.png" 
                    alt="Abreys Logo" 
                    className="h-8 sm:h-10 w-auto"
                    loading="eager"
                  />
                  <span className="text-xs sm:text-sm text-gray-600 ml-2 sm:ml-3 font-medium hidden sm:block">Machine Checklist</span>
                </div>
              </Link>
              <nav className="flex items-center space-x-1 sm:space-x-4">
                <Link 
                  to="/" 
                  className="text-gray-600 hover:text-green-600 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                  data-testid="nav-dashboard"
                >
                  Home
                </Link>
                {/* Admin link - always visible, access controlled by AdminProtectedRoute */}
                <Link 
                  to="/admin" 
                  className="text-gray-600 hover:text-green-600 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors"
                  data-testid="nav-admin"
                >
                  Admin
                </Link>
                
                {/* User info and logout */}
                {isAuthenticated && employee && (
                  <div className="flex items-center space-x-2 border-l pl-2 sm:pl-4 ml-2 sm:ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-gray-900">{employee.name}</p>
                      <p className="text-xs text-gray-600">#{employee.employee_number}</p>
                    </div>
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={logout}
                      className="text-gray-600 hover:text-red-600 text-xs sm:text-sm font-medium px-2 sm:px-3"
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
            <Route path="/general-repair-record" element={
              <ProtectedRoute>
                <GeneralRepairRecord />
              </ProtectedRoute>
            } />
            <Route 
              path="/admin" 
              element={
                <AdminProtectedRoute>
                  <SharePointAdminComponent />
                </AdminProtectedRoute>
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