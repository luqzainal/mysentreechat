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
  const { user, login } = useAuth(); // Get login function to update user state + token
  const [formData, setFormData] = useState({
    name: '',
    email: '', // Email is typically non-editable
    password: '', // For password update
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Populate form with current user data when component mounts
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
      setIsLoading(false);
    } else {
       // If user is not yet available (context might be loading), wait
       setIsLoading(true);
    }
  }, [user]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Submit update data to backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Password and confirmation password do not match."); // Translate toast message
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        // Do not send email if it's non-editable
      };
      // Only send password if it's filled
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await api.put('/users/profile', payload);
      
      // Update AuthContext state with new data & new token
      login(response.data, response.data.token); 

      toast.success("Profile updated successfully."); // Translate toast message
      // Reset password fields after success
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));

    } catch (error) {
      console.error("Failed to update profile:", error); // Translate error log
      const errorMessage = error.response?.data?.message || "Error updating profile."; // Translate error message
      toast.error(`Failed: ${errorMessage}`); // Translate toast message
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
            <CardTitle>Account Manager</CardTitle> {/* Translate title */}
            <CardDescription>Update your profile information and password.</CardDescription> {/* Translate description */}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label> {/* Translate label */}
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
              <Label htmlFor="email">Email</Label> {/* Translate label */}
              <Input 
                id="email"
                name="email"
                type="email"
                value={formData.email}
                readOnly // Make read-only
                disabled // Also disable visually
                className="cursor-not-allowed"
              />
               <p className="text-sm text-muted-foreground">
                   Email cannot be changed. {/* Translate text */}
                 </p>
            </div>
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password (leave blank to keep current)</Label> {/* Translate label */}
              <Input 
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                disabled={isSaving}
              />
            </div>
            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label> {/* Translate label */}
              <Input 
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isSaving || !formData.password} // Disable if password is empty
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'} {/* Translate button text */}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AccountPage; 