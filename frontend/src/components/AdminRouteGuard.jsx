import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const AdminRouteGuard = () => {
    const { user, loading } = useAuth();

    if (loading) {
        // Jika masih loading data pengguna, paparkan loading state
        return <div className="flex items-center justify-center h-screen">Memeriksa status admin...</div>; 
    }

    if (!user || user.role !== 'admin') {
        // Jika tidak loading, DAN (tiada pengguna ATAU bukan admin)
        // Boleh redirect ke dashboard atau paparkan mesej akses ditolak
        // Contoh: Paparkan mesej
        return (
             <div className="container mx-auto p-4 pt-20"> {/* Tambah padding atas */} 
                <Alert variant="destructive">
                    <AlertTitle>Akses Ditolak</AlertTitle>
                    <AlertDescription>Anda tidak mempunyai kebenaran untuk mengakses halaman ini.</AlertDescription>
                </Alert>
            </div>
        );
        // Atau redirect:
        // return <Navigate to="/" replace />; 
    }

    // Jika admin, benarkan akses ke komponen anak (laluan admin)
    return <Outlet />;
};

export default AdminRouteGuard; 