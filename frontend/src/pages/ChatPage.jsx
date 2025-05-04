import React, { useState, useEffect, useRef } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SendHorizontal } from 'lucide-react';
import api from '../services/api'; // Instance Axios
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext'; // Anda mungkin perlukan ini untuk userId

function ChatPage() {
  const [chats, setChats] = useState([]);
  const [selectedChatJid, setSelectedChatJid] = useState(null);
  const [messages, setMessages] = useState([]);
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
    // Fetch chat list
    const fetchChats = async () => {
      setLoadingChats(true);
      setError(null);
      try {
        const response = await api.get('/whatsapp/chats');
        setChats(response.data);
      } catch (err) {
        console.error("Error fetching chats:", err);
        setError("Gagal memuatkan senarai perbualan.");
      }
      setLoadingChats(false);
    };
    fetchChats();

    // Setup Socket.IO
    if (user && user._id) {
        // Dapatkan URL backend dari environment variable Vite
        const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'; 
        console.log(`Connecting socket to: ${SOCKET_URL}`);
        socket.current = io(SOCKET_URL, {
            query: { userId: user._id }
        });

        socket.current.on('connect', () => {
            console.log('Socket connected for chat:', socket.current.id);
        });

        socket.current.on('new_whatsapp_message', (messageData) => {
            console.log('New message received via socket:', messageData);
            const chatJid = messageData.fromMe ? messageData.receiver : messageData.sender;

            // Kemaskini mesej jika chat sedang dipilih
            if (chatJid === selectedChatJid) {
                setMessages((prevMessages) => [...prevMessages, messageData]);
            }

            // Kemaskini senarai chats dengan mesej & timestamp terkini
            setChats(prevChats => {
                const chatIndex = prevChats.findIndex(c => c.jid === chatJid);
                let updatedChat;
                let otherChats;

                if (chatIndex > -1) {
                    // Chat sedia ada, kemaskini dan bawa ke atas
                    updatedChat = {
                        ...prevChats[chatIndex],
                        lastMessageBody: messageData.body,
                        lastMessageTimestamp: messageData.timestamp,
                        lastMessageFromMe: messageData.fromMe
                    };
                    otherChats = prevChats.filter(c => c.jid !== chatJid);
                } else {
                    // Chat baru, perlu dapatkan nama (jika ada) atau guna nombor
                    // Ini mungkin memerlukan panggilan API tambahan atau struktur data berbeza
                    // Buat masa ini, kita cipta chat baru dengan info asas
                    updatedChat = {
                        jid: chatJid,
                        name: chatJid.split('@')[0], // Guna nombor sebagai fallback
                        lastMessageBody: messageData.body,
                        lastMessageTimestamp: messageData.timestamp,
                        lastMessageFromMe: messageData.fromMe
                    };
                    otherChats = prevChats;
                     // Mungkin fetch nama kenalan di sini jika perlu
                     // api.get(`/contacts/by-number/${chatJid.split('@')[0]}`).then(...) 
                }
                return [updatedChat, ...otherChats]; // Letak chat terkini di atas
            });
        });

        socket.current.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        socket.current.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
        });

        // Cleanup on component unmount
        return () => {
            if (socket.current) {
                console.log('Disconnecting chat socket...');
                socket.current.disconnect();
            }
        };
    }

  }, [user, selectedChatJid]);

  useEffect(() => {
    // Fetch messages when a chat is selected
    const fetchMessages = async () => {
      if (!selectedChatJid) return;
      setLoadingMessages(true);
      setError(null);
      setMessages([]);
      try {
        const phoneNumber = selectedChatJid.split('@')[0];
        const response = await api.get(`/whatsapp/chat/${phoneNumber}`);
        // Pastikan data adalah array
        setMessages(Array.isArray(response.data) ? response.data : []); 
      } catch (err) {
        console.error("Error fetching messages:", err);
        setError("Gagal memuatkan mesej.");
        setMessages([]); // Pastikan state adalah array kosong jika ralat
      }
      setLoadingMessages(false);
    };

    fetchMessages();
  }, [selectedChatJid]);

  // Auto-scroll ke bawah apabila mesej baru ditambah
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
                  ) : messages.length === 0 ? (
                    <p className="text-center text-gray-500">Tiada mesej dalam perbualan ini.</p>
                  ) : (
                    messages.map((msg) => (
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