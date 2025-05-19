import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "sonner";
import api from '../services/api';

// Import komponen shadcn/ui
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import Ikon
import {
  Users, 
  Send, 
  Bot, 
  Image as ImageIcon, 
  UserCog, 
  BadgeInfo, 
  ArrowRight,
  MessageSquareText,
  BarChart3,
  SendHorizonal,
  CalendarDays,
  AlertTriangle,
  PlusCircle,
  MoreHorizontal,
  Trash2,
  Copy,
  Edit
} from 'lucide-react';

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState({
      totalMessages: 0, 
      sentMessages: 0,
      failedMessages: 0,
  });
  const [campaigns, setCampaigns] = useState([]); 
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [isCampaignsLoading, setIsCampaignsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
      setIsAnalyticsLoading(true);
      setIsCampaignsLoading(true);
      
      try {
          const responseAnalytics = await api.get('/analytics/dashboard/overall-summary');
          setAnalytics(responseAnalytics.data);
      } catch (error) {
          console.error("Failed to fetch overall analytics:", error);
          toast.error("Could not load overall analytics.");
          setAnalytics({ totalMessages: 0, sentMessages: 0, failedMessages: 0 });
      } finally {
          setIsAnalyticsLoading(false);
      }

      try {
          const responseCampaigns = await api.get('/analytics/dashboard/bulk-campaign-summary'); 
          setCampaigns(responseCampaigns.data); 
      } catch (error) {
          console.error("Failed to fetch bulk campaigns for dashboard:", error);
          toast.error("Could not load bulk campaign list.");
          setCampaigns([]); 
      } finally {
          setIsCampaignsLoading(false);
      }
  }, []);

  useEffect(() => {
      if (user) {
          fetchDashboardData();
      }
  }, [user, fetchDashboardData]);

  const handleDeleteCampaign = async (campaignId, deviceId) => {
    if (!campaignId || !deviceId) {
        toast.error("Campaign ID or Device ID is missing.");
        return;
    }
    const confirmed = window.confirm("Are you sure you want to delete this campaign?");
    if (confirmed) {
        toast.info("Deleting campaign...");
        try {
            await api.delete(`/campaigns/${deviceId}/${campaignId}`);
            toast.success("Campaign deleted successfully!");
            fetchDashboardData(); // Refresh senarai
        } catch (error) {
            console.error("Failed to delete campaign:", error);
            toast.error(error.response?.data?.message || "Failed to delete campaign.");
        }
    }
  };

  const handleDuplicateCampaign = async (campaignId, deviceId) => {
    if (!campaignId || !deviceId) {
        toast.error("Campaign ID or Device ID is missing for duplication.");
        return;
    }
    toast.info("Duplicating campaign...");
    try {
        await api.post(`/campaigns/${deviceId}/${campaignId}/duplicate`);
        toast.success("Campaign duplicated successfully! Refreshing list...");
        fetchDashboardData(); // Refresh senarai
    } catch (error) {
        console.error("Failed to duplicate campaign:", error);
        toast.error(error.response?.data?.message || "Failed to duplicate campaign.");
    }
  };

  const handleEditCampaign = (campaignId, deviceId) => {
    if (!campaignId || !deviceId) {
        toast.error("Campaign ID or Device ID is missing for editing.");
        return;
    }
    navigate(`/dashboard/add-campaign/${deviceId}?type=bulk&editCampaignId=${campaignId}`);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Welcome, {user?.name || 'User'}!</h1>
      
      {/* Bahagian Analitik Ringkasan */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isAnalyticsLoading ? (
              <div className="text-2xl font-bold">Loading...</div>
            ) : (
              <div className="text-2xl font-bold">{analytics.totalMessages.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">Total outgoing messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <SendHorizonal className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            {isAnalyticsLoading ? (
              <div className="text-2xl font-bold">Loading...</div>
            ) : (
              <div className="text-2xl font-bold">{analytics.sentMessages.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">Successfully delivered or read</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            {isAnalyticsLoading ? (
              <div className="text-2xl font-bold">Loading...</div>
            ) : (
              <div className="text-2xl font-bold">{analytics.failedMessages.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">Delivery failures</p>
          </CardContent>
        </Card>
      </div>

      {/* Bahagian Senarai Kempen Bulk */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-semibold">Bulk Messaging Campaigns</CardTitle>
          <Link to="/dashboard/add-campaign?type=bulk">
            <Button variant="default">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Bulk Campaign
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isCampaignsLoading ? (
            <p>Loading campaigns...</p>
          ) : campaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Campaign Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Sent
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Failed
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{campaign.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{campaign.sent.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{campaign.failed.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCampaign(campaign.id, campaign.deviceId)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateCampaign(campaign.id, campaign.deviceId)}>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Duplicate</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteCampaign(campaign.id, campaign.deviceId)} className="text-red-600 hover:!text-red-700">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No bulk campaigns found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardPage; 