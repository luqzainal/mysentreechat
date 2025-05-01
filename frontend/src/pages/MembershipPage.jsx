import React, { useState, useEffect } from 'react';
import api from '../services/api'; // Instance Axios
import { useAuth } from '../contexts/AuthContext'; // Untuk check user
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Untuk paparkan nama pelan
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

const MembershipPage = () => {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth(); // Get the logged-in user

  // Fetch user profile when the component mounts
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/users/profile');
        setProfile(response.data);
      } catch (error) {
        console.error("Failed to get user profile:", error); // Translate error log
        toast.error("Failed to load membership information."); // Translate toast message
      } finally {
        setIsLoading(false);
      }
    };

    if (user) { // Ensure user is logged in
      fetchProfile();
    }
  }, [user]);

  // Function to format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { // Use US locale for English
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error("Date format error:", error); // Translate error log
      return dateString; // Return original string on error
    }
  };

  // Function to determine badge color based on plan
  const getBadgeVariant = (plan) => {
      switch (plan?.toLowerCase()) {
          case 'pro': return 'default'; // Default color (usually dark/primary)
          case 'basic': return 'secondary'; // Secondary color
          case 'free': return 'outline'; // Outline color
          default: return 'secondary';
      }
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Membership Status</CardTitle> {/* Translate title */}
          <CardDescription>Information about your current subscription plan.</CardDescription> {/* Translate description */}
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
              <p className="text-sm text-muted-foreground">Current Plan:</p> {/* Translate label */}
              <Badge variant={getBadgeVariant(profile.membershipPlan)} className="text-lg font-semibold mb-2">
                {profile.membershipPlan || 'Unknown'} {/* Translate fallback text */}
              </Badge>
              
              <p className="text-sm text-muted-foreground mt-4">Registration Date:</p> {/* Translate label */}
              <p>{formatDate(profile.createdAt)}</p>
              
              {/* Feature limits based on the plan can be added here */} 
              {/* Example: <p>Bulk Sending Limit: 100 / day</p> */}
              {/* Example: <p>Media Storage: 500MB</p> */} 
              
              {/* Add upgrade button if needed */}
              {/* Example: <Button className="mt-6">Upgrade Plan</Button> */}
            </div>
          ) : (
            <p className="text-red-600">Failed to load membership information.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MembershipPage; 