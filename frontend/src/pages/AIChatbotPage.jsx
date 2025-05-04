import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link
import api from '../services/api'; // Instance Axios
import { useAuth } from '../contexts/AuthContext'; // Untuk check user
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar
import { Switch } from "@/components/ui/switch"; // Import Switch
import { Input } from "@/components/ui/input"; // Import Input for Search
import { Search, Paperclip, Bot as BotIcon, Send, PlusCircle, List, Loader2 } from 'lucide-react'; // Import icons
import { Label } from "@/components/ui/label";

// // Contoh data DIBUANG - akan dimuat dari API
// const dummyConnectedNumbers = [
// ...
// ];

const AutoresponderPage = () => {
  const [connectedNumbers, setConnectedNumbers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState({}); // Track status update per number
  const { user } = useAuth();

  // Gantikan dengan fetch data sebenar
  useEffect(() => {
    const fetchConnectedNumbers = async () => {
      setIsLoading(true);
      try {
        // TODO: Ganti dengan endpoint API sebenar
        // Gunakan searchTerm jika backend menyokong carian server-side
        // const response = await api.get(`/whatsapp/connected-numbers?search=${searchTerm}`);
        // setConnectedNumbers(response.data);

        // Simulasi API Call dengan filter client-side
         const dummyDataFromApi = [
          {
            id: '1',
            name: 'Hadi Client Account Representative',
            number: '601133045231',
            avatarUrl: 'https://avatar.vercel.sh/hadi.png',
            stats: { sent: 0, items: 0 },
            statusEnabled: false,
            needsSetup: true,
          },
          {
            id: '2',
            name: 'Farhana',
            number: '60189634390',
            avatarUrl: 'https://avatar.vercel.sh/farhana.png',
            stats: { sent: 1286, items: 3 },
            statusEnabled: true,
            needsSetup: false,
          },
           {
            id: '3',
            name: 'Support Team',
            number: '60123456789',
            avatarUrl: 'https://avatar.vercel.sh/support.png',
            stats: { sent: 500, items: 1 },
            statusEnabled: true,
            needsSetup: false,
          },
        ];

        // Simulasi delay network
        await new Promise(resolve => setTimeout(resolve, 600));

        const filteredData = dummyDataFromApi.filter(num =>
              num.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              num.number.includes(searchTerm)
          );
         setConnectedNumbers(filteredData);

      } catch (error) {
        console.error("Failed to fetch connected numbers:", error);
        toast.error("Failed to load connected numbers.");
        setConnectedNumbers([]); // Set to empty on error
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
       // Debounce search or fetch directly
       // Untuk kesederhanaan, kita fetch setiap kali searchTerm berubah
       fetchConnectedNumbers();
    } else {
        setIsLoading(false);
        setConnectedNumbers([]);
    }
  }, [user, searchTerm]);

  const handleStatusChange = async (numberId, newStatus) => {
    setIsUpdatingStatus(prev => ({ ...prev, [numberId]: true }));
    console.log(`Updating status for ${numberId} to ${newStatus}`);
    // toast.info(`Updating status for number ${numberId}...`); // Maybe too noisy

    // TODO: Implement API call sebenar
    /*
    try {
        const response = await api.put(`/whatsapp/numbers/${numberId}/status`, { isEnabled: newStatus });
        // Update state dengan data dari response
        setConnectedNumbers(prev => prev.map(num => num.id === numberId ? response.data : num));
        toast.success(`Status updated for ${numberId}.`);
    } catch (error) {
        console.error("Failed to update status:", error);
        toast.error(`Failed to update status for ${numberId}.`);
        // Tidak perlu revert state jika API gagal, biarkan UI tunjuk state asal
    } finally {
        setIsUpdatingStatus(prev => ({ ...prev, [numberId]: false }));
    }
    */

    // Simulasi API call
    await new Promise(resolve => setTimeout(resolve, 700));
    // Update state selepas simulasi berjaya
     setConnectedNumbers(prev =>
       prev.map(num =>
         num.id === numberId ? { ...num, statusEnabled: newStatus } : num
       )
     );
    toast.success(`Status updated for ${numberId} (Simulation).`);
    setIsUpdatingStatus(prev => ({ ...prev, [numberId]: false }));

  };

  // Tunjukkan loader utama hanya semasa muatan awal
  if (isLoading && !searchTerm) {
    return (
        <div className="container mx-auto p-4 flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
       <div className="flex justify-between items-center mb-6">
           <div>
              <h1 className="text-3xl font-bold">AI Chatbot</h1>
              <p className="text-muted-foreground">Manage campaigns and settings for your connected numbers.</p>
            </div>
           {/* Search Bar */}
           <div className="relative w-full max-w-xs">
                <Input
                    type="search"
                    placeholder="Search by name or number..."
                    className="pl-10" // Add padding for icon
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
       </div>

      {/* Grid untuk senarai nombor */}
      {isLoading && searchTerm && (
            <div className="text-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                <p className="mt-2 text-muted-foreground">Searching...</p>
            </div>
      )}
      {!isLoading && connectedNumbers.length === 0 && (
         <div className="text-center py-10">
            <p className="text-muted-foreground">
              {searchTerm ? 'No numbers found matching your search.' : 'No WhatsApp numbers connected yet.'}
            </p>
            {/* Mungkin tambah pautan ke halaman Scan Device jika tiada nombor */}
            {!searchTerm && (
                <Button asChild variant="link" className="mt-2">
                    <Link to="/scan-device">Connect a Number</Link>
                </Button>
            )}
         </div>
      )}

      {!isLoading && connectedNumbers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {connectedNumbers.map((num) => (
            <Card key={num.id} className="flex flex-col overflow-hidden border shadow-sm">
               {/* Header - Guna warna latar belakang kad */}
              <CardHeader className="flex flex-row items-center space-x-3 p-4 border-b bg-card">
                 <Avatar className="h-12 w-12 border">
                     <AvatarImage src={num.avatarUrl} alt={num.name} />
                     <AvatarFallback>{num.name?.substring(0, 1) || '?'}</AvatarFallback>
                 </Avatar>
                 <div className="flex-1">
                     {/* Guna warna teks utama */}
                     <CardTitle className="text-lg text-card-foreground">{num.name}</CardTitle>
                     {/* Guna warna teks muted */}
                     <CardDescription className="text-muted-foreground">{num.number}</CardDescription>
                 </div>
                 {/* Icon Bot - Guna warna muted */}
                 <BotIcon className="h-10 w-10 text-muted-foreground/50" />
              </CardHeader>

              {/* Content - Statistik (sudah guna bg-muted) */}
              <CardContent className="grid grid-cols-2 gap-4 p-4 bg-card flex-grow">
                 {/* Stat Sent */}
                 <div className="bg-muted rounded-lg p-4 text-center text-muted-foreground">
                      <Send className="h-6 w-6 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-semibold text-card-foreground">{num.stats.sent}</p>
                      <p className="text-sm">Sent</p>
                 </div>
                  {/* Stat Items (Campaigns) */}
                 <div className="bg-muted rounded-lg p-4 text-center text-muted-foreground">
                      <Paperclip className="h-6 w-6 text-red-500 mx-auto mb-2" />
                      <p className="text-2xl font-semibold text-card-foreground">{num.stats.items}</p>
                      <p className="text-sm">Campaigns</p>
                 </div>
              </CardContent>

               {/* Status Toggle / Setup Message (sudah guna bg-card) */}
              <CardContent className="p-4 bg-card">
                  {num.needsSetup ? (
                      <div className="border border-border rounded-md p-3 text-center text-sm text-muted-foreground">
                          Please add at least a chatbot campaign and enable it to can start.
                       </div>
                  ) : (
                      <div className="flex items-center justify-between space-x-2 rounded-lg border border-border p-3">
                          <Label htmlFor={`status-switch-${num.id}`} className="font-medium text-card-foreground">Status</Label>
                          <Switch
                              id={`status-switch-${num.id}`}
                              checked={num.statusEnabled}
                              onCheckedChange={(checked) => handleStatusChange(num.id, checked)}
                              disabled={isUpdatingStatus[num.id]} // Disable semasa update
                           />
                      </div>
                  )}
              </CardContent>

              {/* Footer - Butang (sudah guna bg-card) */}
              <CardFooter className="flex justify-between gap-3 p-4 bg-card border-t border-border">
                 {/* Tukar Add Item -> Add Campaign */}
                 <Button asChild className="flex-1" variant="default">
                     {/* Pautan perlu dinamik berdasarkan ID nombor */}
                     <Link to={`/ai-chatbot/${num.id}/campaigns/create`}>
                         <PlusCircle className="mr-2 h-4 w-4" /> Add Campaign
                     </Link>
                 </Button>
                 {/* Tukar Item list -> Campaign List */}
                 <Button asChild className="flex-1" variant="outline">
                      {/* Pautan perlu dinamik berdasarkan ID nombor */}
                     <Link to={`/ai-chatbot/${num.id}/campaigns`}>
                         <List className="mr-2 h-4 w-4" /> Campaign List
                     </Link>
                 </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutoresponderPage; 