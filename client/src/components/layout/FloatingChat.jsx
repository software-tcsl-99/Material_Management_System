import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import { useActiveRole } from '../../hooks/useActiveRole';

const FloatingChat = ({ transactionId, barcodes = [] }) => {
  const { user } = useAuthStore();
  const activeRole = useActiveRole();
  const [open, setOpen] = useState(false);
  const [activeBarcode, setActiveBarcode] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Check custom event to open chat (e.g. from MobileNav)
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-global-chat', handleOpen);
    return () => window.removeEventListener('open-global-chat', handleOpen);
  }, []);

  // Set default barcode thread if available
  useEffect(() => {
    if (barcodes.length > 0 && !activeBarcode) {
      setActiveBarcode(barcodes[0]);
    }
  }, [barcodes, activeBarcode]);

  const fetchChatMessages = async () => {
    if (!activeBarcode) return;
    setLoading(true);
    try {
      const res = await api.get(`/barcodes/${activeBarcode}/chat`);
      setMessages(res.data.data || []);
    } catch (err) {
      console.error('Error fetching chat:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatMessages();
    
    // Poll for new messages every 5 seconds as socket fallback
    const interval = setInterval(fetchChatMessages, 5000);
    return () => clearInterval(interval);
  }, [activeBarcode]);

  useEffect(() => {
    // Scroll to bottom on new message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeBarcode) return;
    try {
      const res = await api.post(`/barcodes/${activeBarcode}/chat`, {
        message: text,
        transactionId
      });
      setMessages([...messages, res.data.data]);
      setText('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message');
    }
  };

  if (!transactionId) return null;

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-6 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl transition-transform hover:scale-105 z-40 cursor-pointer flex items-center justify-center border border-indigo-500/20"
        title="Open Transaction Chat"
      >
        <MessageSquare className="w-6 h-6 animate-pulse" />
      </button>

      {/* Drawer / Sheet Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Chat Panel - slide in from right (Desktop) / bottom (Mobile) */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full md:h-screen shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-250 border-l border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/20">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Transaction Messages</h3>
                <span className="text-[10px] font-bold text-slate-400">Dossier: {transactionId}</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thread selector */}
            {barcodes.length > 0 && (
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Barcode:</span>
                <select
                  value={activeBarcode}
                  onChange={(e) => setActiveBarcode(e.target.value)}
                  className="w-full text-xs font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 focus:outline-none focus:border-indigo-500 text-indigo-600 dark:text-indigo-400"
                >
                  {barcodes.map(bc => (
                    <option key={bc} value={bc}>{bc}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Message streams */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-950/10">
              {loading && messages.length === 0 ? (
                <div className="flex justify-center items-center h-full"><Spinner size="sm" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">No messages in this loop thread.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                  return (
                    <div key={idx} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                      <span className="text-[9px] font-bold text-slate-400 mb-0.5">{msg.sender?.fullName}</span>
                      <div className={`px-3 py-2 rounded-2xl text-xs shadow-sm font-semibold
                        ${isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'}
                      `}>
                        {msg.message}
                      </div>
                      <span className="text-[8px] text-slate-400 mt-1">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a secure audit comment..."
                required
                className="flex-1 text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingChat;
