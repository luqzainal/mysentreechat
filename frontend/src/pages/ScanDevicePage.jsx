import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import QRCode from 'react-qr-code';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, QrCode as QrCodeIcon, Loader2, Link as LinkIcon, XCircle, Smartphone, Trash2, Power } from 'lucide-react'; // Import ikon

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
let socket = null; // Define socket outside component

// Contoh data peranti (gantikan dengan API)
const dummyDevices = [
  { id: 'dev1', name: 'Primary Phone', number: '601133045231', connected: true },
  { id: 'dev2', name: 'Work Phone', number: '60189634390', connected: false },
];

// Contoh data had pelan (gantikan dengan data user/API)
const planLimits = {
    Free: 1,
    Basic: 3,
    Pro: 5
};
const currentUserPlan = 'Basic'; // Contoh

function ScanDevicePage() {
  const { user } = useAuth();
  const [rawQrString, setRawQrString] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState([]); // State untuk senarai peranti
  const [isDeviceListLoading, setIsDeviceListLoading] = useState(true);

   // TODO: Fetch connected devices list from API
   useEffect(() => {
       const fetchDevices = async () => {
           setIsDeviceListLoading(true);
           // Replace with actual API call
           /*
           try {
               const response = await api.get('/whatsapp/devices'); // Assume this endpoint exists
               setConnectedDevices(response.data);
           } catch (error) {
               console.error("Failed to fetch devices:", error);
               toast.error("Could not load connected device list.");
               setConnectedDevices(dummyDevices); // Fallback
           } finally {
               setIsDeviceListLoading(false);
           }
           */
           // Simulation
           setTimeout(() => {
               setConnectedDevices(dummyDevices);
               setIsDeviceListLoading(false);
           }, 700);
       };
       if(user) {
           fetchDevices();
       }
   }, [user]);

  // Salin logik socket dari DashboardPage
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
     console.log("Attempting to connect socket for QR scan...");
     // Mungkin perlu bezakan socket ini jika Dashboard juga guna socket serentak?
     // Buat masa ini, kita anggap ia berkongsi atau eksklusif.
     socket = io(SOCKET_SERVER_URL, { query: { userId: user._id } });

     socket.on('connect', () => {
       console.log('ScanDevice Socket.IO Connected:', socket.id);
       setSocketConnected(true);
       // Minta status semasa sebaik sahaja bersambung
       socket.emit('get_whatsapp_status'); 
     });
     socket.on('disconnect', (reason) => {
       console.log('ScanDevice Socket.IO Disconnected:', reason);
       setSocketConnected(false);
       setConnectionStatus('disconnected');
       setRawQrString(null);
     });
     socket.on('connect_error', (err) => {
         console.error("ScanDevice Socket Connection Error:", err);
         setSocketConnected(false);
         setConnectionStatus('disconnected');
         setRawQrString(null);
         toast.error(`Server connection failed: ${err.message}`);
     });
     socket.on('whatsapp_status', (status) => {
       console.log('ScanDevice WhatsApp status received:', status);
       setConnectionStatus(status);
       if (status !== 'waiting_qr') setRawQrString(null);
       // Jika status bertukar connected/disconnected, muat semula senarai peranti
       if (status === 'connected' || status === 'disconnected') {
           // TODO: Panggil fetchDevices() atau trigger refresh
           console.log("Status changed, should refresh device list.");
       }
     });
     socket.on('whatsapp_qr', (qrString) => {
       console.log('ScanDevice QR Code received');
       setRawQrString(qrString);
       setConnectionStatus('waiting_qr');
     });
     socket.on('error_message', (message) => {
         console.error('ScanDevice Error from Backend:', message);
         toast.error(message);
         if (connectionStatus === 'Connecting...') setConnectionStatus('disconnected');
     });

     // Pembersihan apabila komponen unmount
     return () => {
       console.log('Cleaning up ScanDevice socket connection...');
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
   }, [user?._id]); // Dependency pada user ID

   useEffect(() => {
     // Hanya setup socket jika user ada
     if (user?._id) {
        return connectSocket();
     }
   }, [user?._id, connectSocket]); // Connect socket apabila user ID tersedia

   const handleConnectRequest = () => {
     const currentDeviceCount = connectedDevices.filter(d => d.connected).length;
     const limit = planLimits[currentUserPlan] || 1;

     if (currentDeviceCount >= limit) {
         toast.error(`Cannot connect more devices. Your plan limit (${currentUserPlan}: ${limit}) has been reached.`);
         return;
     }

     if (socket && socket.connected && user?._id) {
       console.log(`ScanDevice: Sending whatsapp_connect_request for user: ${user._id}`);
       socket.emit('whatsapp_connect_request', user._id); // Mungkin perlu ID peranti spesifik?
       setConnectionStatus('Connecting...');
       setRawQrString(null);
       toast.info("Requesting new WhatsApp connection...");
     } else if (!socket || !socket.connected) {
        toast.error("Connection to server not ready. Please try again later.");
     } else if (!user?._id) {
         toast.error("User ID not available. Please log in again.");
     }
   };

   const handleDisconnectRequest = (deviceId = null) => {
       // Jika tiada deviceId diberi, assume putuskan sambungan sesi semasa
       // Jika ada deviceId, putuskan sambungan peranti spesifik (perlukan API backend)
       if (socket && socket.connected) {
           if (deviceId) {
               console.log(`ScanDevice: Sending whatsapp_disconnect_device request for device: ${deviceId}`);
               // TODO: Perlukan event socket atau endpoint API baru
               // socket.emit('whatsapp_disconnect_device', deviceId);
               toast.info(`Requesting disconnection for device ${deviceId}... (Not Implemented)`);
           } else {
                console.log("ScanDevice: Sending whatsapp_disconnect_request for current session");
                socket.emit('whatsapp_disconnect_request');
                toast.info("Requesting WhatsApp disconnection...");
           }
       } else {
            toast.error("No connection to server.");
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
      <h1 className="text-3xl font-bold">Scan Device</h1>

      {/* Kad untuk Imbas QR & Status Semasa */}
      <Card className="max-w-2xl mx-auto">
          <CardHeader>
             <div className="flex justify-between items-center">
                 <CardTitle>Connect New Device</CardTitle>
                 {renderStatusDisplay()}
             </div>
             <CardDescription>
                Scan the QR code with your WhatsApp application to link a new device.
                Your current plan ({currentUserPlan}) allows up to {planLimits[currentUserPlan] || 1} connected device(s).
             </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
              {connectionStatus === 'waiting_qr' && rawQrString && (
                 <div className="p-4 bg-white rounded-lg shadow-inner border">
                     <QRCode value={rawQrString} size={250} />
                 </div>
              )}
              {(connectionStatus === 'disconnected' || connectionStatus === 'User not loaded') && (
                  <Button onClick={handleConnectRequest} disabled={!socketConnected || !user?._id}>
                      <QrCodeIcon className="mr-2 h-4 w-4" /> Generate QR Code
                  </Button>
              )}
              {connectionStatus === 'connected' && (
                  <div className="text-center text-green-600">
                      <p>A device is currently connected.</p>
                      <Button variant="destructive" size="sm" onClick={() => handleDisconnectRequest()} className="mt-2">
                          <Power className="mr-2 h-4 w-4" /> Disconnect Current Session
                      </Button>
                  </div>
              )}
              {connectionStatus === 'Connecting...' && (
                  <p className="text-muted-foreground">Connecting, please wait...</p>
              )}
               {!socketConnected && connectionStatus !== 'User not loaded' && (
                    <p className="text-xs text-red-500">Connection to server lost. Please reload the page.</p>
               )}
          </CardContent>
      </Card>

      {/* Kad untuk Senarai Peranti Tersambung */}
       <Card>
           <CardHeader>
               <CardTitle>Connected Devices</CardTitle>
               <CardDescription>Manage devices linked to your account.</CardDescription>
           </CardHeader>
           <CardContent>
               {isDeviceListLoading ? (
                   <p>Loading device list...</p>
               ) : connectedDevices.length === 0 ? (
                   <p className="text-muted-foreground">No devices are currently connected.</p>
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
                               {device.connected ? (
                                   <Button variant="outline" size="sm" onClick={() => handleDisconnectRequest(device.id)}>
                                       <Power className="mr-1.5 h-4 w-4" /> Disconnect
                                   </Button>
                               ) : (
                                   <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { /* TODO: Implement remove device */ toast.info('Remove function not implemented.') }}>
                                       <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                                   </Button>
                               )}
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