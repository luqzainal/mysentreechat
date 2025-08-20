import React, { useState, useEffect, useRef } from 'react';
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
import { Loader2, Users, Image as ImageIcon, Video as VideoIcon, Clock, FileText, Type as TypeIcon, Smile as SmileIcon, Settings2 as Settings2Icon, Link2 as Link2Icon } from 'lucide-react'; // Import Loader & Ikon baru
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
  const [isApiConfigModalOpen, setIsApiConfigModalOpen] = useState(false);
  
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
    appointmentLink: '',
    mediaFileAi: null, // Untuk fail media AI chatbot
    selectedMediaFromLibrary: null, // Untuk media dari library
    captionAi: '',
    useAiFeature: 'not_use_ai',
    aiSpintax: '',
    // Conversation Flow Features
    conversationMode: 'single_response', // 'single_response' or 'continuous_chat'
    maxConversationBubbles: '3',
    endConversationKeywords: '',
    // API Rest Configuration
    apiRestConfig: {
      webhookUrl: '',
      method: 'POST',
      customHeaders: '',
      sendCustomerData: true,
      sendResponseData: true,
      sendTimestamp: true
    },
    // Temporary input field for keywords
    keywordInput: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [aiUsageStatus, setAiUsageStatus] = useState({ hasAiCampaign: false, canCreateAi: true, aiCampaign: null });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const pathParts = location.pathname.split('/');
    
    // Determine campaign type from URL path, not query parameter
    let typeFromUrl = 'bulk'; // default
    if (pathParts[1] === 'ai-chatbot') {
      typeFromUrl = 'ai_chatbot';
    } else {
      // Check query parameter as fallback for other routes
      typeFromUrl = searchParams.get('type') || 'bulk';
    }
    setDeterminedCampaignType(typeFromUrl);

    // Safely get campaignId from URL parts
    let campaignIdFromPath = null;
    if (pathParts[1] === 'ai-chatbot' && pathParts[3] === 'campaigns' && pathParts[4] && pathParts[4] !== 'create') {
        // AI chatbot edit: /ai-chatbot/:numberId/campaigns/:campaignId/edit
        campaignIdFromPath = pathParts[4];
    } else if (pathParts.length >= 5 && pathParts[3] === 'campaigns' && pathParts[4] !== 'create') {
        // Other routes: /something/campaigns/:campaignId
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
        const apiCalls = [
          api.get('/whatsapp/devices'),
          determinedCampaignType === 'bulk' ? api.get('/contact-groups') : Promise.resolve({ data: [] }),
          // Fetch media for both bulk AND ai_chatbot campaigns (ai_chatbot also needs media library)
          (determinedCampaignType === 'bulk' || determinedCampaignType === 'ai_chatbot') ? api.get('/media') : Promise.resolve({ data: [] }),
        ];
        
        // Add AI usage check for AI chatbot campaigns
        if (determinedCampaignType === 'ai_chatbot') {
          apiCalls.push(api.get(`/ai-chatbot/check-ai-usage/${user.id}`).catch(error => {
            console.error('[AddCampaignPage] Error fetching AI usage status:', error);
            return { data: { hasAiCampaign: false, canCreateAi: true, aiCampaign: null } }; // Fallback data
          }));
        }
        
        const [devResponse, groupsResponse, mediaResponse, aiUsageResponse] = await Promise.all(apiCalls);

        const fetchedDevices = devResponse.data || [];
        console.log('[AddCampaignPage] Fetched devices:', fetchedDevices);
        console.log('[AddCampaignPage] Campaign type:', determinedCampaignType);
        console.log('[AddCampaignPage] Current device ID from path:', currentDeviceIdFromPath);
        console.log('[AddCampaignPage] Selected device ID before:', selectedDeviceId);
        
        setDevicesList(fetchedDevices);
        
        if(determinedCampaignType === 'bulk') {
          // Map contact groups to match frontend expectations
          console.log('[AddCampaignPage] Raw contact groups from API:', groupsResponse.data);
          const mappedContactGroups = (groupsResponse.data || []).map(group => ({
            _id: group._id,
            name: group.groupName, // Map groupName to name
            count: group.contactCount, // Map contactCount to count
            contacts: group.contacts || []
          }));
          console.log('[AddCampaignPage] Mapped contact groups:', mappedContactGroups);
          setContactGroupsList(mappedContactGroups);
          setUserMediaList(mediaResponse.data || []);
        } else if (determinedCampaignType === 'ai_chatbot') {
          // Set media list for AI chatbot (needed for media library selection)
          setUserMediaList(mediaResponse.data || []);
          console.log('[AddCampaignPage] AI chatbot media list loaded:', mediaResponse.data?.length || 0);
          
          // Set AI usage status if response exists
          if (aiUsageResponse) {
            setAiUsageStatus(aiUsageResponse.data);
            console.log('[AddCampaignPage] AI usage status:', aiUsageResponse.data);
          }
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
            toast.info(`Loading ${determinedCampaignType} campaign details for editing (ID: ${editCampaignId})...`);
            // API endpoint mungkin berbeza untuk AI chatbot dan Bulk
            const campaignApiUrl = determinedCampaignType === 'ai_chatbot' 
                ? `/ai-chatbot/${selectedDeviceId}/campaigns/${editCampaignId}` 
                : `/campaigns/${selectedDeviceId}/${editCampaignId}`;
            
            const campResponse = await api.get(campaignApiUrl);
            const campaignData = campResponse.data;

            if (determinedCampaignType === 'ai_chatbot') {
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
                appointmentLink: campaignData.appointmentLink || '',
                mediaFileAi: null, // Fail akan diuruskan berasingan, tidak dihantar dalam data ini
                captionAi: campaignData.captionAi || '',
                useAiFeature: campaignData.useAiFeature || 'not_use_ai',
                aiSpintax: campaignData.aiSpintax || '',
                // Conversation Flow Features
                conversationMode: campaignData.conversationMode || 'single_response',
                maxConversationBubbles: campaignData.maxConversationBubbles || '3',
                endConversationKeywords: campaignData.endConversationKeywords || '',
                // API Rest Configuration
                apiRestConfig: campaignData.apiRestConfig || {
                  webhookUrl: '',
                  method: 'POST',
                  customHeaders: '',
                  sendCustomerData: true,
                  sendResponseData: true,
                  sendTimestamp: true
                }
              });
              
              // Handle media untuk AI Chatbot edit mode
              console.log('[AddCampaign] AI Chatbot media debug:', {
                mediaAttachments: campaignData.mediaAttachments,
                userMediaListLength: userMediaList.length,
                mediaAttachmentsLength: campaignData.mediaAttachments ? campaignData.mediaAttachments.length : 0
              });
              
              if (campaignData.mediaAttachments && campaignData.mediaAttachments.length > 0 && userMediaList.length > 0) {
                console.log('[AddCampaign] Processing AI Chatbot media attachments:', {
                  campaignMediaAttachments: campaignData.mediaAttachments,
                  userMediaListIds: userMediaList.map(m => m._id),
                  userMediaList: userMediaList
                });
                
                // Find the selected media from library
                const selectedMedia = userMediaList.find(media => 
                  campaignData.mediaAttachments.includes(media._id)
                );
                
                if (selectedMedia) {
                  console.log('[AddCampaign] Found selected media for AI Chatbot:', {
                    selectedMedia: selectedMedia,
                    selectedMediaId: selectedMedia._id,
                    selectedMediaName: selectedMedia.originalName || selectedMedia.fileName
                  });
                  setAiChatbotFormData(prev => ({
                    ...prev,
                    selectedMediaFromLibrary: selectedMedia,
                    mediaFileAi: null // Clear file upload since we're using library media
                  }));
                } else {
                  console.log('[AddCampaign] No matching media found in user media list for AI Chatbot:', {
                    lookingFor: campaignData.mediaAttachments,
                    availableIds: userMediaList.map(m => m._id)
                  });
                }
              } else {
                console.log('[AddCampaign] No AI Chatbot media to process or userMediaList not available yet');
              }
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
              // Handle contactGroupId - could be ObjectId string or populated object
              const contactGroupId = typeof campaignData.contactGroupId === 'object' && campaignData.contactGroupId?._id 
                ? campaignData.contactGroupId._id 
                : campaignData.contactGroupId || '';
              setSelectedContactGroupId(contactGroupId);
              setScheduledAt(formatDateForInput(campaignData.scheduledAt));
              setMinInterval(String(campaignData.minIntervalSeconds || '5'));
              setMaxInterval(String(campaignData.maxIntervalSeconds || '10'));
              setCampaignScheduleType(campaignData.campaignScheduleType || 'anytime');
              let scheduleDetails = [];
              if (typeof campaignData.campaignScheduleDetails === 'string') {
                  try { scheduleDetails = JSON.parse(campaignData.campaignScheduleDetails); } catch { scheduleDetails = []; }
              } else if (Array.isArray(campaignData.campaignScheduleDetails)) {
                  scheduleDetails = campaignData.campaignScheduleDetails;
              }
              setDefinedHours(scheduleDetails);
              console.log('[AddCampaign] Campaign media debug:', {
                campaignId: editCampaignId,
                mediaAttachments: campaignData.mediaAttachments,
                userMediaListLength: userMediaList.length,
                campaignData: campaignData
              });
              
              if (campaignData.mediaAttachments && campaignData.mediaAttachments.length > 0) {
                  console.log('[AddCampaign] Processing media attachments:', campaignData.mediaAttachments);
                  const populatedMedia = campaignData.mediaAttachments
                  .map(attachment => {
                    // Handle both populated objects and IDs
                    if (typeof attachment === 'object' && attachment._id) {
                      // Already populated object from backend
                      console.log('[AddCampaign] Using populated media object:', attachment.originalName);
                      return attachment;
                    } else {
                      // Just an ID, need to find in userMediaList
                      const attachmentId = attachment;
                      console.log('[AddCampaign] Looking for media ID:', attachmentId);
                      const found = userMediaList.find(media => media._id === attachmentId);
                      console.log('[AddCampaign] Found media:', found);
                      return found;
                    }
                  })
                  .filter(item => !!item);
                  console.log('[AddCampaign] Final populated media:', populatedMedia);
                  setSelectedMediaItems(populatedMedia);
              } else {
                console.log('[AddCampaign] No media to process - conditions not met');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.pathname, user, deviceIdFromParams, isEditMode, editCampaignId, determinedCampaignType]);

  // Separate effect to handle media selection for AI chatbot after userMediaList is loaded
  // Modified to handle media reloading properly
  useEffect(() => {
    if (determinedCampaignType === 'ai_chatbot' && isEditMode && editCampaignId && userMediaList.length > 0) {
      
      console.log('[AddCampaign] useEffect triggered for AI chatbot media loading (modified)');
      
      // Re-fetch campaign data to get media attachments
      const loadAiChatbotMedia = async () => {
        try {
          const campaignApiUrl = `/ai-chatbot/${selectedDeviceId}/campaigns/${editCampaignId}`;
          const campResponse = await api.get(campaignApiUrl);
          const campaignData = campResponse.data;
          
          console.log('[AddCampaign] Re-fetching AI chatbot campaign for media (modified):', {
            mediaAttachments: campaignData.mediaAttachments,
            userMediaListLength: userMediaList.length,
            userMediaListIds: userMediaList.map(m => m._id),
            currentSelectedMedia: aiChatbotFormData.selectedMediaFromLibrary,
            currentSelectedMediaId: aiChatbotFormData.selectedMediaFromLibrary?._id
          });
          
          if (campaignData.mediaAttachments && campaignData.mediaAttachments.length > 0) {
            // Handle both populated objects and IDs
            let selectedMedia;
            const firstAttachment = campaignData.mediaAttachments[0];
            
            if (typeof firstAttachment === 'object' && firstAttachment._id) {
              // Already populated object from backend
              selectedMedia = firstAttachment;
            } else {
              // Just an ID, find in userMediaList
              selectedMedia = userMediaList.find(media => 
                campaignData.mediaAttachments.includes(media._id)
              );
            }
            
            if (selectedMedia) {
              // Only update if current selectedMediaFromLibrary is different or null
              const currentSelectedId = aiChatbotFormData.selectedMediaFromLibrary?._id;
              const newSelectedId = selectedMedia._id;
              
              if (currentSelectedId !== newSelectedId) {
                console.log('[AddCampaign] Setting selected media from effect (updated):', {
                  selectedMedia: selectedMedia,
                  selectedMediaId: selectedMedia._id,
                  selectedMediaName: selectedMedia.originalName || selectedMedia.fileName,
                  previousSelectedId: currentSelectedId,
                  updating: true
                });
                setAiChatbotFormData(prev => ({
                  ...prev,
                  selectedMediaFromLibrary: selectedMedia,
                  mediaFileAi: null
                }));
              } else {
                console.log('[AddCampaign] Media already correctly selected, no update needed');
              }
            } else {
              console.log('[AddCampaign] Secondary effect - No matching media found:', {
                lookingFor: campaignData.mediaAttachments,
                availableIds: userMediaList.map(m => m._id)
              });
              // Clear selection if media not found
              if (aiChatbotFormData.selectedMediaFromLibrary) {
                setAiChatbotFormData(prev => ({
                  ...prev,
                  selectedMediaFromLibrary: null,
                  mediaFileAi: null
                }));
              }
            }
          } else {
            // No media attachments - clear selection
            console.log('[AddCampaign] No media attachments, clearing selection');
            if (aiChatbotFormData.selectedMediaFromLibrary) {
              setAiChatbotFormData(prev => ({
                ...prev,
                selectedMediaFromLibrary: null,
                mediaFileAi: null
              }));
            }
          }
        } catch (error) {
          console.error('[AddCampaign] Error loading AI chatbot media in effect:', error);
        }
      };
      
      loadAiChatbotMedia();
    }
  }, [determinedCampaignType, isEditMode, editCampaignId, userMediaList, selectedDeviceId]);

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
    setAiChatbotFormData(prev => ({ 
      ...prev, 
      mediaFileAi: newFile,
      selectedMediaFromLibrary: newFile ? null : prev.selectedMediaFromLibrary // Clear library selection if new file uploaded
    }));
  };

  const handleMediaLibrarySelect = (mediaItem) => {
    setTempSelectedMediaInDialog(prevSelected => {
      const isAlreadySelected = prevSelected.find(item => item._id === mediaItem._id);
      if (isAlreadySelected) {
        return prevSelected.filter(item => item._id !== mediaItem._id);
      } else {
        if (determinedCampaignType === 'ai_chatbot') {
          // AI chatbot: hanya 1 media item
          return [mediaItem];
        } else {
          // Bulk campaign: hingga 3 media items
          if (prevSelected.length < 3) { return [...prevSelected, mediaItem]; }
          else { toast.info("Max 3 media items."); return prevSelected; }
        }
      }
    });
  };

  const handleConfirmMediaSelection = () => {
    console.log('[handleConfirmMediaSelection] Campaign type:', determinedCampaignType);
    console.log('[handleConfirmMediaSelection] tempSelectedMediaInDialog:', tempSelectedMediaInDialog);
    
    if (determinedCampaignType === 'ai_chatbot') {
      // Untuk AI chatbot: simpan media dalam aiChatbotFormData dan clear file upload
      if (tempSelectedMediaInDialog.length > 0) {
        const selectedMedia = tempSelectedMediaInDialog[0];
        console.log('[handleConfirmMediaSelection] AI Chatbot - setting selectedMedia:', {
          selectedMedia,
          id: selectedMedia._id,
          name: selectedMedia.originalName || selectedMedia.fileName
        });
        
        // Update state with selected media
        setAiChatbotFormData(prev => ({ 
          ...prev, 
          selectedMediaFromLibrary: { ...selectedMedia }, // Create new object to force re-render
          mediaFileAi: null 
        }));
        
        console.log('[handleConfirmMediaSelection] AI Chatbot - state updated with media:', selectedMedia.originalName || selectedMedia.fileName);
        
        // Clear file input
        if (aiMediaFileInputRef.current) { 
          aiMediaFileInputRef.current.value = ""; 
        }
      } else {
        console.log('[handleConfirmMediaSelection] AI Chatbot - no media selected, clearing selection');
        setAiChatbotFormData(prev => ({ 
          ...prev, 
          selectedMediaFromLibrary: null, 
          mediaFileAi: null 
        }));
      }
    } else {
      // Untuk bulk campaign: logik asal
      setSelectedMediaItems(tempSelectedMediaInDialog);
      if (tempSelectedMediaInDialog.length > 0 && formData.mediaFile) {
          setFormData(prev => ({ ...prev, mediaFile: null }));
          if (fileInputRef.current) { fileInputRef.current.value = ""; }
      }
    }
    setIsMediaLibraryOpen(false);
  };

  const handleCancelMediaSelection = () => setIsMediaLibraryOpen(false);
  const openMediaLibrary = () => { setTempSelectedMediaInDialog([...selectedMediaItems]); setIsMediaLibraryOpen(true); };
  
  // Fungsi untuk buka Media Library modal
  const handleOpenMediaStorage = () => {
    console.log('[handleOpenMediaStorage] Opening media library for campaign type:', determinedCampaignType);
    
    if (determinedCampaignType === 'ai_chatbot') {
      // For AI chatbot: initialize with selectedMediaFromLibrary if exists
      const currentlySelected = aiChatbotFormData.selectedMediaFromLibrary ? [aiChatbotFormData.selectedMediaFromLibrary] : [];
      console.log('[handleOpenMediaStorage] AI Chatbot - initializing with:', {
        selectedMediaFromLibrary: aiChatbotFormData.selectedMediaFromLibrary,
        currentlySelected: currentlySelected,
        selectedMediaId: aiChatbotFormData.selectedMediaFromLibrary?._id,
        selectedMediaName: aiChatbotFormData.selectedMediaFromLibrary?.originalName || aiChatbotFormData.selectedMediaFromLibrary?.fileName
      });
      setTempSelectedMediaInDialog(currentlySelected);
    } else {
      // For bulk: initialize with selectedMediaItems
      console.log('[handleOpenMediaStorage] Bulk campaign - initializing with selectedMediaItems:', selectedMediaItems);
      setTempSelectedMediaInDialog([...selectedMediaItems]);
    }
    setIsMediaLibraryOpen(true);
  };

  // Fungsi untuk mengendalikan perubahan konfigurasi API
  const handleApiConfigChange = (field, value) => {
    setAiChatbotFormData(prev => ({
      ...prev,
      apiRestConfig: {
        ...prev.apiRestConfig,
        [field]: value
      }
    }));
  };

  // Fungsi untuk menyimpan konfigurasi API
  const handleSaveApiConfig = () => {
    // Validasi asas
    if (!aiChatbotFormData.apiRestConfig.webhookUrl) {
      toast.error("Webhook URL is required");
      return;
    }
    
    // Tutup modal
    setIsApiConfigModalOpen(false);
    toast.success("API configuration saved");
  };

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
            'appointmentLink': 'appointmentLink',
            'captionAi': 'captionAi',
            'useAiFeature': 'useAiFeature',
            'aiSpintax': 'aiSpintax',
            // Conversation Flow Fields
            'conversationMode': 'conversationMode',
            'maxConversationBubbles': 'maxConversationBubbles',
            'endConversationKeywords': 'endConversationKeywords'
        };

        console.log('[Form Submit] AI Chatbot Form Data:', aiChatbotFormData);
        console.log('[Form Submit] selectedMediaFromLibrary:', aiChatbotFormData.selectedMediaFromLibrary);
        
        Object.keys(aiChatbotFormData).forEach(key => {
            if (key === 'mediaFileAi' && aiChatbotFormData[key]) {
                console.log('[Form Submit] Adding mediaFileAi:', aiChatbotFormData[key]);
                dataPayload.append('mediaFileAi', aiChatbotFormData[key]);
            } else if (key === 'selectedMediaFromLibrary' && aiChatbotFormData[key]) {
                // Hantar ID media dari library untuk backend guna
                console.log('[Form Submit] Adding selectedMediaLibraryId:', aiChatbotFormData[key]._id);
                dataPayload.append('selectedMediaLibraryId', aiChatbotFormData[key]._id);
            } else if (key === 'apiRestConfig') {
                // Hantar konfigurasi API sebagai JSON string
                dataPayload.append('apiRestConfig', JSON.stringify(aiChatbotFormData[key]));
            } else if (key === 'keywords' && aiChatbotFormData[key]) {
                // Special handling for keywords - ensure it's sent as a string for backend processing
                console.log('[Form Submit] Keywords before sending:', aiChatbotFormData[key]);
                dataPayload.append('keywords', aiChatbotFormData[key]);
            } else if (fieldMapping[key]) {
                dataPayload.append(fieldMapping[key], aiChatbotFormData[key]);
            } else if (key !== 'mediaFileAi' && key !== 'selectedMediaFromLibrary' && key !== 'apiRestConfig' && key !== 'keywordInput') {
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
      
      // Log detailed error array
      if (error.response?.data?.error && Array.isArray(error.response.data.error)) {
        console.error('Validation Errors:');
        error.response.data.error.forEach((err, index) => {
          console.error(`  ${index + 1}. ${err}`);
        });
      }
      
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
                {import.meta.env.DEV && (
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
        {import.meta.env.DEV && determinedCampaignType === 'bulk' && (
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
                    <div className="flex items-center justify-between">
                        <Label htmlFor="contactGroupId">Contact Group <span className="text-red-500">*</span></Label>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                                try {
                                    const groupsResponse = await api.get('/contact-groups');
                                    const mappedContactGroups = (groupsResponse.data || []).map(group => ({
                                        _id: group._id,
                                        name: group.groupName,
                                        count: group.contactCount,
                                        contacts: group.contacts || []
                                    }));
                                    setContactGroupsList(mappedContactGroups);
                                    toast.success('Contact groups refreshed');
                                } catch {
                                    toast.error('Failed to refresh contact groups');
                                }
                            }}
                        >
                            Refresh
                        </Button>
                    </div>
                    <Select onValueChange={setSelectedContactGroupId} value={selectedContactGroupId} required>
                        <SelectTrigger id="contactGroupId">
                        <SelectValue placeholder="Select contact group...">
                            {selectedContactGroupId ? 
                                (() => {
                                    if (selectedContactGroupId === 'all_contacts') {
                                        return '📧 All Contacts (Send to all contacts)';
                                    }
                                    const selectedGroup = contactGroupsList.find(group => group._id === selectedContactGroupId);
                                    return selectedGroup ? `👥 ${selectedGroup.name} (${selectedGroup.count} contacts)` : 'Select contact group...';
                                })()
                                : 'Select contact group...'
                            }
                        </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        {/* Option untuk semua kontak */}
                        <SelectItem value="all_contacts">📧 All Contacts (Send to all contacts)</SelectItem>
                        
                        {contactGroupsList.length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground space-y-2">
                            <p>No contact groups found.</p>
                            <Button 
                              size="sm" 
                              className="w-full"
                              onClick={async () => {
                                try {
                                  const response = await api.post('/contact-groups/auto-create-default');
                                  toast.success(response.data.message);
                                  // Refresh contact groups list
                                  const groupsResponse = await api.get('/contact-groups');
                                  const mappedContactGroups = (groupsResponse.data || []).map(group => ({
                                    _id: group._id,
                                    name: group.groupName,
                                    count: group.contactCount,
                                    contacts: group.contacts || []
                                  }));
                                  setContactGroupsList(mappedContactGroups);
                                  // Auto-select the created group
                                  if (response.data.group) {
                                    setSelectedContactGroupId(response.data.group._id);
                                  }
                                } catch (error) {
                                  toast.error(error.response?.data?.message || 'Failed to create default group');
                                }
                              }}
                            >
                              Create Default Group
                            </Button>
                          </div>
                        )}
                        {contactGroupsList.map(group => (
                            <SelectItem key={group._id} value={group._id}>👥 {group.name} ({group.count} contacts)</SelectItem>
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
                                <Label htmlFor="scheduledAt">Time Post (Required)</Label>
                                <Input type="datetime-local" id="scheduledAt" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                                {/* <p className="text-xs text-muted-foreground">Leave blank to send immediately (if queue is empty).</p> */}
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

                {/* Default response when no keyword match */}
                <div className="space-y-2">
                <Label htmlFor="ai-isNotMatchDefaultResponse">Use AI for unmatched messages?</Label>
                <RadioGroup id="ai-isNotMatchDefaultResponse" name="isNotMatchDefaultResponse" value={aiChatbotFormData.isNotMatchDefaultResponse} onValueChange={(value) => handleRadioChange(value, 'isNotMatchDefaultResponse')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="ai-isNotMatchDefaultResponse-yes" /><Label htmlFor="ai-isNotMatchDefaultResponse-yes">Yes - Use AI prompt for unmatched messages</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="ai-isNotMatchDefaultResponse-no" /><Label htmlFor="ai-isNotMatchDefaultResponse-no">No - Use keyword/media response only</Label></div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Yes: When customer sends message without keywords, AI will respond using your prompt.<br/>
                  No: Bot will only respond when keywords are matched, sending media and caption.
                </p>
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
                <Label htmlFor="ai-type">Trigger Type</Label>
                <RadioGroup id="ai-type" name="type" value={aiChatbotFormData.type} onValueChange={(value) => handleRadioChange(value, 'type')} className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="message_contains_keyword" id="ai-type-contains" />
                      <Label htmlFor="ai-type-contains">Message contains the keyword</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="message_contains_whole_keyword" id="ai-type-whole" />
                      <Label htmlFor="ai-type-whole">Message contains whole keyword</Label>
                    </div>
                    {aiChatbotFormData.conversationMode === 'continuous_chat' && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="message_contains_ai" id="ai-type-ai" />
                        <Label htmlFor="ai-type-ai" className="text-blue-700 font-medium">
                          💬 Any message (Continuous Chat Mode)
                        </Label>
                      </div>
                    )}
                </RadioGroup>
                {aiChatbotFormData.type === 'message_contains_ai' && (
                  <div className="mt-2 p-3 border rounded-md bg-blue-50 text-xs text-blue-800">
                    <p className="font-semibold mb-1">ℹ️ Continuous Chat Mode:</p>
                    <p>Bot will respond to ALL messages from customers. Use keywords field to set initial conversation starters (optional), and set end keywords below to stop conversations.</p>
                  </div>
                )}
                </div>

                {/* Name */}
                <div className="space-y-2">
                <Label htmlFor="ai-name">Name <span className="text-red-500">*</span></Label>
                <Input id="ai-name" name="name" value={aiChatbotFormData.name} onChange={handleInputChange} placeholder="Enter response name, e.g., Salam Pembuka" required />
                {isEditMode && editCampaignId && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
                    <Label className="text-xs text-blue-600 font-semibold">Flow ID:</Label>
                    <p className="text-sm text-blue-800 font-mono">{editCampaignId}</p>
                    <p className="text-xs text-blue-600 mt-1">This is the unique identifier for this campaign flow.</p>
                  </div>
                )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                <Label htmlFor="ai-description">Description</Label>
                <Textarea id="ai-description" name="description" value={aiChatbotFormData.description} onChange={handleInputChange} placeholder="Short description for this response" />
                </div>

                {/* Keywords */}
                <div className="space-y-2">
                <Label htmlFor="ai-keywords">
                  Keywords {(aiChatbotFormData.type === 'message_contains_ai' || aiChatbotFormData.isNotMatchDefaultResponse === 'no') ? '(Optional)' : '(Required)'}
                </Label>
                <div className="space-y-2">
                  {/* Keywords Input Field */}
                  <Input 
                    id="ai-keywords" 
                    name="keywordInput" 
                    value={aiChatbotFormData.keywordInput || ''}
                    onChange={(e) => {
                      setAiChatbotFormData(prev => ({ ...prev, keywordInput: e.target.value }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        const currentValue = aiChatbotFormData.keywordInput?.trim();
                        if (currentValue) {
                          const existingKeywords = aiChatbotFormData.keywords 
                            ? aiChatbotFormData.keywords.split(',').map(k => k.trim()).filter(k => k)
                            : [];
                          
                          // Check if keyword already exists
                          if (!existingKeywords.includes(currentValue)) {
                            const newKeywords = existingKeywords.length > 0 
                              ? [...existingKeywords, currentValue].join(', ')
                              : currentValue;
                            setAiChatbotFormData(prev => ({ 
                              ...prev, 
                              keywords: newKeywords,
                              keywordInput: '' 
                            }));
                          } else {
                            // Clear input if keyword already exists
                            setAiChatbotFormData(prev => ({ ...prev, keywordInput: '' }));
                          }
                        }
                      }
                    }}
                    placeholder={
                      aiChatbotFormData.isNotMatchDefaultResponse === 'no'
                        ? "Type keywords and press space to add..."
                        : aiChatbotFormData.type === 'message_contains_ai' 
                          ? "Type keywords and press space to add (or leave empty)"
                          : "Type keywords and press space to add..."
                    }
                  />
                  
                  {/* Interactive Keywords Bubbles */}
                  {aiChatbotFormData.keywords && aiChatbotFormData.keywords.trim() && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {aiChatbotFormData.keywords
                        .split(',')
                        .map(keyword => keyword.trim())
                        .filter(keyword => keyword)
                        .map((keyword, index) => (
                          <div
                            key={index}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow-md"
                          >
                            <span className="font-medium">{keyword}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedKeywords = aiChatbotFormData.keywords
                                  .split(',')
                                  .map(k => k.trim())
                                  .filter(k => k && k !== keyword)
                                  .join(', ');
                                setAiChatbotFormData(prev => ({ ...prev, keywords: updatedKeywords }));
                              }}
                              className="ml-1 w-4 h-4 rounded-full bg-blue-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
                              title={`Remove keyword: ${keyword}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-blue-600">💡 How to Use:</p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>Type keywords in the input box above</li>
                    <li>Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Space</kbd> or <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to add bubble</li>
                    <li>Click <span className="inline-flex items-center justify-center w-3 h-3 bg-gray-400 text-white rounded-full text-xs">×</span> button to remove keywords</li>
                  </ul>
                  <p className="mt-2">
                    {aiChatbotFormData.isNotMatchDefaultResponse === 'no'
                      ? 'When these keywords are matched, bot will send media and caption only (not AI response).'
                      : aiChatbotFormData.type === 'message_contains_ai' 
                        ? 'In continuous chat mode: Keywords are optional. If set, conversation starts when customer sends these words.'
                        : 'Bot will trigger if message contains any of these keywords.'
                    }
                  </p>
                </div>
                </div>

                {/* Next Bot Action */}
                <div className="space-y-2">
                <Label htmlFor="ai-nextBotAction">Next Bot Action (Flow ID)</Label>
                <Input id="ai-nextBotAction" name="nextBotAction" value={aiChatbotFormData.nextBotAction} onChange={handleInputChange} placeholder="Enter Flow ID of next campaign (e.g., FLOW-20250818-123456-0001)" />
                <p className="text-xs text-muted-foreground">Optional: Enter the Flow ID of another campaign to chain responses together.</p>
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

                {/* Appointment Link */}
                <div className="space-y-2">
                <Label htmlFor="ai-appointmentLink">Appointment Booking Link</Label>
                <Input 
                  id="ai-appointmentLink" 
                  name="appointmentLink" 
                  value={aiChatbotFormData.appointmentLink || ''} 
                  onChange={handleInputChange} 
                  placeholder="https://calendly.com/your-link or https://your-booking-system.com" 
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: When keywords are matched, customers will receive this booking link for appointments.
                </p>
                </div>

                
                {/* Media file AI */}
                <div className="space-y-2">
                <Label htmlFor="ai-mediaFileAi">Media file (Optional)</Label>
                <div className="flex items-center space-x-2 border p-2 rounded-md">
                    <Input id="ai-mediaFileAi" type="file" onChange={handleAiMediaFileChange} className="hidden" ref={aiMediaFileInputRef} />
                    <Button type="button" variant="outline" onClick={() => aiMediaFileInputRef.current && aiMediaFileInputRef.current.click()} className="flex-grow justify-start text-muted-foreground">
                        {(() => {
                          console.log('[MediaButton] Rendering button text:', {
                            mediaFileAi: aiChatbotFormData.mediaFileAi,
                            selectedMediaFromLibrary: aiChatbotFormData.selectedMediaFromLibrary,
                            selectedMediaName: aiChatbotFormData.selectedMediaFromLibrary?.originalName || aiChatbotFormData.selectedMediaFromLibrary?.fileName
                          });
                          
                          if (aiChatbotFormData.mediaFileAi) {
                            return aiChatbotFormData.mediaFileAi.name;
                          } else if (aiChatbotFormData.selectedMediaFromLibrary) {
                            const mediaName = aiChatbotFormData.selectedMediaFromLibrary.originalName || 
                                           aiChatbotFormData.selectedMediaFromLibrary.fileName || 
                                           'Selected Media';
                            return mediaName;
                          } else {
                            return "SELECT MEDIA FILE";
                          }
                        })()}
                    </Button>
                    {/* Butang Media Storage */} 
                    <Button type="button" variant="ghost" size="icon" title="Open Media Library" onClick={handleOpenMediaStorage}><ImageIcon className="h-5 w-5" /></Button>
                </div>
                {aiChatbotFormData.mediaFileAi && (
                    <div className="mt-2 text-sm text-muted-foreground">
                    Selected file: {aiChatbotFormData.mediaFileAi.name} ({(aiChatbotFormData.mediaFileAi.size / 1024).toFixed(2)} KB)
                    </div>
                )}
                {aiChatbotFormData.selectedMediaFromLibrary && (
                    <div className="mt-2 text-sm text-muted-foreground">
                    Selected from library: {aiChatbotFormData.selectedMediaFromLibrary.originalName || aiChatbotFormData.selectedMediaFromLibrary.fileName}
                    </div>
                )}
                </div>

                {/* Caption AI dengan Spintax */}
                <div className="space-y-2">
                <Label htmlFor="ai-captionAi">Caption / Text Message</Label>
                <Textarea id="ai-captionAi" name="captionAi" value={aiChatbotFormData.captionAi} onChange={handleInputChange} placeholder="Write message with Spintax support: {Hi|Hello|Hola}... Use [greet] [wa_name] [me_wa_name] [now_formatted|DD MMM YYYY]" rows={4} />
                <div className="flex space-x-1 mt-1">
                </div>
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

                {/* Use AI Feature */}
                <div className="space-y-2">
                <Label htmlFor="ai-useAiFeature">Use AI for Dynamic Response</Label>
                <RadioGroup id="ai-useAiFeature" name="useAiFeature" value={aiChatbotFormData.useAiFeature} onValueChange={(value) => handleRadioChange(value, 'useAiFeature')} className="flex space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="not_use_ai" id="ai-useAiFeature-no" /><Label htmlFor="ai-useAiFeature-no">Static Response</Label></div>
                    <div className={`flex items-center space-x-2 p-2 rounded-md border ${(!aiUsageStatus.canCreateAi && !isEditMode) ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-gradient-to-r from-blue-50 to-purple-50'}`}>
                      <RadioGroupItem 
                        value="use_ai" 
                        id="ai-useAiFeature-yes" 
                        disabled={!aiUsageStatus.canCreateAi && !isEditMode}
                      />
                      <Label 
                        htmlFor="ai-useAiFeature-yes" 
                        className={`font-medium ${(!aiUsageStatus.canCreateAi && !isEditMode) ? 'text-gray-400' : 'text-blue-700'}`}
                      >
                        🤖 AI-Powered Response {(!aiUsageStatus.canCreateAi && !isEditMode) && '(Limited to 1 per account)'}
                      </Label>
                    </div>
                </RadioGroup>
                
                {/* AI Usage Limitation Info */}
                {!aiUsageStatus.canCreateAi && !isEditMode && aiUsageStatus.aiCampaign && (
                  <div className="mt-2 p-3 border rounded-md bg-orange-50 text-xs text-orange-800">
                    <p className="font-semibold mb-1">⚠️ AI Feature Limit:</p>
                    <p>You already have an AI-powered campaign: <strong>"{aiUsageStatus.aiCampaign.name}"</strong></p>
                    <p className="mt-1">Each account is limited to 1 AI-powered campaign. To use AI for this campaign, please disable your existing AI campaign first.</p>
                  </div>
                )}
                
                <div className="mt-1 p-2 border rounded-md bg-amber-50 text-xs text-amber-800">
                    <p className="font-semibold mb-1">ℹ️ Feature Comparison:</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <p className="font-medium">Static Response:</p>
                            <p>Uses fixed caption with Spintax</p>
                        </div>
                        <div>
                            <p className="font-medium">AI-Powered:</p>
                            <p>Generates dynamic responses based on context</p>
                        </div>
                    </div>
                </div>
                {aiChatbotFormData.useAiFeature === 'use_ai' && (
                    <div className="mt-2 space-y-4">
                    <Label htmlFor="ai-prompt">AI Prompt for Dynamic Response <span className="text-red-500">*</span></Label>
                    <Textarea 
                      id="ai-prompt" 
                      name="aiSpintax" 
                      value={aiChatbotFormData.aiSpintax} 
                      onChange={handleInputChange} 
                      placeholder="Enter AI prompt to generate dynamic responses. Example: Generate a friendly response about our product pricing in Malay. Keep it professional and helpful. Use the customer's message context to provide relevant answers." 
                      rows={6}
                      required={aiChatbotFormData.useAiFeature === 'use_ai'}
                    />
                    
                    <div className="mt-1 p-2 border rounded-md bg-purple-50 text-xs text-purple-800 mb-2">
                        <p className="font-semibold mb-1">ℹ️ AI Configuration:</p>
                        <p>AI model, temperature, and other global settings are configured in <Link to="/settings" className="underline font-medium">Settings</Link>. This campaign will use your global AI preferences.</p>
                    </div>
                    
                    <div className="mt-1 p-2 border rounded-md bg-blue-50 text-xs text-blue-800">
                        <p className="font-semibold mb-1">AI Prompt Guidelines:</p>
                        <ul className="list-disc list-inside pl-4">
                        <li>Be specific about tone, language, and response style</li>
                        <li>Include context about your business/product if relevant</li>
                        <li>The AI will have access to the customer's incoming message</li>
                        <li>You can use parameters like [wa_name], [greet], [now_formatted|DD MMM YYYY]</li>
                        <li>Example: "Generate a helpful response in Malay about our delivery services. Be friendly and include the customer's name if mentioned. If they ask about price, mention we offer competitive rates."</li>
                        </ul>
                    </div>
                    <div className="mt-1 p-2 border rounded-md bg-green-50 text-xs text-green-800">
                        <p className="font-semibold mb-1">✅ How It Works:</p>
                        <p>When a customer sends a message matching your keywords, the AI will:</p>
                        <ol className="list-decimal list-inside pl-4 mt-1">
                        <li>Read the customer's message</li>
                        <li>Use your prompt as instructions</li>
                        <li>Generate a personalized response using your global AI settings</li>
                        <li>Send the response automatically</li>
                        </ol>
                    </div>
                    </div>
                )}

                {/* Conversation Flow & Bubble Options - Only show for AI-Powered response */}
                {aiChatbotFormData.useAiFeature === 'use_ai' && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg text-blue-800">💬 Conversation Flow Settings</CardTitle>
                    <CardDescription className="text-blue-700">
                      Configure how AI handles ongoing conversations and response options.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Conversation Mode */}
                    <div className="space-y-3">
                      <Label htmlFor="conversation-mode">Conversation Mode</Label>
                      
                      <RadioGroup 
                        value={aiChatbotFormData.conversationMode} 
                        onValueChange={(value) => handleRadioChange(value, 'conversationMode')} 
                        className="space-y-3"
                      >
                        {/* Single Response Option */}
                        <div className={`flex items-start space-x-3 p-3 border rounded-md ${aiChatbotFormData.conversationMode === 'single_response' ? 'border-blue-300 bg-blue-50' : 'bg-white'}`}>
                          <RadioGroupItem 
                            value="single_response" 
                            id="mode-single"
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label htmlFor="mode-single" className="font-medium text-base cursor-pointer">
                              📝 Single Response Mode
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              AI responds only when customer sends a message with trigger keywords. Perfect for FAQ bots.
                            </p>
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <strong>Example flow:</strong><br/>
                              Customer: "harga" → AI responds<br/>
                              Customer: "ok terima kasih" → No response (no keyword)<br/>
                              Customer: "delivery" → AI responds
                            </div>
                          </div>
                        </div>

                        {/* Continuous Chat Option */}
                        <div className={`flex items-start space-x-3 p-3 border rounded-md ${aiChatbotFormData.conversationMode === 'continuous_chat' ? 'border-blue-300 bg-blue-50' : 'bg-white'}`}>
                          <RadioGroupItem 
                            value="continuous_chat" 
                            id="mode-continuous"
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label htmlFor="mode-continuous" className="font-medium text-base cursor-pointer">
                              💬 Continuous Chat Mode
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              After initial keyword trigger, AI responds to ALL customer messages until conversation ends.
                            </p>
                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                              <strong>Example flow:</strong><br/>
                              Customer: "harga" → AI responds (conversation starts)<br/>
                              Customer: "ok terima kasih" → AI responds<br/>
                              Customer: "bye" → AI ends conversation (end keyword)
                            </div>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Max Conversation Bubbles */}
                    {aiChatbotFormData.conversationMode === 'continuous_chat' && (
                      <div className="space-y-2">
                        <Label htmlFor="max-bubbles">Maximum Conversation Bubbles</Label>
                        <Select 
                          value={aiChatbotFormData.maxConversationBubbles} 
                          onValueChange={(value) => handleRadioChange(value, 'maxConversationBubbles')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select max bubbles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 bubbles</SelectItem>
                            <SelectItem value="4">4 bubbles</SelectItem>
                            <SelectItem value="5">5 bubbles</SelectItem>
                            <SelectItem value="6">6 bubbles</SelectItem>
                            <SelectItem value="7">7 bubbles</SelectItem>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Limit how many times AI can respond in one conversation.
                        </p>
                      </div>
                    )}

                    {/* End Conversation Keywords */}
                    {aiChatbotFormData.conversationMode === 'continuous_chat' && (
                      <div className="space-y-2">
                        <Label htmlFor="end-keywords">End Conversation Keywords</Label>
                        <Textarea 
                          id="end-keywords"
                          name="endConversationKeywords"
                          value={aiChatbotFormData.endConversationKeywords}
                          onChange={handleInputChange}
                          placeholder="stop, end, bye, selesai, tamat, finish"
                          rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                          When customer sends any of these keywords, AI will end the conversation. Separate with commas.
                        </p>
                      </div>
                    )}


                  </CardContent>
                </Card>
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
            <Button 
              type="submit" 
              disabled={
                isSaving || 
                isLoadingPageData || 
                (determinedCampaignType === 'ai_chatbot' && !aiChatbotFormData.name) || 
                (determinedCampaignType === 'ai_chatbot' && aiChatbotFormData.useAiFeature === 'use_ai' && !aiChatbotFormData.aiSpintax) ||
                (determinedCampaignType === 'bulk' && !formData.campaignName)
              }
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditMode ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          )}
        </CardFooter>
      </form>

      {/* Media Library Dialog (Untuk Bulk Campaign & AI Chatbot) */}
      <Dialog open={isMediaLibraryOpen} onOpenChange={setIsMediaLibraryOpen}>
          <DialogContent className="max-w-3xl">
          <DialogHeader>
              <DialogTitle>Media Library</DialogTitle>
              <DialogDescription>
                {determinedCampaignType === 'ai_chatbot' 
                  ? 'Select 1 media item for your AI chatbot campaign. Upload new files via the Media Storage page.'
                  : 'Select up to 3 media items for your campaign. Upload new files via the Media Storage page.'
                }
              </DialogDescription>
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
                            <img src={media.accessUrl || `${api.defaults.baseURL.replace('/api', '')}${media.filePath}`} alt={media.fileName} className="object-contain h-full w-full rounded-t-md" onError={(e) => e.target.src = 'https://via.placeholder.com/150?text=No+Preview'}/>
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

        {/* API Rest Data Configuration Modal */}
        <Dialog open={isApiConfigModalOpen} onOpenChange={setIsApiConfigModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>🔗 API Rest Data Configuration</DialogTitle>
              <DialogDescription>
                Configure external API/webhook to receive customer interaction data from AI chatbot responses.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 max-h-[60vh] overflow-y-auto p-1">
              {/* Webhook URL */}
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL <span className="text-red-500">*</span></Label>
                <Input 
                  id="webhook-url"
                  type="url"
                  placeholder="https://your-api.com/webhook/whatsapp"
                  value={aiChatbotFormData.apiRestConfig.webhookUrl}
                  onChange={(e) => handleApiConfigChange('webhookUrl', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL where customer interaction data will be sent
                </p>
              </div>

              {/* HTTP Method */}
              <div className="space-y-2">
                <Label htmlFor="http-method">HTTP Method</Label>
                <Select 
                  value={aiChatbotFormData.apiRestConfig.method} 
                  onValueChange={(value) => handleApiConfigChange('method', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select HTTP method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Headers */}
              <div className="space-y-2">
                <Label htmlFor="custom-headers">Custom Headers (Optional)</Label>
                <Textarea 
                  id="custom-headers"
                  placeholder="Authorization: Bearer your-token&#10;Content-Type: application/json&#10;X-API-Key: your-api-key"
                  value={aiChatbotFormData.apiRestConfig.customHeaders}
                  onChange={(e) => handleApiConfigChange('customHeaders', e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Enter headers in "Key: Value" format, one per line
                </p>
              </div>

              {/* Data to Send */}
              <div className="space-y-3">
                <Label>Data to Send</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="send-customer-data"
                      checked={aiChatbotFormData.apiRestConfig.sendCustomerData}
                      onCheckedChange={(checked) => handleApiConfigChange('sendCustomerData', checked)}
                    />
                    <Label htmlFor="send-customer-data" className="text-sm">Customer Data (phone, name, message)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="send-response-data"
                      checked={aiChatbotFormData.apiRestConfig.sendResponseData}
                      onCheckedChange={(checked) => handleApiConfigChange('sendResponseData', checked)}
                    />
                    <Label htmlFor="send-response-data" className="text-sm">Bot Response Data (AI/static response)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="send-timestamp"
                      checked={aiChatbotFormData.apiRestConfig.sendTimestamp}
                      onCheckedChange={(checked) => handleApiConfigChange('sendTimestamp', checked)}
                    />
                    <Label htmlFor="send-timestamp" className="text-sm">Timestamp & Campaign Info</Label>
                  </div>
                </div>
              </div>

              {/* Example Payload */}
              <div className="space-y-2">
                <Label>Example Payload</Label>
                <div className="p-3 bg-muted rounded-md text-xs font-mono">
                  <pre>{`{
  "event": "ai_chatbot_response",
  "campaign_id": "campaign_id_here",
  "campaign_name": "Campaign Name",
  "customer": {
    "phone": "+60123456789",
    "name": "Customer Name",
    "message": "Customer's original message"
  },
  "bot_response": {
    "message": "AI generated response",
    "type": "ai_generated|static",
    "ai_tokens": 45
  },
  "timestamp": "2025-08-17T14:30:00Z",
  "device_id": "device_id_here"
}`}</pre>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsApiConfigModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveApiConfig}
                disabled={!aiChatbotFormData.apiRestConfig.webhookUrl}
              >
                Save Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

export default AddCampaignPage; 