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
    prompt: 'Anda adalah pembantu AI yang mesra. Balas mesej ini secara ringkas.',
    savedResponses: [], // Tambah state awal
  });
  const [newResponse, setNewResponse] = useState(""); // State untuk input respons baru
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagingResponse, setIsManagingResponse] = useState(false); // State loading untuk operasi respons
  const { user } = useAuth();

  // Fetch tetapan semasa komponen dimuatkan
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/autoresponder/settings');
        setSettings(response.data || { // Handle jika tiada data
          isEnabled: false,
          openaiApiKey: '',
          prompt: 'Anda adalah pembantu AI yang mesra. Balas mesej ini secara ringkas.',
          savedResponses: [],
        });
      } catch (error) {
        console.error("Gagal mendapatkan tetapan autoresponder:", error);
        toast.error("Gagal memuatkan tetapan autoresponder.");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchSettings();
    }
  }, [user]);

  // Kendalikan perubahan pada input form utama
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

   // Kendalikan perubahan pada Switch shadcn/ui
  const handleSwitchChange = (checked) => {
     setSettings(prev => ({
       ...prev,
       isEnabled: checked,
     }));
  };

  // Simpan tetapan utama ke backend
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Hanya hantar field yang relevan untuk PUT /settings
      const settingsToUpdate = {
        isEnabled: settings.isEnabled,
        openaiApiKey: settings.openaiApiKey,
        prompt: settings.prompt,
      };
      const response = await api.put('/autoresponder/settings', settingsToUpdate);
      // Kemaskini SEMUA state settings termasuk savedResponses yang mungkin berubah oleh operasi lain
      setSettings(response.data);
      toast.success("Tetapan autoresponder berjaya disimpan.");
    } catch (error) {
      console.error("Gagal menyimpan tetapan autoresponder:", error);
      const errorMessage = error.response?.data?.message || "Ralat semasa menyimpan tetapan.";
      toast.error(`Gagal menyimpan: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Fungsi baru: Tambah Saved Response
  const handleAddResponse = async () => {
      if (!newResponse.trim()) {
          toast.warning("Sila masukkan teks respons.");
          return;
      }
      setIsManagingResponse(true);
      try {
          const response = await api.post('/autoresponder/responses', { response: newResponse });
          // Kemaskini hanya array savedResponses dalam state
          setSettings(prev => ({ ...prev, savedResponses: response.data }));
          setNewResponse(""); // Kosongkan input selepas berjaya
          toast.success("Respons berjaya disimpan.");
      } catch (error) {
          console.error("Gagal menambah respons:", error);
          const errorMessage = error.response?.data?.message || "Ralat semasa menyimpan respons.";
          toast.error(`Gagal menyimpan: ${errorMessage}`);
      } finally {
          setIsManagingResponse(false);
      }
  };

  // Fungsi baru: Padam Saved Response
  const handleRemoveResponse = async (responseToDelete) => {
      setIsManagingResponse(true);
      try {
          // Encode response untuk URL query
          const encodedResponse = encodeURIComponent(responseToDelete);
          const response = await api.delete(`/autoresponder/responses?response=${encodedResponse}`);
          // Kemaskini hanya array savedResponses dalam state
          setSettings(prev => ({ ...prev, savedResponses: response.data }));
          toast.success("Respons berjaya dipadam.");
      } catch (error) {
          console.error("Gagal memadam respons:", error);
          const errorMessage = error.response?.data?.message || "Ralat semasa memadam respons.";
          toast.error(`Gagal memadam: ${errorMessage}`);
      } finally {
          setIsManagingResponse(false);
      }
  };


  if (isLoading) {
    return <div className="container mx-auto p-4">Memuatkan tetapan...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Wrapper untuk mengehadkan lebar dan memusatkan */}
      <div className="max-w-3xl mx-auto space-y-6"> 
          {/* Kad Tetapan Utama */}
          <Card>
            <CardHeader>
              <CardTitle>Tetapan Autoresponder + AI</CardTitle>
              <CardDescription>
                Konfigurasi balasan mesej automatik menggunakan OpenAI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Aktifkan Autoresponder */}
              <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                 <div className="space-y-0.5">
                     <Label htmlFor="autoresponder-switch" className="text-base">Aktifkan Autoresponder</Label>
                     <CardDescription>
                     Hidupkan untuk membalas mesej WhatsApp secara automatik.
                     </CardDescription>
                 </div>
                 <Switch
                    id="autoresponder-switch"
                    checked={settings.isEnabled}
                    onCheckedChange={handleSwitchChange}
                    disabled={isSaving || isManagingResponse} // Disable jika sedang save/manage
                 />
              </div>

              {/* Tetapan hanya dipaparkan jika autoresponder diaktifkan */}
              {settings.isEnabled && (
                <div className="space-y-4">
                  {/* OpenAI API Key */}
                  <div className="space-y-2">
                    <Label htmlFor="openaiApiKey">Kunci API OpenAI</Label>
                     <Input
                        id="openaiApiKey"
                        name="openaiApiKey"
                        type="password"
                        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={settings.openaiApiKey || ''} // Pastikan value tidak undefined
                        onChange={handleChange}
                        disabled={isSaving || isManagingResponse}
                     />
                     <p className="text-sm text-muted-foreground">
                        Dapatkan kunci API anda dari <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="underline">laman web OpenAI</a>.
                     </p>
                  </div>

                  {/* Prompt AI */}
                  <div className="space-y-2">
                    <Label htmlFor="prompt">Prompt AI</Label>
                     <Textarea
                        id="prompt"
                        name="prompt"
                        placeholder="Terangkan bagaimana AI patut membalas..."
                        value={settings.prompt}
                        onChange={handleChange}
                        rows={5}
                        disabled={isSaving || isManagingResponse}
                     />
                     <p className="text-sm text-muted-foreground">
                       Arahan yang diberikan kepada AI untuk menjana balasan.
                     </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings} disabled={isSaving || isManagingResponse || !settings.isEnabled}>
                {isSaving ? 'Menyimpan...' : 'Simpan Tetapan'}
              </Button>
            </CardFooter>
          </Card>

           {/* Kad Pengurusan Respons Tersimpan */}
          <Card>
              <CardHeader>
                  <CardTitle>Respons Tersimpan</CardTitle>
                  <CardDescription>
                     Tambah dan urus templat respons pantas atau rujukan AI.
                  </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                   {/* Input untuk tambah respons baru */}
                   <div className="space-y-2">
                       <Label htmlFor="newResponse">Tambah Respons Baru</Label>
                       <Textarea
                           id="newResponse"
                           placeholder="Masukkan teks respons di sini..."
                           value={newResponse}
                           onChange={(e) => setNewResponse(e.target.value)}
                           rows={3}
                           disabled={isManagingResponse || isSaving}
                       />
                       {/* Tambah Penerangan Spintax */}
                       <p className="text-xs text-muted-foreground">
                           Anda boleh guna format Spintax <code className="bg-muted px-1 py-0.5 rounded">{'{'}a|b{'}'}</code> untuk variasi rawak.
                       </p>
                       <Button size="sm" onClick={handleAddResponse} disabled={isManagingResponse || isSaving || !newResponse.trim()}>
                           {isManagingResponse ? 'Menyimpan...' : 'Simpan Respons'}
                       </Button>
                   </div>

                   {/* Senarai respons tersimpan */}
                   <div className="space-y-2">
                       <Label>Senarai Respons Sedia Ada</Label>
                       {settings.savedResponses && settings.savedResponses.length > 0 ? (
                           <ScrollArea className="h-48 w-full rounded-md border p-4">
                               <div className="space-y-2">
                                   {settings.savedResponses.map((resp, index) => (
                                       <div key={index} className="flex items-center justify-between p-2 rounded bg-muted/50">
                                           <p className="text-sm flex-1 mr-2">{resp}</p>
                                           {/* Butang Padam dengan Dialog Pengesahan */}
                                           <AlertDialog>
                                               <AlertDialogTrigger asChild>
                                                   <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isManagingResponse || isSaving}>
                                                       <Trash2 className="h-4 w-4 text-red-500" />
                                                   </Button>
                                               </AlertDialogTrigger>
                                               <AlertDialogContent>
                                                   <AlertDialogHeader>
                                                       <AlertDialogTitle>Anda Pasti?</AlertDialogTitle>
                                                       <AlertDialogDescription>
                                                           Tindakan ini akan memadam respons yang disimpan secara kekal: "{resp.length > 50 ? resp.substring(0, 50) + '...' : resp}"
                                                       </AlertDialogDescription>
                                                   </AlertDialogHeader>
                                                   <AlertDialogFooter>
                                                       <AlertDialogCancel disabled={isManagingResponse}>Batal</AlertDialogCancel>
                                                       <AlertDialogAction
                                                            onClick={() => handleRemoveResponse(resp)}
                                                            disabled={isManagingResponse}
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            Padam
                                                        </AlertDialogAction>
                                                   </AlertDialogFooter>
                                               </AlertDialogContent>
                                           </AlertDialog>
                                       </div>
                                   ))}
                               </div>
                           </ScrollArea>
                       ) : (
                           <p className="text-sm text-muted-foreground italic">Tiada respons disimpan lagi.</p>
                       )}
                   </div>
              </CardContent>
          </Card>
      </div>
    </div>
  );
};

export default AutoresponderPage; 