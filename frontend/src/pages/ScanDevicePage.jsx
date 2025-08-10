import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import QRCode from 'react-qr-code';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, QrCode as QrCodeIcon, Loader2, Link as LinkIcon, XCircle, Smartphone, Trash2, Power } from 'lucide-react'; // Import ikon
import api from '../services/api'; // BARU: Import api

// Import Refresh Button
import RefreshButton from '../components/RefreshButton';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
let socket = null; // Define socket outside component

// Contoh data peranti (gantikan dengan API)
const dummyDevices = [
  { id: 'dev1', name: 'Primary Phone', number: '601133045231', connected: true },
  { id: 'dev2', name: 'Work Phone', number: '60189634390', connected: false },
];

// Contoh data had pelan (gantikan dengan data user/API)
const planLimits = {
    free: 1,
    basic: 3,
    pro: 5
};
// const currentUserPlan = 'Basic'; // Ini mungkin patut datang dari user.membershipPlan

function ScanDevicePage() {
  const { user } = useAuth();
  const [rawQrString, setRawQrString] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState([]); // State untuk senarai peranti
  const [isDeviceListLoading, setIsDeviceListLoading] = useState(true);

  const currentUserPlan = user?.membershipPlan || 'Free';
  console.log("[ScanDevicePage] User object from useAuth:", user);
  console.log("[ScanDevicePage] currentUserPlan determined as:", currentUserPlan);

  const limitForCurrentPlan = planLimits[currentUserPlan.toLowerCase()] || 1;
  console.log("[ScanDevicePage] Limit for current plan (", currentUserPlan, ") is:", limitForCurrentPlan);

  // Fetch devices (dijadikan useCallback)
  const fetchDevices = useCallback(async () => {
      if (!user) return; // Jangan fetch jika user belum ada
      setIsDeviceListLoading(true);
      try {
          const response = await api.get('/whatsapp/devices');
          setConnectedDevices(response.data || []); // API sepatutnya kembalikan array
      } catch (error) {
          console.error("Failed to fetch devices:", error);
          toast.error("Could not load connected device list.");
          setConnectedDevices([]); // Kosongkan jika gagal
      } finally {
          setIsDeviceListLoading(false);
      }
  }, [user]); // Dependency pada user

  // useEffect untuk fetch devices pada muatan awal dan bila fetchDevices berubah
  useEffect(() => {
      fetchDevices();
  }, [fetchDevices]);

  // Logik socket
  const connectSocket = useCallback(() => {
    if (!user?._id) {
      console.log("[ScanDevicePage] User ID not available, delaying socket connection.");
      setConnectionStatus('User not loaded');
      return;
    }
    if (socket && socket.connected) {
        console.log("[ScanDevicePage] Disconnecting existing socket before creating a new one.");
        socket.disconnect();
    }
    console.log("[ScanDevicePage] Attempting to connect socket to:", SOCKET_SERVER_URL);
    socket = io(SOCKET_SERVER_URL, { 
      query: { userId: user._id },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    socket.on('connect', () => {
      console.log("[ScanDevicePage] Socket.IO Connected, ID:", socket.id);
      setSocketConnected(true);
      socket.emit('get_whatsapp_status'); 
    });
    socket.on('disconnect', (reason) => {
      console.log("[ScanDevicePage] Socket.IO Disconnected. Reason:", reason);
      setSocketConnected(false);
      setConnectionStatus('disconnected');
      setRawQrString(null);
    });
    socket.on('connect_error', (err) => {
      console.error("[ScanDevicePage] Socket Connection Error:", err);
      setSocketConnected(false);
      setConnectionStatus('disconnected');
      setRawQrString(null);
      toast.error(`Server connection failed: ${err.message}`);
    });
    socket.on('whatsapp_status', (status) => {
      console.log("[ScanDevicePage] WhatsApp status received from backend:", status);
      setConnectionStatus(status); // Ini masih okay untuk set state di sini
      if (status !== 'waiting_qr') setRawQrString(null);
      if (status === 'connected' || status === 'disconnected' || status === 'limit_reached') {
          fetchDevices(); 
      }
    });
    socket.on('whatsapp_qr', (qrString) => {
      console.log("[ScanDevicePage] WhatsApp QR string received from backend:", qrString ? qrString.substring(0,30) + '...' : 'EMPTY_QR_STRING');
      setRawQrString(qrString);
      setConnectionStatus('waiting_qr');
    });
    socket.on('error_message', (message) => {
      console.error("[ScanDevicePage] Error message from backend:", message);
      toast.error(message);
      // Elakkan setConnectionStatus di sini jika ia menyebabkan loop. 
      // Backend patut hantar status yang betul jika error berlaku semasa connecting.
      // if (connectionStatus === 'Connecting...') setConnectionStatus('disconnected'); 
    });

    return () => {
      console.log('[ScanDevicePage] Cleaning up socket connection...');
      if (socket) {
          socket.off('connect');
          socket.off('disconnect');
          socket.off('connect_error');
          socket.off('whatsapp_status');
          socket.off('whatsapp_qr');
          socket.off('error_message');
          if (socket.connected) socket.disconnect();
          socket = null;
      }
    };
  }, [user?._id, fetchDevices]);

  useEffect(() => {
    if (user?._id) {
        // Panggil connectSocket, yang akan mengembalikan fungsi cleanup
        const cleanupSocket = connectSocket();
        // Kembalikan fungsi cleanup ini dari useEffect
        return cleanupSocket;
    }
  }, [user?._id, connectSocket]); // connectSocket kini lebih stabil

  const handleConnectRequest = () => {
    const currentActiveDeviceCount = connectedDevices.filter(d => d.connected).length;
    const limit = limitForCurrentPlan;

    if (currentActiveDeviceCount >= limit) {
        toast.error(`Cannot connect more devices. Your plan (${currentUserPlan}: ${limit} device(s)) limit has been reached.`);
        return;
    }
    if (socket && socket.connected && user?._id) {
      console.log(`[ScanDevicePage] Sending whatsapp_connect_request for user: ${user._id}`);
      socket.emit('whatsapp_connect_request', user._id);
      setConnectionStatus('Connecting...');
      setRawQrString(null);
      toast.info("Requesting new WhatsApp connection...");
    } else {
       console.warn("[ScanDevicePage] Cannot send connect request. Socket connected: ", socket?.connected, "User ID: ", user?._id);
       toast.error("Connection to server not ready or user not available.");
    }
  };

  const handleDisconnectRequest = async (deviceId = null) => {
      if (deviceId) { // Putuskan sambungan peranti spesifik dan padam dari DB
          toast.info(`Attempting to remove device ${deviceId}...`);
          try {
              await api.delete(`/whatsapp/devices/${deviceId}`);
              toast.success(`Device ${deviceId} removed successfully.`);
              fetchDevices(); // Muat semula senarai
              // Jika peranti yang dipadam adalah yang sedang aktif dalam sesi QR/status semasa, reset status
              // Ini mungkin perlukan logik tambahan jika deviceId yang dipadam sama dengan yang sedang dipaparkan statusnya.
              // Buat masa ini, kita hanya muat semula senarai.
          } catch (error) {
              console.error(`Failed to remove device ${deviceId}:`, error);
              toast.error(error.response?.data?.message || `Could not remove device ${deviceId}.`);
          }
      } else { // Putuskan sambungan sesi imbasan QR semasa
          if (socket && socket.connected) {
              socket.emit('whatsapp_disconnect_request');
              toast.info("Requesting current session disconnection...");
          } else {
               toast.error("No active server connection to disconnect session.");
          }
      }
  }

  // Papar status sambungan
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

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Scan Device</h1>
        <RefreshButton onRefresh={fetchDevices} position="relative" />
      </div>

      {/* Kad untuk Imbas QR & Status Semasa */}
      <Card className="max-w-2xl mx-auto">
          <CardHeader>
             <div className="flex justify-between items-center">
                 <CardTitle>Connect New Device</CardTitle>
                 {renderStatusDisplay()}
             </div>
             <CardDescription>
                Scan the QR code with your WhatsApp. 
                Your plan ({currentUserPlan}) allows up to {limitForCurrentPlan} connected device(s).
             </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
              {/* PAPARKAN QR JIKA DALAM PROSES MENUNGGU SCAN */}
              {connectionStatus === 'waiting_qr' && rawQrString && (
                 <div className="p-4 bg-white rounded-lg shadow-inner border">
                     <QRCode value={rawQrString} size={250} />
                 </div>
              )}

              {/* PAPARKAN BUTANG GENERATE JIKA BELUM SAMPAI HAD & TIDAK SEDANG CONNECTING/WAITING */}
              { connectionStatus !== 'Connecting...' && connectionStatus !== 'waiting_qr' &&
                connectedDevices.filter(d => d.connectionStatus === 'connected').length < limitForCurrentPlan && (
                  <Button onClick={handleConnectRequest} disabled={!socketConnected || !user?._id}>
                      <QrCodeIcon className="mr-2 h-4 w-4" /> Connect Another Device
                  </Button>
              )}

              {/* Tunjukkan mesej connecting */}
              {connectionStatus === 'Connecting...' && (
                  <p className="text-muted-foreground">Connecting, please wait...</p>
              )}

              {/* Tunjukkan jika had dicapai */}
              { connectedDevices.filter(d => d.connectionStatus === 'connected').length >= limitForCurrentPlan &&
                connectionStatus !== 'waiting_qr' && connectionStatus !== 'Connecting...' && (
                 <p className="text-sm text-yellow-600">Connection limit reached for your plan.</p>
              )}

              {/* Mesej jika socket tiada */}
               {!socketConnected && connectionStatus !== 'User not loaded' && (
                    <p className="text-xs text-red-500">Connection to server lost. Please reload the page.</p>
               )}

               {/* DIKELUARKAN: Mesej "A device is currently connected." dan butang disconnect session QR, 
                   kerana kita kini mengurus peranti individu dalam senarai di bawah. 
               */}
              {/* {connectionStatus === 'connected' && ( ... ) } */}

          </CardContent>
      </Card>

      {/* Kad untuk Senarai Peranti Tersambung */}
       <Card>
           <CardHeader>
               <CardTitle>Your Connected Devices</CardTitle>
               <CardDescription>Manage devices linked to your account.</CardDescription>
           </CardHeader>
           <CardContent>
               {isDeviceListLoading ? (
                   <p>Loading device list...</p>
               ) : connectedDevices.length === 0 ? (
                   <p className="text-muted-foreground">No devices are currently linked to your account.</p>
               ) : (
                   <div className="space-y-3">
                       {connectedDevices.map(device => (
                           <div key={device.id} className="flex items-center justify-between rounded-lg border p-3">
                               <div className="flex items-center space-x-3">
                                   <Smartphone className={`h-6 w-6 ${device.connected ? 'text-green-600' : 'text-muted-foreground'}`} />
                                   <div>
                                       <p className="font-medium">{device.name}</p>
                                       <p className="text-sm text-muted-foreground">{device.number}</p>
                                   </div>
                               </div>
                               <Button 
                                   variant={device.connected ? "outline" : "destructive"} 
                                   size="sm" 
                                   onClick={() => handleDisconnectRequest(device.id)} // Sentiasa panggil dengan device.id
                                >
                                   {device.connected ? <Power className="mr-1.5 h-4 w-4" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                                   {device.connected ? "Disconnect" : "Remove Registration"} 
                               </Button>
                           </div>
                       ))}
                   </div>
               )}
               {/* TODO: Add pagination or scrolling if list is long */} 
           </CardContent>
       </Card>

    </div>
  );
}

export default ScanDevicePage; 