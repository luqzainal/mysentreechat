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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card
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
      console.error("Error getting contacts:", err);
      setError(err.response?.data?.message || "Failed to get contact list.");
      // Mungkin toast error di sini jika mahu
      toast({ title: "Loading Error", description: err.response?.data?.message || "Failed to get contact list.", variant: "destructive" });
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
        toast({ title: "Success", description: `Contact ${newContact.name} has been added.` });

    } catch (err) {
        console.error("Error adding contact:", err);
        const message = err.response?.data?.message || "Failed to add contact.";
        toast({ title: "Error", description: message, variant: "destructive" });
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
        toast({ title: "Success", description: "Contact has been deleted." });

     } catch (err) {
        console.error("Error deleting contact:", err);
        const message = err.response?.data?.message || "Failed to delete contact.";
        toast({ title: "Error", description: message, variant: "destructive" });
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
        title: "Invalid File Format",
        description: "Please select an Excel file (.xlsx or .xls).",
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
        title: "No File Selected",
        description: "Please select an Excel file to upload.",
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
        title: "Upload Complete",
        description: responseData.message, 
      });

      if (responseData.errors && responseData.errors.length > 0) {
          console.warn("Errors during import:", responseData.errors);
          toast({
            title: `There were ${responseData.errors.length} rows skipped`,
            description: "Check the console for more details or download the report.",
            variant: "warning",
            duration: 7000, 
          })
      }

      setSelectedFile(null); 
      fetchContacts();

    } catch (err) {
      console.error("Error uploading contacts:", err);
      const message = err.response?.data?.message || "Failed to upload contact file.";
      toast({ title: "Upload Error", description: message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Contacts</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}> {/* Kawal Dialog */} 
          <DialogTrigger asChild>
            <Button>Add New Contact</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddContact}>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>
                  Enter name and phone number (e.g., 60123456789).
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
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
                  <Label htmlFor="phone" className="text-right">Phone Number</Label>
                  <Input 
                    id="phone"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="601xxxxxxxx"
                    className="col-span-3" 
                    required
                    disabled={isAdding}
                  />
                </div>
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isAdding}>Cancel</Button>
                 </DialogClose>
                <Button type="submit" disabled={isAdding}>
                  {isAdding ? 'Adding...' : 'Add Contact'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bahagian Muat Naik Fail */}
      <Card>
          <CardHeader>
              <CardTitle>Import Contacts from Excel</CardTitle>
              <CardDescription>
                  Upload an Excel file (.xlsx or .xls) with 'Name' and 'PhoneNumber' columns.
              </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <Input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx, .xls" 
                className="hidden"
              />
              <Button onClick={handleChooseFileClick} variant="outline" disabled={isUploading}>
                  <FileText className="mr-2 h-4 w-4" />
                 {selectedFile ? selectedFile.name : 'Choose File'}
              </Button>
               <span className="text-sm text-muted-foreground flex-1 truncate">
                  {selectedFile ? `(${Math.round(selectedFile.size / 1024)} KB)` : "No file chosen"}
               </span>
          </CardContent>
           <CardFooter>
              <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload and Import'}
              </Button>
           </CardFooter>
      </Card>

      {isLoading && <p>Loading contact list...</p>}
      {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      
      {!isLoading && !error && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                        <Button variant="ghost" size="icon" className="hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action will permanently delete the contact '{contact.name}'.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteContact(contact._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">No contacts added yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default ContactPage; 