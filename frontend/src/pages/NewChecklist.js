import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { useTranslation } from '../LanguageContext';
import { CheckCircle2, ClipboardList, ClipboardCheck, Settings, ArrowLeft, User, Wrench, Database, Upload, Camera, X, QrCode, ScanLine, TrendingUp } from 'lucide-react';
import QRScanner from '../components/QRScanner';
import { PreServiceCheckForm } from '../components/PreServiceCheckForm';
import { ServiceHistoryPanel } from '../components/ServiceHistoryPanel';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';
import { compressImage } from '../lib/images';

// Used when a machine's check type has no "<Check Type> - Pre Service Sheet" tab in AssetList.xlsx
const GENERIC_SERVICE_TEMPLATE = {
  name: 'General Pre Service Check',
  sections: [],
  generic: true,
};

const newServiceItem = (name, custom = false, subItems = []) => ({
  item: name, status: 'unchecked', notes: '', compulsory: false, photos: [], custom, sub_items: subItems,
});

// Sections with their guidance sub-checks (older templates only have the names list)
const templateSections = (template) => (
  template.section_details?.length
    ? template.section_details.map(d => ({ name: d.name, sub_items: d.sub_items || [] }))
    : template.sections.map(name => ({ name, sub_items: [] }))
);

const DEFAULT_CHECKLIST_ITEMS = [
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

const GRADER_STARTUP_CHECKLIST_ITEMS = [
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

const loadChecklistTemplate = async (type) => {
  const fallbackItems = type === 'daily_check' ? DEFAULT_CHECKLIST_ITEMS : GRADER_STARTUP_CHECKLIST_ITEMS;
  try {
    const response = await fetch(`${API_BASE_URL}/api/checklist-templates/${encodeURIComponent(type)}`);
    const template = await response.json();
    if (response.ok && template.items) {
      return template.items.map(templateItem => ({
        item: typeof templateItem === 'string' ? templateItem : templateItem.item,
        status: "unchecked",
        notes: "",
        compulsory: typeof templateItem === 'object' ? (templateItem.compulsory || false) : false,
        photos: []
      }));
    }
    return fallbackItems;
  } catch (error) {
    console.error('Error loading checklist template:', error);
    return fallbackItems;
  }
};


// New Checklist Component
export default function NewChecklist() {
  const { employee, isAuthenticated } = useAuth();
  const { t, tItem } = useTranslation();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [machineCheckType, setMachineCheckType] = useState('');
  const [selectedCheckType, setSelectedCheckType] = useState(''); // daily or workshop or fuel_mileage
  const [checklistItems, setChecklistItems] = useState([]);
  const [workshopNotes, setWorkshopNotes] = useState('');
  const [workshopPhotos, setWorkshopPhotos] = useState([]);
  // Pre Service Check (make-specific service sheet, e.g. Perrot)
  const [serviceTemplate, setServiceTemplate] = useState(null);
  const [partsRequired, setPartsRequired] = useState([]);
  const [partInput, setPartInput] = useState('');
  // Fuel and Mileage fields
  const [fuelMileage, setFuelMileage] = useState('');
  const [fuelAdded, setFuelAdded] = useState('');
  const [adBlueAdded, setAdBlueAdded] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');
  const [makes, setMakes] = useState([]);
  const [names, setNames] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
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

  // Handle pre-selected machine from QR scan on dashboard
  useEffect(() => {
    if (location.state?.scannedMake && location.state?.scannedName) {
      setSelectedMake(location.state.scannedMake);
      setSelectedName(location.state.scannedName);
      if (location.state.scannedCheckType) {
        setMachineCheckType(location.state.scannedCheckType);
      }
      if (location.state.startAtStep) {
        setStep(location.state.startAtStep);
      }
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);


  // Handle QR code scan
  const handleQRScan = async (scannedData) => {
    setShowQRScanner(false);
    try {
      // Parse the QR code data - format: "MACHINE:{make}:{name}" or just asset ID
      let make, name, checkType;
      
      if (scannedData.startsWith('MACHINE:')) {
        const parts = scannedData.split(':');
        make = parts[1];
        name = parts[2];
      } else if (scannedData.startsWith('http')) {
        // URL format: .../check?make=XXX&name=YYY
        const url = new URL(scannedData);
        make = url.searchParams.get('make');
        name = url.searchParams.get('name');
      } else {
        // Try to look up by asset ID
        const response = await fetch(`${API_BASE_URL}/api/assets/${scannedData}`);
        if (response.ok) {
          const asset = await response.json();
          make = asset.make;
          name = asset.name;
          checkType = asset.check_type;
        }
      }
      
      if (make && name) {
        // First set the make
        setSelectedMake(make);
        
        // Fetch the names for this make, then set the name
        try {
          const namesResponse = await fetch(`${API_BASE_URL}/api/assets/names/${encodeURIComponent(make)}`);
          const namesData = await namesResponse.json();
          setNames(namesData);
          
          // Now set the name (names list is now loaded)
          setSelectedName(name);
          
          // Fetch check type if not already available
          if (!checkType) {
            const checkTypeResponse = await fetch(`${API_BASE_URL}/api/assets/checktype/${encodeURIComponent(make)}/${encodeURIComponent(name)}`);
            const checkTypeData = await checkTypeResponse.json();
            checkType = checkTypeData.check_type;
          }
          setMachineCheckType(checkType);
          
          toast.success(`Machine selected: ${make} - ${name}`);
          
          // Stay on step 1 to show check type buttons (Daily Check / Workshop Service)
          // User will click one of those buttons to proceed to step 3
        } catch (fetchError) {
          console.error('Error fetching machine data:', fetchError);
          toast.error('Failed to load machine details');
        }
      } else {
        toast.error('Could not find machine from QR code');
      }
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast.error('Invalid QR code format');
    }
  };

  useEffect(() => {
    fetchMakes();
  }, []);

  useEffect(() => {
    if (selectedMake) {
      setNames([]); // clear stale list until the new make's names arrive
      fetchNames(selectedMake);
      setServiceTemplate(null);
      setSelectedName(''); // Reset name when make changes
      setMachineCheckType(''); // Reset check type
    }
  }, [selectedMake]);

  useEffect(() => {
    if (selectedMake && selectedName) {
      fetchCheckType(selectedMake, selectedName);
    }
  }, [selectedMake, selectedName]);

  // Pre Service Sheet is assigned per check type (AssetList tab "<Check Type> - Pre Service Sheet")
  useEffect(() => {
    if (selectedMake && machineCheckType) {
      fetchServiceTemplate(machineCheckType, selectedMake);
    }
  }, [selectedMake, machineCheckType]);

  useEffect(() => {
    if (step === 3 && selectedCheckType === 'daily_check' && machineCheckType) {
      loadChecklistTemplate(machineCheckType).then(setChecklistItems);
    }
    if (step === 3 && selectedCheckType === 'pre_service_check') {
      setChecklistItems(templateSections(serviceTemplate || GENERIC_SERVICE_TEMPLATE).map(s => newServiceItem(s.name, false, s.sub_items)));
    }
  }, [step, selectedCheckType, machineCheckType, serviceTemplate]);

  const fetchServiceTemplate = async (checkType, make) => {
    try {
      const params = new URLSearchParams({ check_type: checkType, make });
      const response = await fetch(`${API_BASE_URL}/api/service-check-templates/for-asset?${params}`);
      setServiceTemplate(response.ok ? await response.json() : GENERIC_SERVICE_TEMPLATE);
    } catch (error) {
      console.error('Error fetching service template:', error);
      setServiceTemplate(GENERIC_SERVICE_TEMPLATE);
    }
  };

  const addServiceSection = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (checklistItems.some(i => i.item.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('That part / area is already on the list');
      return;
    }
    setChecklistItems(prev => [...prev, newServiceItem(trimmed, true)]);
  };

  const removeServiceSection = (index) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  const addPartRequired = () => {
    const part = partInput.trim();
    if (!part) return;
    setPartsRequired(prev => [...prev, part]);
    setPartInput('');
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
    
    // Check if camera is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        setCurrentPhotoIndex(itemIndex);
        setShowCamera(true);  // Show modal first
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },  // Prefer back camera but allow front
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        
        // Create video element for camera preview
        setTimeout(() => {
          const video = document.getElementById('camera-video');
          if (video) {
            video.srcObject = stream;
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

  const handleFileSelect = async (event, itemIndex) => {
    const file = event.target.files[0];
    if (file) {
      const photoData = await compressImage(file);
      {
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
      }
    }
  };

  const capturePhoto = async () => {
    const video = document.getElementById('camera-video');
    
    if (video) {
      // Convert to a compressed base64 JPEG
      const photoData = await compressImage(video);
      
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
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        // Check file size (limit to 20MB before compression)
        if (file.size > 20 * 1024 * 1024) {
          toast.error('File size must be less than 20MB');
          return;
        }

        try {
          const photoData = {
            id: Date.now(),
            data: await compressImage(file),
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
        } catch (error) {
          toast.error('Error reading file. Please try again.');
        }
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
    // Check for failed compulsory items - block sign-off entirely
    if (selectedCheckType === 'daily_check' || selectedCheckType !== 'workshop_service') {
      const failedCompulsoryItems = checklistItems.filter(item => 
        item.compulsory && item.status === 'unsatisfactory'
      );
      
      if (failedCompulsoryItems.length > 0) {
        const itemNames = failedCompulsoryItems.slice(0, 2).map(i => i.item.split(' - ')[0]).join(', ');
        const moreText = failedCompulsoryItems.length > 2 ? ` and ${failedCompulsoryItems.length - 2} more` : '';
        toast.error(`Cannot sign off: Compulsory check(s) failed: ${itemNames}${moreText}. Please resolve these issues before completing the checklist.`, {
          duration: 6000
        });
        return;
      }
    }

    // Check for unsatisfactory items without explanations
    if (selectedCheckType === 'daily_check' || selectedCheckType === 'pre_service_check') {
      const unsatisfactoryWithoutNotes = checklistItems.find(item => 
        item.status === 'unsatisfactory' && (!item.notes || item.notes.trim() === '')
      );
      
      if (unsatisfactoryWithoutNotes) {
        toast.error(selectedCheckType === 'pre_service_check'
          ? 'Please describe the work needed for every section marked "Needs Work".'
          : 'Do not carry on with this check or until this issue is recorded and sorted.');
        return;
      }
    }

    if (selectedCheckType === 'pre_service_check' && checklistItems.length === 0 && !workshopNotes.trim() && workshopPhotos.length === 0 && partsRequired.length === 0) {
      toast.error('Add at least one part / area you checked, a note, a photo or a part required before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isPreService = selectedCheckType === 'pre_service_check';
      const checklist = {
        employee_number: employee.employee_number,
        staff_name: employee.name,
        machine_make: selectedMake,
        machine_model: selectedName,
        check_type: selectedCheckType,
        checklist_items: (selectedCheckType === 'daily_check' || isPreService) ? checklistItems : [],
        workshop_notes: selectedCheckType === 'workshop_service' ? workshopNotes : (isPreService && workshopNotes.trim() ? workshopNotes : null),
        workshop_photos: (selectedCheckType === 'workshop_service' || isPreService) ? workshopPhotos : [],
        parts_required: isPreService ? partsRequired : [],
        // Fuel and Mileage fields
        fuel_mileage: selectedCheckType === 'fuel_mileage' ? fuelMileage : null,
        fuel_added: selectedCheckType === 'fuel_mileage' ? fuelAdded : null,
        adblue_added: selectedCheckType === 'fuel_mileage' ? adBlueAdded : null,
        fuel_notes: selectedCheckType === 'fuel_mileage' ? fuelNotes : null
      };

      const response = await fetch(`${API_BASE_URL}/api/checklists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checklist)
      });

      if (response.ok) {
        toast.success(selectedCheckType === 'pre_service_check' ? 'Pre Service Check saved successfully!' : 'Checklist completed successfully!');
        navigate('/');
      } else {
        // Parse error response from backend
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || 'Failed to save checklist';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast.error(error.message || 'Failed to save checklist. Please try again.', {
        duration: 5000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedToStep2 = selectedCheckType !== '';
  
  // Check if all items have been addressed (status selected + notes if unsatisfactory + photos if required)
  // Check if any compulsory items have failed
  const hasFailedCompulsoryItems = checklistItems.some(item => 
    item.compulsory && item.status === 'unsatisfactory'
  );

  const preServiceHasContent = selectedCheckType !== 'pre_service_check'
    || checklistItems.length > 0 || workshopNotes.trim() !== '' || workshopPhotos.length > 0 || partsRequired.length > 0;

  const allItemsAddressed = selectedCheckType === 'workshop_service' 
    ? workshopNotes.trim() !== '' 
    : selectedCheckType === 'fuel_mileage'
    ? (fuelMileage.trim() !== '' || fuelAdded.trim() !== '' || adBlueAdded.trim() !== '')
    : preServiceHasContent && checklistItems.every(item => {
        // Must have a status (not unchecked)
        const hasStatus = item.status === 'satisfactory' || item.status === 'n/a' || item.status === 'unsatisfactory';
        
        // If unsatisfactory, must have notes
        const hasNotesIfNeeded = item.status !== 'unsatisfactory' || (item.notes && item.notes.trim() !== '');
        
        // If photo_required is true for this item, must have at least one photo
        const hasPhotoIfRequired = !item.photo_required || (item.photos && item.photos.length > 0);
        
        return hasStatus && hasNotesIfNeeded && hasPhotoIfRequired;
      });
  
  // Can only submit if all items addressed AND no compulsory items failed
  const canSubmitChecklist = allItemsAddressed && !hasFailedCompulsoryItems;

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
                data-testid="fault-explanation-textarea"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={closeFaultModal} data-testid="fault-cancel-btn">
                Cancel
              </Button>
              <Button 
                onClick={handleFaultExplanation}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={!faultExplanation.trim()}
                data-testid="fault-record-btn"
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
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative z-[10000]">
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
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-800 text-sm">
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

      {/* Progress Steps - Machine → Checklist (simplified) */}
      <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-4 sm:mb-8 overflow-x-auto">
        <div className={`flex items-center space-x-1 sm:space-x-2 ${step >= 1 ? 'text-green-600' : 'text-gray-400'} whitespace-nowrap`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${step >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>1</div>
          <span className="text-xs sm:text-sm">Select Machine</span>
        </div>
        <div className={`w-8 sm:w-16 h-1 ${step >= 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>
        <div className={`flex items-center space-x-1 sm:space-x-2 ${step >= 3 ? 'text-green-600' : 'text-gray-400'} whitespace-nowrap`}>
          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>2</div>
          <span className="text-xs sm:text-sm">Complete Checklist</span>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner 
          onScan={handleQRScan} 
          onClose={() => setShowQRScanner(false)} 
        />
      )}

      <Card data-testid="checklist-form-card">
        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Quick Scan Option */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-2 rounded-full">
                      <QrCode className="h-6 w-6 text-gray-800" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Quick Select with QR Code</h3>
                      <p className="text-sm text-gray-800">Scan the QR code on the machine</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowQRScanner(true)}
                    className="bg-gray-800 hover:bg-gray-800"
                  >
                    <ScanLine className="h-4 w-4 mr-2" />
                    Scan Code
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or select manually</span>
                </div>
              </div>

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
              
              {/* Check Type Buttons - Show when machine is selected */}
              {selectedMake && selectedName && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">
                      Selected: <span className="text-gray-800">{selectedMake} - {selectedName}</span>
                    </p>
                    {machineCheckType && (
                      <p className="text-xs text-gray-800 mt-1">Uses "{machineCheckType}" checklist template</p>
                    )}
                  </div>
                  
                  <p className="text-gray-700 font-medium">Select check type:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:grid-cols-4">
                    <Button 
                      onClick={() => {
                        setSelectedCheckType('daily_check');
                        setStep(3);
                      }}
                      className="h-auto py-4 bg-green-600 hover:bg-green-700 flex flex-col items-center gap-2"
                      data-testid="daily-check-btn"
                    >
                      <CheckCircle2 className="h-6 w-6" />
                      <span className="text-lg font-semibold">Daily Check</span>
                      <span className="text-xs opacity-90">Complete {machineCheckType || 'startup'} inspection</span>
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        setSelectedCheckType('workshop_service');
                        setStep(3);
                      }}
                      className="h-auto py-4 bg-orange-600 hover:bg-orange-700 flex flex-col items-center gap-2"
                      data-testid="workshop-service-btn"
                    >
                      <Settings className="h-6 w-6" />
                      <span className="text-lg font-semibold">Workshop Service</span>
                      <span className="text-xs opacity-90">Record maintenance or repair</span>
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        setSelectedCheckType('fuel_mileage');
                        setStep(3);
                      }}
                      className="h-auto py-4 bg-gray-800 hover:bg-gray-800 flex flex-col items-center gap-2"
                      data-testid="fuel-mileage-btn"
                    >
                      <TrendingUp className="h-6 w-6" />
                      <span className="text-lg font-semibold">Fuel & Mileage</span>
                      <span className="text-xs opacity-90">Record fuel and mileage</span>
                    </Button>

                    <Button 
                      onClick={() => {
                        setSelectedCheckType('pre_service_check');
                        setStep(3);
                      }}
                      className="h-auto py-4 bg-green-700 hover:bg-green-800 flex flex-col items-center gap-2"
                      data-testid="pre-service-check-btn"
                    >
                      <ClipboardCheck className="h-6 w-6" />
                      <span className="text-lg font-semibold">Pre Service Check</span>
                      <span className="text-xs opacity-90">{serviceTemplate && !serviceTemplate.generic ? `${serviceTemplate.sections.length}-section service sheet` : 'Whole-machine check & parts list'}</span>
                    </Button>
                  </div>

                  <ServiceHistoryPanel make={selectedMake} model={selectedName} />
                </div>
              )}

              {/* Add Machine Section - Moved below check type buttons */}
              <div className="border-t pt-6 mt-6">
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <Wrench className="h-5 w-5 text-green-600" />
                <span className="font-medium">Machine: {selectedMake} - {selectedName}</span>
              </div>
              
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-900 font-medium">Checklist Type: {machineCheckType}</p>
                <p className="text-gray-800 text-sm mt-1">This machine uses the "{machineCheckType}" checklist template</p>
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

                <Card 
                  className={`p-4 sm:p-6 cursor-pointer transition-all hover:shadow-lg hover:border-blue-400 border-2 ${selectedCheckType === 'fuel_mileage' ? 'border-blue-500 bg-gray-50' : 'border-gray-200'}`}
                  onClick={() => {
                    setSelectedCheckType('fuel_mileage');
                    setStep(3);
                  }}
                  data-testid="fuel-mileage-option"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-gray-800" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg sm:text-xl">Fuel and Mileage Recording</h3>
                      <p className="text-gray-600 text-sm sm:text-base">Record fuel, AdBlue and mileage</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">Track fuel consumption and vehicle mileage</p>
                      <p className="text-sm text-gray-800 font-medium mt-2">Tap to start →</p>
                    </div>
                  </div>
                </Card>

                <Card 
                  className={`p-4 sm:p-6 cursor-pointer transition-all hover:shadow-lg hover:border-purple-400 border-2 ${selectedCheckType === 'pre_service_check' ? 'border-purple-500 bg-green-50' : 'border-gray-200'}`}
                  onClick={() => {
                    setSelectedCheckType('pre_service_check');
                    setStep(3);
                  }}
                  data-testid="pre-service-check-option"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <ClipboardCheck className="h-6 w-6 text-green-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg sm:text-xl">Pre Service Check</h3>
                      <p className="text-gray-600 text-sm sm:text-base">{(serviceTemplate || GENERIC_SERVICE_TEMPLATE).name}</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        {serviceTemplate && !serviceTemplate.generic
                          ? `End of season service sheet — ${serviceTemplate.sections.length} sections`
                          : 'No set sheet for this machine type — check the whole machine, list parts and photograph issues'}
                      </p>
                      <p className="text-sm text-green-700 font-medium mt-2">Tap to start →</p>
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
                    <span className="font-medium">Check Type: {selectedCheckType === 'daily_check' ? `Daily Check (${machineCheckType})` : selectedCheckType === 'fuel_mileage' ? 'Fuel & Mileage Recording' : selectedCheckType === 'pre_service_check' ? 'Pre Service Check' : 'Workshop Service'}</span>
                  </div>
                </div>
                {(selectedCheckType === 'daily_check' || selectedCheckType === 'pre_service_check') && (
                  <Badge variant={allItemsAddressed ? "default" : "secondary"} className="px-3 py-1" data-testid="items-complete-badge">
                    {checklistItems.filter(item => item.status !== 'unchecked').length} / {checklistItems.length} {checklistItems.length === 0 && selectedCheckType === 'pre_service_check' ? 'parts added' : 'Complete'}
                  </Badge>
                )}
              </div>
              
              <Separator />
              
              {selectedCheckType === 'daily_check' ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pre-Startup Safety Checklist</h3>
                  <p className="text-sm text-gray-600">Mark each item as satisfactory (✓) or unsatisfactory (✗). Items marked with <span className="text-red-600 font-bold">*</span> are compulsory and cannot be failed.</p>
                  {checklistItems.map((item, index) => (
                    <Card key={index} className={`p-4 ${item.compulsory ? 'border-l-4 border-l-red-500 bg-red-50/30' : ''}`} data-testid={`checklist-item-${index}`}>
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
                            {item.compulsory && <span className="text-red-600 font-bold mr-1">*</span>}
                            {tItem(item.item)}
                            {item.compulsory && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">COMPULSORY</span>}
                          </label>
                          {item.compulsory && item.status === 'unsatisfactory' && (
                            <div className="mt-1 text-xs text-red-700 font-bold bg-red-100 p-2 rounded">⛔ COMPULSORY CHECK FAILED - Cannot sign off until resolved</div>
                          )}
                          {!item.compulsory && item.status === 'unsatisfactory' && (
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
                                <span className="text-xs text-green-600 font-medium">
                                  ✓ {item.photos.length} photo{item.photos.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {item.photo_required && (
                                <span className="text-xs text-orange-600 font-medium">
                                  📸 Required
                                </span>
                              )}
                            </div>
                            
                            {/* Photo required warning */}
                            {item.photo_required && (!item.photos || item.photos.length === 0) && (
                              <div className="text-xs text-orange-600 font-medium bg-orange-50 p-2 rounded flex items-center">
                                <Camera className="h-3 w-3 mr-1" />
                                Photo required for this item
                              </div>
                            )}
                            
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
              ) : selectedCheckType === 'pre_service_check' ? (
                <PreServiceCheckForm
                  template={serviceTemplate || GENERIC_SERVICE_TEMPLATE}
                  items={checklistItems}
                  onItemChange={handleItemChange}
                  onAddSection={addServiceSection}
                  onRemoveSection={removeServiceSection}
                  takePhoto={takePhoto}
                  uploadPhoto={uploadPhoto}
                  deletePhoto={deletePhoto}
                  notes={workshopNotes}
                  setNotes={setWorkshopNotes}
                  photos={workshopPhotos}
                  partsRequired={partsRequired}
                  setPartsRequired={setPartsRequired}
                  partInput={partInput}
                  setPartInput={setPartInput}
                  addPart={addPartRequired}
                />
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
              ) : selectedCheckType === 'fuel_mileage' ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Fuel and Mileage Recording</h3>
                  <p className="text-sm text-gray-600">Record fuel, AdBlue additions and current mileage for this vehicle.</p>
                  
                  <Card className="p-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Current Mileage / Hours</label>
                        <input
                          type="number"
                          placeholder="Enter current mileage or hours"
                          value={fuelMileage}
                          onChange={(e) => setFuelMileage(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          data-testid="fuel-mileage-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter odometer reading or hour meter</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Fuel Added (Litres)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Enter litres added"
                            value={fuelAdded}
                            onChange={(e) => setFuelAdded(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="fuel-added-input"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium mb-2 block">AdBlue Added (Litres)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Enter litres added"
                            value={adBlueAdded}
                            onChange={(e) => setAdBlueAdded(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="adblue-added-input"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
                        <Textarea
                          placeholder="Any additional notes about fueling..."
                          value={fuelNotes}
                          onChange={(e) => setFuelNotes(e.target.value)}
                          className="min-h-[80px]"
                          data-testid="fuel-notes-input"
                        />
                      </div>
                    </div>
                  </Card>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-sm text-gray-900">
                      <strong>Note:</strong> At least mileage OR fuel/AdBlue amount must be entered to save this record.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Mandatory photo notice */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <Camera className="h-5 w-5 text-gray-800" />
                      <h4 className="font-semibold text-gray-900">Photo Required for Each Item</h4>
                    </div>
                    <p className="text-sm text-gray-800 mt-2">
                      📸 You must take at least one photo for every checklist item before you can submit. This provides visual documentation of the equipment condition.
                    </p>
                  </div>
                  
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
                            {tItem(item.item)}
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
                <Button variant="outline" onClick={() => setStep(1)} data-testid="back-to-machine-btn">
                  Back: Select Machine
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!canSubmitChecklist || isSubmitting}
                  className={`${machineCheckType === 'grader_startup' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'} ${hasFailedCompulsoryItems ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid="submit-checklist-btn"
                >
                  {isSubmitting ? 'Saving...' : hasFailedCompulsoryItems ? 'Cannot Submit - Compulsory Check Failed' : `Complete ${
                    selectedCheckType === 'daily_check' ? 'Checklist' : 
                    selectedCheckType === 'pre_service_check' ? 'Pre Service Check' :
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
