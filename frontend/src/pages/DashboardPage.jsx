import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  PlusCircle
} from 'lucide-react';

function DashboardPage() {
  const { user } = useAuth();

  const [analytics, setAnalytics] = useState({
      totalMessages: 0, 
      sentMessages: 0,
      failedMessages: 0,
  });
  const [campaigns, setCampaigns] = useState([]); 
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);
  const [isCampaignsLoading, setIsCampaignsLoading] = useState(true);

  useEffect(() => {
      const fetchDashboardData = async () => {
          setIsAnalyticsLoading(true);
          setIsCampaignsLoading(true);
          
          // Fetch Analitik Ringkasan Keseluruhan
          try {
              const responseAnalytics = await api.get('/analytics/dashboard/overall-summary');
              setAnalytics(responseAnalytics.data); // Data: { totalMessages, sentMessages, failedMessages }
          } catch (error) {
              console.error("Failed to fetch overall analytics:", error);
              toast.error("Could not load overall analytics.");
              // Kekalkan nilai default jika gagal
              setAnalytics({ totalMessages: 0, sentMessages: 0, failedMessages: 0 });
          } finally {
              setIsAnalyticsLoading(false);
          }

          // Fetch Senarai Kempen Pukal
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
      };

      if (user) {
          fetchDashboardData();
      }
  }, [user]);

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
          <Link to="/add-campaign?type=bulk">
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Failed
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{campaign.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">{campaign.sent.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{campaign.failed.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No bulk campaigns found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardPage; 