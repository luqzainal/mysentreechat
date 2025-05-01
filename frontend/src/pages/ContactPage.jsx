import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios'; // Buang import axios langsung
import api from '../services/api'; // Import instance api

// Import komponen shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast"; 
import { Toaster } from "@/components/ui/toaster";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card
import { Trash2, Upload, FileText } from 'lucide-react'; // Tambah Upload, FileText

function ContactPage() {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State untuk borang tambah
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); // Kawal dialog tambah
  const [selectedFile, setSelectedFile] = useState(null); // State untuk fail dipilih
  const [isUploading, setIsUploading] = useState(false); // State untuk status muat naik

  const { toast } = useToast();
  // const [userInfo, setUserInfo] = useState(null); // Tidak digunakan, boleh buang jika mahu
  const fileInputRef = useRef(null);

  // Fungsi untuk dapatkan token (kini tidak perlu jika interceptor berfungsi)
  // const getToken = () => { ... };

  // Fungsi untuk dapatkan semua kenalan
  const fetchContacts = async () => {
    setIsLoading(true);
    setError(null);
    // Token akan ditambah oleh interceptor dalam 'api'
    // const token = getToken(); 
    // if (!token) { ... }

    try {
      // Guna instance api dan path relatif
      // const config = { headers: { Authorization: `Bearer ${token}` } }; // Tak perlu config jika interceptor ada
      const { data } = await api.get('/contacts'); // Tukar axios.get ke api.get
      setContacts(data);
    } catch (err) {
      console.error("Ralat mendapatkan kenalan:", err);
      setError(err.response?.data?.message || "Gagal mendapatkan senarai kenalan.");
      // Mungkin toast error di sini jika mahu
      toast({ title: "Ralat Memuatkan", description: err.response?.data?.message || "Gagal mendapatkan senarai kenalan.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Panggil fetchContacts semasa komponen dimuatkan
  useEffect(() => {
    fetchContacts();
    // const storedUserInfo = localStorage.getItem('userInfo'); // Tidak digunakan
    // if (storedUserInfo) setUserInfo(JSON.parse(storedUserInfo)); // Tidak digunakan
  }, []);

  // Fungsi untuk menambah kenalan
  const handleAddContact = async (e) => {
    e.preventDefault();
    setIsAdding(true);
    setError(null);
    // Token ditambah oleh interceptor
    // const token = getToken();
    // if (!token) { ... }

    try {
        // const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }; // Tak perlu
        const payload = { name: newContactName, phoneNumber: newContactPhone };
        // Guna instance api dan path relatif
        const { data: newContact } = await api.post('/contacts', payload);
        
        setContacts([...contacts, newContact]);
        setNewContactName(''); 
        setNewContactPhone('');
        setIsAddDialogOpen(false);
        toast({ title: "Berjaya", description: `Kenalan ${newContact.name} telah ditambah.` });

    } catch (err) {
        console.error("Ralat menambah kenalan:", err);
        const message = err.response?.data?.message || "Gagal menambah kenalan.";
        toast({ title: "Ralat", description: message, variant: "destructive" });
    } finally {
        setIsAdding(false);
    }
  };

  // Fungsi untuk memadam kenalan
  const handleDeleteContact = async (contactId) => {
     setError(null);
     // Token ditambah oleh interceptor
     // const token = getToken();
     // if (!token) { ... }

     try {
        // const config = { headers: { Authorization: `Bearer ${token}` } }; // Tak perlu
        // Guna instance api dan path relatif
        await api.delete(`/contacts/${contactId}`);
        
        setContacts(contacts.filter(contact => contact._id !== contactId));
        toast({ title: "Berjaya", description: "Kenalan telah dipadam." });

     } catch (err) {
        console.error("Ralat memadam kenalan:", err);
        const message = err.response?.data?.message || "Gagal memadam kenalan.";
        toast({ title: "Ralat", description: message, variant: "destructive" });
     }
  };

  // Fungsi untuk handle perubahan fail dipilih
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel')) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
      toast({
        title: "Format Fail Tidak Sah",
        description: "Sila pilih fail Excel (.xlsx atau .xls).",
        variant: "destructive",
      });
    }
  };

  // Fungsi untuk trigger klik pada input fail tersembunyi
  const handleChooseFileClick = () => {
    fileInputRef.current.click();
  };

  // Fungsi untuk memuat naik fail
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Tiada Fail Dipilih",
        description: "Sila pilih fail Excel untuk dimuat naik.",
        variant: "warning", // Guna variant warning
      });
      return;
    }

    setIsUploading(true);
    // Token ditambah oleh interceptor
    // const token = getToken();
    // if (!token) { ... }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Guna instance api dan path relatif
      // Config header Content-Type multipart/form-data mungkin perlu ditambah
      // jika interceptor tidak handle atau jika perlu override
      const config = {
        headers: {
          // Authorization akan ditambah oleh interceptor
          'Content-Type': 'multipart/form-data',
        },
      };
      const { data: responseData } = await api.post('/contacts/upload', formData, config);

      toast({
        title: "Muat Naik Selesai",
        description: responseData.message, 
      });

      if (responseData.errors && responseData.errors.length > 0) {
          console.warn("Ralat semasa import:", responseData.errors);
          toast({
            title: `Terdapat ${responseData.errors.length} baris diabaikan`,
            description: "Semak konsol untuk maklumat lanjut atau muat turun laporan.",
            variant: "warning",
            duration: 7000, 
          })
      }

      setSelectedFile(null); 
      fetchContacts();

    } catch (err) {
      console.error("Ralat memuat naik kenalan:", err);
      const message = err.response?.data?.message || "Gagal memuat naik fail kenalan.";
      toast({ title: "Ralat Muat Naik", description: message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Urus Kenalan</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}> {/* Kawal Dialog */} 
          <DialogTrigger asChild>
            <Button>Tambah Kenalan Baru</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddContact}>
              <DialogHeader>
                <DialogTitle>Tambah Kenalan Baru</DialogTitle>
                <DialogDescription>
                  Masukkan nama dan nombor telefon (cth., 60123456789).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nama</Label>
                  <Input 
                    id="name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="col-span-3" 
                    required 
                    disabled={isAdding}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Nombor Telefon</Label>
                  <Input 
                    id="phone"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="col-span-3" 
                    placeholder="601xxxxxxxx"
                    required
                    disabled={isAdding}
                  />
                </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isAdding}>Batal</Button>
                 </DialogClose>
                <Button type="submit" disabled={isAdding}>
                  {isAdding ? "Menambah..." : "Tambah Kenalan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bahagian Muat Naik Fail */}
      <Card>
          <CardHeader>
              <CardTitle>Muat Naik Kenalan Pukal</CardTitle>
              <CardDescription>
                  Tambah kenalan dari fail Excel (.xlsx). Pastikan fail mempunyai lajur "Nama" dan "Nombor Telefon".
              </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {/* Input fail tersembunyi */}
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".xlsx, .xls" 
                  className="hidden" 
              />
              {/* Butang untuk trigger input fail */}
              <Button variant="outline" onClick={handleChooseFileClick} disabled={isUploading}>
                  <FileText className="mr-2 h-4 w-4" /> Pilih Fail Excel
              </Button>
              {/* Papar nama fail dipilih */}
              {selectedFile && (
                  <div className="text-sm text-muted-foreground">
                      Fail dipilih: <strong>{selectedFile.name}</strong>
                  </div>
              )}
              {/* Butang Muat Naik */}
              <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
                  <Upload className="mr-2 h-4 w-4" /> {isUploading ? 'Memuat Naik...' : 'Muat Naik Fail'}
              </Button>
          </CardContent>
      </Card>

      {isLoading && <p>Memuatkan senarai kenalan...</p>}
      {error && <Alert variant="destructive"><AlertTitle>Ralat</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      
      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Nombor Telefon</TableHead>
              <TableHead className="text-right">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length > 0 ? (
              contacts.map((contact) => (
                <TableRow key={contact._id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.phoneNumber}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm"> {/* Icon Trash2 di sini */} Padam</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Anda pasti?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini tidak boleh diundur. Ini akan memadam kenalan '{contact.name}' secara kekal.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteContact(contact._id)}>
                            Teruskan Padam
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">Tiada kenalan ditemui.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default ContactPage; 