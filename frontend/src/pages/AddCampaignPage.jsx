import React, { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react'; // Import Loader
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from '../contexts/AuthContext'; // BARU: Untuk dapatkan user ID jika perlu untuk API devices

function AddCampaignPage() {
  const { numberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // Untuk baca query params
  const { user } = useAuth(); // Dapatkan user info

  const [determinedCampaignType, setDeterminedCampaignType] = useState('ai_chatbot');
  const [devicesList, setDevicesList] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(numberId || ''); // Inisialisasi dengan numberId jika ada
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const typeFromUrl = searchParams.get('type');
    const campaignType = typeFromUrl === 'bulk' ? 'bulk' : 'ai_chatbot';
    setDeterminedCampaignType(campaignType);

    if (campaignType === 'bulk' && !numberId) { // Jika bulk dan tiada deviceId dari URL
      const fetchDevices = async () => {
        setIsLoadingDevices(true);
        try {
          const response = await api.get('/whatsapp/devices'); // Panggil API devices
          setDevicesList(response.data || []);
          if (response.data && response.data.length > 0) {
            // Boleh set default selected device jika mahu, atau biarkan kosong
            // setSelectedDeviceId(response.data[0].id); 
          } else {
            toast.info("No active devices found. Please connect a device first to create a bulk campaign.");
          }
        } catch (error) {
          console.error("Failed to fetch devices:", error);
          toast.error("Could not load your WhatsApp devices.");
          setDevicesList([]);
        } finally {
          setIsLoadingDevices(false);
        }
      };
      if(user) fetchDevices(); // Hanya fetch jika user ada
    }
  }, [location.search, numberId, user]);

  const [formData, setFormData] = useState({
    campaignName: '',
    statusEnabled: true,
    enableLink: false,
    urlLink: '',
    mediaFile: null, // Untuk simpan file object
    caption: '',
    aiAgentTraining: '',
    useAI: false,
    presenceDelay: 'typing', // default value
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSwitchChange = (checked, name) => {
     setFormData(prev => ({
       ...prev,
       [name]: checked,
     }));
  };

  const handleCheckboxChange = (checked, name) => {
     setFormData(prev => ({
       ...prev,
       [name]: checked,
     }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({
      ...prev,
      mediaFile: e.target.files[0] || null,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const effectiveDeviceId = numberId || selectedDeviceId;

    if (!effectiveDeviceId) {
        toast.error("Device ID is required. Please select a device for this campaign.");
        return;
    }

    setIsSaving(true);
    toast.info("Saving campaign...");

    const dataToSend = new FormData();
    Object.keys(formData).forEach(key => {
        if (key === 'mediaFile' && formData[key]) {
            dataToSend.append(key, formData.mediaFile);
        } else if (key !== 'mediaFile') {
             dataToSend.append(key, typeof formData[key] === 'boolean' ? formData[key].toString() : formData[key]);
        }
    });
    dataToSend.append('campaignType', determinedCampaignType);

    const apiUrl = `/api/campaigns/${effectiveDeviceId}`;

    try {
        await api.post(apiUrl, dataToSend);
        toast.success("Campaign saved successfully!");
        if (determinedCampaignType === 'bulk') {
            navigate('/'); 
        } else {
            navigate(`/ai-chatbot/${effectiveDeviceId}/campaigns`);
        }
    } catch (error) {
        console.error("Failed to save campaign:", error);
        const errorMessage = error.response?.data?.message || "Error saving campaign.";
        toast.error(`Save failed: ${errorMessage}`);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Add New {determinedCampaignType === 'bulk' ? 'Bulk' : 'AI Chatbot'} Campaign</CardTitle>
          <CardDescription>
            Create a new {determinedCampaignType === 'bulk' ? 'bulk messaging' : 'AI chatbot'} campaign.
            {determinedCampaignType === 'ai_chatbot' && numberId && ` For device ID: ${numberId}`}
            {determinedCampaignType === 'bulk' && !numberId && devicesList.length === 0 && !isLoadingDevices &&
              <span className="text-red-600 block mt-1">No devices found. Please connect a device.</span>
            }
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Pemilihan Peranti untuk Kempen Pukal jika tiada numberId */} 
            {determinedCampaignType === 'bulk' && !numberId && (
              <div className="space-y-2">
                <Label htmlFor="selectedDevice">Select Device for Bulk Campaign</Label>
                <Select 
                    value={selectedDeviceId}
                    onValueChange={setSelectedDeviceId}
                    disabled={isLoadingDevices || devicesList.length === 0}
                >
                    <SelectTrigger id="selectedDevice">
                        <SelectValue placeholder={isLoadingDevices ? "Loading devices..." : "Select a device"} />
                    </SelectTrigger>
                    <SelectContent>
                        {devicesList.map(device => (
                            <SelectItem key={device.id} value={device.id}>
                                {device.name} ({device.number}) {device.connected ? "(Connected)" : "(Disconnected)"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {devicesList.length === 0 && !isLoadingDevices && <p className="text-sm text-muted-foreground">No devices available.</p>}
              </div>
            )}

            {/* Campaign Name */}
             <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                   id="campaignName"
                   name="campaignName"
                   value={formData.campaignName}
                   onChange={handleInputChange}
                   placeholder={determinedCampaignType === 'bulk' ? "e.g., Promosi Jualan Disember" : "e.g., AI Agen Bantuan"}
                   required
                   disabled={isSaving}
                />
             </div>

             {/* Status Enable/Disable */}
             <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                <Label htmlFor="statusEnabled" className="font-medium">Enable Campaign</Label>
                <Switch
                   id="statusEnabled"
                   name="statusEnabled"
                   checked={formData.statusEnabled}
                   onCheckedChange={(checked) => handleSwitchChange(checked, 'statusEnabled')}
                   disabled={isSaving}
                />
             </div>

            {/* URL Link Section */}
             <div className="space-y-3 rounded-lg border p-4">
                 <div className="flex items-center space-x-2">
                    <Checkbox
                        id="enableLink"
                        name="enableLink"
                        checked={formData.enableLink}
                        onCheckedChange={(checked) => handleCheckboxChange(checked, 'enableLink')}
                        disabled={isSaving}
                    />
                     <Label htmlFor="enableLink" className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                         Include URL Link
                     </Label>
                 </div>
                 {formData.enableLink && (
                     <div className="space-y-2 pl-6">
                         <Label htmlFor="urlLink">URL Link</Label>
                         <Input
                            id="urlLink"
                            name="urlLink"
                            type="url"
                            value={formData.urlLink}
                            onChange={handleInputChange}
                            placeholder="https://example.com"
                            disabled={isSaving}
                         />
                     </div>
                 )}
             </div>

             {/* Media File */}
             <div className="space-y-2">
                <Label htmlFor="mediaFile">Media File (Optional)</Label>
                <Input
                   id="mediaFile"
                   name="mediaFile"
                   type="file"
                   onChange={handleFileChange}
                   disabled={isSaving}
                />
                {formData.mediaFile && <p className="text-xs text-muted-foreground">Selected: {formData.mediaFile.name}</p>}
             </div>

             {/* Caption */}
             <div className="space-y-2">
                <Label htmlFor="caption">Message / Caption</Label>
                <Textarea
                   id="caption"
                   name="caption"
                   value={formData.caption}
                   onChange={handleInputChange}
                   placeholder={determinedCampaignType === 'bulk' ? "Enter your bulk message here...\n{name} - nama contact\n{var1} - custom var1" : "Enter default AI reply or context..."}
                   rows={determinedCampaignType === 'bulk' ? 6 : 4}
                   required
                   disabled={isSaving}
                />
             </div>

            {/* Hanya tunjukkan medan AI jika jenis kempen adalah 'ai_chatbot' */}
            {determinedCampaignType === 'ai_chatbot' && (
              <>
                 {/* AI Agent Training */}
                 <div className="space-y-2">
                    <Label htmlFor="aiAgentTraining">AI Agent Training (Optional for AI)</Label>
                    <Textarea
                       id="aiAgentTraining"
                       name="aiAgentTraining"
                       value={formData.aiAgentTraining}
                       onChange={handleInputChange}
                       placeholder="Provide specific instructions or context for the AI..."
                       rows={6}
                       disabled={isSaving}
                    />
                 </div>

                 {/* Use AI Toggle */}
                 <div className="flex items-center space-x-2">
                    <Checkbox
                        id="useAI"
                        name="useAI"
                        checked={formData.useAI}
                        onCheckedChange={(checked) => handleCheckboxChange(checked, 'useAI')}
                        disabled={isSaving}
                    />
                    <Label htmlFor="useAI" className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                         Use AI for Replies
                    </Label>
                 </div>

                 {/* Presence Delay (lebih relevan untuk AI) */}
                <div className="space-y-2">
                    <Label htmlFor="presenceDelay">Presence Delay</Label>
                    <select
                        id="presenceDelay"
                        name="presenceDelay"
                        value={formData.presenceDelay}
                        onChange={handleInputChange}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSaving}
                    >
                        <option value="typing">Typing</option>
                        <option value="recording">Recording</option>
                        <option value="none">None</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                        Simulate user presence (typing/recording) before sending the message.
                     </p>
                 </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving || (determinedCampaignType === 'bulk' && !numberId && !selectedDeviceId)}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Campaign'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(determinedCampaignType === 'bulk' ? '/' : `/ai-chatbot/${numberId || selectedDeviceId}/campaigns`)} className="ml-2" disabled={isSaving}>
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default AddCampaignPage; 