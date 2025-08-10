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
import { Trash2, Upload, FileText, Users, PlusCircle, Edit3, XCircle, UserMinus, Download } from 'lucide-react'; // Tambah Edit3, XCircle, UserMinus, Download
import { Badge } from "@/components/ui/badge"; // Import Badge

// Import Refresh Button
import RefreshButton from '../components/RefreshButton';
// Import Excel Templates
import { generateContactTemplate, validateExcelFile } from '../utils/excelTemplates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // State untuk Kumpulan Kenalan
  const [contactGroups, setContactGroups] = useState([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(''); // Untuk filter atau tambah ke group
  const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // State untuk AlertDialog padam group
  const [isDeleteGroupDialogOpen, setIsDeleteGroupDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // State untuk AlertDialog alih keluar contact dari group
  const [isRemoveContactDialogOpen, setIsRemoveContactDialogOpen] = useState(false);
  const [contactToRemove, setContactToRemove] = useState(null); // { contactId: string, contactName: string, groupId: string, groupName: string }
  const [isRemovingContact, setIsRemovingContact] = useState(false);

  // State untuk Upload Dialog
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const { toast } = useToast();
  // const [userInfo, setUserInfo] = useState(null); // Tidak digunakan, boleh buang jika mahu
  const fileInputRef = useRef(null);

  // Fungsi untuk dapatkan token (kini tidak perlu jika interceptor berfungsi)
  // const getToken = () => { ... };

  // Fungsi untuk dapatkan semua kenalan
  const fetchContacts = async (groupId = null) => { // Terima groupId sebagai parameter
    setIsLoading(true);
    setError(null);
    try {
      // Jika groupId ada, dapatkan kenalan dalam group. Jika tidak, dapatkan semua kenalan.
      const url = groupId ? `/contact-groups/${groupId}/contacts` : '/contacts';
      const { data } = await api.get(url);
      setContacts(data);
      // Jika kita memuatkan kenalan untuk group tertentu, kita boleh set selectedGroupId
      // Tetapi lebih baik kawal selectedGroupId melalui tindakan pengguna (klik pada group)
    } catch (err) {
      console.error("Error getting contacts:", err);
      const msg = err.response?.data?.message || "Failed to get contact list.";
      setError(msg);
      toast({ title: "Loading Error", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk dapatkan semua kumpulan kenalan
  const fetchContactGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const { data } = await api.get('/contact-groups');
      setContactGroups(data);
      if (data.length > 0 && !selectedGroupId) {
        // Boleh pilih group pertama secara default jika mahu, atau biarkan "All Contacts"
        // setSelectedGroupId(data[0]._id); 
      }
    } catch (err) {
      console.error("Error getting contact groups:", err);
      toast({ title: "Error", description: "Failed to load contact groups.", variant: "destructive" });
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Panggil fetchContacts dan fetchContactGroups semasa komponen dimuatkan
  useEffect(() => {
    fetchContacts(); // Muat semua kenalan pada mulanya
    fetchContactGroups();
  }, []);

  // Fungsi untuk handle pemilihan group
  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
    if (groupId === 'all' || !groupId) { // 'all' untuk pilihan "Semua Kenalan"
        fetchContacts(); // Muat semua kenalan
    } else {
        fetchContacts(groupId); // Muat kenalan untuk group yang dipilih
    }
  };

  // Fungsi untuk mencipta kumpulan kenalan baru
  const handleCreateContactGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
        toast({ title: "Validation Error", description: "Group name cannot be empty.", variant: "destructive" });
        return;
    }
    setIsCreatingGroup(true);
    try {
        const { data: newGroup } = await api.post('/contact-groups', { groupName: newGroupName.trim() });
        setContactGroups([...contactGroups, newGroup]);
        setNewGroupName('');
        setIsCreateGroupDialogOpen(false);
        toast({ title: "Success", description: `Group '${newGroup.groupName}' created.` });
        // Mungkin pilih group baru ini secara automatik
        // handleSelectGroup(newGroup._id);
    } catch (err) {
        console.error("Error creating contact group:", err);
        const message = err.response?.data?.message || "Failed to create group.";
        toast({ title: "Error Creating Group", description: message, variant: "destructive" });
    } finally {
        setIsCreatingGroup(false);
    }
  };

  // Fungsi untuk menambah kenalan
  const handleAddContact = async (e) => {
    e.preventDefault();
    setIsAdding(true);
    setError(null);

    try {
        const payload = { 
            name: newContactName, 
            phoneNumber: newContactPhone 
        };
        // Jika ada group dipilih (dan bukan 'all'), tambah groupId ke payload
        if (selectedGroupId && selectedGroupId !== 'all') {
            payload.groupId = selectedGroupId;
        }

        const { data: newContact } = await api.post('/contacts', payload);
        
        // Tidak perlu tambah terus ke state `contacts` jika kita akan refresh berdasarkan group
        // setContacts([...contacts, newContact]); 
        
        setNewContactName(''); 
        setNewContactPhone('');
        setIsAddDialogOpen(false);
        toast({ title: "Success", description: `Contact ${newContact.name} has been added.` });

        // Refresh senarai kenalan berdasarkan group semasa (atau semua)
        handleSelectGroup(selectedGroupId || 'all');
        // Jika ditambah ke group tertentu, refresh juga senarai group untuk update count
        if (payload.groupId) {
            fetchContactGroups();
        }

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

  // Fungsi untuk memuat naik fail - selectedGroupId akan diambil dari state
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please choose an Excel file to upload.",
        variant: "destructive",
      });
      return;
    }
    // Pastikan group dipilih sebelum upload
    if (!selectedGroupId || selectedGroupId === 'all') {
        toast({
            title: "No Group Selected",
            description: "Please select a contact group to upload contacts into.",
            variant: "destructive",
        });
        return;
    }

    setIsUploading(true);

    try {
      // Validate Excel file first
      toast({
        title: "Validating File...",
        description: "Checking Excel file format and data...",
      });

      const validation = await validateExcelFile(selectedFile);
      
      if (!validation.isValid) {
        toast({
          title: "File Validation Failed",
          description: `Found ${validation.errors.length} error(s): ${validation.errors.slice(0, 3).join(', ')}${validation.errors.length > 3 ? '...' : ''}`,
          variant: "destructive",
        });
        return;
      }

      // Show validation summary
      toast({
        title: "File Validated",
        description: `Found ${validation.validRowCount} valid contacts out of ${validation.totalRows} rows.`,
      });

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('groupId', selectedGroupId); // Hantar groupId yang dipilih

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };
      // API endpoint mungkin perlu diubah jika backend diubah suai untuk handle group semasa upload
      // Buat masa sekarang, guna endpoint sedia ada.
      const { data: responseData } = await api.post('/contacts/upload', formData, config);

      toast({
        title: "Upload Complete",
        description: responseData.message, 
      });

      // Show detailed summary if available
      if (responseData.summary) {
        console.log("Upload Summary:", responseData.summary);
        if (responseData.summary.errorCount > 0) {
          toast({
            title: "Upload Summary",
            description: `${responseData.summary.successfullyCreated} created, ${responseData.summary.errorCount} errors.`,
            variant: "default",
          });
        }
      }

      if (responseData.errors && responseData.errors.length > 0) {
          console.warn("Errors during import:", responseData.errors);
          // Show first few errors to user
          const errorPreview = responseData.errors.slice(0, 3).join('\n');
          toast({
            title: "Some Issues Found",
            description: `${responseData.errors.length} issue(s):\n${errorPreview}${responseData.errors.length > 3 ? '\n...' : ''}`,
            variant: "destructive",
          });
      }

      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      handleSelectGroup(selectedGroupId); // Refresh senarai kenalan untuk group semasa
      fetchContactGroups(); // Refresh juga senarai group untuk update count

    } catch (err) {
      console.error("Error during upload:", err);
      let errorMessage = "Failed to upload contacts.";
      
      if (err.message && err.message.includes('Failed to read Excel file')) {
        errorMessage = "Invalid Excel file format. Please check your file and try again.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Fungsi untuk memadam kumpulan kenalan
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    try {
        await api.delete(`/contact-groups/${groupToDelete._id}`);
        toast({ title: "Success", description: `Group '${groupToDelete.groupName}' has been deleted.` });
        setContactGroups(contactGroups.filter(group => group._id !== groupToDelete._id));
        // Jika group yang dipadam sedang dipilih, reset pemilihan ke 'All Contacts'
        if (selectedGroupId === groupToDelete._id) {
            handleSelectGroup('all');
        }
        setGroupToDelete(null);
        setIsDeleteGroupDialogOpen(false);
    } catch (err) {
        console.error("Error deleting contact group:", err);
        const message = err.response?.data?.message || "Failed to delete group.";
        toast({ title: "Error Deleting Group", description: message, variant: "destructive" });
    } finally {
        setIsDeletingGroup(false);
    }
  };

  const openDeleteGroupDialog = (group) => {
    setGroupToDelete(group);
    setIsDeleteGroupDialogOpen(true);
  };

  // Fungsi untuk mengalih keluar kenalan dari kumpulan
  const handleRemoveContactFromGroup = async () => {
    if (!contactToRemove || !contactToRemove.contactId || !contactToRemove.groupId) return;
    setIsRemovingContact(true);
    try {
        await api.delete(`/contact-groups/${contactToRemove.groupId}/contacts/${contactToRemove.contactId}`);
        toast({ title: "Success", description: `Contact '${contactToRemove.contactName}' removed from group '${contactToRemove.groupName}'.` });
        
        // Refresh contact list for the current group
        fetchContacts(contactToRemove.groupId);
        // Refresh group list to update contact count
        fetchContactGroups();

        setContactToRemove(null);
        setIsRemoveContactDialogOpen(false);
    } catch (err) {
        console.error("Error removing contact from group:", err);
        const message = err.response?.data?.message || "Failed to remove contact from group.";
        toast({ title: "Error Removing Contact", description: message, variant: "destructive" });
    } finally {
        setIsRemovingContact(false);
    }
  };

  const openRemoveContactDialog = (contact, currentGroup) => {
    if (!currentGroup || !currentGroup._id) return;
    setContactToRemove({
        contactId: contact._id,
        contactName: contact.name,
        groupId: currentGroup._id,
        groupName: currentGroup.groupName
    });
    setIsRemoveContactDialogOpen(true);
  };

  const refreshData = () => {
    fetchContacts();
    fetchContactGroups();
  };

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Contacts</h1>
        <RefreshButton onRefresh={refreshData} position="relative" />
      </div>

      {/* Bahagian Upload dan Kumpulan Kenalan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" /> Contact Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bahagian Kiri: Kumpulan Kenalan */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Contact Groups</h3>
                <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleCreateContactGroup}>
                      <DialogHeader>
                        <DialogTitle>Create New Contact Group</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <Label htmlFor="groupName">Group Name</Label>
                        <Input 
                          id="groupName"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="E.g., VIP Customers"
                          disabled={isCreatingGroup}
                          required
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="secondary" disabled={isCreatingGroup}>Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isCreatingGroup}>
                          {isCreatingGroup ? 'Creating...' : 'Create Group'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              
              {isLoadingGroups ? (
                <p>Loading groups...</p>
              ) : (
                <div className="space-y-2">
                  <Button 
                    variant={(!selectedGroupId || selectedGroupId === 'all') ? "secondary" : "ghost"} 
                    className="w-full justify-start"
                    onClick={() => handleSelectGroup('all')}
                  >
                    All Contacts
                  </Button>
                  {contactGroups.map(group => (
                    <Button 
                      key={group._id}
                      variant={selectedGroupId === group._id ? "secondary" : "ghost"} 
                      className="w-full justify-between items-center group/item"
                      onClick={() => handleSelectGroup(group._id)}
                    >
                      <span>{group.groupName}</span>
                      <span className="text-sm text-muted-foreground">({group.contactCount || 0})</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Bahagian Kanan: Upload dan Tambah Manual */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Add Contacts</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => generateContactTemplate('xlsx')}
                  >
                    <Download className="mr-2 h-4 w-4" /> Excel (.xlsx)
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => generateContactTemplate('xls')}
                  >
                    <Download className="mr-2 h-4 w-4" /> Excel (.xls)
                  </Button>
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Contact Manually
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleAddContact}>
                      <DialogHeader>
                        <DialogTitle>Add New Contact</DialogTitle>
                        <DialogDescription>
                          Enter name and phone number.
                          {selectedGroupId && selectedGroupId !== 'all' && contactGroups.find(g => g._id === selectedGroupId) && 
                            <span> Will be added to <strong>{contactGroups.find(g => g._id === selectedGroupId).groupName}</strong>.</span>
                          }
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

                <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Upload className="mr-2 h-4 w-4" /> Upload Contacts from File
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Upload Contacts</DialogTitle>
                      <DialogDescription>
                        Select a contact group and an Excel file (.xlsx or .xls) to upload your contacts.
                        <br /><span className="text-sm text-muted-foreground mt-1 block">Required columns: Name, Phone (download template above for exact format)</span>
                        <br /><span className="text-sm text-yellow-600 mt-1 block">⚠️ Only Excel files (.xlsx, .xls) are supported</span>
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="upload-contact-group" className="text-right">
                          Group
                        </Label>
                        <Select 
                          value={selectedGroupId} 
                          onValueChange={(value) => setSelectedGroupId(value)} 
                          disabled={isLoadingGroups || contactGroups.length === 0}
                        >
                          <SelectTrigger id="upload-contact-group" className="col-span-3">
                            <SelectValue placeholder={isLoadingGroups ? "Loading groups..." : "Select a group"} />
                          </SelectTrigger>
                          <SelectContent>
                            {contactGroups.map(group => (
                              <SelectItem key={group._id} value={group._id}>
                                {group.groupName}
                              </SelectItem>
                            ))}
                            {contactGroups.length === 0 && !isLoadingGroups && 
                              <SelectItem value="" disabled>No groups found. Create one first.</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">
                          File
                        </Label>
                        <div className="col-span-3">
                          <Button variant="outline" onClick={handleChooseFileClick} className="w-full justify-start">
                            <FileText className="mr-2 h-4 w-4" /> 
                            {selectedFile ? selectedFile.name : "Choose Excel File"}
                          </Button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept=".xlsx,.xls"
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={handleUpload} 
                        disabled={isUploading || !selectedFile || !selectedGroupId || selectedGroupId === 'all'}
                      >
                        {isUploading ? "Uploading..." : "Upload to Group"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bahagian Senarai Kenalan */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {selectedGroupId && selectedGroupId !== 'all' && contactGroups.find(g => g._id === selectedGroupId) 
                ? `Contacts in "${contactGroups.find(g => g._id === selectedGroupId).groupName}"` 
                : "All Contacts"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading contact list...</p>}
          {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          
          {!isLoading && !error && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4">
                        No contacts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact._id}>
                        <TableCell>{contact.name}</TableCell>
                        <TableCell>{contact.phoneNumber.replace('@c.us', '')}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteContact(contact._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AlertDialog untuk Padam Kumpulan */}
      <AlertDialog open={isDeleteGroupDialogOpen} onOpenChange={setIsDeleteGroupDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this group?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will delete the group "<strong>{groupToDelete?.groupName}</strong>". 
                    Contacts within this group will NOT be deleted from your main contact list.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setGroupToDelete(null)} disabled={isDeletingGroup}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteGroup} disabled={isDeletingGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeletingGroup ? "Deleting..." : "Delete Group"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog untuk Alih Keluar Kenalan Dari Kumpulan */}
      <AlertDialog open={isRemoveContactDialogOpen} onOpenChange={setIsRemoveContactDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Remove Contact from Group?</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to remove "<strong>{contactToRemove?.contactName}</strong>" 
                    from the group "<strong>{contactToRemove?.groupName}</strong>"?
                    The contact will remain in your main contact list.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setContactToRemove(null)} disabled={isRemovingContact}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveContactFromGroup} disabled={isRemovingContact} variant="destructive">
                    {isRemovingContact ? "Removing..." : "Remove from Group"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ContactPage; 