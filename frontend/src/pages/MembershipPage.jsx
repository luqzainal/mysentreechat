import React, { useState, useEffect } from 'react';
import api from '../services/api'; // Instance Axios
import { useAuth } from '../contexts/AuthContext'; // Untuk check user
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Untuk paparkan nama pelan
import { Skeleton } from "@/components/ui/skeleton"; // Untuk loading state

const MembershipPage = () => {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth(); // Dapatkan pengguna yang log masuk

  // Fetch profil pengguna semasa komponen dimuatkan
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/users/profile');
        setProfile(response.data);
      } catch (error) {
        console.error("Gagal mendapatkan profil pengguna:", error);
        toast.error("Gagal memuatkan maklumat keahlian.");
      } finally {
        setIsLoading(false);
      }
    };

    if (user) { // Pastikan pengguna sudah log masuk
      fetchProfile();
    }
  }, [user]);

  // Fungsi untuk format tarikh
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('ms-MY', { // Guna locale Malaysia
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error("Ralat format tarikh:", error);
      return dateString; // Kembalikan string asal jika ralat
    }
  };

  // Fungsi untuk tentukan warna badge berdasarkan pelan
  const getBadgeVariant = (plan) => {
      switch (plan?.toLowerCase()) {
          case 'pro': return 'default'; // Warna default (biasanya gelap/utama)
          case 'basic': return 'secondary'; // Warna sekunder
          case 'free': return 'outline'; // Warna outline
          default: return 'secondary';
      }
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Status Keahlian</CardTitle>
          <CardDescription>Maklumat pelan langganan semasa anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
               <Skeleton className="h-6 w-1/2" />
               <Skeleton className="h-4 w-1/4" />
               <Skeleton className="h-4 w-1/3" />
            </div>
          ) : profile ? (
            <div>
              <p className="text-sm text-muted-foreground">Pelan Semasa:</p>
              <Badge variant={getBadgeVariant(profile.membershipPlan)} className="text-lg font-semibold mb-2">
                {profile.membershipPlan || 'Tidak Diketahui'}
              </Badge>
              
              <p className="text-sm text-muted-foreground mt-4">Tarikh Mendaftar:</p>
              <p>{formatDate(profile.createdAt)}</p>
              
              {/* Di sini boleh tambah maklumat had ciri berdasarkan pelan */} 
              {/* Contoh: <p>Had Penghantaran Pukal: 100 / hari</p> */}
              {/* Contoh: <p>Storan Media: 500MB</p> */} 
              
              {/* Tambah butang untuk naik taraf jika perlu */}
              {/* <Button className="mt-6">Naik Taraf Pelan</Button> */}
            </div>
          ) : (
            <p className="text-red-600">Gagal memuatkan maklumat keahlian.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MembershipPage; 