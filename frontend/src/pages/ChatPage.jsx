import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from 'lucide-react';

const ChatPage = () => {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();

  // TODO: Fetch contacts
  useEffect(() => {
    const fetchContacts = async () => {
      setIsLoadingContacts(true);
      try {
        // Assuming an endpoint /contacts exists
        const response = await api.get('/contacts'); 
        setContacts(response.data);
      } catch (error) {
        console.error("Failed to fetch contacts:", error);
        toast.error("Failed to load contacts.");
      } finally {
        setIsLoadingContacts(false);
      }
    };

    if (user) {
      fetchContacts();
    }
  }, [user]);

  // Function to fetch messages for selected contact
  const loadMessages = async (contactId) => {
    if (!contactId) return;
    const contact = contacts.find(c => c._id === contactId);
    if (!contact) {
        toast.error("Contact not found.");
        return;
    }
    setSelectedContact(contact);
    setIsLoadingMessages(true);
    setMessages([]); // Clear previous messages
    console.log(`Loading messages for contact ID: ${contactId}`);
    
    try {
      // Assume endpoint /whatsapp/chat/:contactId exists and returns an array of messages
      // Adjust the message structure { id, body, timestamp, fromMe } based on your actual backend response
      const response = await api.get(`/whatsapp/chat/${contactId}`); 
      setMessages(response.data || []); // Ensure it's an array
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error(error.response?.data?.message || "Failed to load chat history.");
      setMessages([]); // Clear messages on error
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Function to send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || isSending) return;

    setIsSending(true);
    const messageToSend = newMessage;
    const recipientNumber = selectedContact.phoneNumber; // Get phone number
    
    // Optimistic UI update
    const optimisticMessage = {
        id: `temp-${Date.now()}`,
        sender: user._id, // Assuming user object has _id
        body: messageToSend,
        timestamp: Date.now(),
        fromMe: true,
        status: 'sending' // Optional status indicator
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage(''); // Clear input immediately

    console.log(`Attempting to send message to ${recipientNumber}: ${messageToSend}`);
    
    try {
      // Assume endpoint /whatsapp/send exists
      // Backend should handle mapping phoneNumber to the correct WhatsApp ID/session
      const response = await api.post('/whatsapp/send', { 
        to: recipientNumber, // Send phone number
        message: messageToSend 
      });

      // Update message status after successful send (if backend confirms)
      setMessages(prev => prev.map(msg => 
          msg.id === optimisticMessage.id ? { ...msg, status: 'sent', id: response.data?.messageId || optimisticMessage.id } : msg // Replace temp id if possible
      ));

    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error(error.response?.data?.message || "Failed to send message.");
      // Revert optimistic update or mark as failed
      setMessages(prev => prev.map(msg => 
          msg.id === optimisticMessage.id ? { ...msg, status: 'failed' } : msg
      ));
      // setNewMessage(messageToSend); // Optionally restore input 
    } finally {
      setIsSending(false);
    }
  };
  
   // TODO: Setup Socket.IO listener for incoming messages
    useEffect(() => {
        // --- Backend interaction required ---
        // Example:
        // const socket = io(SOCKET_SERVER_URL); // Use existing socket logic if possible
        // socket.on('new_whatsapp_message', (messageData) => {
        //      console.log('Received message:', messageData);
        //      // Check if the message belongs to the currently selected chat
        //      if (selectedContact && messageData.senderId === selectedContact._id) { // Adjust based on actual data structure
        //          setMessages(prev => [...prev, { ...messageData, fromMe: false }]); 
        //          // Add logic to scroll down
        //      } else {
        //         // Optionally show a notification for messages from other chats
        //         toast.info(`New message from ${messageData.senderName || messageData.senderNumber}`);
        //      }
        // });
        // return () => {
        //     socket.off('new_whatsapp_message');
        //     // socket.disconnect(); // Only if socket is specific to this page
        // }
        // --- End Example ---
    }, [selectedContact]); // Re-run if selected contact changes


  return (
    <div className="flex h-[calc(100vh-theme(space.24))]"> {/* Adjust height based on your layout's header/nav */}
      {/* Contact List Sidebar */}
      <Card className="w-1/3 lg:w-1/4 border-r rounded-none">
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-theme(space.48))]"> {/* Adjust height */}
            {isLoadingContacts ? (
              <p className="p-4 text-center text-muted-foreground">Loading contacts...</p>
            ) : contacts.length === 0 ? (
               <p className="p-4 text-center text-muted-foreground">No contacts found.</p>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact._id}
                  className={`flex items-center w-full p-3 text-left hover:bg-muted/50 ${selectedContact?._id === contact._id ? 'bg-muted' : ''}`}
                  onClick={() => loadMessages(contact._id)}
                >
                  <Avatar className="h-9 w-9 mr-3">
                     {/* Assuming contacts might have an image URL */}
                    <AvatarImage src={contact.imageUrl || `https://avatar.vercel.sh/${contact.phoneNumber}.png`} alt={contact.name} /> 
                    <AvatarFallback>{contact.name?.substring(0, 1) || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 truncate">
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phoneNumber}</p>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <div className="flex flex-col flex-1 bg-muted/20">
        {!selectedContact ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a contact to start chatting.
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center p-4 border-b bg-background">
               <Avatar className="h-9 w-9 mr-3">
                   <AvatarImage src={selectedContact.imageUrl || `https://avatar.vercel.sh/${selectedContact.phoneNumber}.png`} alt={selectedContact.name} /> 
                   <AvatarFallback>{selectedContact.name?.substring(0, 1) || '?'}</AvatarFallback>
               </Avatar>
               <h2 className="font-semibold">{selectedContact.name}</h2>
               {/* Optional: Add status or other info here */}
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4 space-y-4">
               {isLoadingMessages ? (
                  <p className="text-center text-muted-foreground">Loading messages...</p>
               ) : messages.length === 0 ? (
                   <p className="text-center text-muted-foreground">No messages yet.</p>
               ): (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${msg.fromMe ? 'bg-primary text-primary-foreground' : 'bg-background border'}`}>
                        <p>{msg.body}</p>
                        <p className={`text-xs mt-1 ${msg.fromMe ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
               )}
               {/* TODO: Add scroll-to-bottom functionality */}
            </ScrollArea>

            {/* Message Input Area */}
            <div className="p-4 border-t bg-background">
              <form 
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }} 
                className="flex items-center space-x-2"
              >
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={isSending || isLoadingMessages}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatPage; 