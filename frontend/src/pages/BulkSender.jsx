import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Laluan ini sepatutnya betul sekarang
import api from '../services/api'; // Instance Axios anda
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const BulkSender = () => {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sendingStatus, setSendingStatus] = useState(null); // { message: string, results: array | null }
  const { user } = useAuth(); // Dapatkan token jika perlu

  // Fetch kenalan semasa komponen dimuatkan
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await api.get('/contacts');
        setContacts(response.data);
      } catch (error) {
        console.error("Gagal mendapatkan senarai kenalan:", error);
        toast.error("Gagal mendapatkan senarai kenalan.");
      }
    };
    fetchContacts();
  }, []);

  // Kendalikan pemilihan/pembuangan kenalan tunggal
  const handleSelectContact = (contactId) => {
    setSelectedContacts((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(contactId)) {
        newSelected.delete(contactId);
      } else {
        newSelected.add(contactId);
      }
      return newSelected;
    });
  };

  // Kendalikan pemilihan/pembuangan semua kenalan
  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      const allIds = new Set(contacts.map((c) => c._id));
      setSelectedContacts(allIds);
    } else {
      setSelectedContacts(new Set());
    }
  };

  // Hantar mesej pukal
  const handleSendBulk = async () => {
    if (!message.trim()) {
      toast.warning("Sila masukkan mesej.");
      return;
    }
    if (selectedContacts.size === 0) {
      toast.warning("Sila pilih sekurang-kurangnya satu kenalan.");
      return;
    }

    setIsLoading(true);
    setSendingStatus(null); // Reset status sebelum hantar
    const contactIds = Array.from(selectedContacts);

    try {
      const response = await api.post('/whatsapp/bulk', {
        message,
        contactIds,
      });
      setSendingStatus(response.data);
      toast.success(response.data.message || "Proses penghantaran selesai.");
    } catch (error) {
      console.error("Gagal menghantar mesej pukal:", error);
      const errorMessage = error.response?.data?.message || "Ralat berlaku semasa penghantaran.";
      setSendingStatus({ message: `Gagal: ${errorMessage}`, results: null });
      toast.error(`Gagal menghantar: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isAllSelected = contacts.length > 0 && selectedContacts.size === contacts.length;

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Whatsapp Bulk Sender</CardTitle>
          <CardDescription>Hantar mesej ke beberapa kenalan serentak.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Mesej</Label>
            <Textarea
              id="message"
              placeholder="Taip mesej anda di sini..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
               Gunakan format Spintax <code className="bg-muted px-1 py-0.5 rounded">{'{'}pilihan1|pilihan2{'}'}</code> untuk variasi mesej rawak (cth: <code className="bg-muted px-1 py-0.5 rounded">{'{'}Hai|Helo{'}'}</code>).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Pilih Kenalan</Label>
            <ScrollArea className="h-72 w-full rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Pilih semua"
                        disabled={isLoading || contacts.length === 0}
                      />
                    </TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Nombor Telefon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        Tiada kenalan ditemui.
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((contact) => (
                      <TableRow key={contact._id} data-state={selectedContacts.has(contact._id) && "selected"}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContacts.has(contact._id)}
                            onCheckedChange={() => handleSelectContact(contact._id)}
                            aria-label={`Pilih ${contact.name}`}
                            disabled={isLoading}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>{contact.phoneNumber}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            <p className="text-sm text-muted-foreground">
              Dipilih: {selectedContacts.size} / {contacts.length} kenalan.
            </p>
          </div>

          {sendingStatus && (
            <Card className="bg-muted/40">
              <CardHeader>
                <CardTitle className="text-lg">Keputusan Penghantaran</CardTitle>
                <CardDescription>{sendingStatus.message}</CardDescription>
              </CardHeader>
              {sendingStatus.results && (
                <CardContent>
                  <ScrollArea className="h-40">
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {sendingStatus.results.map((result, index) => (
                        <li key={index} className={result.status === 'Gagal' ? 'text-red-600' : 'text-green-600'}>
                          {result.name} ({result.number}): {result.status}
                          {result.status === 'Gagal' && result.error && ` - ${result.error}`}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          )}

        </CardContent>
        <CardFooter>
          <Button onClick={handleSendBulk} disabled={isLoading || selectedContacts.size === 0}>
            {isLoading ? 'Menghantar...' : 'Hantar Mesej Pukal'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BulkSender; 