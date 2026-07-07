import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Clock, User, Users, Send, ChevronLeft, MoreVertical, Paperclip, Check, CheckCheck, Plus } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardBody, Badge, Table, Spinner, Button, Input, Textarea, Modal, Select } from '@/components/ui';
import { formatDate, formatTime, cn } from '@/lib/utils';

function ComplaintModal({ open, onClose, onSuccess }) {
  const [recipients, setRecipients] = useState([]);
  const [form, setForm] = useState({ type: 'group', recipientId: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      api.get('/complaints/recipients').then(res => setRecipients(res.data.data));
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/complaints', {
        isGroup: form.type === 'group',
        recipientId: form.type === 'individual' ? form.recipientId : null,
        subject: form.subject,
        message: form.message
      });
      onSuccess();
      onClose();
      setForm({ type: 'group', recipientId: '', subject: '', message: '' });
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('too large')) {
        alert('The image or file you are trying to send is too large. Please try a smaller file (under 50MB).');
      } else {
        alert('Could not start the chat. Please check your internet connection or try again later.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start New Chat">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={form.type === 'group' ? 'primary' : 'outline'}
            onClick={() => setForm({ ...form, type: 'group' })}
            className="w-full"
          >
            Company Group
          </Button>
          <Button
            type="button"
            variant={form.type === 'individual' ? 'primary' : 'outline'}
            onClick={() => setForm({ ...form, type: 'individual' })}
            className="w-full"
          >
            Specific Person
          </Button>
        </div>

        {form.type === 'individual' && (
          <Select
            label="Select Recipient"
            value={form.recipientId}
            onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
            options={[
              { value: '', label: 'Select a person...' },
              ...recipients.map(r => ({ value: r._id, label: `${r.name} (${r.position || r.role})` }))
            ]}
            required
          />
        )}

        {form.type === 'group' && (
          <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
            This chat will be visible to the Company Owner, Managers, and all Staff members.
          </p>
        )}

        <Input
          label="Subject / Issue"
          placeholder="e.g. Leave Inquiry, Market Support..."
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          required
        />

        <Textarea
          label="Initial Message"
          placeholder="Start the conversation..."
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={busy}>Start Chat</Button>
        </div>
      </form>
    </Modal>
  );
}

