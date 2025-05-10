import React, { useState, useEffect, useRef } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SendHorizontal, Smartphone } from 'lucide-react';
import api from '../services/api'; // Instance Axios
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext'; // Anda mungkin perlukan ini untuk userId
import { toast } from 'sonner'; // BARU: Import toast
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function ChatPage() {
  const [userDevices, setUserDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);

  const [chats, setChats] = useState([]);
  const [currentChatMessages, setCurrentChatMessages] = useState([]);
  const [selectedChatJid, setSelectedChatJid] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth(); // Dapatkan data pengguna, termasuk ID
  const socket = useRef(null);
  const messagesEndRef = useRef(null); // Rujukan untuk auto-scroll

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Fetch senarai peranti pengguna
    const fetchUserDevices = async () => {
      if (!user) return;
      setIsLoadingDevices(true);
      try {
        const response = await api.get('/whatsapp/devices');
        setUserDevices(response.data || []);
        if (response.data && response.data.length > 0) {
          setSelectedDeviceId(response.data[0].id); // Pilih peranti pertama sebagai default
        } else {
          toast.info("No WhatsApp device connected. Please connect a device on Scan Device page.");
        }
      } catch (err) {
        console.error("Error fetching user devices:", err);
        toast.error("Could not load your WhatsApp devices.");
      } finally {
        setIsLoadingDevices(false);
      }
    };
    fetchUserDevices();

    // Fetch chat list
    const fetchChats = async () => {
      if (!user || !selectedDeviceId) {
        setChats([]);
        setLoadingChats(false);
        return;
      }
      setLoadingChats(true);
      setError(null);
      try {
        const response = await api.get(`/whatsapp/chats?deviceId=${selectedDeviceId}`);
        setChats(response.data || []);
      } catch (err) {
        console.error("Error fetching chats:", err);
        setError("Gagal memuatkan senarai perbualan.");
        setChats([]);
      }
      setLoadingChats(false);
    };
    fetchChats();

    // Setup Socket.IO
    if (user && user._id && selectedDeviceId) {
        const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'; 
        if (socket.current) socket.current.disconnect();
        
        socket.current = io(SOCKET_URL, {
            query: { userId: user._id, deviceId: selectedDeviceId } 
        });
        console.log(`Connecting socket for chat with userId: ${user._id} and deviceId: ${selectedDeviceId}`);

        socket.current.on('connect', () => console.log('Socket connected for chat:', socket.current.id));
        socket.current.on('new_whatsapp_message', (messageData) => {
            console.log('New message via socket:', messageData);
            if (messageData.sourceDeviceId !== selectedDeviceId) {
                console.log(`Message from different device (${messageData.sourceDeviceId}), ignoring for current view (${selectedDeviceId})`);
                return;
            }

            const chatJid = messageData.fromMe ? messageData.receiver : messageData.sender;
            if (chatJid === selectedChatJid) {
                setCurrentChatMessages((prevMessages) => [...prevMessages, messageData]);
            }
            setChats(prevChats => {
                const chatIndex = prevChats.findIndex(c => c.jid === chatJid);
                let updatedChat;
                const otherChats = prevChats.filter(c => c.jid !== chatJid);
                if (chatIndex > -1) {
                    updatedChat = { ...prevChats[chatIndex], lastMessageBody: messageData.body, lastMessageTimestamp: messageData.timestamp, lastMessageFromMe: messageData.fromMe };
                } else {
                    updatedChat = { jid: chatJid, name: messageData.senderName || chatJid.split('@')[0], lastMessageBody: messageData.body, lastMessageTimestamp: messageData.timestamp, lastMessageFromMe: messageData.fromMe };
                }
                return [updatedChat, ...otherChats].sort((a, b) => new Date(b.lastMessageTimestamp) - new Date(a.lastMessageTimestamp));
            });
        });
        socket.current.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
        socket.current.on('connect_error', (err) => console.error('Socket connection error:', err));

        return () => {
            if (socket.current) {
                console.log('Disconnecting chat socket...');
                socket.current.disconnect();
            }
        };
    }

  }, [user, selectedDeviceId, selectedChatJid]);

  useEffect(() => {
    // Fetch messages when a chat is selected
    const fetchMessages = async () => {
      if (!selectedChatJid || !selectedDeviceId) return;
      setLoadingMessages(true);
      setError(null);
      setCurrentChatMessages([]);
      try {
        const phoneNumber = selectedChatJid.split('@')[0];
        const response = await api.get(`/whatsapp/chat/${phoneNumber}?deviceId=${selectedDeviceId}`);
        setCurrentChatMessages(Array.isArray(response.data) ? response.data : []); 
      } catch (err) {
        console.error("Error fetching messages:", err);
        setError("Gagal memuatkan mesej.");
        setCurrentChatMessages([]);
      }
      setLoadingMessages(false);
    };

    fetchMessages();
  }, [selectedChatJid, selectedDeviceId]);

  // Auto-scroll ke bawah apabila mesej baru ditambah
  useEffect(() => {
    scrollToBottom();
  }, [currentChatMessages]);

  const handleSelectChat = (jid) => {
    setSelectedChatJid(jid);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChatJid) return;

    const messageToSend = newMessage;
    setNewMessage('');

    try {
      await api.post('/whatsapp/send', {
        to: selectedChatJid.split('@')[0],
        message: messageToSend,
      });
      // Mesej yang berjaya dihantar akan dikemas kini melalui socket
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Gagal menghantar mesej.");
      setNewMessage(messageToSend);
    }
  };

  return (
    <div className="flex flex-col h-screen p-4 space-y-4">
      <h1 className="text-2xl font-bold">Chat</h1>
      {error && <p className="text-red-500">{error}</p>}
      <ResizablePanelGroup direction="horizontal" className="flex-1 border rounded-lg">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <div className="flex flex-col h-full">
            <div className="p-4 font-semibold border-b">
              Senarai Perbualan
            </div>
            <ScrollArea className="flex-1">
              {loadingChats ? (
                <p className="p-4 text-center text-gray-500">Memuatkan...</p>
              ) : chats.length === 0 ? (
                 <p className="p-4 text-center text-gray-500">Tiada perbualan ditemui.</p>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.jid}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-100 ${
                      selectedChatJid === chat.jid ? 'bg-gray-200' : ''
                    }`}
                    onClick={() => handleSelectChat(chat.jid)}
                  >
                    <div className="flex items-center space-x-3">
                       <Avatar className="h-10 w-10">
                           {/* TODO: Add Avatar Image if available */}
                           <AvatarFallback>{chat.name?.substring(0, 2).toUpperCase() || '??'}</AvatarFallback>
                       </Avatar>
                       <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{chat.name}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {chat.lastMessageFromMe ? 'Anda: ' : ''}
                            {chat.lastMessageBody}
                          </p>
                       </div>
                       <p className="text-xs text-gray-400">
                           {chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                       </p>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full">
            {selectedChatJid ? (
              <>
                <div className="p-4 border-b flex items-center space-x-3">
                   <Avatar className="h-10 w-10">
                       <AvatarFallback>{(chats.find(c=>c.jid===selectedChatJid)?.name || '?').substring(0, 2).toUpperCase()}</AvatarFallback>
                   </Avatar>
                  <h2 className="font-semibold text-lg">{chats.find(c=>c.jid===selectedChatJid)?.name || selectedChatJid}</h2>
                </div>
                <ScrollArea className="flex-1 bg-gray-50 p-4">
                  {loadingMessages ? (
                    <p className="text-center text-gray-500">Memuatkan mesej...</p>
                  ) : currentChatMessages.length === 0 ? (
                    <p className="text-center text-gray-500">Tiada mesej dalam perbualan ini.</p>
                  ) : (
                    currentChatMessages.map((msg) => (
                      <div
                        key={msg.id || msg.messageId} // Guna msg.id (dari DB) atau messageId (dari socket)
                        className={`flex mb-3 ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`rounded-lg px-4 py-2 max-w-[70%] ${
                            msg.fromMe
                              ? 'bg-blue-500 text-white'
                              : 'bg-white text-black border'
                          }`}
                        >
                          <p>{msg.body}</p>
                          <p className="text-xs opacity-70 mt-1 text-right">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </ScrollArea>
                <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
                  <div className="flex items-center space-x-2">
                    <Input
                      type="text"
                      placeholder="Taip mesej..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1"
                      disabled={loadingMessages}
                    />
                    <Button type="submit" size="icon" disabled={!newMessage.trim() || loadingMessages}>
                      <SendHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Pilih perbualan untuk mula berbual.
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default ChatPage; 