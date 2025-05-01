import React, { useState, useEffect } from 'react';
import api from '../services/api'; // Instance Axios
import { useAuth } from '../contexts/AuthContext'; // Untuk data pengguna awal
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const AccountPage = () => {
  const { user, login } = useAuth(); // Ambil fungsi login untuk update user state + token
  const [formData, setFormData] = useState({
    name: '',
    email: '', // Email biasanya tidak boleh diubah
    password: '', // Untuk kemaskini kata laluan
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Isi form dengan data pengguna semasa komponen dimuatkan
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
      setIsLoading(false);
    } else {
       // Jika user belum ada (mungkin loading context), tunggu
       setIsLoading(true);
    }
  }, [user]);

  // Kendalikan perubahan input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Hantar data kemaskini ke backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Kata laluan dan pengesahan kata laluan tidak sepadan.");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        // Jangan hantar email jika tidak boleh diubah
      };
      // Hanya hantar password jika ia diisi
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await api.put('/users/profile', payload);
      
      // Kemaskini state AuthContext dengan data baru & token baru
      login(response.data, response.data.token); 

      toast.success("Profil berjaya dikemaskini.");
      // Reset medan password selepas berjaya
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));

    } catch (error) {
      console.error("Gagal mengemaskini profil:", error);
      const errorMessage = error.response?.data?.message || "Ralat semasa mengemaskini profil.";
      toast.error(`Gagal: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter>
             <Skeleton className="h-10 w-24" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Pengurus Akaun</CardTitle>
            <CardDescription>Kemaskini maklumat profil dan kata laluan anda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nama */}
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input 
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={isSaving}
              />
            </div>
            {/* Email (Read Only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                name="email"
                type="email"
                value={formData.email}
                readOnly // Jadikan read-only
                disabled // Juga disable untuk visual
                className="cursor-not-allowed"
              />
               <p className="text-sm text-muted-foreground">
                   Email tidak boleh diubah.
                 </p>
            </div>
            {/* Kata Laluan Baru */}
            <div className="space-y-2">
              <Label htmlFor="password">Kata Laluan Baru (biarkan kosong jika tidak mahu tukar)</Label>
              <Input 
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                disabled={isSaving}
              />
            </div>
            {/* Sahkan Kata Laluan Baru */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Sahkan Kata Laluan Baru</Label>
              <Input 
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isSaving || !formData.password} // Disable jika password kosong
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AccountPage; 