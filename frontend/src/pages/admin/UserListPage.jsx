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
import { Pencil, ShieldCheck, UserX } from 'lucide-react'; // Import new icons
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

const UserListPage = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user: loggedInUser } = useAuth(); // Rename user from context

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

    // Function to get token (not needed if interceptor works)
    // const getToken = () => { ... };

    // Fetch users (use api instance)
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Token added by interceptor
                const { data } = await api.get('/admin/users');
                setUsers(data);
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
                `/admin/users/${selectedUserForEdit._id}/plan`,
                { plan: newPlanForSelectedUser } // Send new plan in body
            );

            // Update user list in state
            setUsers(prevUsers => 
                prevUsers.map(u => 
                    u._id === updatedUser._id ? updatedUser : u
                )
            );

            toast.success(`Plan for ${updatedUser.name} updated successfully to ${updatedUser.membershipPlan}.`); // Translate toast message
            setIsEditDialogOpen(false); // Close dialog

        } catch (err) {
            console.error("Error updating user plan:", err); // Translate error log
            const message = err.response?.data?.message || "Failed to update plan."; // Translate error message
            toast.error(message); // Translate toast message
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
                `/admin/users/${userForRoleChange._id}/role`,
                { role: newRoleForChange } // Send new role in body
            );

            // Update user list in state
            setUsers(prevUsers => 
                prevUsers.map(u => 
                    u._id === updatedUser._id ? updatedUser : u
                )
            );

            toast.success(`Role for ${updatedUser.name} successfully changed to ${updatedUser.role}.`); // Translate toast message
            setIsRoleAlertOpen(false); // Close alert dialog
            setUserForRoleChange(null);
            setNewRoleForChange(null);

        } catch (err) {
            console.error("Error changing user role:", err); // Translate error log
            const message = err.response?.data?.message || "Failed to change role."; // Translate error message
            toast.error(message); // Translate toast message
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
            case 'basic': return 'default'; // Use default for Basic
            case 'pro': return 'success'; // Use success for Pro (ensure success color exists)
            default: return 'secondary';
        }
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
    const allowedPlans = ['Free', 'Basic', 'Pro']; // Adjust with your plans

    return (
        <div className="container mx-auto p-4 space-y-6">
            <h1 className="text-3xl font-bold">User Management</h1> {/* Translate heading */}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead> {/* Translate table header */}
                        <TableHead>Email</TableHead> {/* Translate table header */}
                        <TableHead>Role</TableHead> {/* Translate table header */}
                        <TableHead>Plan</TableHead> {/* Translate table header */}
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
                                    {/* Format date in English locale */} 
                                    {format(new Date(u.createdAt), 'PPpp')} 
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
                                                                <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                 <DialogClose asChild>
                                                     <Button type="button" variant="secondary" disabled={isUpdatingPlan}>Cancel</Button> {/* Translate button */}
                                                 </DialogClose>
                                                <Button onClick={handleUpdatePlan} disabled={isUpdatingPlan || newPlanForSelectedUser === selectedUserForEdit?.membershipPlan}>
                                                    {isUpdatingPlan ? 'Updating...' : 'Update Plan'} {/* Translate button text */}
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
                                                    variant={u.role === 'admin' ? "secondary" : "destructive"} // Button style changes based on action
                                                    size="sm" 
                                                    onClick={() => handleOpenRoleChangeAlert(u)}
                                                >
                                                    {u.role === 'admin' ? 
                                                        <><UserX className="h-4 w-4 mr-1" /> Revoke Admin</> // Translate button text
                                                        : <><ShieldCheck className="h-4 w-4 mr-1" /> Make Admin</> // Translate button text
                                                    }
                                                </Button>
                                           </AlertDialogTrigger>
                                           <AlertDialogContent>
                                               <AlertDialogHeader>
                                                   <AlertDialogTitle>Confirm Role Change</AlertDialogTitle> {/* Translate dialog title */}
                                                   <AlertDialogDescription>
                                                       Are you sure you want to change the role of {userForRoleChange?.name} to {newRoleForChange}? 
                                                       {newRoleForChange === 'admin' ? ' They will gain administrative privileges.' : ' Their administrative privileges will be revoked.'} 
                                                   </AlertDialogDescription> {/* Translate dialog description */}
                                               </AlertDialogHeader>
                                               <AlertDialogFooter>
                                                   <AlertDialogCancel disabled={isUpdatingRole}>Cancel</AlertDialogCancel> {/* Translate button */}
                                                   <AlertDialogAction onClick={handleConfirmRoleChange} disabled={isUpdatingRole} className={newRoleForChange === 'admin' ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}>
                                                        {isUpdatingRole ? 'Updating...' : 'Confirm Change'} {/* Translate button text */}
                                                   </AlertDialogAction>
                                               </AlertDialogFooter>
                                           </AlertDialogContent>
                                       </AlertDialog>
                                   )}
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">No users found.</TableCell> {/* Translate text */}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default UserListPage; 