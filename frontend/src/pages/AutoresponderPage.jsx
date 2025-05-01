import React, { useState, useEffect } from 'react';
import api from '../services/api'; // Instance Axios
import { useAuth } from '../contexts/AuthContext'; // Untuk check user
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
// Import komponen baru
import { ScrollArea } from "@/components/ui/scroll-area"; // Untuk senarai jika panjang
import { Badge } from "@/components/ui/badge"; // Untuk papar respons
import { Trash2 } from 'lucide-react'; // Ikon padam
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


const AutoresponderPage = () => {
  const [settings, setSettings] = useState({
    isEnabled: false,
    openaiApiKey: '',
    prompt: 'You are a friendly AI assistant. Reply to this message briefly.',
    savedResponses: [],
  });
  const [newResponse, setNewResponse] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagingResponse, setIsManagingResponse] = useState(false);
  const { user } = useAuth();

  // Fetch settings when component mounts
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/autoresponder/settings');
        setSettings(response.data || {
          isEnabled: false,
          openaiApiKey: '',
          prompt: 'You are a friendly AI assistant. Reply to this message briefly.',
          savedResponses: [],
        });
      } catch (error) {
        console.error("Failed to get autoresponder settings:", error);
        toast.error("Failed to load autoresponder settings.");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchSettings();
    }
  }, [user]);

  // Handle changes in the main form inputs
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

   // Handle changes in the shadcn/ui Switch
  const handleSwitchChange = (checked) => {
     setSettings(prev => ({
       ...prev,
       isEnabled: checked,
     }));
  };

  // Save main settings to backend
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Only send relevant fields for PUT /settings
      const settingsToUpdate = {
        isEnabled: settings.isEnabled,
        openaiApiKey: settings.openaiApiKey,
        prompt: settings.prompt,
      };
      const response = await api.put('/autoresponder/settings', settingsToUpdate);
      // Update ALL settings state including savedResponses that might have changed from other operations
      setSettings(response.data);
      toast.success("Autoresponder settings saved successfully.");
    } catch (error) {
      console.error("Failed to save autoresponder settings:", error);
      const errorMessage = error.response?.data?.message || "Error saving settings.";
      toast.error(`Save failed: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // New function: Add Saved Response
  const handleAddResponse = async () => {
      if (!newResponse.trim()) {
          toast.warning("Please enter response text.");
          return;
      }
      setIsManagingResponse(true);
      try {
          const response = await api.post('/autoresponder/responses', { response: newResponse });
          // Update only the savedResponses array in the state
          setSettings(prev => ({ ...prev, savedResponses: response.data }));
          setNewResponse("");
          toast.success("Response saved successfully.");
      } catch (error) {
          console.error("Failed to add response:", error);
          const errorMessage = error.response?.data?.message || "Error saving response.";
          toast.error(`Save failed: ${errorMessage}`);
      } finally {
          setIsManagingResponse(false);
      }
  };

  // New function: Delete Saved Response
  const handleRemoveResponse = async (responseToDelete) => {
      setIsManagingResponse(true);
      try {
          // Encode response for URL query
          const encodedResponse = encodeURIComponent(responseToDelete);
          const response = await api.delete(`/autoresponder/responses?response=${encodedResponse}`);
          // Update only the savedResponses array in the state
          setSettings(prev => ({ ...prev, savedResponses: response.data }));
          toast.success("Response deleted successfully.");
      } catch (error) {
          console.error("Failed to delete response:", error);
          const errorMessage = error.response?.data?.message || "Error deleting response.";
          toast.error(`Delete failed: ${errorMessage}`);
      } finally {
          setIsManagingResponse(false);
      }
  };


  if (isLoading) {
    return <div className="container mx-auto p-4">Loading settings...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Wrapper to limit width and center content */}
      <div className="max-w-3xl mx-auto space-y-6"> 
          {/* Main Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Autoresponder + AI Settings</CardTitle>
              <CardDescription>
                Configure automatic message replies using OpenAI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Autoresponder */}
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                 <div className="space-y-0.5">
                     <Label htmlFor="autoresponder-switch" className="text-base">Enable Autoresponder</Label>
                     <CardDescription>
                     Turn on to automatically reply to WhatsApp messages.
                     </CardDescription>
                 </div>
                 <Switch
                    id="autoresponder-switch"
                    checked={settings.isEnabled}
                    onCheckedChange={handleSwitchChange}
                    disabled={isSaving || isManagingResponse}
                 />
              </div>

              {/* Settings only shown if autoresponder is enabled */}
              {settings.isEnabled && (
                <div className="space-y-4">
                  {/* OpenAI API Key */}
                  <div className="space-y-2">
                    <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                     <Input
                        id="openaiApiKey"
                        name="openaiApiKey"
                        type="password"
                        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={settings.openaiApiKey || ''}
                        onChange={handleChange}
                        disabled={isSaving || isManagingResponse}
                     />
                     <p className="text-sm text-muted-foreground">
                        Get your API key from the <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI website</a>.
                     </p>
                  </div>

                  {/* AI Prompt */}
                  <div className="space-y-2">
                    <Label htmlFor="prompt">AI Prompt</Label>
                     <Textarea
                        id="prompt"
                        name="prompt"
                        placeholder="Describe how the AI should respond..."
                        value={settings.prompt}
                        onChange={handleChange}
                        rows={5}
                        disabled={isSaving || isManagingResponse}
                     />
                     <p className="text-sm text-muted-foreground">
                       Instructions given to the AI to generate replies.
                     </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings} disabled={isSaving || isManagingResponse || !settings.isEnabled}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardFooter>
          </Card>

           {/* Saved Responses Management Card */}
          <Card>
              <CardHeader>
                  <CardTitle>Saved Responses</CardTitle>
                  <CardDescription>
                     Add and manage quick response templates or AI references.
                  </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                   {/* Input to add new response */}
                   <div className="space-y-2">
                       <Label htmlFor="newResponse">Add New Response</Label>
                       <Textarea
                           id="newResponse"
                           placeholder="Enter response text here..."
                           value={newResponse}
                           onChange={(e) => setNewResponse(e.target.value)}
                           rows={3}
                           disabled={isManagingResponse || isSaving}
                       />
                       {/* Add Spintax Description */}
                       <p className="text-xs text-muted-foreground">
                           You can use Spintax format <code className="bg-muted px-1 py-0.5 rounded">{"{" + "a|b" + "}"}</code> for random variations.
                       </p>
                   </div>
                   <Button onClick={handleAddResponse} disabled={isManagingResponse || isSaving || !newResponse.trim()}>
                        {isManagingResponse ? 'Adding...' : 'Add Response'}
                   </Button>

                   {/* List of saved responses */}
                   <div className="space-y-2">
                       <Label>Current Saved Responses</Label>
                       {settings.savedResponses && settings.savedResponses.length > 0 ? (
                           <ScrollArea className="h-40 w-full rounded-md border p-3">
                               <div className="space-y-2">
                                   {settings.savedResponses.map((resp, index) => (
                                       <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50">
                                           <span className="flex-1 truncate" title={resp}>{resp}</span>
                                           <Badge className="bg-muted text-muted-foreground">
                                               <AlertDialog>
                                                   <AlertDialogTrigger asChild>
                                                       <Button variant="ghost" size="icon" className="h-6 w-6" disabled={isManagingResponse || isSaving}>
                                                           <Trash2 className="h-4 w-4 text-destructive" />
                                                       </Button>
                                                   </AlertDialogTrigger>
                                                   <AlertDialogContent>
                                                       <AlertDialogHeader>
                                                           <AlertDialogTitle>Delete Saved Response?</AlertDialogTitle>
                                                           <AlertDialogDescription>
                                                               This action will permanently delete the response: "{resp}".
                                                           </AlertDialogDescription>
                                                       </AlertDialogHeader>
                                                       <AlertDialogFooter>
                                                           <AlertDialogCancel disabled={isManagingResponse}>Cancel</AlertDialogCancel>
                                                           <AlertDialogAction 
                                                             onClick={() => handleRemoveResponse(resp)}
                                                             disabled={isManagingResponse}
                                                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                           >
                                                             {isManagingResponse ? 'Deleting...' : 'Delete'}
                                                           </AlertDialogAction>
                                                       </AlertDialogFooter>
                                                   </AlertDialogContent>
                                               </AlertDialog>
                                           </Badge>
                                       </div>
                                   ))}
                               </div>
                           </ScrollArea>
                       ) : (
                           <p className="text-sm text-muted-foreground text-center py-4">No saved responses yet.</p>
                       )}
                   </div>
              </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default AutoresponderPage; 