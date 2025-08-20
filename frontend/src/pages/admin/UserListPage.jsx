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
import { Input } from "@/components/ui/input";
import { Pencil, ShieldCheck, UserX, Trash2, Key } from 'lucide-react'; // Import new icons
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Import Refresh Button
import RefreshButton from '../../components/RefreshButton';

const UserListPage = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user: loggedInUser } = useAuth(); // Rename user from context
    
    // State for server device usage
    const [deviceUsage, setDeviceUsage] = useState(null);
    const [isLoadingDeviceUsage, setIsLoadingDeviceUsage] = useState(false);

    // State for edit plan dialog
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
    const [newPlanForSelectedUser, setNewPlanForSelectedUser] = useState('');
    const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

    // State for change role dialog (using AlertDialog)
    const [isRoleAlertOpen, setIsRoleAlertOpen] = useState(false);
    const [userForRoleChange, setUserForRoleChange] = useState(null);
    const [newRoleForChange, setNewRoleForChange] = useState(null); // 'admin' or 'user'
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);

    // State BARU untuk delete user dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userForDeletion, setUserForDeletion] = useState(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);

    // State untuk password reset dialog
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [userForPasswordReset, setUserForPasswordReset] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [isSettingPassword, setIsSettingPassword] = useState(false);

    // Function to get token (not needed if interceptor works)
    // const getToken = () => { ... };

    // Fetch device usage data
    const fetchDeviceUsage = async () => {
        setIsLoadingDeviceUsage(true);
        try {
            const { data } = await api.get('/whatsapp/server/device-usage');
            setDeviceUsage(data);
        } catch (err) {
            console.error("Error getting device usage:", err);
            // Don't show toast error for device usage as it's supplementary data
        } finally {
            setIsLoadingDeviceUsage(false);
        }
    };

    // Fetch users (use api instance)
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Token added by interceptor
                const { data } = await api.get('/admin/users');
                setUsers(data);
                
                // Fetch device usage after users are loaded
                fetchDeviceUsage();
            } catch (err) {
                console.error("Error getting user list:", err); // Translate error log
                const message = err.response?.data?.message || "Failed to get user list."; // Translate error message
                setError(message);
                toast.error(message); // Translate toast message
            } finally {
                setIsLoading(false);
            }
        };

        if (loggedInUser?.role === 'admin') {
             fetchUsers();
        } else if (loggedInUser) { 
            setError('Access denied.'); // Translate error message
            setIsLoading(false);
        }
    }, [loggedInUser]);

    // Function to open edit dialog
    const handleOpenEditDialog = (userToEdit) => {
        setSelectedUserForEdit(userToEdit);
        setNewPlanForSelectedUser(userToEdit.membershipPlan || 'Free'); // Set initial Select value
        setIsEditDialogOpen(true);
    };

    // Function to update user plan
    const handleUpdatePlan = async () => {
        if (!selectedUserForEdit || !newPlanForSelectedUser) return;

        setIsUpdatingPlan(true);
        try {
            // Token added by interceptor
            const { data: updatedUser } = await api.put(
                `/admin/users/${selectedUserForEdit._id}`,
                { membershipPlan: newPlanForSelectedUser } 
            );

            // Update user list in state
            setUsers(prevUsers => 
                prevUsers.map(u => 
                    u._id === updatedUser._id ? updatedUser : u
                )
            );

            toast.success(`Plan for ${updatedUser.name} updated successfully to ${updatedUser.membershipPlan}.`);
            setIsEditDialogOpen(false); // Close dialog

        } catch (err) {
            console.error("Error updating user plan:", err);
            const message = err.response?.data?.message || "Failed to update plan.";
            toast.error(message);
        } finally {
            setIsUpdatingPlan(false);
        }
    };

    // Function to open role change confirmation dialog
    const handleOpenRoleChangeAlert = (userToChange) => {
        setUserForRoleChange(userToChange);
        // Determine new role based on current role
        const targetRole = userToChange.role === 'user' ? 'admin' : 'user'; 
        setNewRoleForChange(targetRole);
        setIsRoleAlertOpen(true);
    };

    // Function to update user role
    const handleConfirmRoleChange = async () => {
        if (!userForRoleChange || !newRoleForChange) return;

        setIsUpdatingRole(true);
        try {
            const { data: updatedUser } = await api.put(
                `/admin/users/${userForRoleChange._id}`,
                { role: newRoleForChange } // Send new role in body
            );

            // Update user list in state
            setUsers(prevUsers => 
                prevUsers.map(u => 
                    u._id === updatedUser._id ? updatedUser : u
                )
            );

            toast.success(`Role for ${updatedUser.name} successfully changed to ${updatedUser.role}.`);
            setIsRoleAlertOpen(false); // Close alert dialog
            setUserForRoleChange(null);
            setNewRoleForChange(null);

        } catch (err) {
            console.error("Error changing user role:", err);
            const message = err.response?.data?.message || "Failed to change role.";
            toast.error(message);
        } finally {
            setIsUpdatingRole(false);
        }
    };

    // BARU: Function to open delete confirmation dialog
    const handleOpenDeleteDialog = (userToDelete) => {
        setUserForDeletion(userToDelete);
        setIsDeleteDialogOpen(true);
    };

    // BARU: Function to confirm and delete user
    const handleConfirmDeleteUser = async () => {
        if (!userForDeletion) return;

        setIsDeletingUser(true);
        try {
            // Andaikan endpoint /admin/users/:userId dengan method DELETE wujud
            await api.delete(`/admin/users/${userForDeletion._id}`);
            
            setUsers(prevUsers => prevUsers.filter(u => u._id !== userForDeletion._id));
            toast.success(`User ${userForDeletion.name} deleted successfully.`);
            setIsDeleteDialogOpen(false);
            setUserForDeletion(null);

        } catch (err) {
            console.error("Error deleting user:", err);
            const message = err.response?.data?.message || "Failed to delete user.";
            toast.error(message);
        } finally {
            setIsDeletingUser(false);
        }
    };

    // Function to open password reset dialog
    const handleOpenPasswordDialog = (userToReset) => {
        setUserForPasswordReset(userToReset);
        setNewPassword(''); // Reset password field
        setIsPasswordDialogOpen(true);
    };

    // Function to set new password for user
    const handleSetNewPassword = async () => {
        if (!userForPasswordReset || !newPassword.trim()) {
            toast.error("Please enter a password.");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }

        setIsSettingPassword(true);
        try {
            await api.put(`/admin/users/${userForPasswordReset._id}/password`, {
                newPassword: newPassword.trim()
            });

            toast.success(`Password for ${userForPasswordReset.name} has been updated successfully.`);
            setIsPasswordDialogOpen(false);
            setUserForPasswordReset(null);
            setNewPassword('');

        } catch (err) {
            console.error("Error setting password:", err);
            const message = err.response?.data?.message || "Failed to set password.";
            toast.error(message);
        } finally {
            setIsSettingPassword(false);
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
            case 'basic': return 'default'; // Use default for Basic
            case 'pro': return 'success'; // Use success for Pro (ensure success color exists)
            default: return 'secondary';
        }
    };

    // Helper function to get device count for a user
    const getUserDeviceCount = (userId) => {
        const userDeviceData = deviceUsage?.userBreakdown?.find(u => u.userId === userId);
        return userDeviceData?.deviceCount || 0;
    };

    // Helper function to get plan limits
    const getPlanLimit = (plan) => {
        const limits = { Free: 1, Basic: 3, Pro: 5 };
        return limits[plan] || 1;
    };

    if (isLoading) {
        return <div className="container mx-auto p-4">Loading user list...</div>; // Translate loading text
    }

    if (error) {
        return (
            <div className="container mx-auto p-4">
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle> {/* Translate title */}
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    // Allowed plans for selection
    const allowedPlans = [
        { value: 'Free', label: 'Free (1 Device)' },
        { value: 'Basic', label: 'Basic (3 Devices)' },
        { value: 'Pro', label: 'Pro (5 Devices)' }
    ];

    const refreshUsers = async () => {
        if (loggedInUser?.role === 'admin') {
            try {
                const { data } = await api.get('/admin/users');
                setUsers(data);
                
                // Also refresh device usage
                fetchDeviceUsage();
                
                toast.success('User list and device usage refreshed successfully.');
            } catch (err) {
                toast.error('Failed to refresh user list.');
            }
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">User Management</h1>
                <RefreshButton onRefresh={refreshUsers} position="relative" />
            </div>

            {/* Server Device Usage Stats */}
            {deviceUsage && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Server Capacity</div>
                        <div className="text-2xl font-bold">{deviceUsage.serverStats.connectedDevices}/{deviceUsage.serverStats.serverLimit}</div>
                        <div className="text-xs text-gray-500">devices connected</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Utilization</div>
                        <div className="text-2xl font-bold">{deviceUsage.serverStats.utilizationPercentage}%</div>
                        <div className="text-xs text-gray-500">server usage</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Available</div>
                        <div className="text-2xl font-bold">{deviceUsage.serverStats.availableSlots}</div>
                        <div className="text-xs text-gray-500">slots remaining</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                        <div className="text-2xl font-bold">
                            <Badge 
                                variant={
                                    deviceUsage.serverStats.status === 'FULL' ? 'destructive' :
                                    deviceUsage.serverStats.status === 'NEAR_FULL' ? 'default' : 
                                    'success'
                                }
                            >
                                {deviceUsage.serverStats.status}
                            </Badge>
                        </div>
                        <div className="text-xs text-gray-500">server status</div>
                    </div>
                </div>
            )}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead> {/* Translate table header */}
                        <TableHead>Email</TableHead> {/* Translate table header */}
                        <TableHead>Role</TableHead> {/* Translate table header */}
                        <TableHead>Plan</TableHead> {/* Translate table header */}
                        <TableHead>Devices</TableHead> {/* New column for device usage */}
                        <TableHead>Registration Date</TableHead> {/* Translate table header */}
                        <TableHead className="text-right">Actions</TableHead> {/* Translate table header */}
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
                                    {/* Device usage display */}
                                    {isLoadingDeviceUsage ? (
                                        <span className="text-sm text-gray-500">Loading...</span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">
                                                {getUserDeviceCount(u._id)}/{getPlanLimit(u.membershipPlan)}
                                            </span>
                                            <Badge 
                                                variant={
                                                    getUserDeviceCount(u._id) >= getPlanLimit(u.membershipPlan) 
                                                        ? 'destructive' 
                                                        : getUserDeviceCount(u._id) > 0 
                                                            ? 'default' 
                                                            : 'outline'
                                                }
                                                className="text-xs"
                                            >
                                                {getUserDeviceCount(u._id) >= getPlanLimit(u.membershipPlan) 
                                                    ? 'Full' 
                                                    : getUserDeviceCount(u._id) > 0 
                                                        ? 'Active' 
                                                        : 'None'}
                                            </Badge>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {/* Tambah semakan untuk u.createdAt sebelum format */}
                                    {u.createdAt ? format(new Date(u.createdAt), 'PPpp') : '-'}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                   {/* Edit Plan Button */} 
                                   <Dialog open={isEditDialogOpen && selectedUserForEdit?._id === u._id} onOpenChange={(isOpen) => {
                                        if (!isOpen) {
                                            setIsEditDialogOpen(false);
                                            setSelectedUserForEdit(null);
                                        }
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleOpenEditDialog(u)}
                                                disabled={u.role === 'admin'} // Disable plan change for admins
                                            >
                                               <Pencil className="h-4 w-4 mr-1" /> Change Plan {/* Translate button text */}
                                           </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>Edit User Plan</DialogTitle> {/* Translate dialog title */}
                                                <DialogDescription>
                                                    Change the membership plan for {selectedUserForEdit?.name}.
                                                </DialogDescription> {/* Translate dialog description */}
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="plan-select" className="text-right">Plan</Label> {/* Translate label */}
                                                    <Select 
                                                        value={newPlanForSelectedUser}
                                                        onValueChange={setNewPlanForSelectedUser}
                                                        disabled={isUpdatingPlan}
                                                    >
                                                        <SelectTrigger id="plan-select" className="col-span-3">
                                                            <SelectValue placeholder="Select a plan" /> {/* Translate placeholder */}
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {allowedPlans.map(plan => (
                                                                <SelectItem key={plan.value} value={plan.value}>{plan.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                 {/* Ujian: Buang asChild buat sementara */}
                                                 <DialogClose>
                                                     <Button type="button" variant="secondary" disabled={isUpdatingPlan}>Cancel</Button>
                                                 </DialogClose>
                                                <Button onClick={handleUpdatePlan} disabled={isUpdatingPlan || newPlanForSelectedUser === selectedUserForEdit?.membershipPlan}>
                                                    {isUpdatingPlan ? 'Updating...' : 'Update Plan'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                   
                                   {/* Change Role Button/Alert Trigger */}
                                   {loggedInUser?._id !== u._id && ( // Cannot change own role
                                       <AlertDialog open={isRoleAlertOpen && userForRoleChange?._id === u._id} onOpenChange={(isOpen) => {
                                            if (!isOpen) {
                                                setIsRoleAlertOpen(false);
                                                setUserForRoleChange(null);
                                                setNewRoleForChange(null);
                                            }
                                        }}>
                                           <AlertDialogTrigger asChild>
                                                <Button 
                                                    variant={u.role === 'admin' ? "secondary" : "destructive"}
                                                    size="sm" 
                                                    onClick={() => handleOpenRoleChangeAlert(u)}
                                                >
                                                    {u.role === 'admin' ? 
                                                        <><UserX className="h-4 w-4 mr-1" /> Revoke Admin</>
                                                        : <><ShieldCheck className="h-4 w-4 mr-1" /> Make Admin</>
                                                    }
                                                </Button>
                                           </AlertDialogTrigger>
                                           <AlertDialogContent>
                                               <AlertDialogHeader>
                                                   <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
                                                   <AlertDialogDescription>
                                                       Are you sure you want to change the role of {userForRoleChange?.name} to {newRoleForChange}? 
                                                       {newRoleForChange === 'admin' ? ' They will gain administrative privileges.' : ' Their administrative privileges will be revoked.'} 
                                                   </AlertDialogDescription>
                                               </AlertDialogHeader>
                                               <AlertDialogFooter>
                                                   <AlertDialogCancel disabled={isUpdatingRole}>Cancel</AlertDialogCancel>
                                                   <AlertDialogAction onClick={handleConfirmRoleChange} disabled={isUpdatingRole} className={newRoleForChange === 'admin' ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}>
                                                        {isUpdatingRole ? 'Updating...' : 'Confirm Change'}
                                                   </AlertDialogAction>
                                               </AlertDialogFooter>
                                           </AlertDialogContent>
                                       </AlertDialog>
                                   )}

                                   {/* Password Reset Button */}
                                   <Dialog open={isPasswordDialogOpen && userForPasswordReset?._id === u._id} onOpenChange={(isOpen) => {
                                        if (!isOpen) {
                                            setIsPasswordDialogOpen(false);
                                            setUserForPasswordReset(null);
                                            setNewPassword('');
                                        }
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleOpenPasswordDialog(u)}
                                                disabled={loggedInUser._id === u._id} // Cannot reset own password
                                            >
                                                <Key className="h-4 w-4 mr-1" /> Set Password
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>Set New Password</DialogTitle>
                                                <DialogDescription>
                                                    Set a new password for {userForPasswordReset?.name}.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="password-input" className="text-right">Password</Label>
                                                    <Input 
                                                        id="password-input"
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        placeholder="Enter new password"
                                                        className="col-span-3"
                                                        disabled={isSettingPassword}
                                                        minLength={6}
                                                    />
                                                </div>
                                                <div className="text-sm text-muted-foreground ml-auto col-span-4">
                                                    Password must be at least 6 characters long.
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <DialogClose>
                                                    <Button type="button" variant="secondary" disabled={isSettingPassword}>Cancel</Button>
                                                </DialogClose>
                                                <Button 
                                                    onClick={handleSetNewPassword} 
                                                    disabled={isSettingPassword || !newPassword.trim() || newPassword.length < 6}
                                                >
                                                    {isSettingPassword ? 'Setting...' : 'Set Password'}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                   {/* BARU: Delete User Button & AlertDialog */}
                                   <AlertDialog open={isDeleteDialogOpen && userForDeletion?._id === u._id} onOpenChange={(isOpen) => {
                                        if (!isOpen) {
                                            setIsDeleteDialogOpen(false);
                                            setUserForDeletion(null);
                                        }
                                    }}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" onClick={() => handleOpenDeleteDialog(u)} disabled={loggedInUser._id === u._id}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Confirm User Deletion</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete the user "{userForDeletion?.name}"? 
                                                    This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeletingUser}>
                                                    Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmDeleteUser} disabled={isDeletingUser} className="bg-destructive hover:bg-destructive/90">
                                                    {isDeletingUser ? "Deleting..." : "Delete User"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">No users found.</TableCell> {/* Translate text */}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default UserListPage; 