import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  const { user, refreshUserData } = useAuth();
  const [rawQrString, setRawQrString] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState([]); // State untuk senarai peranti
  const [isDeviceListLoading, setIsDeviceListLoading] = useState(true);
  const fetchTimeoutRef = useRef(null); // For debouncing fetchDevices

  const currentUserPlan = user?.membershipPlan || 'Free';
  console.log("[ScanDevicePage] User object from useAuth:", user);
  console.log("[ScanDevicePage] currentUserPlan determined as:", currentUserPlan);

  // Memoize plan calculations to prevent recalculation
  const limitForCurrentPlan = useMemo(() => {
    const limit = planLimits[currentUserPlan.toLowerCase()] || 1;
    console.log("[ScanDevicePage] Limit for current plan (", currentUserPlan, ") is:", limit);
    return limit;
  }, [currentUserPlan]);

  // Memoize connected devices count
  const connectedDevicesCount = useMemo(() => {
    return connectedDevices.filter(d => d.connectionStatus === 'connected').length;
  }, [connectedDevices]);

  // Fetch devices (dijadikan useCallback)
  const fetchDevices = useCallback(async (showLoading = true) => {
      if (!user) return; // Jangan fetch jika user belum ada
      
      // Only show loading for initial fetch or manual refresh
      if (showLoading) {
          setIsDeviceListLoading(true);
      }
      
      try {
          const response = await api.get('/whatsapp/devices');
          setConnectedDevices(response.data || []); // API sepatutnya kembalikan array
      } catch (error) {
          console.error("Failed to fetch devices:", error);
          toast.error("Could not load connected device list.");
          setConnectedDevices([]); // Kosongkan jika gagal
      } finally {
          if (showLoading) {
              setIsDeviceListLoading(false);
          }
      }
  }, [user]); // Dependency pada user

  // Debounced version of fetchDevices with longer delay to prevent blinking
  const debouncedFetchDevices = useCallback(() => {
      if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(() => {
          fetchDevices(false); // Don't show loading spinner for debounced updates
      }, 2000); // Wait 2 seconds before fetching to reduce blinking
  }, [fetchDevices]);

  // useEffect untuk fetch devices pada muatan awal dan bila fetchDevices berubah
  useEffect(() => {
      fetchDevices();
  }, [fetchDevices]);

  // Auto-refresh user data when window gets focus (to get latest plan changes)
  useEffect(() => {
      const handleWindowFocus = async () => {
          try {
              await refreshUserData();
              console.log("[ScanDevicePage] User data refreshed on window focus");
          } catch (error) {
              console.error("[ScanDevicePage] Failed to refresh user data:", error);
          }
      };

      window.addEventListener('focus', handleWindowFocus);
      return () => window.removeEventListener('focus', handleWindowFocus);
  }, [refreshUserData]);

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
      setConnectionStatus(prevStatus => {
        // Only update if status actually changed to prevent unnecessary re-renders
        if (prevStatus === status) return prevStatus;
        console.log(`[ScanDevicePage] Status changing from ${prevStatus} to ${status}`);
        return status;
      });
      
      // Only clear QR if status is not waiting_qr
      if (status !== 'waiting_qr') {
        setRawQrString(prevQr => {
          if (prevQr === null) return prevQr;
          console.log("[ScanDevicePage] Clearing QR code");
          return null;
        });
      }
      
      // Only fetch devices on specific status changes to reduce blinking
      if (status === 'connected') {
          // Fetch devices after successful connection
          debouncedFetchDevices();
      } else if (status === 'disconnected') {
          // Fetch devices after disconnection (less frequent)
          debouncedFetchDevices();
      }
      // Removed 'limit_reached' to reduce unnecessary fetches
    });
    socket.on('whatsapp_qr', (qrString) => {
      console.log("[ScanDevicePage] WhatsApp QR string received from backend:", qrString ? qrString.substring(0,30) + '...' : 'EMPTY_QR_STRING');
      setRawQrString(prevQr => {
        // Only update if QR actually changed
        if (prevQr === qrString) return prevQr;
        return qrString;
      });
      if (qrString) {
        setConnectionStatus('waiting_qr');
      }
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
  }, [user?._id, debouncedFetchDevices]); // Include debouncedFetchDevices

  useEffect(() => {
    if (user?._id) {
        // Panggil connectSocket, yang akan mengembalikan fungsi cleanup
        const cleanupSocket = connectSocket();
        // Kembalikan fungsi cleanup ini dari useEffect
        return () => {
            // Clear any pending fetch timeout
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }
            // Clean up socket
            if (cleanupSocket) cleanupSocket();
        };
    }
  }, [user?._id]); // Remove connectSocket dependency to prevent recreation

  const handleConnectRequest = useCallback(() => {
    if (connectedDevicesCount >= limitForCurrentPlan) {
        toast.error(`Cannot connect more devices. Your plan (${currentUserPlan}: ${limitForCurrentPlan} device(s)) limit has been reached.`);
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
  }, [connectedDevicesCount, limitForCurrentPlan, currentUserPlan, user?._id]);

  const handleDisconnectRequest = useCallback(async (deviceId = null) => {
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
  }, [fetchDevices]);

  // Memoize status display to prevent unnecessary re-renders
  const statusDisplay = useMemo(() => {
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
  }, [connectionStatus]); // Only re-compute when connectionStatus changes

  // Memoize device list to prevent unnecessary re-renders
  const deviceList = useMemo(() => {
    if (isDeviceListLoading) {
      return <p>Loading device list...</p>;
    }
    
    if (connectedDevices.length === 0) {
      return <p className="text-muted-foreground">No devices are currently linked to your account.</p>;
    }
    
    return (
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
              onClick={() => handleDisconnectRequest(device.id)}
            >
              {device.connected ? <Power className="mr-1.5 h-4 w-4" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              {device.connected ? "Disconnect" : "Remove Registration"} 
            </Button>
          </div>
        ))}
      </div>
    );
  }, [connectedDevices, isDeviceListLoading]); // Only re-render when devices or loading state changes

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Scan Device</h1>
        <RefreshButton onRefresh={async () => {
          // Refresh both device list and user data
          await Promise.all([
            fetchDevices(),
            refreshUserData().catch(err => console.error("Failed to refresh user data:", err))
          ]);
        }} position="relative" />
      </div>

      {/* Kad untuk Imbas QR & Status Semasa */}
      <Card className="max-w-2xl mx-auto">
          <CardHeader>
             <div className="flex justify-between items-center">
                 <CardTitle>Connect New Device</CardTitle>
                 {statusDisplay}
             </div>
             <CardDescription>
                Scan the QR code with your WhatsApp. 
                Your plan ({currentUserPlan}) allows up to {limitForCurrentPlan} connected device(s).
             </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
              {/* PAPARKAN QR JIKA DALAM PROSES MENUNGGU SCAN */}
              {connectionStatus === 'waiting_qr' && rawQrString && (
                 <div className="p-4 bg-white rounded-lg shadow-inner border" key={rawQrString}>
                     <QRCode value={rawQrString} size={250} />
                 </div>
              )}

              {/* PAPARKAN BUTANG GENERATE JIKA BELUM SAMPAI HAD & TIDAK SEDANG CONNECTING/WAITING */}
              { connectionStatus !== 'Connecting...' && connectionStatus !== 'waiting_qr' &&
                connectedDevicesCount < limitForCurrentPlan && (
                  <Button onClick={handleConnectRequest} disabled={!socketConnected || !user?._id}>
                      <QrCodeIcon className="mr-2 h-4 w-4" /> Connect Another Device
                  </Button>
              )}

              {/* Tunjukkan mesej connecting */}
              {connectionStatus === 'Connecting...' && (
                  <p className="text-muted-foreground">Connecting, please wait...</p>
              )}

              {/* Tunjukkan jika had dicapai */}
              { connectedDevicesCount >= limitForCurrentPlan &&
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
               {deviceList}
               {/* TODO: Add pagination or scrolling if list is long */} 
           </CardContent>
       </Card>

    </div>
  );
}

export default ScanDevicePage; 