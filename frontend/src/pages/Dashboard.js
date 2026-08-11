import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from '../LanguageContext';
import { ClipboardList, FileText, Download, Calendar, Wrench, RefreshCw, Upload, AlertCircle, AlertTriangle, Camera, X, Truck, QrCode, CheckCircle, Target, Search, ShieldAlert } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import WorkplanBoard from '../components/WorkplanBoard';
import QRScanner from '../components/QRScanner';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';
import FieldMapBoard from '../components/FieldMapBoard';

// Dashboard Component
export default function Dashboard() {
  const { t } = useTranslation();
  const { employee } = useAuth();
  const isAdmin = employee?.admin_control === 'yes';
  const isManager = employee?.manager_control?.toLowerCase() === 'yes';
  const hasManagerAccess = isAdmin || isManager;
  const [recentChecklists, setRecentChecklists] = useState([]);
  const [stats, setStats] = useState({ total: 0, todayByType: {}, todayTotal: 0, repairsDue: 0, nonAcknowledgedRepairs: 0, repairsCompletedLast7Days: 0, pendingMachineAdditions: 0, nearMissesNew: 0, suggestionsNew: 0, accidentsNew: 0, accidentsTotal: 0, whistleblowingNew: 0, whistleblowingTotal: 0, trainingPending: 0, trainingTotal: 0 });
  const [showRepairWarning, setShowRepairWarning] = useState(false);
  const [checksByDay, setChecksByDay] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const navigate = useNavigate();

  // Dashboard rotation state
  const [activeSection, setActiveSection] = useState(0); // 0=stats, 1=workplan, 2=progress
  const [isPaused, setIsPaused] = useState(false);
  const rotationInterval = useRef(null);
  const ROTATION_DELAY = 60000; // 60 seconds
  const SECTION_LABELS = ['Check Figures', 'Daily Work Plan', 'Work Progress', 'Field Maps'];

  // Auto-rotation effect
  useEffect(() => {
    if (isPaused) {
      if (rotationInterval.current) {
        clearInterval(rotationInterval.current);
        rotationInterval.current = null;
      }
      return;
    }

    rotationInterval.current = setInterval(() => {
      // Don't rotate while the user is scrolled down reading — it would jump the screen
      if (window.scrollY > 150) return;
      setActiveSection(prev => (prev + 1) % 4);
    }, ROTATION_DELAY);

    return () => {
      if (rotationInterval.current) {
        clearInterval(rotationInterval.current);
      }
    };
  }, [isPaused]);

  // Handle section click - pause/resume
  const handleSectionClick = (sectionIndex) => {
    if (activeSection === sectionIndex && !isPaused) {
      // Already on this section, pause
      setIsPaused(true);
    } else if (isPaused) {
      // Currently paused, resume rotation
      setIsPaused(false);
    } else {
      // Switch to clicked section and pause
      setActiveSection(sectionIndex);
      setIsPaused(true);
    }
  };

  // Near Miss / Suggestion / Accident / Whistleblowing Modal state
  const [showReportModal, setShowReportModal] = useState(null); // 'near-miss', 'suggestion', or 'accident'
  const [reportIsAnonymous, setReportIsAnonymous] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [reportLocation, setReportLocation] = useState('');
  const [reportCategory, setReportCategory] = useState('');
  const [reportPhotos, setReportPhotos] = useState([]);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  
  // Accident-specific fields - Matching official accident record book
  // Section 1: About the person who had the accident
  const [injuredName, setInjuredName] = useState('');
  const [injuredAddress, setInjuredAddress] = useState('');
  const [injuredPostcode, setInjuredPostcode] = useState('');
  const [injuredOccupation, setInjuredOccupation] = useState('');
  
  // Section 2: About the person filling in this record
  const [reporterAddress, setReporterAddress] = useState('');
  const [reporterPostcode, setReporterPostcode] = useState('');
  const [reporterOccupation, setReporterOccupation] = useState('');
  
  // Section 3: About the accident
  const [accidentDate, setAccidentDate] = useState('');
  const [accidentTime, setAccidentTime] = useState('');
  const [accidentLocation, setAccidentLocation] = useState('');
  const [accidentDescription, setAccidentDescription] = useState('');
  const [injuryDetails, setInjuryDetails] = useState('');
  
  // Section 4: Employee consent
  const [employeeConsent, setEmployeeConsent] = useState(false);

  // Pie chart data for near misses by location
  const [nearMissesByLocation, setNearMissesByLocation] = useState([]);

  // Total Checks Modal state
  const [showTotalChecksModal, setShowTotalChecksModal] = useState(false);
  const [totalChecksMakes, setTotalChecksMakes] = useState([]);
  const [totalChecksNames, setTotalChecksNames] = useState([]);
  const [selectedFilterMake, setSelectedFilterMake] = useState('');
  const [selectedFilterName, setSelectedFilterName] = useState('');
  const [filteredChecklists, setFilteredChecklists] = useState([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedCheckDetail, setSelectedCheckDetail] = useState(null);  // For viewing check details

  // Use location to trigger refresh on navigation
  const location = useLocation();

  // Handle QR scan from dashboard - navigate directly to check type selection
  const handleDashboardQRScan = async (scannedData) => {
    setShowQRScanner(false);
    try {
      let make, name, checkType;
      
      if (scannedData.startsWith('MACHINE:')) {
        const parts = scannedData.split(':');
        make = parts[1];
        name = parts[2];
      } else if (scannedData.startsWith('http')) {
        const url = new URL(scannedData);
        make = url.searchParams.get('make');
        name = url.searchParams.get('name');
      } else {
        const response = await fetch(`${API_BASE_URL}/api/assets/${scannedData}`);
        if (response.ok) {
          const asset = await response.json();
          make = asset.make;
          name = asset.name;
          checkType = asset.check_type;
        }
      }
      
      if (make && name) {
        // Fetch check type if not available
        if (!checkType) {
          const checkTypeResponse = await fetch(`${API_BASE_URL}/api/assets/checktype/${encodeURIComponent(make)}/${encodeURIComponent(name)}`);
          const checkTypeData = await checkTypeResponse.json();
          checkType = checkTypeData.check_type;
        }
        
        toast.success(`Machine: ${make} - ${name}`);
        
        // Navigate to new-checklist with machine pre-selected, starting at step 2
        navigate('/new-checklist', { 
          state: { 
            scannedMake: make, 
            scannedName: name, 
            scannedCheckType: checkType,
            startAtStep: 2 
          } 
        });
      } else {
        toast.error('Could not find machine from QR code');
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast.error('Invalid QR code format');
    }
  };

  // Total Checks Modal Functions
  const openTotalChecksModal = async () => {
    setShowTotalChecksModal(true);
    setSelectedFilterMake('');
    setSelectedFilterName('');
    setFilteredChecklists([]);
    
    // Load available makes
    try {
      const response = await fetch(`${API_BASE_URL}/api/assets/makes`);
      const makes = await response.json();
      setTotalChecksMakes(makes);
    } catch (error) {
      console.error('Error loading makes:', error);
      toast.error('Failed to load machine makes');
    }
  };

  const handleFilterMakeChange = async (make) => {
    setSelectedFilterMake(make);
    setSelectedFilterName('');
    setFilteredChecklists([]);
    
    if (make) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/assets/names/${encodeURIComponent(make)}`);
        const names = await response.json();
        setTotalChecksNames(names);
      } catch (error) {
        console.error('Error loading names:', error);
      }
    } else {
      setTotalChecksNames([]);
    }
  };

  const handleFilterNameChange = (name) => {
    setSelectedFilterName(name);
  };

  const loadFilteredChecklists = async () => {
    if (!selectedFilterMake) {
      toast.error('Please select a machine make');
      return;
    }
    
    setIsLoadingChecklists(true);
    try {
      let url = `${API_BASE_URL}/api/checklists/by-machine?make=${encodeURIComponent(selectedFilterMake)}&limit=200`;
      if (selectedFilterName) {
        url += `&name=${encodeURIComponent(selectedFilterName)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Handle new paginated response format
      const checklists = data.checklists || data;
      const total = data.total || checklists.length;
      
      setFilteredChecklists(checklists);
      
      if (checklists.length === 0) {
        toast.info('No checklists found for this machine');
      } else if (total > checklists.length) {
        toast.info(`Showing ${checklists.length} of ${total} checklists. Use Export for full data.`);
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
      toast.error('Failed to load checklists');
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const exportAllChecklists = async () => {
    setIsExporting(true);
    toast.info('Generating Excel export... This may take a moment for large datasets.');
    try {
      // Use a longer timeout for large exports
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      // Export ALL checks - no filters
      const response = await fetch(`${API_BASE_URL}/api/checklists/export/excel-by-machine`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Export failed');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `all_checklists_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success('Export downloaded! Each check type is on a separate sheet.');
    } catch (error) {
      console.error('Error exporting:', error);
      if (error.name === 'AbortError') {
        toast.error('Export timed out. Try the faster CSV export instead.');
      } else {
        toast.error(error.message || 'Failed to export checklists. Try CSV for large datasets.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Near Miss / Suggestion / Accident / Whistleblowing submission
  const openReportModal = (type) => {
    setShowReportModal(type);
    setReportIsAnonymous(type === 'whistleblowing'); // Default anonymous for whistleblowing
    setReportName(employee?.name || ''); // Pre-fill with logged-in user's name
    setReportDescription('');
    setReportTitle('');
    setReportLocation('');
    setReportCategory('');
    setReportPhotos([]);
    // Reset accident fields - matching official accident record book
    setInjuredName('');
    setInjuredAddress('');
    setInjuredPostcode('');
    setInjuredOccupation('');
    setReporterAddress('');
    setReporterPostcode('');
    setReporterOccupation('');
    setAccidentDate('');
    setAccidentTime('');
    setAccidentLocation('');
    setAccidentDescription('');
    setInjuryDetails('');
    setEmployeeConsent(false);
  };

  const handlePhotoCapture = (e) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setReportPhotos(prev => [...prev, e.target.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const submitReport = async () => {
    if (showReportModal === 'accident') {
      // Validate accident form - matching official accident record book
      if (!injuredName.trim()) {
        toast.error('Please enter the injured person\'s name');
        return;
      }
      if (!reportName.trim()) {
        toast.error('Please enter reporter name');
        return;
      }
      if (!accidentDate) {
        toast.error('Please enter the date of the accident');
        return;
      }
      if (!accidentTime) {
        toast.error('Please enter the time of the accident');
        return;
      }
      if (!accidentLocation.trim()) {
        toast.error('Please enter where the accident happened');
        return;
      }
      if (!accidentDescription.trim()) {
        toast.error('Please describe how the accident happened');
        return;
      }
      
      setIsSubmittingReport(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/accidents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Section 1
            injured_name: injuredName,
            injured_address: injuredAddress,
            injured_postcode: injuredPostcode,
            injured_occupation: injuredOccupation,
            // Section 2
            reporter_name: reportName,
            reporter_address: reporterAddress,
            reporter_postcode: reporterPostcode,
            reporter_occupation: reporterOccupation,
            // Section 3
            accident_date: accidentDate,
            accident_time: accidentTime,
            accident_location: accidentLocation,
            accident_description: accidentDescription,
            injury_details: injuryDetails,
            // Section 4
            employee_consent: employeeConsent,
            // Photos
            photos: reportPhotos
          })
        });
        
        if (!response.ok) throw new Error('Failed to submit');
        const data = await response.json();
        toast.success(`Accident reported successfully! Report #${data.report_number}`);
        setShowReportModal(null);
        fetchRecentChecklists();
      } catch (error) {
        console.error('Error submitting:', error);
        toast.error('Failed to submit. Please try again.');
      } finally {
        setIsSubmittingReport(false);
      }
      return;
    }
    
    if (showReportModal === 'whistleblowing') {
      // Validate whistleblowing form
      if (!reportTitle.trim()) {
        toast.error('Please provide a title');
        return;
      }
      if (!reportDescription.trim()) {
        toast.error('Please provide a description');
        return;
      }
      if (!reportIsAnonymous && !reportName.trim()) {
        toast.error('Please enter your name or choose anonymous');
        return;
      }
      
      setIsSubmittingReport(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/whistleblowing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: reportTitle,
            description: reportDescription,
            category: reportCategory,
            location: reportLocation,
            is_anonymous: reportIsAnonymous,
            submitted_by: reportIsAnonymous ? null : reportName
          })
        });
        
        if (!response.ok) throw new Error('Failed to submit');
        toast.success('Whistleblowing report submitted successfully!');
        setShowReportModal(null);
        fetchRecentChecklists();
      } catch (error) {
        console.error('Error submitting:', error);
        toast.error('Failed to submit. Please try again.');
      } finally {
        setIsSubmittingReport(false);
      }
      return;
    }
    
    if (!reportDescription.trim()) {
      toast.error('Please provide a description');
      return;
    }
    
    if (showReportModal === 'suggestion' && !reportTitle.trim()) {
      toast.error('Please provide a title for your suggestion');
      return;
    }
    
    if (!reportIsAnonymous && !reportName.trim()) {
      toast.error('Please enter your name or choose anonymous');
      return;
    }

    setIsSubmittingReport(true);
    try {
      if (showReportModal === 'near-miss') {
        const response = await fetch(`${API_BASE_URL}/api/near-misses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: reportDescription,
            location: reportLocation,
            photos: reportPhotos,
            is_anonymous: reportIsAnonymous,
            submitted_by: reportIsAnonymous ? null : reportName
          })
        });
        
        if (!response.ok) throw new Error('Failed to submit');
        toast.success('Near miss reported successfully!');
      } else if (showReportModal === 'suggestion') {
        const response = await fetch(`${API_BASE_URL}/api/suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: reportTitle,
            description: reportDescription,
            category: reportCategory,
            location: reportLocation,
            photos: reportPhotos,
            is_anonymous: reportIsAnonymous,
            submitted_by: reportIsAnonymous ? null : reportName
          })
        });
        
        if (!response.ok) throw new Error('Failed to submit');
        toast.success('Suggestion submitted successfully!');
      }
      
      setShowReportModal(null);
      fetchRecentChecklists(); // Refresh stats
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useEffect(() => {
    // Fetch data whenever dashboard is visited
    fetchRecentChecklists();
    
    // Silent background refresh every 30 seconds (no loading indicator, no screen movement)
    const refreshInterval = setInterval(() => {
      fetchRecentChecklists(true);
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [location.pathname]); // Re-run when path changes (navigation)

  const fetchRecentChecklists = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      // Fetch dashboard stats first (faster with caching)
      const statsResponse = await fetch(`${API_BASE_URL}/api/dashboard/stats`);
      
      if (!statsResponse.ok) {
        throw new Error(`Stats API error: ${statsResponse.status}`);
      }
      
      const statsData = await statsResponse.json();
      
      setStats({ 
        total: statsData.total_completed || 0,
        todayByType: statsData.today_by_type || {},
        todayTotal: statsData.today_total || 0,
        repairsDue: statsData.repairs_due || 0,
        nonAcknowledgedRepairs: statsData.new_repairs || 0,
        repairsCompletedLast7Days: statsData.repairs_completed || 0,
        pendingMachineAdditions: statsData.machine_additions_count || 0,
        nearMissesNew: statsData.near_misses_new || 0,
        nearMissesTotal: statsData.near_misses_total || 0,
        suggestionsNew: statsData.suggestions_new || 0,
        suggestionsTotal: statsData.suggestions_total || 0,
        accidentsNew: statsData.accidents_new || 0,
        accidentsTotal: statsData.accidents_total || 0,
        whistleblowingNew: statsData.whistleblowing_new || 0,
        whistleblowingTotal: statsData.whistleblowing_total || 0
      });
      
      // Fetch checks-by-day breakdown for the Check Figures section
      try {
        const byDayResponse = await fetch(`${API_BASE_URL}/api/dashboard/checks-by-day?days=6`);
        if (byDayResponse.ok) {
          setChecksByDay(await byDayResponse.json());
        }
      } catch (e) {
        // non-fatal
      }

      // Fetch training stats
      try {
        const trainingResponse = await fetch(`${API_BASE_URL}/api/training/stats/count`);
        if (trainingResponse.ok) {
          const trainingData = await trainingResponse.json();
          setStats(prev => ({
            ...prev,
            trainingPending: trainingData.pending || 0,
            trainingTotal: trainingData.total || 0
          }));
        }
      } catch (trainingError) {
        console.error('Error fetching training stats:', trainingError);
      }
      
      // Fetch near misses by location for pie chart
      try {
        const pieResponse = await fetch(`${API_BASE_URL}/api/near-misses/stats/by-location`);
        if (pieResponse.ok) {
          const pieData = await pieResponse.json();
          setNearMissesByLocation(pieData);
        }
      } catch (pieError) {
        console.error('Error fetching pie chart data:', pieError);
      }
      
      // Fetch recent checklists
      const recentResponse = await fetch(`${API_BASE_URL}/api/checklists?limit=5`);
      const recentChecklistsData = await recentResponse.json();
      const filteredRecentChecklists = recentChecklistsData.filter(c => c.check_type !== 'GENERAL REPAIR');
      setRecentChecklists(filteredRecentChecklists);
      
      // Fetch work progress jobs
      try {
        const jobsResponse = await fetch(`${API_BASE_URL}/api/jobs`);
        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json();
          setJobs(jobsData);
        }
      } catch (jobsError) {
        console.error('Error fetching jobs:', jobsError);
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner 
          onScan={handleDashboardQRScan} 
          onClose={() => setShowQRScanner(false)} 
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed top-20 right-4 z-50 flex items-center bg-blue-100 border border-blue-300 rounded-full px-3 py-1.5 shadow-sm">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600 mr-2" />
          <span className="text-sm text-blue-700">Loading...</span>
        </div>
      )}
      
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

      {/* Total Checks Filter & Export Modal */}
      {showTotalChecksModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col relative z-[10000]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ClipboardList className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">All Checks Overview</h3>
                  <p className="text-sm text-gray-600">Filter by machine and export to Excel</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowTotalChecksModal(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Machine Make</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={selectedFilterMake}
                  onChange={(e) => handleFilterMakeChange(e.target.value)}
                >
                  <option value="">Select a make...</option>
                  {totalChecksMakes.map(make => (
                    <option key={make} value={make}>{make}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Machine Name (Optional)</label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={selectedFilterName}
                  onChange={(e) => handleFilterNameChange(e.target.value)}
                  disabled={!selectedFilterMake}
                >
                  <option value="">All machines of this make</option>
                  {totalChecksNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <Button 
                onClick={loadFilteredChecklists}
                disabled={!selectedFilterMake || isLoadingChecklists}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isLoadingChecklists ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    View Checks
                  </>
                )}
              </Button>
              <Button 
                onClick={exportAllChecklists}
                disabled={isExporting}
                variant="outline"
                className="border-green-500 text-green-700 hover:bg-green-50"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Excel (Detailed)
                  </>
                )}
              </Button>
              <Button 
                onClick={() => window.open(`${API_BASE_URL}/api/checklists/export/csv`, '_blank')}
                variant="outline"
                className="border-blue-500 text-blue-700 hover:bg-blue-50"
                title="Faster download for large datasets"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV (Fast)
              </Button>
              <Button 
                onClick={() => window.open(`${API_BASE_URL}/api/checklists/export/excel-by-machine`, '_blank')}
                variant="outline"
                className="text-gray-600"
                title="Opens in new tab - use if Excel button times out"
              >
                <Download className="h-4 w-4 mr-2" />
                Direct Excel Link
              </Button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Export Info:</strong> Exports <strong>ALL checks for ALL machines for ALL time</strong>. 
                The Excel file will have a separate sheet for each check type (e.g., Tractor, HGV, Grader) with all checklist questions showing ✓ (pass), ✗ (fail), or N/A.
              </p>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              {filteredChecklists.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredChecklists.map((checklist, idx) => (
                      <tr key={checklist.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(checklist.completed_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{checklist.staff_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {checklist.machine_make} - {checklist.machine_model}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                            {checklist.check_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            checklist.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {checklist.status || 'completed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCheckDetail(checklist)}
                            className="text-purple-600 border-purple-300 hover:bg-purple-50"
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <ClipboardList className="h-12 w-12 mb-3 text-gray-300" />
                  <p className="text-sm">Select a machine make and click "View Checks" to see results</p>
                </div>
              )}
            </div>

            {/* Results Count */}
            {filteredChecklists.length > 0 && (
              <div className="mt-3 text-sm text-gray-600">
                Showing {filteredChecklists.length} check(s) for {selectedFilterMake}
                {selectedFilterName && ` - ${selectedFilterName}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Check Detail Modal */}
      {selectedCheckDetail && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]"
          onClick={() => setSelectedCheckDetail(null)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Check Details</h3>
                <p className="text-sm text-gray-600">
                  {selectedCheckDetail.machine_make} - {selectedCheckDetail.machine_model}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedCheckDetail(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Check Info */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Date & Time</p>
                <p className="font-medium">{new Date(selectedCheckDetail.completed_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Staff</p>
                <p className="font-medium">{selectedCheckDetail.staff_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Check Type</p>
                <p className="font-medium">{selectedCheckDetail.check_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  selectedCheckDetail.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedCheckDetail.status || 'completed'}
                </span>
              </div>
            </div>

            {/* Checklist Items */}
            {selectedCheckDetail.checklist_items && selectedCheckDetail.checklist_items.length > 0 ? (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Checklist Items ({selectedCheckDetail.checklist_items.length})</h4>
                <div className="space-y-2 max-h-[40vh] overflow-auto">
                  {selectedCheckDetail.checklist_items.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${
                      item.status === 'satisfactory' ? 'bg-green-50 border-green-200' :
                      item.status === 'unsatisfactory' ? 'bg-red-50 border-red-200' :
                      item.status === 'n/a' ? 'bg-gray-50 border-gray-200' :
                      'bg-white border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <p className="text-sm flex-1">{item.item}</p>
                        <span className={`ml-2 px-2 py-1 text-xs rounded font-medium ${
                          item.status === 'satisfactory' ? 'bg-green-200 text-green-800' :
                          item.status === 'unsatisfactory' ? 'bg-red-200 text-red-800' :
                          item.status === 'n/a' ? 'bg-gray-200 text-gray-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.status === 'satisfactory' ? '✓ Pass' :
                           item.status === 'unsatisfactory' ? '✗ Fail' :
                           item.status === 'n/a' ? 'N/A' : 'Not checked'}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="mt-2 text-xs text-gray-600 bg-white p-2 rounded">
                          <strong>Notes:</strong> {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedCheckDetail.workshop_notes ? (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Workshop Notes</h4>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedCheckDetail.workshop_notes}</p>
                </div>
              </div>
            ) : selectedCheckDetail.check_type === 'fuel_mileage' || selectedCheckDetail.fuel_mileage || selectedCheckDetail.fuel_added || selectedCheckDetail.adblue_added ? (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Fuel and Mileage Record</h4>
                <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                  {selectedCheckDetail.fuel_mileage && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Mileage / Hours:</span>
                      <span className="font-semibold text-blue-700">{selectedCheckDetail.fuel_mileage}</span>
                    </div>
                  )}
                  {selectedCheckDetail.fuel_added && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">Fuel Added:</span>
                      <span className="font-semibold text-green-700">{selectedCheckDetail.fuel_added} Litres</span>
                    </div>
                  )}
                  {selectedCheckDetail.adblue_added && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">AdBlue Added:</span>
                      <span className="font-semibold text-purple-700">{selectedCheckDetail.adblue_added} Litres</span>
                    </div>
                  )}
                  {selectedCheckDetail.fuel_notes && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <span className="text-sm text-gray-600">Notes: {selectedCheckDetail.fuel_notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedCheckDetail.notes_summary ? (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Summary</h4>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm">{selectedCheckDetail.notes_summary}</p>
                  {selectedCheckDetail.items_total > 0 && (
                    <div className="mt-3 flex gap-4 text-sm">
                      <span className="text-green-600">✓ {selectedCheckDetail.items_satisfactory || 0} Pass</span>
                      <span className="text-red-600">✗ {selectedCheckDetail.items_unsatisfactory || 0} Fail</span>
                      <span className="text-gray-600">Total: {selectedCheckDetail.items_total}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                <p>No detailed checklist data available for this check.</p>
                {selectedCheckDetail.items_total > 0 && (
                  <div className="mt-3 flex justify-center gap-4 text-sm">
                    <span className="text-green-600">✓ {selectedCheckDetail.items_satisfactory || 0} Pass</span>
                    <span className="text-red-600">✗ {selectedCheckDetail.items_unsatisfactory || 0} Fail</span>
                    <span className="text-gray-600">Total: {selectedCheckDetail.items_total}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={() => setSelectedCheckDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Near Miss / Suggestion / Accident / Whistleblowing Report Modal */}
      {showReportModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto relative z-[10000]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  showReportModal === 'near-miss' ? 'bg-red-100' : 
                  showReportModal === 'accident' ? 'bg-purple-100' : 
                  showReportModal === 'whistleblowing' ? 'bg-amber-100' : 
                  'bg-blue-100'
                }`}>
                  {showReportModal === 'near-miss' ? (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  ) : showReportModal === 'accident' ? (
                    <ShieldAlert className="h-6 w-6 text-purple-600" />
                  ) : showReportModal === 'whistleblowing' ? (
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                  ) : (
                    <FileText className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {showReportModal === 'near-miss' ? 'Report Near Miss' : 
                     showReportModal === 'accident' ? 'Report Accident' : 
                     showReportModal === 'whistleblowing' ? 'Whistleblowing Report' :
                     'Submit Suggestion'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {showReportModal === 'near-miss' 
                      ? 'Report a safety incident or near miss' 
                      : showReportModal === 'accident'
                      ? 'Record a workplace accident'
                      : showReportModal === 'whistleblowing'
                      ? 'Report concerns confidentially'
                      : 'Share your idea for improvement'}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowReportModal(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* ACCIDENT FORM - Matching official accident record book */}
            {showReportModal === 'accident' ? (
              <>
                {/* Section 1: About the person who had the accident */}
                <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-3">Section 1: About the person who had the accident</h4>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={injuredName}
                      onChange={(e) => setInjuredName(e.target.value)}
                      placeholder="Name of person who had the accident"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      data-testid="injured-name-input"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={injuredAddress}
                      onChange={(e) => setInjuredAddress(e.target.value)}
                      placeholder="Address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                      <input
                        type="text"
                        value={injuredPostcode}
                        onChange={(e) => setInjuredPostcode(e.target.value)}
                        placeholder="Postcode"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                      <input
                        type="text"
                        value={injuredOccupation}
                        onChange={(e) => setInjuredOccupation(e.target.value)}
                        placeholder="Job title"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: About the person filling in this record */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Section 2: About you, the person filling in this record</h4>
                  <p className="text-xs text-blue-700 mb-3">(If you did not have the accident, write your details here)</p>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="reporter-name-input"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={reporterAddress}
                      onChange={(e) => setReporterAddress(e.target.value)}
                      placeholder="Address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                      <input
                        type="text"
                        value={reporterPostcode}
                        onChange={(e) => setReporterPostcode(e.target.value)}
                        placeholder="Postcode"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                      <input
                        type="text"
                        value={reporterOccupation}
                        onChange={(e) => setReporterOccupation(e.target.value)}
                        placeholder="Job title"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: About the accident */}
                <div className="mb-4 p-3 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-3">Section 3: About the accident</h4>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Accident *</label>
                      <input
                        type="date"
                        value={accidentDate}
                        onChange={(e) => setAccidentDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        data-testid="accident-date-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time of Accident *</label>
                      <input
                        type="time"
                        value={accidentTime}
                        onChange={(e) => setAccidentTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        data-testid="accident-time-input"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Where did the accident happen? (Room or place) *</label>
                    <input
                      type="text"
                      value={accidentLocation}
                      onChange={(e) => setAccidentLocation(e.target.value)}
                      placeholder="Describe the location"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      data-testid="accident-location-input"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">How did the accident happen? Give the cause if you can. *</label>
                    <Textarea
                      value={accidentDescription}
                      onChange={(e) => setAccidentDescription(e.target.value)}
                      placeholder="Describe how the accident happened and the cause..."
                      rows={3}
                      className="w-full"
                      data-testid="accident-description-input"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">If the person who had the accident suffered an injury, say what it was</label>
                    <Textarea
                      value={injuryDetails}
                      onChange={(e) => setInjuryDetails(e.target.value)}
                      placeholder="Describe the injury..."
                      rows={2}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Section 4: For the employee only */}
                <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-3">Section 4: For the employee only</h4>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={employeeConsent}
                      onChange={(e) => setEmployeeConsent(e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    <div className="text-sm text-gray-700">
                      I consent to my employer disclosing information about my accident to the health and safety representatives on request.
                    </div>
                  </label>
                </div>

                {/* Photos */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Photos (optional)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {reportPhotos.map((photo, idx) => (
                      <div key={idx} className="relative">
                        <img src={photo} alt={`Photo ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
                        <button onClick={() => setReportPhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors w-fit">
                    <Camera className="h-5 w-5 text-gray-600" />
                    <span className="text-sm text-gray-700">Add Photo</span>
                    <input type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoCapture} className="hidden" data-testid="accident-photo-input" />
                  </label>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setShowReportModal(null)} className="flex-1">Cancel</Button>
                  <Button onClick={submitReport} disabled={isSubmittingReport} className="flex-1 bg-purple-600 hover:bg-purple-700" data-testid="submit-accident-btn">
                    {isSubmittingReport ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Submitting...</>) : 'Submit Accident Report'}
                  </Button>
                </div>
              </>
            ) : showReportModal === 'whistleblowing' ? (
              <>
                {/* Whistleblowing Form */}
                <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm text-amber-800">
                    Whistleblowing reports are treated with the utmost confidentiality. You can submit anonymously if you prefer.
                  </p>
                </div>

                {/* Anonymous Toggle */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reportIsAnonymous}
                      onChange={(e) => setReportIsAnonymous(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Submit anonymously</span>
                      <p className="text-xs text-gray-500">Your identity will be protected</p>
                    </div>
                  </label>
                </div>

                {/* Name field (if not anonymous) */}
                {!reportIsAnonymous && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                {/* Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="Brief title for your report"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Category */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select a category...</option>
                    <option value="Financial">Financial Misconduct</option>
                    <option value="Health and Safety">Health and Safety Concerns</option>
                    <option value="Misconduct">Staff Misconduct</option>
                    <option value="Harassment">Harassment or Bullying</option>
                    <option value="Discrimination">Discrimination</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Location */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <select
                    value={reportLocation}
                    onChange={(e) => setReportLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select a location...</option>
                    <option value="Farm">Farm</option>
                    <option value="Field">Field</option>
                    <option value="Storage">Storage</option>
                    <option value="Grading">Grading</option>
                  </select>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <Textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Please provide as much detail as possible about the concern..."
                    rows={4}
                    className="w-full"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setShowReportModal(null)} className="flex-1">Cancel</Button>
                  <Button onClick={submitReport} disabled={isSubmittingReport} className="flex-1 bg-amber-600 hover:bg-amber-700">
                    {isSubmittingReport ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Submitting...</>) : 'Submit Report'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Anonymous Toggle */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={reportIsAnonymous}
                      onChange={(e) => setReportIsAnonymous(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      data-testid="anonymous-checkbox"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Submit anonymously</span>
                      <p className="text-xs text-gray-500">Your name will not be recorded</p>
                    </div>
                  </label>
                </div>

                {/* Name field (if not anonymous) */}
                {!reportIsAnonymous && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-testid="report-name-input"
                    />
                  </div>
                )}

            {/* Title (for suggestions only) */}
            {showReportModal === 'suggestion' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Suggestion Title *</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Brief title for your suggestion"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="report-title-input"
                />
              </div>
            )}

            {/* Category (for suggestions only) */}
            {showReportModal === 'suggestion' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Suggestion Type</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="report-category-select"
                >
                  <option value="">Select a type...</option>
                  <option value="Financial">Financial</option>
                  <option value="Well Being">Well Being</option>
                  <option value="Health and Safety">Health and Safety</option>
                </select>
              </div>
            )}

            {/* Location dropdown - shown for both near misses and suggestions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                value={reportLocation}
                onChange={(e) => setReportLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="report-location-select"
              >
                <option value="">Select a location...</option>
                <option value="Farm">Farm</option>
                <option value="Field">Field</option>
                <option value="Storage">Storage</option>
                <option value="Grading">Grading</option>
              </select>
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {showReportModal === 'near-miss' ? 'What happened? *' : 'Description *'}
              </label>
              <Textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder={showReportModal === 'near-miss' 
                  ? 'Describe what happened and any potential hazards...'
                  : 'Describe your suggestion in detail...'}
                rows={4}
                className="w-full"
                data-testid="report-description-input"
              />
            </div>

            {/* Photo Upload - for both near misses and suggestions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Photos (optional)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {reportPhotos.map((photo, idx) => (
                  <div key={idx} className="relative">
                    <img 
                      src={photo} 
                      alt={`Photo ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => setReportPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors w-fit">
                <Camera className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-700">Add Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoCapture}
                  className="hidden"
                  data-testid="photo-upload-input"
                />
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowReportModal(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={submitReport}
                disabled={isSubmittingReport}
                className={`flex-1 ${showReportModal === 'near-miss' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                data-testid="submit-report-btn"
              >
                {isSubmittingReport ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="text-center sm:text-left">
        <div>
          <p className="text-[10px] sm:text-xs tracking-[3px] uppercase text-green-700 font-extrabold mb-1">{t('dashboardSubtitle')}</p>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{t('dashboardTitle')}</h1>
          <div className="flex items-center space-x-2 mt-1">
            <p className="text-xs text-gray-400">Version 2.3</p>
            <span className="text-gray-300">•</span>
            <p className="text-xs text-gray-400">
              <RefreshCw className="h-3 w-3 inline mr-1" />
              Auto-updates every 30sec
            </p>
            <span className="text-gray-300">•</span>
            <p className="text-xs text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Quick Scan Button - Prominent */}
        <div className="mt-4 sm:mt-6">
          <Button 
            onClick={() => setShowQRScanner(true)}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white py-6 text-lg font-semibold shadow-md rounded-xl"
            data-testid="quick-scan-btn"
          >
            <QrCode className="mr-3 h-6 w-6" />
            Scan Machine QR Code
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-3 w-full">
          <Button
            onClick={() => navigate('/new-checklist')}
            className="bg-green-600 hover:bg-green-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6 rounded-xl shadow-md"
            data-testid="daily-check-btn"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Checks and Servicing
          </Button>
          {/* HIDDEN FOR NOW — Breakdown and repair reporting (not in use; set to true to bring it back) */}
          {false && (
          <Button
            onClick={() => setShowRepairWarning(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6 rounded-xl shadow-md"
            data-testid="breakdown-repair-btn"
          >
            <Wrench className="mr-2 h-4 w-4" />
            Breakdown and repair reporting
          </Button>
          )}
        </div>
        
        {/* HIDDEN FOR DEPLOYMENT - Second Row - Near Miss and Suggestions
        <div className="flex flex-col sm:flex-row gap-3 mt-3 mb-4">
          <Button 
            onClick={() => openReportModal('near-miss')}
            className="bg-red-600 hover:bg-red-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6"
            data-testid="near-miss-btn"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Report Near Miss
          </Button>
          <Button 
            onClick={() => openReportModal('suggestion')}
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6"
            data-testid="suggestion-btn"
          >
            <FileText className="mr-2 h-4 w-4" />
            Submit Suggestion
          </Button>
          <Button 
            onClick={() => openReportModal('accident')}
            className="bg-purple-600 hover:bg-purple-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6"
            data-testid="accident-btn"
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            Report Accident
          </Button>
        </div>
        */}
        {/* HIDDEN FOR DEPLOYMENT - Third Row - Whistleblowing and Training
        <div className="flex flex-col sm:flex-row gap-3 mt-3 mb-4">
          <Button 
            onClick={() => openReportModal('whistleblowing')}
            className="bg-amber-600 hover:bg-amber-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6"
            data-testid="whistleblowing-btn"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Whistleblowing Report
          </Button>
          <Button 
            onClick={() => navigate('/training?create=true')}
            className="bg-teal-600 hover:bg-teal-700 text-white flex-1 text-sm sm:text-base py-4 sm:py-6"
            data-testid="training-btn"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            New Training Record
          </Button>
        </div>
        */}
      </div>

      {/* Dashboard Rotation Controls */}
      <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
        {SECTION_LABELS.map((label, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveSection(idx);
              setIsPaused(true);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeSection === idx
                ? 'bg-green-600 text-white shadow-md scale-105'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`section-btn-${idx}`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`ml-3 px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1 ${
            isPaused 
              ? 'bg-green-500 text-white hover:bg-green-600' 
              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
          }`}
          data-testid="rotation-toggle-btn"
        >
          {isPaused ? '▶ Play' : '⏸ Pause'}
        </button>
        <span className="text-xs text-gray-500 ml-2">
          {isPaused ? 'Paused - tap Play to auto-rotate' : 'Auto-rotating every 60s'}
        </span>
      </div>

      {/* Section 0: Stats Cards */}
      <div className={`transition-all duration-500 ${activeSection === 0 ? 'block opacity-100' : 'hidden opacity-0'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Total Checks */}
          <Card data-testid="total-checks-card" className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Total Checks</CardTitle>
              <ClipboardList className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="flex-1">
                <div className="text-4xl font-bold font-serif text-green-700">{stats.total}</div>
                <p className="text-xs text-gray-500 mt-1">All time completed</p>
              </div>
              <Button onClick={openTotalChecksModal} variant="outline" size="sm" className="w-full mt-3">
                View All Checks
              </Button>
            </CardContent>
          </Card>

          {/* Today's Checks by type */}
          <Card data-testid="today-checks-card" className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Today's Checks</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="flex-1">
                <div className="text-4xl font-bold font-serif text-green-700">{checksByDay?.today_total ?? stats.todayTotal}</div>
                {checksByDay && Object.keys(checksByDay.today_by_type || {}).length > 0 ? (
                  <div className="mt-2 space-y-0.5">
                    {Object.entries(checksByDay.today_by_type)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <p key={type} className="text-xs text-gray-600">{type} <span className="font-semibold text-gray-900">&times; {count}</span></p>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">No checks completed today</p>
                )}
              </div>
              <Button onClick={() => navigate('/all-checks?filter=today')} variant="outline" size="sm" className="w-full mt-3">
                View Today's Checks
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Checks by type over the last 5 days */}
        <Card data-testid="five-day-table-card" className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checks by Type &mdash; Last 5 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {checksByDay ? (() => {
              const pastDays = checksByDay.days.filter((d) => !d.is_today).slice(-5);
              const types = checksByDay.types;
              if (types.length === 0) {
                return <p className="text-xs text-gray-500">No checks recorded in the last 5 days</p>;
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-gray-500 font-semibold">Check type</th>
                        {pastDays.map((d) => (
                          <th key={d.date} className="text-center py-2 px-2 text-xs uppercase tracking-wider text-gray-500 font-semibold whitespace-nowrap">{d.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((type) => (
                        <tr key={type} className="border-b border-gray-100">
                          <td className="py-1.5 pr-4 text-gray-900">{type}</td>
                          {pastDays.map((d) => {
                            const n = (checksByDay.counts[type] && checksByDay.counts[type][d.date]) || 0;
                            return (
                              <td key={d.date} className={`text-center py-1.5 px-2 font-medium ${n ? 'text-green-700' : 'text-gray-300'}`}>{n || '—'}</td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2 pr-4 font-semibold text-gray-900">Total</td>
                        {pastDays.map((d) => (
                          <td key={d.date} className="text-center py-2 px-2 font-bold text-gray-900">{checksByDay.day_totals[d.date] || 0}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <p className="text-xs text-gray-500">Loading&hellip;</p>
            )}
          </CardContent>
        </Card>

        {/* HIDDEN FOR NOW — old stat tiles (set to true to bring them back) */}
        {false && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {/* 0. Total Checks Completed - First - Now clickable with button */}
        <Card 
          className="hover:shadow-lg transition-shadow border-purple-200 bg-purple-50" 
          style={{display: 'flex', flexDirection: 'column', height: '100%'}}
          data-testid="total-checks-card"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Total Checks</CardTitle>
            <ClipboardList className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-purple-600">{stats.total}</div>
              <p className="text-xs text-purple-700">All time completed</p>
            </div>
            <Button 
              onClick={openTotalChecksModal}
              variant="outline"
              size="sm"
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-100"
              style={{marginTop: 'auto'}}
            >
              View All Checks
            </Button>
          </div>
        </Card>

        {/* 1. New Repairs - Second */}
        <Card className="hover:shadow-lg transition-shadow" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Repairs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-orange-600">{stats.nonAcknowledgedRepairs}</div>
              <p className="text-xs text-gray-600">Need acknowledgment</p>
            </div>
            <Button 
              onClick={() => navigate('/repairs-needed?view=new')}
              variant="outline"
              size="sm"
              className="w-full"
              style={{marginTop: 'auto'}}
            >
              View New Repairs
            </Button>
          </div>
        </Card>

        {/* 2. New Machines Added - Second */}
        <Card className="hover:shadow-lg transition-shadow border-blue-200 bg-blue-50" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">New Machines Added</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-blue-600">{stats.pendingMachineAdditions}</div>
              <p className="text-xs text-blue-700">Pending review</p>
            </div>
            <Button 
              onClick={() => navigate('/machine-additions')}
              variant="outline"
              size="sm"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
              style={{marginTop: 'auto'}}
            >
              View Machine Requests
            </Button>
          </div>
        </Card>

        {/* 3. Repairs Due - Third */}
        <Card className="hover:shadow-lg transition-shadow" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repairs Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-red-600">{stats.repairsDue}</div>
              <p className="text-xs text-gray-600">Acknowledged repairs</p>
            </div>
            <Button 
              onClick={() => navigate('/repairs-needed?view=acknowledged')}
              variant="outline"
              size="sm"
              className="w-full"
              style={{marginTop: 'auto'}}
            >
              View Repairs Due
            </Button>
          </div>
        </Card>

        {/* 4. Today's Checks - Fourth */}
        <Card className="hover:shadow-lg transition-shadow" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Checks</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-green-600">{stats.todayTotal}</div>
              {Object.keys(stats.todayByType).length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {(() => {
                    const order = ['Vehicles', 'Mounted machines', 'Other equipment', 'Machine add', 'Repairs completed', 'Workshop service'];
                    const sortedEntries = Object.entries(stats.todayByType).sort(([typeA], [typeB]) => {
                      const indexA = order.indexOf(typeA);
                      const indexB = order.indexOf(typeB);
                      if (indexA === -1 && indexB === -1) return 0;
                      if (indexA === -1) return 1;
                      if (indexB === -1) return -1;
                      return indexA - indexB;
                    });
                    return sortedEntries.map(([type, count]) => (
                      <p key={type} className="text-xs text-gray-600">{type}: {count}</p>
                    ));
                  })()}
                </div>
              ) : (
                <p className="text-xs text-gray-600">No checks completed today</p>
              )}
            </div>
            <Button 
              onClick={() => navigate('/all-checks?filter=today')}
              variant="outline"
              size="sm"
              className="w-full"
              style={{marginTop: 'auto'}}
            >
              View Today's Checks
            </Button>
          </div>
        </Card>
        
        {/* 5. Repairs Completed - Fifth */}
        <Card className="hover:shadow-lg transition-shadow" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repairs Completed</CardTitle>
            <Wrench className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-emerald-600">{stats.repairsCompletedLast7Days}</div>
              <p className="text-xs text-gray-600">All time</p>
            </div>
            <Button 
              onClick={() => navigate('/repairs-completed')}
              variant="outline"
              size="sm"
              className="w-full"
              style={{marginTop: 'auto'}}
            >
              View Completed Repairs
            </Button>
          </div>
        </Card>
        </div>
        )}
      </div>

      {/* Section 1: WorkplanBoard */}
      <div className={`transition-all duration-500 ${activeSection === 1 ? 'block opacity-100' : 'hidden opacity-0'}`}>

      {/* HIDDEN FOR DEPLOYMENT - Second Row Stats - Near Misses, Suggestions & Accidents
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card 
          className="hover:shadow-lg transition-shadow border-red-200 bg-red-50" 
          style={{display: 'flex', flexDirection: 'column', height: '100%'}}
          data-testid="near-misses-card"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-900">Near Misses</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-red-600">{stats.nearMissesNew || 0}</div>
              <p className="text-xs text-red-700">New reports ({stats.nearMissesTotal || 0} total)</p>
            </div>
            <Button 
              onClick={() => navigate('/near-misses')}
              variant="outline"
              size="sm"
              className="w-full border-red-300 text-red-700 hover:bg-red-100"
              style={{marginTop: 'auto'}}
              data-testid="view-near-misses-btn"
            >
              View Near Misses
            </Button>
          </div>
        </Card>

        <Card 
          className="hover:shadow-lg transition-shadow border-indigo-200 bg-indigo-50" 
          style={{display: 'flex', flexDirection: 'column', height: '100%'}}
          data-testid="suggestions-card"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Suggestions</CardTitle>
            <FileText className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-indigo-600">{stats.suggestionsNew || 0}</div>
              <p className="text-xs text-indigo-700">New suggestions ({stats.suggestionsTotal || 0} total)</p>
            </div>
            {isAdmin && (
              <Button 
                onClick={() => navigate('/suggestions')}
                variant="outline"
                size="sm"
                className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                style={{marginTop: 'auto'}}
                data-testid="view-suggestions-btn"
              >
                View Suggestions
              </Button>
            )}
          </div>
        </Card>

        <Card 
          className="hover:shadow-lg transition-shadow border-purple-200 bg-purple-50" 
          style={{display: 'flex', flexDirection: 'column', height: '100%'}}
          data-testid="accidents-card"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Accidents</CardTitle>
            <ShieldAlert className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-purple-600">{stats.accidentsNew || 0}</div>
              <p className="text-xs text-purple-700">New reports ({stats.accidentsTotal || 0} total)</p>
            </div>
            {hasManagerAccess && (
              <Button 
                onClick={() => navigate('/accidents')}
                variant="outline"
                size="sm"
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-100"
                style={{marginTop: 'auto'}}
                data-testid="view-accidents-btn"
              >
                View Accidents
              </Button>
            )}
          </div>
        </Card>

        <Card 
          className="hover:shadow-lg transition-shadow border-amber-200 bg-amber-50" 
          style={{display: 'flex', flexDirection: 'column', height: '100%'}}
          data-testid="whistleblowing-card"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Whistleblowing</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-amber-600">{stats.whistleblowingNew || 0}</div>
              <p className="text-xs text-amber-700">New reports ({stats.whistleblowingTotal || 0} total)</p>
            </div>
            {hasManagerAccess && (
              <Button 
                onClick={() => navigate('/whistleblowing')}
                variant="outline"
                size="sm"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                style={{marginTop: 'auto'}}
                data-testid="view-whistleblowing-btn"
              >
                View Reports
              </Button>
            )}
          </div>
        </Card>

        <Card className="border-teal-200 hover:shadow-lg transition-shadow"
          style={{display: 'flex', flexDirection: 'column', minHeight: '160px'}}>
          <CardHeader className="pb-2" style={{flex: 0}}>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-teal-600" />
              Training Records
            </CardTitle>
          </CardHeader>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, padding: '0 1.5rem 1.5rem 1.5rem'}}>
            <div style={{flex: 1}}>
              <div className="text-2xl font-bold text-teal-600">{stats.trainingPending || 0}</div>
              <p className="text-xs text-teal-700">Pending signatures ({stats.trainingTotal || 0} total)</p>
            </div>
            <Button 
              onClick={() => navigate('/training')}
              variant="outline"
              size="sm"
              className="w-full border-teal-300 text-teal-700 hover:bg-teal-100"
              style={{marginTop: 'auto'}}
              data-testid="view-training-btn"
            >
              View Training
            </Button>
          </div>
        </Card>
      </div>
      */}

      {/* HIDDEN FOR DEPLOYMENT - Near Misses by Location - Pie Chart
      {nearMissesByLocation.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Near Misses by Location (Last 4 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nearMissesByLocation}
                    dataKey="count"
                    nameKey="location"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ location, count }) => `${location}: ${count}`}
                  >
                    {nearMissesByLocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
      */}

      {/* Published Work Plan */}
      <WorkplanBoard />
      </div>

      {/* Section 2: Work Progress Stats */}
      <div className={`transition-all duration-500 ${activeSection === 2 ? 'block opacity-100' : 'hidden opacity-0'}`}>
      {/* Work Progress Stats Section */}
      {jobs.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-600" />
              Work Progress
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.filter(j => j.status === 'active').map(job => {
              // Calculate daily target based on 6-day work week until target date
              let dailyTarget = null;
              let daysRemaining = null;
              let isOverdue = false;
              
              if (job.target_date && job.area_left > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const targetDate = new Date(job.target_date);
                targetDate.setHours(0, 0, 0, 0);
                
                // Calculate total days between now and target
                const diffTime = targetDate - today;
                const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (totalDays <= 0) {
                  isOverdue = true;
                  daysRemaining = Math.abs(totalDays);
                } else {
                  // Calculate work days (6 days per week)
                  const fullWeeks = Math.floor(totalDays / 7);
                  const remainingDays = totalDays % 7;
                  const workDays = (fullWeeks * 6) + Math.min(remainingDays, 6);
                  daysRemaining = workDays;
                  
                  if (workDays > 0) {
                    dailyTarget = (job.area_left / workDays).toFixed(1);
                  }
                }
              }
              
              return (
                <Card key={job.id} className="border-orange-200 hover:shadow-lg transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{job.name}</h3>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                        Active
                      </Badge>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-gradient-to-r from-orange-500 to-green-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (job.total_completed / job.total_area) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round((job.total_completed / job.total_area) * 100)}% complete
                      </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-orange-50 rounded-lg p-2 text-center">
                        <p className="text-orange-600 font-bold text-lg">{job.area_left}</p>
                        <p className="text-orange-700 text-xs">Ha Left</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-blue-600 font-bold text-lg">{job.ha_per_day}</p>
                        <p className="text-blue-700 text-xs">Ha/Day Avg</p>
                      </div>
                    </div>
                    
                    {/* Daily Target Section */}
                    {job.target_date && (
                      <div className={`mt-3 p-2 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600">Target: {new Date(job.target_date).toLocaleDateString()}</span>
                          {isOverdue ? (
                            <Badge className="bg-red-500 text-white text-xs">Overdue</Badge>
                          ) : (
                            <span className="text-xs text-gray-500">{daysRemaining} work days left</span>
                          )}
                        </div>
                        {!isOverdue && dailyTarget && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600">Required daily:</span>
                            <span className={`font-bold ${parseFloat(dailyTarget) > parseFloat(job.ha_per_day || 0) ? 'text-red-600' : 'text-green-600'}`}>
                              {dailyTarget} Ha/day
                            </span>
                          </div>
                        )}
                        {isOverdue && (
                          <p className="text-xs text-red-600 font-medium">
                            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} overdue - {job.area_left} Ha remaining
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Completed Jobs Summary */}
            {jobs.filter(j => j.status === 'complete').length > 0 && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">Completed Jobs</h3>
                  </div>
                  <div className="space-y-2">
                    {jobs.filter(j => j.status === 'complete').slice(0, 3).map(job => (
                      <div key={job.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{job.name}</span>
                        <span className="text-green-600 font-medium">{job.total_completed} Ha</span>
                      </div>
                    ))}
                    {jobs.filter(j => j.status === 'complete').length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{jobs.filter(j => j.status === 'complete').length - 3} more
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      
      {/* Fallback message when no jobs exist for Work Progress section */}
      {jobs.length === 0 && activeSection === 2 && (
        <div className="flex items-center justify-center h-48 text-gray-500">
          <p>No work progress jobs to display</p>
        </div>
      )}
      </div>

      {/* Section 3: Field Maps */}
      <div className={`transition-all duration-500 ${activeSection === 3 ? 'block opacity-100' : 'hidden opacity-0'}`}>
        <FieldMapBoard active={activeSection === 3} isPaused={isPaused} />
      </div>
    </div>
  );
}
