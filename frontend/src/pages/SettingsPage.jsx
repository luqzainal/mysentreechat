import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from '../services/api'; // Import API service
import { useAuth } from '../contexts/AuthContext';

function SettingsPage() {
  const { user } = useAuth();
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // TODO: Fetch existing settings (API key) when component mounts
  useEffect(() => {
      const fetchSettings = async () => {
        setIsLoading(true);
        /* Replace with actual API call
        try {
           // Assume endpoint /settings/ai or similar
           const response = await api.get('/settings/ai'); 
           setOpenaiApiKey(response.data.openaiApiKey || '');
         } catch (error) {
           console.error("Failed to fetch AI settings:", error);
           // Don't necessarily need a toast here unless it's critical
         } finally {
           setIsLoading(false);
         }
         */
         // Simulation
         setTimeout(() => {
             // setOpenaiApiKey('sk-xxxxxxxxxxxxxxxxx'); // Simulate fetching existing key
             setIsLoading(false);
         }, 500);
       };

      if(user) {
          fetchSettings();
      }

  }, [user]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    toast.info("Saving AI settings...");

    // TODO: Implement API call to save the OpenAI API key
    /*
    try {
      await api.put('/settings/ai', { openaiApiKey });
      toast.success("AI settings saved successfully.");
    } catch (error) {
       console.error("Failed to save AI settings:", error);
       const errorMessage = error.response?.data?.message || "Error saving settings.";
       toast.error(`Save failed: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
    */

    // Simulation
    setTimeout(() => {
        toast.success("AI settings saved successfully! (Simulation)");
        setIsSaving(false);
    }, 1000);
  };

  if (isLoading) {
      return <div className="container mx-auto p-4">Loading settings...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
          <CardDescription>
            Manage your OpenAI API key for AI features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
            <Input
              id="openaiApiKey"
              name="openaiApiKey"
              type="password"
              placeholder="Enter your OpenAI API key (e.g., sk-...)"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              disabled={isSaving}
            />
            <p className="text-sm text-muted-foreground">
              Your API key is stored securely. Get your key from the{' '}
              <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                OpenAI website
              </a>.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveSettings} disabled={isSaving || !openaiApiKey}>
            {isSaving ? 'Saving...' : 'Save API Key'}
          </Button>
        </CardFooter>
      </Card>

      {/* Boleh tambah Kad Tetapan lain di sini jika perlu */}

    </div>
  );
}

export default SettingsPage; 