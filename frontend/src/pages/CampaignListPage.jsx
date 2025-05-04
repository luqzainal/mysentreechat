import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Edit, Trash2, ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import api from '../services/api';

// Contoh data kempen (gantikan dengan API)
const dummyCampaigns = [
  {
    id: 'camp1',
    name: 'Welcome Message',
    status: 'Enabled',
    useAI: true,
    media: true,
    link: false,
    lastEdited: '2024-03-10',
  },
  {
    id: 'camp2',
    name: 'Raya Promotion',
    status: 'Disabled',
    useAI: false,
    media: true,
    link: true,
    lastEdited: '2024-03-15',
  },
    {
    id: 'camp3',
    name: 'Follow Up Reminder',
    status: 'Enabled',
    useAI: true,
    media: false,
    link: false,
    lastEdited: '2024-03-18',
  },
];

function CampaignListPage() {
  const { numberId } = useParams();
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // State untuk menjejaki status update/delete
  const [isUpdating, setIsUpdating] = useState(null); // Store ID of campaign being updated/deleted

  useEffect(() => {
    const fetchCampaigns = async () => {
      setIsLoading(true);
      // TODO: Ganti dengan API call sebenar
      /*
      try {
          const response = await api.get(`/ai-chatbot/${numberId}/campaigns`);
          setCampaigns(response.data);
      } catch (error) {
          console.error(`Failed to fetch campaigns for ${numberId}:`, error);
          toast.error("Failed to load campaigns.");
          setCampaigns([]);
      } finally {
          setIsLoading(false);
      }
      */
      // Simulasi
      await new Promise(resolve => setTimeout(resolve, 500));
      setCampaigns(dummyCampaigns);
      setIsLoading(false);
    };

    fetchCampaigns();
  }, [numberId]);

  // TODO: Fungsi untuk toggle status kempen
  const handleToggleStatus = async (campaignId, currentStatus) => {
      const newStatus = currentStatus === 'Enabled' ? 'Disabled' : 'Enabled';
      setIsUpdating(campaignId);
      toast.info(`Updating status for campaign ${campaignId}...`);
      /*
      try {
          const response = await api.put(`/ai-chatbot/${numberId}/campaigns/${campaignId}/status`, { status: newStatus });
          setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: response.data.status } : c));
          toast.success("Campaign status updated.");
      } catch (error) {
           console.error("Failed to update campaign status:", error);
           toast.error("Failed to update status.");
      } finally {
           setIsUpdating(null);
      }
      */
      // Simulasi
      await new Promise(resolve => setTimeout(resolve, 600));
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: newStatus } : c));
      toast.success("Campaign status updated (Simulation).");
      setIsUpdating(null);
  };

  // TODO: Fungsi untuk padam kempen
   const handleDeleteCampaign = async (campaignId) => {
       if (!window.confirm("Are you sure you want to delete this campaign?")) return;
       setIsUpdating(campaignId);
       toast.info(`Deleting campaign ${campaignId}...`);
       /*
       try {
           await api.delete(`/ai-chatbot/${numberId}/campaigns/${campaignId}`);
           setCampaigns(prev => prev.filter(c => c.id !== campaignId));
           toast.success("Campaign deleted successfully.");
       } catch (error) {
           console.error("Failed to delete campaign:", error);
           toast.error("Failed to delete campaign.");
       } finally {
           setIsUpdating(null);
       }
       */
       // Simulasi
       await new Promise(resolve => setTimeout(resolve, 600));
       setCampaigns(prev => prev.filter(c => c.id !== campaignId));
       toast.success("Campaign deleted (Simulation).");
       setIsUpdating(null);
   };

  if (isLoading) {
    return (
        <div className="container mx-auto p-4 flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
             <h1 className="text-3xl font-bold">Campaign List</h1>
             <p className="text-muted-foreground">Manage campaigns for number ID: {numberId}</p>
         </div>
        <Button asChild>
            <Link to={`/ai-chatbot/${numberId}/campaigns/create`}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Campaign
            </Link>
        </Button>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>Your Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">No campaigns found for this number yet. Click 'Add New Campaign' to create one.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Last Edited</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id} className={isUpdating === campaign.id ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                           <Badge variant={campaign.status === 'Enabled' ? 'success' : 'destructive'}>
                               {campaign.status}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                            {campaign.useAI && <div>- AI Reply</div>}
                            {campaign.media && <div>- Media Attached</div>}
                            {campaign.link && <div>- Link Included</div>}
                        </TableCell>
                        <TableCell>{campaign.lastEdited}</TableCell>
                        <TableCell className="text-right space-x-1">
                           {/* View/Edit Button */}
                          <Button variant="ghost" size="icon" asChild disabled={isUpdating === campaign.id}>
                              {/* TODO: Nanti pautan edit perlu ke /ai-chatbot/:numberId/campaigns/:campaignId/edit */}
                              <Link to={`#edit-${campaign.id}`} title="Edit Campaign">
                                 <Edit className="h-4 w-4" />
                             </Link>
                          </Button>
                           {/* Toggle Status Button */}
                           <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                               disabled={isUpdating === campaign.id}
                               title={campaign.status === 'Enabled' ? 'Disable Campaign' : 'Enable Campaign'}
                            >
                              {campaign.status === 'Enabled' ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                           </Button>
                            {/* Delete Button */}
                           <Button
                               variant="ghost"
                               size="icon"
                               className="text-destructive hover:bg-destructive/10"
                               onClick={() => handleDeleteCampaign(campaign.id)}
                               disabled={isUpdating === campaign.id}
                               title="Delete Campaign"
                            >
                               <Trash2 className="h-4 w-4" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
           </CardContent>
      </Card>
    </div>
  );
}

export default CampaignListPage; 