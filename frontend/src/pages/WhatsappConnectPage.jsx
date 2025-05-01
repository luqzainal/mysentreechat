import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import QRCode from 'react-qr-code';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, QrCode as QrCodeIcon, Loader2, Link as LinkIcon, XCircle } from 'lucide-react'; // Import ikon

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
let socket = null; // Define socket outside component to avoid re-creation on re-renders

const WhatsappConnectPage = () => {
  const [rawQrString, setRawQrString] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // Initial state
  const [socketConnected, setSocketConnected] = useState(false);
  const { user } = useAuth();

  // Memoized function to initialize socket connection
  const connectSocket = useCallback(() => {
    if (!user?._id) {
       console.log("User ID not available yet, delaying socket connection.");
       setConnectionStatus('User not loaded');
       return; 
    }

    // Disconnect previous socket if exists
    if (socket && socket.connected) {
        console.log('Disconnecting existing socket before creating a new one.');
        socket.disconnect();
    }

    console.log("Attempting to connect socket...");
    socket = io(SOCKET_SERVER_URL, { 
       // transports: ['websocket'], // Optional: force websocket
       // autoConnect: false // Manage connection manually if needed
    });

    socket.on('connect', () => {
      console.log('Socket.IO Connected, ID:', socket.id);
      setSocketConnected(true);
      // Automatically request status upon socket connection?
      // Or wait for user action?
      // Let's assume the backend sends initial status on connection or we rely on button press
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO Disconnected:', reason);
      setSocketConnected(false);
      setConnectionStatus('disconnected'); // Reset WA status on socket disconnect
      setRawQrString(null);
      toast.error("Connection to server lost.");
    });

    socket.on('connect_error', (err) => {
        console.error("Socket Connection Error:", err);
        setSocketConnected(false);
        setConnectionStatus('disconnected');
        setRawQrString(null);
        toast.error(`Failed to connect to server: ${err.message}`);
    });

    // Listener for WhatsApp status from backend
    socket.on('whatsapp_status', (status) => {
      console.log('WhatsApp status received:', status);
      setConnectionStatus(status);
      if (status !== 'waiting_qr') {
        setRawQrString(null); // Clear QR if status is not waiting_qr
      }
    });

    // Listener for WhatsApp QR code (raw string)
    socket.on('whatsapp_qr', (qrString) => {
      console.log('QR Code string received');
      setRawQrString(qrString);
      setConnectionStatus('waiting_qr'); // Ensure status is waiting_qr
    });

     // Listener for error messages from backend
     socket.on('error_message', (message) => {
        console.error('Error from Backend:', message);
        toast.error(message);
        // Reset status if needed
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
          socket = null; // Clear the socket reference
      }
    };

  }, [user?._id]); // Dependency on user ID

  // Setup Socket connection on mount and when user changes
  useEffect(() => {
     return connectSocket();
  }, [connectSocket]);

  // Function to request a new WA connection
  const handleConnectRequest = () => {
    if (socket && socket.connected && user?._id) {
      console.log(`Sending whatsapp_connect_request for user: ${user._id}`);
      socket.emit('whatsapp_connect_request', user._id);
      setConnectionStatus('Connecting...'); // Update temporary status
      setRawQrString(null); // Reset QR while waiting
      toast.info("Requesting WhatsApp connection...");
    } else if (!socket || !socket.connected) {
       toast.error("Connection to server not ready. Please try again later.");
       // Optionally try to reconnect socket here
       // connectSocket(); 
    } else if (!user?._id) {
        toast.error("User ID not available. Please log in again.");
    }
  };

  // Function to request disconnection
  const handleDisconnectRequest = () => {
      if (socket && socket.connected) {
          console.log("Sending whatsapp_disconnect_request");
          socket.emit('whatsapp_disconnect_request');
          toast.info("Requesting WhatsApp disconnection...");
          // Status will be updated by the 'whatsapp_status' listener -> 'disconnected'
      } else {
           toast.error("No connection to server.");
      }
  }

  // Function to display status with icon
  const renderStatusDisplay = () => {
    let icon = <Loader2 className="animate-spin h-5 w-5 mr-2" />;
    let text = connectionStatus;
    let variant = "secondary";
    let description = "Your WhatsApp connection status.";

    switch (connectionStatus) {
      case 'connected':
        icon = <Wifi className="h-5 w-5 mr-2 text-green-600" />;
        text = "Connected";
        variant = "success";
        description = "Your WhatsApp is active and ready to use.";
        break;
      case 'disconnected':
        icon = <WifiOff className="h-5 w-5 mr-2 text-red-600" />;
        text = "Disconnected";
        variant = "destructive";
        description = "WhatsApp connection is inactive. Please connect.";
        break;
      case 'waiting_qr':
        icon = <QrCodeIcon className="h-5 w-5 mr-2 text-blue-600" />;
        text = "Waiting for QR Scan";
        variant = "outline";
        description = "Please scan the QR code below using your WhatsApp application.";
        break;
      case 'Connecting...':
         text = "Connecting...";
         variant = "secondary";
         description = "Attempting to connect to WhatsApp...";
        break;
       case 'User not loaded':
          icon = <XCircle className="h-5 w-5 mr-2 text-yellow-600" />;
          text = "User Not Ready";
          variant = "secondary";
          description = "Loading user information...";
          break;
       default:
        icon = <Loader2 className="animate-spin h-5 w-5 mr-2" />;
        variant = "secondary";
        description = `Status: ${connectionStatus}`; // Show actual status if unknown
        break;
    }

    return (
        <div className="flex flex-col items-center space-y-3">
           <Badge variant={variant} className="text-lg px-4 py-1">
              {icon}
              {text}
            </Badge>
            <p className="text-sm text-muted-foreground text-center">{description}</p>
        </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>WhatsApp Connection</CardTitle>
          <CardDescription>Manage your WhatsApp account connection.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          {renderStatusDisplay()}

          {connectionStatus === 'waiting_qr' && rawQrString && (
            <div className="p-4 bg-white rounded-lg shadow-md">
              <QRCode value={rawQrString} size={256} />
            </div>
          )}

          <div className="flex space-x-4">
            {connectionStatus === 'disconnected' && (
              <Button onClick={handleConnectRequest} disabled={!socketConnected || !user?._id}>
                 <LinkIcon className="mr-2 h-4 w-4" /> Connect / Rescan
              </Button>
            )}
            {connectionStatus === 'connected' && (
               <Button variant="destructive" onClick={handleDisconnectRequest} disabled={!socketConnected}>
                 <WifiOff className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            )}
            {/* Show connect button if status is uncertain & socket is connected */} 
            {connectionStatus !== 'connected' && connectionStatus !== 'disconnected' && connectionStatus !== 'waiting_qr' && connectionStatus !== 'Connecting...' && socketConnected && (
                 <Button onClick={handleConnectRequest} disabled={!user?._id}>
                     <LinkIcon className="mr-2 h-4 w-4" /> Try Connecting
                 </Button>
            )}
          </div>

           {!socketConnected && connectionStatus !== 'User not loaded' && (
                <p className="text-xs text-red-500">Connection to server lost. Try refreshing the page.</p>
            )}

        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsappConnectPage; 