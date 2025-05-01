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

// Import Ikon
import {
  Users, 
  Send, 
  Bot, 
  Image as ImageIcon, 
  UserCog, 
  BadgeInfo, 
  ArrowRight,
  Wifi, WifiOff, QrCode as QrCodeIcon, Loader2, Link as LinkIcon, XCircle
} from 'lucide-react';

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
let socket = null;

function DashboardPage() {
  const { user } = useAuth();

  // State untuk sambungan WhatsApp
  const [rawQrString, setRawQrString] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [socketConnected, setSocketConnected] = useState(false);

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
    socket = io(SOCKET_SERVER_URL);
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
        toast.error(`Gagal menyambung ke pelayan: ${err.message}`);
    });
    socket.on('whatsapp_status', (status) => {
      console.log('Status WhatsApp diterima:', status);
      setConnectionStatus(status);
      if (status !== 'waiting_qr') {
        setRawQrString(null);
      }
    });
    socket.on('whatsapp_qr', (qrString) => {
      console.log('String QR Code diterima');
      setRawQrString(qrString);
      setConnectionStatus('waiting_qr');
    });
     socket.on('error_message', (message) => {
        console.error('Ralat dari Backend:', message);
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
      console.log(`Menghantar whatsapp_connect_request untuk user: ${user._id}`);
      socket.emit('whatsapp_connect_request', user._id);
      setConnectionStatus('Connecting...'); 
      setRawQrString(null); 
      toast.info("Meminta sambungan WhatsApp...");
    } else if (!socket || !socket.connected) {
       toast.error("Sambungan ke pelayan belum sedia. Sila cuba sebentar lagi.");
    } else if (!user?._id) {
        toast.error("User ID tidak tersedia. Sila log masuk semula.");
    }
  };

  // Salin semula handleDisconnectRequest
  const handleDisconnectRequest = () => {
      if (socket && socket.connected) {
          console.log("Menghantar whatsapp_disconnect_request");
          socket.emit('whatsapp_disconnect_request');
          toast.info("Meminta putus sambungan WhatsApp...");
      } else {
           toast.error("Sambungan ke pelayan tiada.");
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
        text = "Tersambung";
        variant = "success";
        break;
      case 'disconnected':
        icon = <WifiOff className="h-5 w-5 mr-2 text-red-600" />;
        text = "Terputus";
        variant = "destructive";
        break;
      case 'waiting_qr':
        icon = <QrCodeIcon className="h-5 w-5 mr-2 text-blue-600" />;
        text = "Menunggu Imbasan QR";
        variant = "outline";
        break;
      case 'Connecting...':
         text = "Menyambung...";
         break;
       case 'User not loaded':
          icon = <XCircle className="h-5 w-5 mr-2 text-yellow-600" />;
          text = "Pengguna Belum Sedia";
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

  // Definisi kad-kad menu/modul
  const modules = [
    {
      title: "Kenalan",
      description: "Urus senarai kenalan WhatsApp anda.",
      link: "/contacts",
      icon: Users,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      title: "Bulk Sender",
      description: "Hantar mesej pukal ke kenalan.",
      link: "/bulk-sender",
      icon: Send,
      bgColor: "bg-green-100",
      iconColor: "text-green-600"
    },
    {
      title: "Autoresponder + AI",
      description: "Tetapkan balasan automatik dengan AI.",
      link: "/autoresponder",
      icon: Bot,
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600"
    },
    {
      title: "Storan Media",
      description: "Muat naik dan urus fail media.",
      link: "/media-storage",
      icon: ImageIcon,
       bgColor: "bg-orange-100",
      iconColor: "text-orange-600"
    },
     {
      title: "Keahlian",
      description: "Lihat pelan langganan semasa.",
      link: "/membership",
      icon: BadgeInfo,
       bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600"
    },
    {
      title: "Pengurus Akaun",
      description: "Kemaskini profil dan tetapan akaun.",
      link: "/account",
      icon: UserCog,
       bgColor: "bg-gray-100",
      iconColor: "text-gray-600"
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Selamat Datang, {user?.name || 'Pengguna'}!</h1>
      
       {/* Wrapper untuk mengehadkan lebar dan memusatkan Kad Sambungan WhatsApp */}
      <div className="max-w-3xl mx-auto">
          {/* Bahagian Status & QR WhatsApp */}
          <Card>
            {/* Ubah header untuk memusatkan kandungan */}
            <CardHeader className="flex flex-col items-center space-y-2 pb-2">
              <CardTitle className="text-lg font-medium">Sambungan WhatsApp</CardTitle>
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
                  <p className="mt-2 text-center text-sm text-muted-foreground">Imbas kod ini menggunakan WhatsApp anda.</p>
                </div>
              )}
              
              <div className="flex space-x-4">
                {connectionStatus === 'disconnected' && (
                  <Button size="sm" onClick={handleConnectRequest} disabled={!socketConnected || !user?._id}>
                     <LinkIcon className="mr-2 h-4 w-4" /> Sambung / Imbas Semula
                  </Button>
                )}
                {connectionStatus === 'connected' && (
                   <Button size="sm" variant="destructive" onClick={handleDisconnectRequest} disabled={!socketConnected}>
                     <WifiOff className="mr-2 h-4 w-4" /> Putuskan Sambungan
                  </Button>
                )}
                {connectionStatus !== 'connected' && connectionStatus !== 'disconnected' && connectionStatus !== 'waiting_qr' && connectionStatus !== 'Connecting...' && socketConnected && (
                     <Button size="sm" onClick={handleConnectRequest} disabled={!user?._id}>
                         <LinkIcon className="mr-2 h-4 w-4" /> Cuba Sambung
                     </Button>
                )}
              </div>
               {!socketConnected && connectionStatus !== 'User not loaded' && (
                    <p className="text-xs text-red-500">Sambungan ke pelayan terputus. Cuba muat semula halaman.</p>
                )}
            </CardContent>
          </Card>
       </div>

      <p className="text-muted-foreground">
        Urus semua keperluan WhatsApp anda dari sini.
      </p>

      {/* Grid Kad Modul */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card key={module.link} className="hover:shadow-md transition-shadow duration-200 flex flex-col">
              <CardHeader className="flex flex-row items-center space-x-4 pb-2">
                <div className={`p-3 rounded-full ${module.bgColor}`}> 
                   <module.icon className={`h-6 w-6 ${module.iconColor}`} />
                </div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{module.description}</CardDescription>
              </CardContent>
               <div className="p-4 pt-0 text-right">
                 <Link to={module.link} className="text-sm font-medium text-primary hover:underline inline-flex items-center">
                   Pergi ke Modul <ArrowRight className="ml-1 h-4 w-4" />
                 </Link>
               </div>
            </Card>
          ))}
       </div>
    </div>
  );
}

export default DashboardPage; 