function ChatView({ complaint, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const { data } = await api.get(`/complaints/${complaint._id}/messages`);
      setMessages(data.data);
    } finally {
      setLoading(false);
    }
  }, [complaint._id]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (e, attachments = []) => {
    if (e) e.preventDefault();
    if (!text.trim() && attachments.length === 0) return;
    if (sending) return;

    setSending(true);
    try {
      await api.post(`/complaints/${complaint._id}/messages`, {
        message: text,
        attachments
      });
      setText('');
      loadMessages();
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('too large')) {
        alert('This attachment is too big. Try compressing the image or choosing a smaller file.');
      } else {
        alert('Message not sent. Please check your connection and try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // In a real app, we'd upload to S3/Cloudinary and get a URL.
    // For now, let's simulate by sending base64 or just a placeholder if no upload service is set up.
    // We'll use FileReader to get base64.
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      await send(null, [base64]);
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <Spinner />;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col bg-[#efeae2] dark:bg-slate-950">
      {/* ... header ... */}
      <div className="flex items-center justify-between bg-[#f0f2f5] px-4 py-2 dark:bg-slate-900 border-b dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-slate-600 font-bold uppercase">
            {complaint.isGroup ? <Users className="h-5 w-5" /> : (complaint.recipient?.name?.[0] || 'C')}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{complaint.subject}</h3>
            <p className="text-[11px] text-slate-500">
              {complaint.isGroup ? 'Company Group' : `Chat with ${complaint.recipient?.name || 'Management'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="rounded-full p-2"><MoreVertical className="h-5 w-5 text-slate-500" /></Button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth"
        style={{ backgroundImage: 'radial-gradient(#00000010 1px, transparent 0)', backgroundSize: '20px 20px' }}
      >
        {messages.map((m, idx) => {
          const isMe = m.sender._id === user._id;
          const prevMsg = messages[idx - 1];
          const showSender = !isMe && (!prevMsg || prevMsg.sender._id !== m.sender._id);

          return (
            <div key={m._id} className={cn('flex w-full mb-1', isMe ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'relative max-w-[85%] rounded-lg px-3 py-1.5 shadow-sm',
                isMe ? 'bg-[#dcf8c6] dark:bg-emerald-900/80 rounded-tr-none' : 'bg-white dark:bg-slate-800 rounded-tl-none'
              )}>
                {showSender && <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">{m.sender.name}</p>}
                <div className="flex flex-col gap-1">
                  {m.attachments?.map((att, i) => (
                    <img key={i} src={att} alt="attachment" className="max-w-full rounded mb-1 max-h-60 object-cover" />
                  ))}
                  <div className="flex flex-wrap items-end gap-2">
                    <p className="text-[14px] text-slate-800 dark:text-slate-100 leading-normal">{m.message}</p>
                    <div className="ml-auto flex items-center gap-1 self-end pt-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatTime(m.createdAt)}</span>
                      {isMe && <CheckCheck className="h-3 w-3 text-blue-500" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <form onSubmit={(e) => send(e)} className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-slate-900 px-4 py-3 border-t dark:border-slate-800">
        <input
          type="file"
          hidden
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
        />
        <Button
          type="button"
          variant="ghost"
          className="rounded-full p-2 text-slate-500"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <div className="flex-1 relative">
          <input
            placeholder="Type a message"
            className="w-full rounded-lg bg-white dark:bg-slate-800 px-4 py-2 text-sm focus:outline-none dark:text-white border-none"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={2000}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={(!text.trim()) || sending}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-all",
            text.trim() ? "bg-emerald-600 text-white" : "bg-transparent text-slate-400"
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

export default function Complaints() {
  const { user } = useAuth();
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/complaints');
      setComplaints(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // Refresh list every 10s
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <Spinner />;

  if (selected) {
    return (
      <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-950 lg:relative lg:inset-auto lg:h-full lg:rounded-xl lg:overflow-hidden lg:shadow-xl lg:border dark:border-slate-800">
        <ChatView complaint={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between px-2">
        <h1 className="text-xl font-bold dark:text-white">Complaints & Chats</h1>
        <Button size="sm" onClick={() => setShowNewChat(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Chat
        </Button>
      </div>

      <Card className="overflow-hidden divide-y dark:divide-slate-800">
        {complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400">
            <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
            <p>No chats yet</p>
          </div>
        ) : complaints.map((c) => (
          <div
            key={c._id}
            onClick={() => setSelected(c)}
            className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition active:bg-slate-100 dark:active:bg-slate-800"
          >
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold text-lg uppercase">
                {c.isGroup ? <Users className="h-6 w-6" /> : (c.recipient?.name?.[0] || 'C')}
              </div>
              {c.status === 'OPEN' && (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                {/* Black: Main Issue / Complaint */}
                <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                   {c.subject}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {formatDate(c.lastMessageAt || c.updatedAt, dateFormat)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                {/* Yellow: Latest Message */}
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate pr-4">
                  {c.lastMessageSender && (
                    <span className="font-semibold text-slate-400 mr-1">
                      {c.lastMessageSender._id === user._id ? 'You:' : `${c.lastMessageSender.name}:`}
                    </span>
                  )}
                  {c.lastMessage || c.message}
                </p>
                {/* Red: Recipient Name / Group */}
                <Badge color={c.isGroup ? "gray" : "blue"} className="text-[9px] shrink-0 uppercase font-bold tracking-wider">
                  {c.isGroup ? 'GROUP' : (c.recipient?.name || 'Manager')}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <div className="text-center pb-10">
        <p className="text-xs text-slate-400">Your chats are visible to authorized management staff only.</p>
      </div>

      <ComplaintModal
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSuccess={load}
      />
    </div>
  );
}
