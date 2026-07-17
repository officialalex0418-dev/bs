import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Clock, User, Users, Send, ChevronLeft, MoreVertical, Paperclip, Check, CheckCheck, Plus, AlertCircle } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardBody, Badge, Table, Spinner, Button, Input, Textarea, Modal, Select } from '@/components/ui';
import { formatDate, formatTime, cn } from '@/lib/utils';

function ComplaintModal({ open, onClose, onSuccess, mode = 'CHAT' }) {
  const [recipients, setRecipients] = useState([]);
  const [form, setForm] = useState({
    recipientType: 'group',
    recipientId: '',
    subject: '',
    message: ''
  });
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
        type: mode,
        isGroup: form.recipientType === 'group' || form.recipientType === 'create_group',
        recipientId: form.recipientType === 'individual' ? form.recipientId : null,
        subject: mode === 'COMPLAINT' || form.recipientType === 'create_group' ? form.subject : 'Direct Message',
        message: form.message
      });
      onSuccess();
      onClose();
      setForm({ recipientType: 'group', recipientId: '', subject: '', message: '' });
    } catch (err) {
      alert(`Could not start the ${mode.toLowerCase()}. Please check your connection.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'COMPLAINT' ? "Add Complaint" : "New Chat"}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Select Recipient</label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={form.recipientType === 'group' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setForm({ ...form, recipientType: 'group' })}
              className="text-[10px] px-1"
            >
              Company Group
            </Button>
            <Button
              type="button"
              variant={form.recipientType === 'individual' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setForm({ ...form, recipientType: 'individual' })}
              className="text-[10px] px-1"
            >
              Specific Person
            </Button>
            <Button
              type="button"
              variant={form.recipientType === 'create_group' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setForm({ ...form, recipientType: 'create_group' })}
              className="text-[10px] px-1"
            >
              Create Group
            </Button>
          </div>
        </div>

        {form.recipientType === 'individual' && (
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

        {(mode === 'COMPLAINT' || form.recipientType === 'create_group') && (
          <Input
            label={form.recipientType === 'create_group' ? "Group Name" : "Subject"}
            placeholder={form.recipientType === 'create_group' ? "e.g. Sales, Marketing..." : "What is the complaint about?"}
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            required
          />
        )}

        <Textarea
          label="Message"
          placeholder="Type your message here..."
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={busy}>Submit</Button>
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
      alert('Message not sent. Please check your connection.');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      await send(null, [reader.result]);
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <Spinner />;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col bg-[#efeae2] dark:bg-slate-950">
      <div className="flex items-center justify-between bg-[#f0f2f5] px-4 py-2 dark:bg-slate-900 border-b dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-slate-600 font-bold uppercase">
            {complaint.isGroup ? <Users className="h-5 w-5" /> : (complaint.recipient?.name?.[0] || 'C')}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
              {complaint.type === 'CHAT' && !complaint.isGroup ? (complaint.recipient?.name || 'User') : complaint.subject}
            </h3>
            <p className="text-[10px] text-slate-500 truncate">
              {complaint.isGroup ? 'Company Group' : `Private Chat`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full p-2"><MoreVertical className="h-5 w-5 text-slate-500" /></Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
        style={{ backgroundImage: 'radial-gradient(#00000010 1px, transparent 0)', backgroundSize: '20px 20px' }}
      >
        {messages.map((m, idx) => {
          const isMe = m.sender._id === user._id;
          const showSender = !isMe && (!messages[idx - 1] || messages[idx - 1].sender._id !== m.sender._id);
          return (
            <div key={m._id} className={cn('flex w-full mb-1', isMe ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'relative max-w-[85%] rounded-lg px-3 py-1.5 shadow-sm',
                isMe ? 'bg-[#dcf8c6] dark:bg-emerald-900/80 rounded-tr-none' : 'bg-white dark:bg-slate-800 rounded-tl-none'
              )}>
                {showSender && <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">{m.sender.name}</p>}
                {m.attachments?.map((att, i) => <img key={i} src={att} className="max-w-full rounded mb-1 max-h-60 object-cover" />)}
                <div className="flex flex-wrap items-end gap-2">
                  <p className="text-[14px] text-slate-800 dark:text-slate-100 leading-normal">{m.message}</p>
                  <div className="ml-auto flex items-center gap-1 pt-1">
                    <span className="text-[9px] text-slate-400">{formatTime(m.createdAt)}</span>
                    {isMe && <CheckCheck className="h-3 w-3 text-blue-500" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={(e) => send(e)} className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-slate-900 px-4 py-3 border-t dark:border-slate-800">
        <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
        <Button type="button" variant="ghost" className="rounded-full p-2 text-slate-500" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5" /></Button>
        <input
          placeholder="Type a message"
          className="flex-1 rounded-lg bg-white dark:bg-slate-800 px-4 py-2 text-sm focus:outline-none dark:text-white"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button type="submit" disabled={!text.trim() && !sending} className={cn("flex h-10 w-10 items-center justify-center rounded-full", text.trim() ? "bg-emerald-600 text-white" : "text-slate-400")}><Send className="h-5 w-5" /></button>
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
  const [tab, setTab] = useState('CHAT'); // CHAT | COMPLAINT
  const [modal, setModal] = useState({ open: false, mode: 'CHAT' });

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
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = complaints.filter(c => (c.type || 'CHAT') === tab);

  if (loading) return <Spinner />;

  if (selected) {
    return (
      <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-950 lg:relative lg:inset-auto lg:h-full lg:rounded-xl lg:overflow-hidden lg:shadow-xl lg:border dark:border-slate-800">
        <ChatView complaint={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setTab('CHAT')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", tab === 'CHAT' ? "bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-500")}
          >
            Chat
          </button>
          <button
            onClick={() => setTab('COMPLAINT')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", tab === 'COMPLAINT' ? "bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400" : "text-slate-500")}
          >
            Complaint
          </button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="bg-white" onClick={() => setModal({ open: true, mode: 'CHAT' })}>
            <MessageSquare className="h-4 w-4 mr-1" /> New Chat
          </Button>
          <Button size="sm" onClick={() => setModal({ open: true, mode: 'COMPLAINT' })}>
            <Plus className="h-4 w-4 mr-1" /> Add Complaint
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden divide-y dark:divide-slate-800">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400">
            <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
            <p>No {tab.toLowerCase()}s yet</p>
          </div>
        ) : filtered.map((c) => (
          <div
            key={c._id}
            onClick={() => setSelected(c)}
            className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold text-lg uppercase">
              {c.isGroup ? <Users className="h-6 w-6" /> : (c.recipient?.name?.[0] || 'C')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                   {tab === 'CHAT' && !c.isGroup ? (c.recipient?.name || 'User') : c.subject}
                </h3>
                <span className="text-[10px] text-slate-400">{formatDate(c.lastMessageAt || c.updatedAt, dateFormat)}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500 truncate pr-4">
                  {c.lastMessageSender && <span className="font-semibold text-slate-400 mr-1">{c.lastMessageSender._id === user._id ? 'You:' : `${c.lastMessageSender.name}:`}</span>}
                  {c.lastMessage || c.message}
                </p>
                <Badge color={c.isGroup ? "gray" : "blue"} className="text-[9px] uppercase font-bold tracking-wider">
                  {c.isGroup ? 'GROUP' : (c.recipient?.name || 'Manager')}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <ComplaintModal
        open={modal.open}
        mode={modal.mode}
        onClose={() => setModal({ ...modal, open: false })}
        onSuccess={load}
      />
    </div>
  );
}
