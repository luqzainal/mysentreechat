import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import QRCode from 'react-qr-code';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "sonner";

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
import { Progress } from "@/components/ui/progress";

// Import Ikon
import {
  Users, 
  Send, 
  Bot, 
  Image as ImageIcon, 
  UserCog, 
  BadgeInfo, 
  ArrowRight,
  Wifi, WifiOff, QrCode as QrCodeIcon, Loader2, Link as LinkIcon, XCircle,
  MessageSquareText,
  BarChart3,
  SendHorizonal
} from 'lucide-react';

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
let socket = null;

function DashboardPage() {
  const { user } = useAuth();

  // State untuk sambungan WhatsApp
  const [rawQrString, setRawQrString] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [socketConnected, setSocketConnected] = useState(false);

  // State BARU untuk data analitik
  const [analytics, setAnalytics] = useState({
      totalSent: 0,
      monthlyUsagePercent: 0,
      monthlyUsed: 0,
      monthlyLimit: 0,
      bulkTotal: 0,
      bulkSent: 0,
      bulkFailed: 0,
  });
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  // Salin semula fungsi connectSocket dari WhatsappConnectPage
  const connectSocket = useCallback(() => {
    if (!user?._id) {
       console.log("User ID not available yet, delaying socket connection.");
       setConnectionStatus('User not loaded');
       return; 
    }
    if (socket && socket.connected) {
        console.log('Disconnecting existing socket before creating a new one.');
        socket.disconnect();
    }
    console.log("Attempting to connect socket...");
    socket = io(SOCKET_SERVER_URL, { 
        query: { userId: user._id }
    });
    socket.on('connect', () => {
      console.log('Socket.IO Connected, ID:', socket.id);
      setSocketConnected(true);
    });
    socket.on('disconnect', (reason) => {
      console.log('Socket.IO Disconnected:', reason);
      setSocketConnected(false);
      setConnectionStatus('disconnected'); 
      setRawQrString(null);
    });
    socket.on('connect_error', (err) => {
        console.error("Socket Connection Error:", err);
        setSocketConnected(false);
        setConnectionStatus('disconnected');
        setRawQrString(null);
        toast.error(`Failed to connect to server: ${err.message}`);
    });
    socket.on('whatsapp_status', (status) => {
      console.log('WhatsApp status received:', status);
      setConnectionStatus(status);
      if (status !== 'waiting_qr') {
        setRawQrString(null);
      }
    });
    socket.on('whatsapp_qr', (qrString) => {
      console.log('QR Code string received');
      setRawQrString(qrString);
      setConnectionStatus('waiting_qr');
    });
     socket.on('error_message', (message) => {
        console.error('Error from Backend:', message);
        toast.error(message);
        if (connectionStatus === 'Connecting...') {
             setConnectionStatus('disconnected');
        }
    });
    return () => {
      console.log('Cleaning up socket connection...');
      if (socket) {
          socket.off('connect');
          socket.off('disconnect');
          socket.off('connect_error');
          socket.off('whatsapp_status');
          socket.off('whatsapp_qr');
          socket.off('error_message');
          socket.disconnect();
          socket = null; 
      }
    };
  }, [user?._id]);

  // Salin semula useEffect untuk connectSocket
  useEffect(() => {
     return connectSocket();
  }, [connectSocket]);

  // Salin semula handleConnectRequest
  const handleConnectRequest = () => {
    if (socket && socket.connected && user?._id) {
      console.log(`Sending whatsapp_connect_request for user: ${user._id}`);
      socket.emit('whatsapp_connect_request', user._id);
      setConnectionStatus('Connecting...'); 
      setRawQrString(null); 
      toast.info("Requesting WhatsApp connection...");
    } else if (!socket || !socket.connected) {
       toast.error("Connection to server not ready. Please try again later.");
    } else if (!user?._id) {
        toast.error("User ID not available. Please log in again.");
    }
  };

  // Salin semula handleDisconnectRequest
  const handleDisconnectRequest = () => {
      if (socket && socket.connected) {
          console.log("Sending whatsapp_disconnect_request");
          socket.emit('whatsapp_disconnect_request');
          toast.info("Requesting WhatsApp disconnection...");
      } else {
           toast.error("No connection to server.");
      }
  }

  // Salin semula renderStatusDisplay (atau versi ringkas)
  const renderStatusDisplay = () => {
    let icon = <Loader2 className="animate-spin h-5 w-5 mr-2" />;
    let text = connectionStatus;
    let variant = "secondary";

    switch (connectionStatus) {
      case 'connected':
        icon = <Wifi className="h-5 w-5 mr-2 text-green-600" />;
        text = "Connected";
        variant = "success";
        break;
      case 'disconnected':
        icon = <WifiOff className="h-5 w-5 mr-2 text-red-600" />;
        text = "Disconnected";
        variant = "destructive";
        break;
      case 'waiting_qr':
        icon = <QrCodeIcon className="h-5 w-5 mr-2 text-blue-600" />;
        text = "Waiting for QR Scan";
        variant = "outline";
        break;
      case 'Connecting...':
         text = "Connecting...";
         break;
       case 'User not loaded':
          icon = <XCircle className="h-5 w-5 mr-2 text-yellow-600" />;
          text = "User Not Ready";
          break;
       default:
        break;
    }
    return (
        <Badge variant={variant} className="text-md px-3 py-1">
           {icon}
           {text}
         </Badge>
    );
  };

  // Fetch data analitik
  useEffect(() => {
      const fetchAnalytics = async () => {
          setIsAnalyticsLoading(true);
          // TODO: Ganti dengan API call sebenar
          /*
          try {
              const response = await api.get('/analytics/chat');
              setAnalytics(response.data);
          } catch (error) {
              console.error("Failed to fetch chat analytics:", error);
              toast.error("Could not load chat analytics.");
              // Kekalkan state default atau set kepada null/error state
          } finally {
              setIsAnalyticsLoading(false);
          }
          */
          // Simulasi
          setTimeout(() => {
               setAnalytics({
                  totalSent: 10293,
                  monthlyUsagePercent: 75,
                  monthlyUsed: 7500,
                  monthlyLimit: 10000,
                  bulkTotal: 1250,
                  bulkSent: 1200,
                  bulkFailed: 50,
              });
              setIsAnalyticsLoading(false);
          }, 800);
      };

      if (user) {
          fetchAnalytics();
      }

  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, {user?.name || 'User'}!</h1>
      
       {/* Wrapper untuk mengehadkan lebar dan memusatkan Kad Sambungan WhatsApp */}
      <div className="max-w-3xl mx-auto">
          {/* Bahagian Status & QR WhatsApp */}
          <Card>
            {/* Ubah header untuk memusatkan kandungan */}
            <CardHeader className="flex flex-col items-center space-y-2 pb-2">
              <CardTitle className="text-lg font-medium">WhatsApp Connection</CardTitle>
              {renderStatusDisplay()} 
            </CardHeader>
            {/* Pastikan content juga memusatkan item */}
            <CardContent className="flex flex-col items-center pt-4 space-y-4">
               {connectionStatus === 'waiting_qr' && rawQrString && (
                <div className="p-4 bg-white rounded-lg shadow-md">
                  {/* Bungkus QRCode dalam div untuk pemusatan */}
                  <div className="flex justify-center">
                    <QRCode value={rawQrString} size={200} /> 
                  </div>
                  <p className="mt-2 text-center text-sm text-muted-foreground">Scan this code using your WhatsApp.</p>
                </div>
              )}
              
              <div className="flex space-x-4">
                {connectionStatus === 'disconnected' && (
                  <Button size="sm" onClick={handleConnectRequest} disabled={!socketConnected || !user?._id}>
                     <LinkIcon className="mr-2 h-4 w-4" /> Connect / Re-Connect
                  </Button>
                )}
                {connectionStatus === 'connected' && (
                   <Button size="sm" variant="destructive" onClick={handleDisconnectRequest} disabled={!socketConnected}>
                     <WifiOff className="mr-2 h-4 w-4" /> Disconnect
                  </Button>
                )}
                {connectionStatus !== 'connected' && connectionStatus !== 'disconnected' && connectionStatus !== 'waiting_qr' && connectionStatus !== 'Connecting...' && socketConnected && (
                     <Button size="sm" onClick={handleConnectRequest} disabled={!user?._id}>
                         <LinkIcon className="mr-2 h-4 w-4" /> Re-Connect
                     </Button>
                )}
              </div>
               {!socketConnected && connectionStatus !== 'User not loaded' && (
                    <p className="text-xs text-red-500">Connection to server lost. Please reload the page.</p>
                )}
            </CardContent>
          </Card>
       </div>

      {/* Bahagian Analitik Chat BARU - Guna state */}
      <h2 className="text-2xl font-semibold">Chat Analytics</h2>
      {isAnalyticsLoading ? (
           <p>Loading analytics...</p>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Kad Total Messages Sent */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages Sent</CardTitle>
                <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalSent.toLocaleString()}</div>
                {/* <p className="text-xs text-muted-foreground">+15% from last month</p> */}{/* Data ini mungkin perlu API berbeza */}
              </CardContent>
            </Card>

            {/* Kad Messages by Month */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.monthlyUsagePercent}%</div>
                <p className="text-xs text-muted-foreground mb-2">
                    {analytics.monthlyUsed.toLocaleString()} / {analytics.monthlyLimit.toLocaleString()} messages used
                 </p>
                <Progress value={analytics.monthlyUsagePercent} aria-label={`${analytics.monthlyUsagePercent}% message usage`} />
              </CardContent>
            </Card>

            {/* Kad Bulk Messaging Stats */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bulk Messaging</CardTitle>
                <SendHorizonal className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.bulkTotal.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total Campaigns Sent</p>
                 <div className="mt-2 text-sm space-y-1">
                     <div>Sent: <span className="font-medium">{analytics.bulkSent.toLocaleString()}</span></div>
                     <div>Failed: <span className="font-medium text-destructive">{analytics.bulkFailed.toLocaleString()}</span></div>
                 </div>
              </CardContent>
            </Card>
          </div>
      )}
    </div>
  );
}

export default DashboardPage; 