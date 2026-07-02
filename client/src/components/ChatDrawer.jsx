import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { X, Send, Paperclip, Smile, Image as ImageIcon, FileText } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import api from '../lib/api';

export default function ChatDrawer() {
  const user = useAuthStore((s) => s.user);
  const { chatDrawerOpen, chatTransactionId, closeChatDrawer } = useUIStore();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [members, setMembers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load chat history & members
  useEffect(() => {
    if (!chatTransactionId || !chatDrawerOpen) return;

    // Load messages
    api.get(`/chat/${chatTransactionId}/messages`)
      .then(({ data }) => {
        setMessages(data.messages);
        setIsLocked(data.chatLocked);
      })
      .catch(err => console.error(err));

    // Load members
    api.get(`/chat/${chatTransactionId}/members`)
      .then(({ data }) => {
        setMembers(data.members);
      })
      .catch(err => console.error(err));

    // Socket connection
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      auth: { userId: user._id }
    });
    socketRef.current = socket;

    socket.emit('join_transaction', chatTransactionId);

    // Socket listeners
    socket.on('chat_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('user_typing', ({ userId, userName }) => {
      if (userId !== user._id) {
        setTypingUser(userName);
      }
    });

    socket.on('user_stop_typing', ({ userId }) => {
      if (userId !== user._id) {
        setTypingUser(null);
      }
    });

    return () => {
      socket.emit('leave_transaction', chatTransactionId);
      socket.disconnect();
    };
  }, [chatTransactionId, chatDrawerOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    
    // Typing indicator trigger
    if (socketRef.current && chatTransactionId) {
      socketRef.current.emit('typing', { transactionId: chatTransactionId, userName: user.fullName });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('stop_typing', { transactionId: chatTransactionId });
      }, 2000);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLocked) return;

    const textToSend = inputText;
    setInputText('');

    try {
      await api.post(`/chat/${chatTransactionId}/messages`, {
        message: textToSend
      });
      if (socketRef.current) {
        socketRef.current.emit('stop_typing', { transactionId: chatTransactionId });
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  if (!chatDrawerOpen) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={closeChatDrawer} />

      {/* Slide-out Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[420px] max-w-[90vw] bg-white z-50 shadow-2xl flex flex-col animate-fade-in border-l border-slate-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm tracking-wide">TXN CHAT SYSTEM</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{chatTransactionId}</p>
          </div>
          <button onClick={closeChatDrawer} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member list bar */}
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">Members:</span>
            <span className="text-xs font-bold text-primary bg-primary-light px-2 py-0.5 rounded-full">
              {members.length}
            </span>
          </div>
          {/* Avatar stack */}
          <div className="flex -space-x-1.5 overflow-hidden">
            {members.slice(0, 4).map((m, i) => (
              <div
                key={m._id}
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-300 text-[10px] flex items-center justify-center font-bold text-slate-600"
                title={`${m.fullName} (${m.role})`}
              >
                {m.fullName.charAt(0)}
              </div>
            ))}
            {members.length > 4 && (
              <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-800 text-[10px] flex items-center justify-center font-bold text-white">
                +{members.length - 4}
              </div>
            )}
          </div>
        </div>

        {/* Message body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Smile className="w-12 h-12 opacity-35 mb-2 text-slate-500" />
              <p className="text-sm font-semibold">Start the Conversation</p>
              <p className="text-xs text-slate-500">Discuss requests, statuses, and barcode splits/transfers here.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
              return (
                <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Name label */}
                  {!isMe && (
                    <span className="text-[10px] font-bold text-slate-500 mb-1 ml-1">
                      {msg.sender?.fullName || 'System'} ({msg.sender?.role?.replace('_', ' ')})
                    </span>
                  )}
                  {/* Bubble */}
                  <div className={`chat-bubble ${isMe ? 'chat-bubble-sent' : 'chat-bubble-received shadow-sm'}`}>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  {/* Timestamp */}
                  <span className="text-[9px] text-slate-400 mt-1 mx-1 font-medium">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          {typingUser && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium italic animate-pulse">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
              <span>{typingUser} is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input panel */}
        <div className="p-4 border-t border-slate-200 bg-white">
          {isLocked ? (
            <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl text-xs text-center font-medium">
              🔒 Chat is locked because this transaction is closed/archived.
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2 items-center">
              <button
                type="button"
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition"
                title="Attach Document"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type your message..."
                className="flex-1 py-2 px-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-slate-50"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2.5 rounded-xl transition ${
                  inputText.trim()
                    ? 'bg-primary text-white hover:bg-primary-dark shadow-md'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
