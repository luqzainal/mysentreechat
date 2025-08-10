import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; // Import hooks
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { toast } from "sonner";
import api from '../services/api'; // Import API service
import { Loader2, Users, Image as ImageIcon, Video as VideoIcon, Clock, FileText, UploadCloud, ListChecks, Type as TypeIcon, Smile as SmileIcon, Settings2 as Settings2Icon, Link2 as Link2Icon } from 'lucide-react'; // Import Loader & Ikon baru
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '../contexts/AuthContext'; // BARU: Untuk dapatkan user ID jika perlu untuk API devices
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; // Import ToggleGroup
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"; // DialogTrigger tidak diperlukan jika dikawal oleh state
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';

// Import Refresh Button
import RefreshButton from '../components/RefreshButton';

// Helper function to format date for datetime-local input
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    console.error("Error formatting date:", e);
    return '';
  }
};

function AddCampaignPage() {
  const params = useParams();
  // Extract deviceId from different route patterns
  const deviceIdFromParams = params.numberId || params.deviceId;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fileInputRef = useRef(null); // Untuk input fail biasa (Bulk)
  const aiMediaFileInputRef = useRef(null); // Untuk input fail AI Chatbot

  const [editCampaignId, setEditCampaignId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);

  const [determinedCampaignType, setDeterminedCampaignType] = useState('bulk');
  const [devicesList, setDevicesList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(deviceIdFromParams || '');
  
  const [contactGroupsList, setContactGroupsList] = useState([]);
  const [selectedContactGroupId, setSelectedContactGroupId] = useState('');

  const [userMediaList, setUserMediaList] = useState([]);
  const [selectedMediaItems, setSelectedMediaItems] = useState([]);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [tempSelectedMediaInDialog, setTempSelectedMediaInDialog] = useState([]);
  
  const [scheduledAt, setScheduledAt] = useState('');
  const [minInterval, setMinInterval] = useState('5');
  const [maxInterval, setMaxInterval] = useState('10');
  
  const [campaignScheduleType, setCampaignScheduleType] = useState('anytime');
  const [definedHours, setDefinedHours] = useState([]);

  // State untuk borang Bulk Campaign
  const [formData, setFormData] = useState({
    campaignName: '',
    statusEnabled: true,
    enableLink: false,
    urlLink: '',
    mediaFile: null,
    caption: '',
    aiAgentTraining: '', // Ini mungkin tidak relevan untuk bulk, semak semula kegunaan
    useAI: false, // Ini juga, mungkin untuk jenis kempen lain
    presenceDelay: 'typing', // Ini juga
  });

  // State untuk borang AI Chatbot
  const [aiChatbotFormData, setAiChatbotFormData] = useState({
    status: 'enable',
    isNotMatchDefaultResponse: 'no',
    sendTo: 'all',
    type: 'message_contains_keyword',
    name: '',
    description: '',
    keywords: '',
    nextBotAction: '',
    presenceDelayTime: '',
    presenceDelayStatus: 'disable',
    saveData: 'no_save_response',
    apiRestDataStatus: 'disabled',
    mediaFileAi: null, // Untuk fail media AI chatbot
    captionAi: '',
    useAiFeature: 'not_use_ai',
    aiSpintax: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const typeFromUrl = searchParams.get('type') || 'bulk';
    setDeterminedCampaignType(typeFromUrl);

    // Safely get campaignId from URL parts
    const pathParts = location.pathname.split('/');
    let campaignIdFromPath = null;
    if (pathParts.length >= 5 && pathParts[3] === 'campaigns' && pathParts[4] !== 'create') {
        campaignIdFromPath = pathParts[4];
    }

    const campaignIdFromQuery = searchParams.get('editCampaignId');
    const determinedCampaignId = campaignIdFromQuery || campaignIdFromPath;

    // Extract device ID from path based on route pattern
    let currentDeviceIdFromPath = deviceIdFromParams;
    if (!currentDeviceIdFromPath) {
      if (pathParts[1] === 'dashboard' && pathParts[2] === 'add-campaign' && pathParts[3]) {
        // Route: /dashboard/add-campaign/:deviceId
        currentDeviceIdFromPath = pathParts[3];
      } else if (pathParts[1] === 'ai-chatbot' && pathParts[2]) {
        // Route: /ai-chatbot/:numberId/campaigns/...
        currentDeviceIdFromPath = pathParts[2];
      }
      // For route /add-campaign, no device ID in path - leave as undefined
    }

    if (determinedCampaignId) {
      setEditCampaignId(determinedCampaignId);
      setIsEditMode(true);
      if (currentDeviceIdFromPath) setSelectedDeviceId(currentDeviceIdFromPath);
    } else {
      setEditCampaignId(null); // Pastikan null jika tiada ID sah
      setIsEditMode(false);
      setSelectedDeviceId(currentDeviceIdFromPath || '');
    }
    setIsLoadingPageData(true);

    const fetchData = async () => {
      if (!user) return;
      try {
        const [devResponse, groupsResponse, mediaResponse] = await Promise.all([
          api.get('/whatsapp/devices'),
          determinedCampaignType === 'bulk' ? api.get('/contact-groups') : Promise.resolve({ data: [] }),
          determinedCampaignType === 'bulk' ? api.get('/media') : Promise.resolve({ data: [] }),
        ]);

        const fetchedDevices = devResponse.data || [];
        console.log('[AddCampaignPage] Fetched devices:', fetchedDevices);
        console.log('[AddCampaignPage] Campaign type:', determinedCampaignType);
        console.log('[AddCampaignPage] Current device ID from path:', currentDeviceIdFromPath);
        console.log('[AddCampaignPage] Selected device ID before:', selectedDeviceId);
        
        setDevicesList(fetchedDevices);
        if(determinedCampaignType === 'bulk') {
          setContactGroupsList(groupsResponse.data || []);
          setUserMediaList(mediaResponse.data || []);
        }
        
        if (currentDeviceIdFromPath) {
            console.log('[AddCampaignPage] Setting device ID from path:', currentDeviceIdFromPath);
            setSelectedDeviceId(currentDeviceIdFromPath);
        } else if (determinedCampaignType === 'bulk' && fetchedDevices.length > 0 && !isEditMode) {
            // Auto-select first device for bulk campaigns if none is specified
            const firstDevice = fetchedDevices[0];
            const firstDeviceId = firstDevice.id; // Backend always provides this as d.deviceId
            console.log('[AddCampaignPage] Auto-selecting first device for bulk campaign:', firstDeviceId, firstDevice);
            console.log('[AddCampaignPage] First device available fields:', Object.keys(firstDevice));
            setSelectedDeviceId(firstDeviceId);
        } else {
            console.log('[AddCampaignPage] No auto-selection. Conditions:', {
                determinedCampaignType,
                fetchedDevicesLength: fetchedDevices.length,
                isEditMode,
                currentDeviceIdFromPath,
                firstDeviceKeys: fetchedDevices[0] ? Object.keys(fetchedDevices[0]) : 'No devices'
            });
        }

        if (fetchedDevices.length === 0 && typeFromUrl === 'bulk' && !isEditMode && !currentDeviceIdFromPath) {
             toast.info("No active devices. Connect device for bulk campaign.");
        }
        
        // Logik untuk memuatkan data kempen sedia ada (jika mod edit)
        if (isEditMode && editCampaignId && selectedDeviceId && editCampaignId !== 'create') {
            toast.info(`Loading ${typeFromUrl} campaign details for editing (ID: ${editCampaignId})...`);
            // API endpoint mungkin berbeza untuk AI chatbot dan Bulk
            const campaignApiUrl = typeFromUrl === 'ai_chatbot' 
                ? `/ai-chatbot/${selectedDeviceId}/campaigns/${editCampaignId}` 
                : `/campaigns/${selectedDeviceId}/${editCampaignId}`;
            
            const campResponse = await api.get(campaignApiUrl);
            const campaignData = campResponse.data;

            if (typeFromUrl === 'ai_chatbot') {
              setAiChatbotFormData({
                status: campaignData.status || 'enable',
                isNotMatchDefaultResponse: campaignData.isNotMatchDefaultResponse ? 'yes' : 'no' , // Asumsikan boolean dari backend
                sendTo: campaignData.sendTo || 'all',
                type: campaignData.type || 'message_contains_keyword',
                name: campaignData.name || '',
                description: campaignData.description || '',
                keywords: Array.isArray(campaignData.keywords) ? campaignData.keywords.join(', ') : (campaignData.keywords || ''),
                nextBotAction: campaignData.nextBotAction || '',
                presenceDelayTime: campaignData.presenceDelayTime || '',
                presenceDelayStatus: campaignData.presenceDelayStatus || 'disable',
                saveData: campaignData.saveData || 'no_save_response',
                apiRestDataStatus: campaignData.apiRestDataStatus || 'disabled',
                mediaFileAi: null, // Fail akan diuruskan berasingan, tidak dihantar dalam data ini
                captionAi: campaignData.captionAi || '',
                useAiFeature: campaignData.useAiFeature || 'not_use_ai',
                aiSpintax: campaignData.aiSpintax || '',
              });
              // TODO: Handle media untuk AI Chatbot edit mode jika ada (e.g. panggil API media khusus)
            } else { // Untuk bulk campaign
              setFormData({
                  campaignName: campaignData.campaignName || '',
                  statusEnabled: campaignData.statusEnabled === true,
                  enableLink: campaignData.enableLink === true,
                  urlLink: campaignData.urlLink || '',
                  mediaFile: null,
                  caption: campaignData.caption || '',
                  // Polulate field lain yang relevan untuk bulk dari campaignData
              });
              setSelectedContactGroupId(campaignData.contactGroupId || '');
              setScheduledAt(formatDateForInput(campaignData.scheduledAt));
              setMinInterval(String(campaignData.minIntervalSeconds || '5'));
              setMaxInterval(String(campaignData.maxIntervalSeconds || '10'));
              setCampaignScheduleType(campaignData.campaignScheduleType || 'anytime');
              let scheduleDetails = [];
              if (typeof campaignData.campaignScheduleDetails === 'string') {
                  try { scheduleDetails = JSON.parse(campaignData.campaignScheduleDetails); } catch (e) { scheduleDetails = []; }
              } else if (Array.isArray(campaignData.campaignScheduleDetails)) {
                  scheduleDetails = campaignData.campaignScheduleDetails;
              }
              setDefinedHours(scheduleDetails);
              if (campaignData.mediaAttachments && campaignData.mediaAttachments.length > 0 && userMediaList.length > 0) {
                  const populatedMedia = campaignData.mediaAttachments
                  .map(attachmentId => userMediaList.find(media => media._id === attachmentId))
                  .filter(item => !!item);
                  setSelectedMediaItems(populatedMedia);
              }
            }
            toast.success("Campaign details loaded.");
        } else if (!isEditMode && selectedDeviceId && typeFromUrl === 'ai_chatbot'){
             // Tiada tindakan spesifik diperlukan di sini melainkan ada data default untuk AI chatbot baru
        }

      } catch (error) {
        console.error("Error fetching page data:", error);
        toast.error("Failed to load page data. Please try again.");
        if(isEditMode) navigate(determinedCampaignType === 'bulk' ? '/' : `/ai-chatbot/${selectedDeviceId}/campaigns`);
      } finally {
        setIsLoadingPageData(false);
      }
    };
    if(user) fetchData(); // Hanya fetch jika user sudah ada
  }, [location.search, location.pathname, user, deviceIdFromParams, isEditMode, editCampaignId, determinedCampaignType]);

  useEffect(() => {
    let hours = [];
    switch (campaignScheduleType) {
      case 'daytime': for (let i = 7; i <= 18; i++) hours.push(i); break;
      case 'nighttime': for (let i = 19; i <= 23; i++) hours.push(i); for (let i = 0; i <= 6; i++) hours.push(i); break;
      case 'odd_hours': for (let i = 0; i <= 23; i++) if (i % 2 !== 0) hours.push(i); break;
      case 'even_hours': for (let i = 0; i <= 23; i++) if (i % 2 === 0) hours.push(i); break;
      default: hours = []; break;
    }
    setDefinedHours(hours);
  }, [campaignScheduleType]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const targetForm = determinedCampaignType === 'ai_chatbot' ? setAiChatbotFormData : setFormData;
    targetForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSwitchChange = (checked, name) => {
    const targetForm = determinedCampaignType === 'ai_chatbot' ? setAiChatbotFormData : setFormData;
    targetForm(prev => ({ ...prev, [name]: checked }));
  };
  
  const handleRadioChange = (value, name) => {
    // Hanya untuk AI Chatbot pada masa ini
    if (determinedCampaignType === 'ai_chatbot') {
      setAiChatbotFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e) => { // Untuk Bulk Campaign
    const newFile = e.target.files[0] || null;
    setFormData(prev => ({ ...prev, mediaFile: newFile }));
    if (newFile) {
        setSelectedMediaItems([]); 
        setTempSelectedMediaInDialog([]);
    }
  };

  const handleAiMediaFileChange = (e) => { // Untuk AI Chatbot
    const newFile = e.target.files[0] || null;
    setAiChatbotFormData(prev => ({ ...prev, mediaFileAi: newFile }));
    // Jika AI chatbot guna media library, logik sama seperti bulk mungkin perlu
  };

  const handleMediaLibrarySelect = (mediaItem) => {
    setTempSelectedMediaInDialog(prevSelected => {
      const isAlreadySelected = prevSelected.find(item => item._id === mediaItem._id);
      if (isAlreadySelected) {
        return prevSelected.filter(item => item._id !== mediaItem._id);
      } else {
        if (prevSelected.length < 3) { return [...prevSelected, mediaItem]; }
        else { toast.info("Max 3 media items."); return prevSelected; }
      }
    });
  };

  const handleConfirmMediaSelection = () => {
    setSelectedMediaItems(tempSelectedMediaInDialog);
    setIsMediaLibraryOpen(false);
    if (tempSelectedMediaInDialog.length > 0 && formData.mediaFile) {
        setFormData(prev => ({ ...prev, mediaFile: null }));
        if (fileInputRef.current) { fileInputRef.current.value = ""; }
    }
  };

  const handleCancelMediaSelection = () => setIsMediaLibraryOpen(false);
  const openMediaLibrary = () => { setTempSelectedMediaInDialog([...selectedMediaItems]); setIsMediaLibraryOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentSubmitDeviceId = selectedDeviceId; // selectedDeviceId sentiasa dikemaskini

    if (!currentSubmitDeviceId) {
        toast.error("Device ID is required. Please select or ensure device is connected."); 
        return;
    }
    
    // Validate that the selected device ID exists in the available devices list
    const selectedDevice = devicesList.find(d => d.id === currentSubmitDeviceId);
    if (!selectedDevice) {
        toast.error(`Selected device ID "${currentSubmitDeviceId}" is not available. Please select a valid device.`);
        console.error('Device validation failed. Available devices:', devicesList);
        console.error('Attempted device ID:', currentSubmitDeviceId);
        return;
    }
    
    console.log('[Form Submit] Using valid device:', selectedDevice);

    setIsSaving(true);
    toast.info(isEditMode ? "Updating campaign..." : "Saving campaign...");

    const dataPayload = new FormData(); // Guna FormData untuk kedua-dua jenis

    if (determinedCampaignType === 'ai_chatbot') {
        // Map frontend field names to backend expected names
        const fieldMapping = {
            'status': 'status',
            'isNotMatchDefaultResponse': 'isNotMatchDefaultResponse', 
            'sendTo': 'sendTo',
            'type': 'type',
            'name': 'name',
            'description': 'description',
            'keywords': 'keywords',
            'nextBotAction': 'nextBotAction',
            'presenceDelayTime': 'presenceDelayTime',
            'presenceDelayStatus': 'presenceDelayStatus',
            'saveData': 'saveData',
            'apiRestDataStatus': 'apiRestDataStatus',
            'captionAi': 'captionAi',
            'useAiFeature': 'useAiFeature',
            'aiSpintax': 'aiSpintax'
        };

        Object.keys(aiChatbotFormData).forEach(key => {
            if (key === 'mediaFileAi' && aiChatbotFormData[key]) {
                dataPayload.append('mediaFileAi', aiChatbotFormData[key]);
            } else if (fieldMapping[key]) {
                dataPayload.append(fieldMapping[key], aiChatbotFormData[key]);
            } else if (key !== 'mediaFileAi') {
                dataPayload.append(key, aiChatbotFormData[key]);
            }
        });
        dataPayload.append('campaignType', 'ai_chatbot');
        // deviceId sudah termasuk dalam URL API untuk AI Chatbot
    } else { // Bulk Campaign
        if (!selectedContactGroupId) {
            toast.error("Contact Group is required for Bulk Campaign.");
            setIsSaving(false);
            return;
        }
        Object.keys(formData).forEach(key => {
            if (key === 'mediaFile' && formData[key]) {
                if (selectedMediaItems.length === 0) dataPayload.append(key, formData.mediaFile);
            } else if (key !== 'mediaFile') {
                 dataPayload.append(key, typeof formData[key] === 'boolean' ? formData[key].toString() : formData[key]);
            }
        });
        dataPayload.append('campaignType', 'bulk');
        dataPayload.append('contactGroupId', selectedContactGroupId);
        dataPayload.append('scheduledAt', scheduledAt ? new Date(scheduledAt).toISOString() : '');
        dataPayload.append('minIntervalSeconds', minInterval);
        dataPayload.append('maxIntervalSeconds', maxInterval);
        dataPayload.append('campaignScheduleType', campaignScheduleType);
        dataPayload.append('campaignScheduleDetails', JSON.stringify(campaignScheduleType !== 'anytime' && definedHours.length > 0 ? definedHours : []));
        if (selectedMediaItems.length > 0) {
            selectedMediaItems.forEach(item => dataPayload.append('mediaAttachments', item._id));
            if (dataPayload.has('mediaFile')) dataPayload.delete('mediaFile');
        } else if (isEditMode && !formData.mediaFile && selectedMediaItems.length === 0) { 
            dataPayload.append('mediaAttachments', JSON.stringify([])); // Hantar array kosong untuk clear
        }
    }

    try {
      let apiUrlPath, apiMethod;
      if (determinedCampaignType === 'ai_chatbot') {
        apiUrlPath = isEditMode 
            ? `/ai-chatbot/${currentSubmitDeviceId}/campaigns/${editCampaignId}` 
            : `/ai-chatbot/${currentSubmitDeviceId}/campaigns`;
        apiMethod = isEditMode ? api.put : api.post;
      } else { // Bulk Campaign
        apiUrlPath = isEditMode 
            ? `/campaigns/${currentSubmitDeviceId}/${editCampaignId}` 
            : `/campaigns/${currentSubmitDeviceId}`;
        apiMethod = isEditMode ? api.put : api.post;
      }
      
      // Log data yang akan dihantar untuk debugging
      console.log('=== CAMPAIGN SUBMISSION DEBUG ===');
      console.log('Selected Device ID:', selectedDeviceId);
      console.log('Current Submit Device ID:', currentSubmitDeviceId);
      console.log('Device ID From Params:', deviceIdFromParams);
      console.log('Determined Campaign Type:', determinedCampaignType);
      console.log('API URL:', apiUrlPath);
      console.log('API Method:', apiMethod.name);
      console.log('Available Devices:', devicesList.map(d => ({
        id: d.id,
        name: d.name,
        number: d.number,
        connected: d.connected,
        fullObject: d
      })));
      console.log('FormData contents:');
      for (let [key, value] of dataPayload.entries()) {
        console.log(`${key}:`, value);
      }
      console.log('===============================');
      
      const response = await apiMethod(apiUrlPath, dataPayload);
      console.log('Response:', response);
      toast.success(isEditMode ? "Campaign updated!" : "Campaign created!");
      navigate(determinedCampaignType === 'bulk' ? '/' : `/ai-chatbot/${currentSubmitDeviceId}/campaigns`);
    } catch (error) {
      console.error(isEditMode ? "Update failed:" : "Save failed:", error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      // Handle detailed error messages
      let errorMsg = "An unknown error occurred.";
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMsg = error.response.data.message;
        } else if (error.response.data.error) {
          if (Array.isArray(error.response.data.error)) {
            errorMsg = error.response.data.error.join(', ');
          } else {
            errorMsg = error.response.data.error;
          }
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(`Failed: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingPageData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">{isEditMode ? "Loading campaign for editing..." : "Loading page setup..."}</p>
      </div>
    );
  }

  const refreshPageData = () => {
    window.location.reload();
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Add Campaign</h1>
        <RefreshButton onRefresh={refreshPageData} position="relative" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pemilihan Peranti - mungkin dikongsi atau dipaparkan secara berbeza */}
        <Card>
          <CardHeader>
            <CardTitle>
              {isEditMode 
                  ? (determinedCampaignType === 'bulk' ? 'Edit Bulk Campaign' : 'Edit AI Chatbot Campaign') 
                  : (determinedCampaignType === 'bulk' ? 'Create New Bulk Campaign' : 'Create New AI Chatbot Campaign')}
            </CardTitle>
            <CardDescription>
              {isEditMode 
                ? `Update details for your ${determinedCampaignType === 'ai_chatbot' ? "AI Chatbot" : "Bulk"} campaign for device: ${selectedDeviceId || 'N/A'}.`
                : `Create a new ${determinedCampaignType === 'ai_chatbot' ? "AI Chatbot" : "Bulk"} campaign for device: ${selectedDeviceId || 'N/A'}.`
              }
              {determinedCampaignType === 'ai_chatbot' && !selectedDeviceId && !isEditMode && (
                <p className='text-orange-600 mt-1'>Please select a device from the AI Chatbot list page if you want to create a new AI Chatbot campaign.</p>
              )}
            </CardDescription>
          </CardHeader>
          {(determinedCampaignType === 'bulk' || determinedCampaignType === 'ai_chatbot') && (
            <CardContent>
                <div className="space-y-2">
                <Label htmlFor="deviceSelect">Device {determinedCampaignType === 'bulk' && <span className="text-red-500">*</span>}</Label>
                {/* Debug info */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-500 p-2 bg-gray-100 rounded">
                    <strong>Debug Info:</strong><br/>
                    Campaign Type: {determinedCampaignType}<br/>
                    Devices Available: {devicesList.length}<br/>
                    Selected Device ID: {selectedDeviceId || 'None'}<br/>
                    Device ID From Params: {deviceIdFromParams || 'None'}<br/>
                    Is Loading: {isLoadingPageData ? 'Yes' : 'No'}<br/>
                    Is Edit Mode: {isEditMode ? 'Yes' : 'No'}<br/>
                    Is Disabled: {(isLoadingPageData || (devicesList.length === 0) || (determinedCampaignType === 'ai_chatbot' && !isEditMode && !!deviceIdFromParams)) ? 'Yes' : 'No'}<br/>
                    First Device Fields: {devicesList.length > 0 ? Object.keys(devicesList[0]).join(', ') : 'No devices'}
                  </div>
                )}
                <Select 
                    onValueChange={(value) => {
                        console.log('[AddCampaignPage] Device selection changed to:', value);
                        setSelectedDeviceId(value);
                    }} 
                    value={selectedDeviceId} 
                    disabled={
                        isLoadingPageData || 
                        (devicesList.length === 0) ||
                        (determinedCampaignType === 'ai_chatbot' && !isEditMode && !!deviceIdFromParams)
                    } 
                >
                  <SelectTrigger id="deviceSelect" className={determinedCampaignType === 'ai_chatbot' && !isEditMode && !deviceIdFromParams ? 'border-destructive' : ''}>
                    <SelectValue placeholder={
                        isLoadingPageData ? "Loading devices..." : 
                        (devicesList.length === 0) ? "No devices available" :
                        "Select a device..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {devicesList.map(device => {
                      // Based on backend whatsapp routes, device structure is:
                      // {id: d.deviceId, name: d.name || default, number: d.number || 'Not Available', connected: boolean}
                      const deviceId = device.id; // Backend always provides this as d.deviceId
                      const deviceName = device.name || deviceId;
                      const phoneNumber = device.number || 'N/A';
                      
                      console.log('[SelectItem] Device:', device, 'Using ID:', deviceId);
                      
                      return (
                        <SelectItem key={deviceId} value={deviceId}>
                          {deviceName} ({phoneNumber})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {devicesList.length === 0 && !isLoadingPageData && (
                    <p className="text-sm text-destructive">
                        No devices found. Please connect a WhatsApp device first. 
                        <Link to="/whatsapp-connect" className="underline ml-1">Go to WhatsApp Connection page</Link>
                    </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* ======================== BULK CAMPAIGN FORM START ======================== */}
        {/* Debug info for bulk campaign form visibility */}
        {process.env.NODE_ENV === 'development' && determinedCampaignType === 'bulk' && (
          <div className="text-xs text-blue-600 p-2 bg-blue-50 rounded border">
            <strong>Bulk Campaign Form Debug:</strong><br/>
            Campaign Type: {determinedCampaignType}<br/>
            Selected Device ID: {selectedDeviceId || 'None'}<br/>
            Form Should Show: {(determinedCampaignType === 'bulk' && selectedDeviceId) ? 'Yes' : 'No'}<br/>
            {!selectedDeviceId && 'Form hidden because no device selected. Please select a device above.'}
          </div>
        )}
        {determinedCampaignType === 'bulk' && !isLoadingPageData && (
          selectedDeviceId ? (
          <Card>
            <CardHeader>
                <CardTitle>Bulk Campaign Details</CardTitle>
                <CardDescription>Configure your bulk messaging campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Nama Kempen */}
                <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name <span className="text-red-500">*</span></Label>
                <Input id="campaignName" name="campaignName" value={formData.campaignName} onChange={handleInputChange} placeholder="e.g., Lebaran Promo" required />
                </div>

                {/* Kumpulan Kenalan */}
                <div className="space-y-2">
                    <Label htmlFor="contactGroupId">Contact Group <span className="text-red-500">*</span></Label>
                    <Select onValueChange={setSelectedContactGroupId} value={selectedContactGroupId} required>
                        <SelectTrigger id="contactGroupId">
                        <SelectValue placeholder="Select contact group..." />
                        </SelectTrigger>
                        <SelectContent>
                        {contactGroupsList.length === 0 && <p className="p-2 text-sm text-muted-foreground">No contact groups found.</p>}
                        {contactGroupsList.map(group => (
                            <SelectItem key={group._id} value={group._id}>{group.name} ({group.count} contacts)</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Media - Gabungan Upload & Library */}
                <div className="space-y-2">
                    <Label>Media Attachment (Optional)</Label>
                    <div className="flex items-center space-x-2">
                        <Button type="button" variant="outline" onClick={openMediaLibrary} disabled={!!formData.mediaFile} className="flex-1">
                            <Users className="mr-2 h-4 w-4" /> Choose from Media Library ({selectedMediaItems.length} selected)
                        </Button>
                        <span className="text-sm text-muted-foreground">OR</span>
                        <Input 
                            id="mediaFile" 
                            name="mediaFile" 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="flex-1" 
                            disabled={selectedMediaItems.length > 0} 
                        />
                    </div>
                    {selectedMediaItems.length > 0 && (
                        <div className="mt-2 space-y-1">
                            <p className="text-sm font-medium">Selected from library:</p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                                {selectedMediaItems.map(item => <li key={item._id}>{item.fileName || "Unknown File"}</li>)}
                            </ul>
                        </div>
                    )}
                    {formData.mediaFile && <p className="text-sm text-muted-foreground mt-1">Selected for upload: {formData.mediaFile.name}</p>}
                </div>

                {/* Caption */}
                <div className="space-y-2">
                    <Label htmlFor="caption">Caption</Label>
                    <Textarea id="caption" name="caption" value={formData.caption} onChange={handleInputChange} placeholder="Write your message here..." rows={5} />
                </div>
                
                {/* Penjadualan */}
                <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Scheduling Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-1">
                                <Label htmlFor="scheduledAt">Time Post (Optional)</Label>
                                <Input type="datetime-local" id="scheduledAt" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                                <p className="text-xs text-muted-foreground">Leave blank to send immediately (if queue is empty).</p>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="minInterval">Min Interval (secs)</Label>
                                <Select value={minInterval} onValueChange={setMinInterval}>
                                    <SelectTrigger id="minInterval"><SelectValue /></SelectTrigger>
                                    <SelectContent>{Array.from({length: 57}, (_,i) => i+4).map(s => <SelectItem key={s} value={String(s)}>{s}s</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="maxInterval">Max Interval (secs)</Label>
                                <Select value={maxInterval} onValueChange={setMaxInterval}>
                                    <SelectTrigger id="maxInterval"><SelectValue /></SelectTrigger>
                                    <SelectContent>{Array.from({length: 57}, (_,i) => i+4).map(s => <SelectItem key={s} value={String(s)}>{s}s</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Schedule Time (based on recipient's timezone if available, else sender's)</Label>
                            <ToggleGroup type="single" value={campaignScheduleType} onValueChange={(val) => val && setCampaignScheduleType(val)} className="flex-wrap justify-start">
                                <ToggleGroupItem value="anytime">Anytime</ToggleGroupItem>
                                <ToggleGroupItem value="daytime">Daytime (7am-6pm)</ToggleGroupItem>
                                <ToggleGroupItem value="nighttime">Nighttime (7pm-6am)</ToggleGroupItem>
                                <ToggleGroupItem value="odd_hours">Odd Hours</ToggleGroupItem>
                                <ToggleGroupItem value="even_hours">Even Hours</ToggleGroupItem>
                            </ToggleGroup>
                            {campaignScheduleType !== 'anytime' && definedHours.length > 0 && (
                                <div className="p-2 border rounded bg-background text-xs space-x-1 space-y-1">
                                    <span className="font-medium">Active Hours:</span>
                                    {definedHours.map(h => <Badge key={h} variant="secondary">{`${String(h).padStart(2, '0')}:00`}</Badge>)}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Lain-lain field seperti Enable Link, Status, dll. boleh ditambah di sini jika perlu */}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Device Selection Required</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">
                  Please select a WhatsApp device above to continue creating your bulk campaign.
                </p>
                {devicesList.length === 0 && (
                  <p className="text-sm text-destructive">
                    No devices available. Please connect a WhatsApp device first.
                    <Link to="/whatsapp-connect" className="underline ml-1">Go to WhatsApp Connection</Link>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {/* ======================== BULK CAMPAIGN FORM END ======================== */}


        {/* ======================== AI CHATBOT FORM START ======================== */}
        {determinedCampaignType === 'ai_chatbot' && !isLoadingPageData && selectedDeviceId && (
            <Card>
            <CardHeader>
                <CardTitle>AI Chatbot Item</CardTitle>
                <CardDescription>Configure the AI Chatbot response and actions for device: {selectedDeviceId}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Status */}
                <div className="space-y-2">
                <Label htmlFor="ai-status">Status</Label>
                <RadioGroup id="ai-status" name="status" value={aiChatbotFormData.status} onValueChange={(value) => handleRadioChange(value, 'status')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="enable" id="ai-status-enable" /><Label htmlFor="ai-status-enable">Enable</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="disable" id="ai-status-disable" /><Label htmlFor="ai-status-disable">Disable</Label></div>
                </RadioGroup>
                </div>

                {/* is not Match default response? */}
                <div className="space-y-2">
                <Label htmlFor="ai-isNotMatchDefaultResponse">is not Match default response?</Label>
                <RadioGroup id="ai-isNotMatchDefaultResponse" name="isNotMatchDefaultResponse" value={aiChatbotFormData.isNotMatchDefaultResponse} onValueChange={(value) => handleRadioChange(value, 'isNotMatchDefaultResponse')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="ai-isNotMatchDefaultResponse-no" /><Label htmlFor="ai-isNotMatchDefaultResponse-no">No</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="ai-isNotMatchDefaultResponse-yes" /><Label htmlFor="ai-isNotMatchDefaultResponse-yes">Yes</Label></div>
                </RadioGroup>
                </div>

                {/* Send to */}
                <div className="space-y-2">
                <Label htmlFor="ai-sendTo">Send to</Label>
                <RadioGroup id="ai-sendTo" name="sendTo" value={aiChatbotFormData.sendTo} onValueChange={(value) => handleRadioChange(value, 'sendTo')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="ai-sendTo-all" /><Label htmlFor="ai-sendTo-all">All</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="individual" id="ai-sendTo-individual" /><Label htmlFor="ai-sendTo-individual">Individual</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="group" id="ai-sendTo-group" /><Label htmlFor="ai-sendTo-group">Group</Label></div>
                </RadioGroup>
                </div>

                {/* Type */}
                <div className="space-y-2">
                <Label htmlFor="ai-type">Type</Label>
                <RadioGroup id="ai-type" name="type" value={aiChatbotFormData.type} onValueChange={(value) => handleRadioChange(value, 'type')} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="message_contains_keyword" id="ai-type-contains" /><Label htmlFor="ai-type-contains">Message contains the keyword</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="message_contains_whole_keyword" id="ai-type-whole" /><Label htmlFor="ai-type-whole">Message contains whole keyword</Label></div>
                </RadioGroup>
                </div>

                {/* Name */}
                <div className="space-y-2">
                <Label htmlFor="ai-name">Name <span className="text-red-500">*</span></Label>
                <Input id="ai-name" name="name" value={aiChatbotFormData.name} onChange={handleInputChange} placeholder="Enter response name, e.g., Salam Pembuka" required />
                </div>

                {/* Description */}
                <div className="space-y-2">
                <Label htmlFor="ai-description">Description</Label>
                <Textarea id="ai-description" name="description" value={aiChatbotFormData.description} onChange={handleInputChange} placeholder="Short description for this response" />
                </div>

                {/* Keywords */}
                <div className="space-y-2">
                <Label htmlFor="ai-keywords">Keywords</Label>
                <Textarea id="ai-keywords" name="keywords" value={aiChatbotFormData.keywords} onChange={handleInputChange} placeholder="Enter keywords, separated by comma. e.g., hai,helo,info produk" />
                <p className="text-xs text-muted-foreground">Bot will trigger if message contains any of these keywords.</p>
                </div>

                {/* Next Bot Action */}
                <div className="space-y-2">
                <Label htmlFor="ai-nextBotAction">Next Bot Action (Optional)</Label>
                <Input id="ai-nextBotAction" name="nextBotAction" value={aiChatbotFormData.nextBotAction} onChange={handleInputChange} placeholder="Enter ID of next AI Chatbot item if needed" />
                </div>
                
                {/* Presence Delay */}
                <div className="space-y-2">
                <Label>Presence Delay (Typing/Recording simulation)</Label>
                <div className="flex items-center space-x-2">
                    <Input type="number" name="presenceDelayTime" value={aiChatbotFormData.presenceDelayTime} onChange={handleInputChange} placeholder="Seconds" className="w-1/2" max="25" />
                    <Select name="presenceDelayStatus" value={aiChatbotFormData.presenceDelayStatus} onValueChange={(value) => handleRadioChange(value, 'presenceDelayStatus')}>
                    <SelectTrigger className="w-1/2"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="disable">Disable</SelectItem>
                        <SelectItem value="enable_typing">Enable Typing</SelectItem>
                        <SelectItem value="enable_recording">Enable Recording</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <p className="text-xs text-muted-foreground">Max: 25 seconds. Simulates user activity.</p>
                </div>

                {/* Save Data */}
                <div className="space-y-2">
                <Label htmlFor="ai-saveData">Save Data</Label>
                <RadioGroup id="ai-saveData" name="saveData" value={aiChatbotFormData.saveData} onValueChange={(value) => handleRadioChange(value, 'saveData')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no_save_response" id="ai-saveData-no" /><Label htmlFor="ai-saveData-no">No save response</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="response_is_saved" id="ai-saveData-yes" /><Label htmlFor="ai-saveData-yes">The response is saved</Label></div>
                </RadioGroup>
                </div>

                {/* API Rest Data */}
                <div className="space-y-2">
                <Label htmlFor="ai-apiRestDataStatus">API Rest Data</Label>
                <div className="flex items-center space-x-4">
                    <RadioGroup id="ai-apiRestDataStatus" name="apiRestDataStatus" value={aiChatbotFormData.apiRestDataStatus} onValueChange={(value) => handleRadioChange(value, 'apiRestDataStatus')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="disabled" id="ai-apiRestDataStatus-disabled" /><Label htmlFor="ai-apiRestDataStatus-disabled">Disabled</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="enabled" id="ai-apiRestDataStatus-enabled" /><Label htmlFor="ai-apiRestDataStatus-enabled">Enabled</Label></div>
                    </RadioGroup>
                    <Button type="button" variant="outline" size="sm" disabled={aiChatbotFormData.apiRestDataStatus === 'disabled'}>
                    <FileText className="mr-2 h-4 w-4" /> Configure API
                    </Button>
                </div>
                </div>
                
                {/* Media file AI */}
                <div className="space-y-2">
                <Label htmlFor="ai-mediaFileAi">Media file (Optional)</Label>
                <div className="flex items-center space-x-2 border p-2 rounded-md">
                    <Input id="ai-mediaFileAi" type="file" onChange={handleAiMediaFileChange} className="hidden" ref={aiMediaFileInputRef} />
                    <Button type="button" variant="outline" onClick={() => aiMediaFileInputRef.current && aiMediaFileInputRef.current.click()} className="flex-grow justify-start text-muted-foreground">
                        {aiChatbotFormData.mediaFileAi ? aiChatbotFormData.mediaFileAi.name : "SELECT MEDIA FILE"}
                    </Button>
                    {/* Butang File Manager, Upload, List Checks - mungkin memerlukan implementasi tambahan jika bukan sekadar UI */} 
                    <Button type="button" variant="ghost" size="icon" title="Open File Manager (Not implemented)"><ImageIcon className="h-5 w-5" /></Button>
                    <Button type="button" variant="ghost" size="icon" title="Direct Upload (Not implemented)"><UploadCloud className="h-5 w-5" /></Button>
                    <Button type="button" variant="ghost" size="icon" title="View Options (Not implemented)"><ListChecks className="h-5 w-5" /></Button>
                </div>
                {aiChatbotFormData.mediaFileAi && (
                    <div className="mt-2 text-sm text-muted-foreground">
                    Selected for AI: {aiChatbotFormData.mediaFileAi.name} ({(aiChatbotFormData.mediaFileAi.size / 1024).toFixed(2)} KB)
                    </div>
                )}
                </div>

                {/* Caption AI */}
                <div className="space-y-2">
                <Label htmlFor="ai-captionAi">Caption / Text Message <span className="text-red-500">*</span></Label>
                <Textarea id="ai-captionAi" name="captionAi" value={aiChatbotFormData.captionAi} onChange={handleInputChange} placeholder="Write a caption or text message for the bot response" rows={4} required />
                <div className="flex space-x-1 mt-1">
                    {/* Butang toolbar ini adalah placeholder visual. Implementasi sebenar memerlukan editor teks kaya atau logik JS. */}
                    <Button type="button" variant="outline" size="icon" title="Bold (Not implemented)"><TypeIcon className="h-4 w-4" /></Button> 
                    <Button type="button" variant="outline" size="icon" title="Image (Not implemented)"><ImageIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" title="Emoji (Not implemented)"><SmileIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" title="Settings (Not implemented)"><Settings2Icon className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" title="URL Shortener (Not implemented)"><Link2Icon className="h-4 w-4" /></Button>
                </div>
                </div>

                {/* Use AI Feature */}
                <div className="space-y-2">
                <Label htmlFor="ai-useAiFeature">Use AI for Spintax/Dynamic Content</Label>
                <RadioGroup id="ai-useAiFeature" name="useAiFeature" value={aiChatbotFormData.useAiFeature} onValueChange={(value) => handleRadioChange(value, 'useAiFeature')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="not_use_ai" id="ai-useAiFeature-no" /><Label htmlFor="ai-useAiFeature-no">Not use AI</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="use_ai" id="ai-useAiFeature-yes" /><Label htmlFor="ai-useAiFeature-yes">Use AI</Label></div>
                </RadioGroup>
                {aiChatbotFormData.useAiFeature === 'use_ai' && (
                    <div className="mt-2">
                    <Textarea name="aiSpintax" value={aiChatbotFormData.aiSpintax} onChange={handleInputChange} placeholder="Random message by Spintax ex: {Hi|Hello|Hola}... Parameters are available.
[greet] [wa_name] [me_wa_name] [now_formatted|DD MMM YYYY]" rows={6} />
                    <div className="mt-1 p-2 border rounded-md bg-muted text-xs text-muted-foreground">
                        <p className="font-semibold mb-1">Available Parameters:</p>
                        <ul className="list-disc list-inside pl-4">
                        <li><code>[greet]</code>: Returns greeting based on time (e.g., good morning).</li>
                        <li><code>[wa_name]</code>: Returns user's WhatsApp name.</li>
                        <li><code>[me_wa_name]</code>: Returns your WhatsApp name.</li>
                        <li><code>[now_formatted|FORMAT]</code>: Returns current time. E.g., <code>[now_formatted|DD MMM YYYY, HH:mm]</code>.</li>
                        </ul>
                    </div>
                    </div>
                )}
                </div>
            </CardContent>
            </Card>
        )}
        {/* ======================== AI CHATBOT FORM END ======================== */}

        <CardFooter className="flex justify-end space-x-2 mt-8">
          <Button type="button" variant="outline" onClick={() => navigate(determinedCampaignType === 'bulk' ? '/' : `/ai-chatbot/${selectedDeviceId}/campaigns`)} disabled={isSaving}>
            Back
          </Button>
          {((determinedCampaignType === 'bulk' && selectedDeviceId) || (determinedCampaignType === 'ai_chatbot' && selectedDeviceId)) && (
            <Button type="submit" disabled={isSaving || isLoadingPageData || (determinedCampaignType === 'ai_chatbot' && !aiChatbotFormData.name) || (determinedCampaignType === 'bulk' && !formData.campaignName) }>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditMode ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          )}
        </CardFooter>
      </form>

      {/* Media Library Dialog (Untuk Bulk Campaign) */}
      {determinedCampaignType === 'bulk' && (
        <Dialog open={isMediaLibraryOpen} onOpenChange={setIsMediaLibraryOpen}>
            <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Media Library</DialogTitle>
                <DialogDescription>Select up to 3 media items for your campaign. Upload new files via the Media Storage page.</DialogDescription>
            </DialogHeader>
            {userMediaList.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">No media found in your storage. <Link to="/media-storage" className="text-primary hover:underline">Upload now</Link>.</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1">
                {userMediaList.map(media => (
                    <Card 
                        key={media._id} 
                        className={`cursor-pointer transition-all ${tempSelectedMediaInDialog.find(item => item._id === media._id) ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                        onClick={() => handleMediaLibrarySelect(media)}
                    >
                    <CardContent className="p-0 aspect-square flex flex-col items-center justify-center">
                        {media.fileType && media.fileType.startsWith('image/') ? (
                            <img src={`${api.defaults.baseURL.replace('/api', '')}/uploads/${media.fileName}`} alt={media.fileName} className="object-contain h-full w-full rounded-t-md" onError={(e) => e.target.src = 'https://via.placeholder.com/150?text=No+Preview'}/>
                        ) : media.fileType && media.fileType.startsWith('video/') ? (
                            <VideoIcon className="w-16 h-16 text-muted-foreground" /> 
                        ) : (
                            <FileText className="w-16 h-16 text-muted-foreground" />
                        )}
                    </CardContent>
                    <div className="p-2 border-t">
                        <p className="text-xs font-medium truncate" title={media.fileName}>{media.fileName}</p>
                        <p className="text-xs text-muted-foreground">{media.fileType}</p>
                        <Checkbox checked={!!tempSelectedMediaInDialog.find(item => item._id === media._id)} readOnly className="mt-1"/>
                    </div>
                    </Card>
                ))}
                </div>
            )}
            <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleCancelMediaSelection}>Cancel</Button>
                <Button onClick={handleConfirmMediaSelection}>Confirm ({tempSelectedMediaInDialog.length} selected)</Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default AddCampaignPage; 