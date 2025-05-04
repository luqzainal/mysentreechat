import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import hooks
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

function AddCampaignPage() {
  const { numberId } = useParams();
  const navigate = useNavigate();
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
    setIsSaving(true);
    console.log("Form Data to Submit:", formData);
    toast.info("Saving campaign...");

    // Membina FormData untuk penghantaran API
    const dataToSend = new FormData();
    Object.keys(formData).forEach(key => {
        // Khas untuk fail, append terus objek fail
        if (key === 'mediaFile' && formData[key]) {
            dataToSend.append(key, formData.mediaFile);
        } else if (key !== 'mediaFile') {
            // Untuk boolean atau nilai lain, pastikan ia string jika perlu
            // API mungkin jangkakan boolean sebagai string "true"/"false" atau integer 0/1
             if (typeof formData[key] === 'boolean') {
                 dataToSend.append(key, formData[key].toString());
             } else {
                 dataToSend.append(key, formData[key]);
             }
        }
    });

    // Papar kandungan FormData (untuk debug sahaja)
    /*
    for (let [key, value] of dataToSend.entries()) {
        console.log(`${key}:`, value);
    }
    */

    // TODO: Implement API call sebenar dengan dataToSend
    /*
    try {
        // Endpoint perlu disesuaikan
        const response = await api.post(`/ai-chatbot/${numberId}/campaigns`, dataToSend, {
             headers: {
                // Content-Type biasanya ditetapkan secara automatik oleh browser/axios apabila menggunakan FormData
                // 'Content-Type': 'multipart/form-data', 
            },
        });
        toast.success("Campaign saved successfully!");
        navigate(`/ai-chatbot/${numberId}/campaigns`);
    } catch (error) {
        console.error("Failed to save campaign:", error);
        const errorMessage = error.response?.data?.message || "Error saving campaign.";
        toast.error(`Save failed: ${errorMessage}`);
    } finally {
        setIsSaving(false);
    }
    */

    // Simulasi save
    setTimeout(() => {
        toast.success("Campaign saved successfully! (Simulation)");
        setIsSaving(false);
        navigate(`/ai-chatbot/${numberId}/campaigns`); // Redirect selepas simulasi
    }, 1500);
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Add New Campaign</CardTitle>
          <CardDescription>Create a new AI chatbot campaign for number ID: {numberId}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
             {/* Campaign Name */}
             <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                   id="campaignName"
                   name="campaignName"
                   value={formData.campaignName}
                   onChange={handleInputChange}
                   placeholder="e.g., Promo Hari Raya"
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
                <Label htmlFor="caption">Caption</Label>
                <Textarea
                   id="caption"
                   name="caption"
                   value={formData.caption}
                   onChange={handleInputChange}
                   placeholder="Enter message caption..."
                   rows={4}
                   disabled={isSaving}
                />
             </div>

             {/* AI Agent Training */}
             <div className="space-y-2">
                <Label htmlFor="aiAgentTraining">AI Agent Training (Optional)</Label>
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

             {/* Presence Delay */}
            <div className="space-y-2">
                <Label htmlFor="presenceDelay">Presence Delay</Label>
                 {/* TODO: Tukar kepada Select component dari shadcn jika perlu */}
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

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                 <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                 'Save Campaign'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/ai-chatbot/${numberId}/campaigns`)} className="ml-2" disabled={isSaving}>
              Cancel
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default AddCampaignPage; 