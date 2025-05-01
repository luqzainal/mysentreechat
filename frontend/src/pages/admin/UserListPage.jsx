import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../../services/api'; // Guna instance API yang dikongsi
import { useAuth } from '../../contexts/AuthContext'; // Sesuaikan path jika perlu
import { toast } from "sonner"; // Guna sonner untuk notifikasi
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Untuk papar Role/Plan
import { format } from 'date-fns'; // Untuk format tarikh
import { Button } from "@/components/ui/button"; // Import Button
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pencil, ShieldCheck, UserX } from 'lucide-react'; // Import ikon baru
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const UserListPage = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user: loggedInUser } = useAuth(); // Namakan semula user dari context

    // State untuk dialog edit pelan
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
    const [newPlanForSelectedUser, setNewPlanForSelectedUser] = useState('');
    const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

    // State untuk dialog ubah peranan (guna AlertDialog)
    const [isRoleAlertOpen, setIsRoleAlertOpen] = useState(false);
    const [userForRoleChange, setUserForRoleChange] = useState(null);
    const [newRoleForChange, setNewRoleForChange] = useState(null); // 'admin' atau 'user'
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);

    // Fungsi untuk dapatkan token (tidak diperlukan jika interceptor berfungsi)
    // const getToken = () => { ... };

    // Fetch users (guna instance api)
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Token ditambah oleh interceptor
                const { data } = await api.get('/admin/users');
                setUsers(data);
            } catch (err) {
                console.error("Ralat mendapatkan senarai pengguna:", err);
                const message = err.response?.data?.message || "Gagal mendapatkan senarai pengguna.";
                setError(message);
                toast.error(message);
            } finally {
                setIsLoading(false);
            }
        };

        if (loggedInUser?.role === 'admin') {
             fetchUsers();
        } else if (loggedInUser) { 
            setError('Akses tidak dibenarkan.');
            setIsLoading(false);
        }
    }, [loggedInUser]);

    // Fungsi untuk membuka dialog edit
    const handleOpenEditDialog = (userToEdit) => {
        setSelectedUserForEdit(userToEdit);
        setNewPlanForSelectedUser(userToEdit.membershipPlan || 'Free'); // Set nilai awal Select
        setIsEditDialogOpen(true);
    };

    // Fungsi untuk mengemaskini pelan pengguna
    const handleUpdatePlan = async () => {
        if (!selectedUserForEdit || !newPlanForSelectedUser) return;

        setIsUpdatingPlan(true);
        try {
            // Token ditambah oleh interceptor
            const { data: updatedUser } = await api.put(
                `/admin/users/${selectedUserForEdit._id}/plan`,
                { plan: newPlanForSelectedUser } // Hantar pelan baru dalam body
            );

            // Kemaskini senarai pengguna dalam state
            setUsers(prevUsers => 
                prevUsers.map(u => 
                    u._id === updatedUser._id ? updatedUser : u
                )
            );

            toast.success(`Pelan untuk ${updatedUser.name} berjaya dikemaskini kepada ${updatedUser.membershipPlan}.`);
            setIsEditDialogOpen(false); // Tutup dialog

        } catch (err) {
            console.error("Ralat mengemaskini pelan pengguna:", err);
            const message = err.response?.data?.message || "Gagal mengemaskini pelan.";
            toast.error(message);
        } finally {
            setIsUpdatingPlan(false);
        }
    };

    // Fungsi untuk membuka dialog pengesahan ubah peranan
    const handleOpenRoleChangeAlert = (userToChange) => {
        setUserForRoleChange(userToChange);
        // Tentukan role baru berdasarkan role semasa
        const targetRole = userToChange.role === 'user' ? 'admin' : 'user'; 
        setNewRoleForChange(targetRole);
        setIsRoleAlertOpen(true);
    };

    // Fungsi untuk mengemaskini peranan pengguna
    const handleConfirmRoleChange = async () => {
        if (!userForRoleChange || !newRoleForChange) return;

        setIsUpdatingRole(true);
        try {
            const { data: updatedUser } = await api.put(
                `/admin/users/${userForRoleChange._id}/role`,
                { role: newRoleForChange } // Hantar role baru dalam body
            );

            // Kemaskini senarai pengguna dalam state
            setUsers(prevUsers => 
                prevUsers.map(u => 
                    u._id === updatedUser._id ? updatedUser : u
                )
            );

            toast.success(`Peranan untuk ${updatedUser.name} berjaya ditukar kepada ${updatedUser.role}.`);
            setIsRoleAlertOpen(false); // Tutup alert dialog
            setUserForRoleChange(null);
            setNewRoleForChange(null);

        } catch (err) {
            console.error("Ralat menukar peranan pengguna:", err);
            const message = err.response?.data?.message || "Gagal menukar peranan.";
            toast.error(message);
        } finally {
            setIsUpdatingRole(false);
        }
    };

    const getRoleBadgeVariant = (role) => {
        switch (role) {
            case 'admin': return 'destructive';
            case 'user': return 'secondary';
            default: return 'outline';
        }
    };

    const getPlanBadgeVariant = (plan) => {
        switch (plan?.toLowerCase()) {
            case 'free': return 'outline';
            case 'basic': return 'default'; // Guna default untuk Basic
            case 'pro': return 'success'; // Guna success untuk Pro (pastikan warna success ada)
            default: return 'secondary';
        }
    };

    if (isLoading) {
        return <div className="container mx-auto p-4">Memuatkan senarai pengguna...</div>;
    }

    if (error) {
        return (
            <div className="container mx-auto p-4">
                <Alert variant="destructive">
                    <AlertTitle>Ralat</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    // Pelan yang dibenarkan untuk pilihan
    const allowedPlans = ['Free', 'Basic', 'Pro']; // Sesuaikan dengan pelan anda

    return (
        <div className="container mx-auto p-4 space-y-6">
            <h1 className="text-3xl font-bold">Pengurusan Pengguna</h1>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Peranan</TableHead>
                        <TableHead>Pelan</TableHead>
                        <TableHead>Tarikh Daftar</TableHead>
                        <TableHead className="text-right">Tindakan</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.length > 0 ? (
                        users.map((u) => (
                            <TableRow key={u._id}>
                                <TableCell className="font-medium">{u.name}</TableCell>
                                <TableCell>{u.email}</TableCell>
                                <TableCell>
                                    <Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getPlanBadgeVariant(u.membershipPlan)}>{u.membershipPlan || 'N/A'}</Badge>
                                </TableCell>
                                <TableCell>
                                    {format(new Date(u.createdAt), 'dd/MM/yyyy HH:mm')}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                   <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleOpenEditDialog(u)}
                                        disabled={u.role === 'admin'}
                                    >
                                       <Pencil className="h-4 w-4 mr-1" /> Tukar Pelan
                                   </Button>
                                   
                                   {loggedInUser?._id !== u._id && (
                                       <Button 
                                            variant={u.role === 'user' ? "default" : "destructive"} 
                                            size="sm" 
                                            onClick={() => handleOpenRoleChangeAlert(u)}
                                        >
                                           {u.role === 'user' ? 
                                               <><ShieldCheck className="h-4 w-4 mr-1" /> Lantik Admin</> : 
                                               <><UserX className="h-4 w-4 mr-1" /> Turunkan Pangkat</>
                                           }
                                       </Button>
                                   )}
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center">Tiada pengguna ditemui.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                     {selectedUserForEdit && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Kemaskini Pelan Pengguna</DialogTitle>
                                <DialogDescription>
                                    Tukar pelan keahlian untuk <strong>{selectedUserForEdit.name}</strong> ({selectedUserForEdit.email}).
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="plan-select" className="text-right">Pelan Baru</Label>
                                    <div className="col-span-3">
                                        <Select 
                                            value={newPlanForSelectedUser}
                                            onValueChange={setNewPlanForSelectedUser}
                                            disabled={isUpdatingPlan}
                                        >
                                            <SelectTrigger id="plan-select">
                                                <SelectValue placeholder="Pilih pelan..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allowedPlans.map(plan => (
                                                    <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" disabled={isUpdatingPlan}>Batal</Button>
                                </DialogClose>
                                <Button onClick={handleUpdatePlan} disabled={isUpdatingPlan || newPlanForSelectedUser === selectedUserForEdit.membershipPlan}>
                                    {isUpdatingPlan ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* AlertDialog untuk Tukar Peranan */} 
            <AlertDialog open={isRoleAlertOpen} onOpenChange={setIsRoleAlertOpen}>
                 <AlertDialogContent>
                    {userForRoleChange && (
                        <>
                             <AlertDialogHeader>
                                <AlertDialogTitle>Pengesahan Tukar Peranan</AlertDialogTitle>
                                <AlertDialogDescription>
                                     Anda pasti mahu menukar peranan untuk 
                                     <strong> {userForRoleChange.name} </strong>
                                     ({userForRoleChange.email}) kepada 
                                     <strong> {newRoleForChange}?</strong>
                                     {newRoleForChange === 'admin' && ' Pengguna ini akan mendapat akses penuh admin.'}
                                     {newRoleForChange === 'user' && ' Pengguna ini akan kehilangan akses admin.'}
                                 </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setUserForRoleChange(null)} disabled={isUpdatingRole}>Batal</AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={handleConfirmRoleChange}
                                    disabled={isUpdatingRole}
                                    className={newRoleForChange === 'admin' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}
                                >
                                    {isUpdatingRole ? 'Memproses...' : `Ya, Tukar kepada ${newRoleForChange}`}
                                </AlertDialogAction>
                             </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UserListPage; 