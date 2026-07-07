import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, CreditCard, History, Truck, Trash2, Printer, Download } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Input, Modal, Table, Spinner, Pagination, EmptyState, Badge, Select, Textarea, DatePicker } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const emptyDistributor = { name: '', phone: '', email: '', address: '', panVat: '', creditLimit: 0 };
const emptyPayment = { distributorId: '', amount: 0, method: 'CASH', remarks: '', chequeDetails: { number: '', bankName: '', issueDate: '', depositDate: '', maturityDate: '' } };
const emptyCheque = { distributor: '', chequeNumber: '', bankName: '', issueDate: '', cashDate: '', amount: 0, remarks: '', status: 'ISSUED' };

export default function Distributors() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'form' | 'payment' | 'ledger' | 'cheque' | 'upcoming-cheques'
  const [editing, setEditing] = useState(null);
  const [editingCheque, setEditingCheque] = useState(null);
  const [form, setForm] = useState(emptyDistributor);
  const [payForm, setPayForm] = useState(emptyPayment);
  const [chequeForm, setChequeForm] = useState(emptyCheque);
  const [ledger, setLedger] = useState(null);
  const [cheques, setCheques] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [featureBlocked, setFeatureBlocked] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, ana] = await Promise.all([
        api.get('/distributors', { params: { page, search: search || undefined } }),
        api.get('/distributors/analytics')
      ]);
      setData(res.data.data);
      setAnalytics(ana.data.data);
    } catch (err) {
      if (err.response?.status === 403) setFeatureBlocked(true);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const loadCheques = async () => {
    try {
      const res = await api.get('/cheques');
      setCheques(res.data.data);
      setModal('upcoming-cheques');
    } catch (err) {
      console.error('Failed to load cheques', err);
    }
  };

  const submitDistributor = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/distributors/${editing._id}`, form);
      else await api.post('/distributors', form);
      setModal(null); setEditing(null); setForm(emptyDistributor); load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed';
      const details = err.response?.data?.details;
      if (details && Array.isArray(details)) {
        setError(`${msg}: ${details.map(d => d.message).join(', ')}`);
      } else {
        setError(msg);
      }
    } finally { setSaving(false); }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/payments', payForm);
      setModal(null); load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed';
      const details = err.response?.data?.details;
      if (details && Array.isArray(details)) {
        setError(`${msg}: ${details.map(d => d.message).join(', ')}`);
      } else {
        setError(msg);
      }
    } finally { setSaving(false); }
  };

  const submitCheque = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editingCheque) await api.patch(`/cheques/${editingCheque._id}`, chequeForm);
      else await api.post('/cheques', chequeForm);

      const wasInList = modal === 'cheque' && cheques.length > 0;

      setModal(null); setEditingCheque(null); setChequeForm(emptyCheque);
      load();

      if (wasInList) {
        loadCheques();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Operation failed';
      const details = err.response?.data?.details;
      if (details && Array.isArray(details)) {
        setError(`${msg}: ${details.map(d => d.message).join(', ')}`);
      } else {
        setError(msg);
      }
    } finally { setSaving(false); }
  };

  const deleteCheque = async (id) => {
    if (!confirm('Are you sure you want to remove this cheque record?')) return;
    try {
      await api.delete(`/cheques/${id}`);
      loadCheques();
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const viewLedger = async (d) => {
    setEditing(d);
    setModal('ledger');
    const { data } = await api.get(`/distributors/${d._id}/ledger`);
    setLedger(data.data);
  };

  const handlePrintLedger = (e) => {
    if (e) e.preventDefault();
    const printContent = document.getElementById('ledger-table');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    const companyLogo = user?.company?.logo || '';
    const logoHtml = companyLogo ? `<img src="${companyLogo}" style="max-height: 80px; margin-bottom: 10px;" />` : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Account Ledger - ${editing.name}</title>
          <style>
            body { font-family: "Times New Roman", Times, serif; padding: 0; margin: 0; color: #000; line-height: 1.4; }
            .page { padding: 40px; min-height: 297mm; box-sizing: border-box; display: flex; flex-direction: column; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 2.5px solid #000; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 14px; }
            th { background: #fff; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; }
            .header-main { background-color: #9e9e9e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 25px; text-align: center; border: 2px solid #000; margin-bottom: 30px; }
            .company-title { font-size: 36px; font-weight: 900; text-transform: uppercase; margin: 10px 0; }
            .header-meta { font-size: 13px; font-weight: bold; border-top: 1px solid rgba(0,0,0,0.3); padding-top: 10px; display: flex; justify-content: center; gap: 20px; }
            .dist-box { padding: 0 15px 15px 15px; margin-bottom: 20px; font-size: 16px; font-weight: bold; }
            .text-right { text-align: right; }
            .hidden, .sm\\:hidden, .flex.gap-2, .no-print, button, .divide-y.sm\\:hidden, [class*="sm:hidden"], .divide-y.dark\\:divide-slate-800.sm\\:hidden { display: none !important; }
            .sm\\:table { display: table !important; }

            /* Invoice Style Footer */
            .footer-strip { display: flex; border: 2px solid #000; height: 64px; font-family: sans-serif; font-weight: bold; overflow: hidden; background: #fff; margin-top: auto; }
            .footer-part-1 { background: #9e9e9e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0 15px; display: flex; align-items: center; gap: 10px; border-right: 2px solid #000; flex: 1; }
            .footer-part-2 { flex: 1.2; background: #cecece !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; align-items: center; justify-content: center; border-right: 2px solid #000; text-align: center; }
            .footer-part-3 { background: #9e9e9e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0 15px; display: flex; flex-direction: column; justify-content: center; min-width: 180px; font-size: 9px; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header-main">
               <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                 <div style="width: 80px; height: 80px; background: #fff; border-radius: 50%; overflow: hidden; border: 2px solid #fff;">
                   ${companyLogo ? `<img src="${companyLogo}" style="width: 100%; height: 100%; object-fit: contain;" />` : ''}
                 </div>
                 <div class="company-title">${user?.company?.name || 'Business Sarthi'}</div>
               </div>
               <div class="header-meta">
                 <span>Address: ${user?.company?.address || '—'}</span>
                 <span>Reg No: ${user?.company?.registrationNumber || '—'}</span>
                 <span>PAN/VAT: ${user?.company?.panVat || '—'}</span>
               </div>
            </div>

            <div style="font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 20px; text-decoration: underline;">
              ACCOUNT LEDGER STATEMENT
            </div>

            <div class="dist-box">
               <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: flex-end; margin-bottom: 8px;">
                      <span style="width: 80px;">Name:</span>
                      <span style="flex: 1; border-bottom: 1px dotted #000; font-weight: normal;">${editing.name}</span>
                    </div>
                  </div>
                  <div style="text-align: right; margin-left: 40px;">
                    Date: <span style="font-weight: normal;">${new Date().toLocaleDateString()}</span><br/>
                    Closing Balance: <span style="font-size: 20px;">${formatMoney(ledger.finalBalance)}</span>
                  </div>
               </div>
            </div>

            <div class="content-table" style="flex: 1;">${printContent.innerHTML}</div>

            <div style="margin-top: 50px; margin-bottom: 30px; display: flex; justify-content: space-between; padding: 0 60px; font-weight: bold; font-style: italic;">
               <div style="text-align: center; width: 180px;"><div style="border-top: 2px solid #000; border-style: dotted; margin-bottom: 8px;"></div>PREPARED BY</div>
               <div style="text-align: center; width: 180px;"><div style="border-top: 2px solid #000; border-style: dotted; margin-bottom: 8px;"></div>AUTHORIZED BY</div>
            </div>

            <div class="footer-strip">
              <div class="footer-part-1">
                <div style="width: 44px; height: 44px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #000;">
                   <img src="/logo.png" style="width: 80%; height: 80%; object-fit: contain;" onerror="this.style.display='none'"/>
                </div>
                <div style="line-height: 1.1">
                  <div style="font-size: 12px; text-transform: uppercase;">Business Sarthi</div>
                  <div style="font-size: 8px; font-weight: normal; font-style: italic; opacity: 0.9;">Driving Your Business Forward</div>
                </div>
              </div>
              <div class="footer-part-2">
                <div style="font-size: 8px; text-transform: uppercase; color: #444; margin-bottom: 2px;">Powered By</div>
                <div style="font-size: 11px; font-weight: 900; text-transform: uppercase;">Royal Consultancy Services</div>
                <div style="font-size: 8px;">📍 Koteshwor-32, Kathmandu</div>
              </div>
              <div class="footer-part-3">
                <div style="display: flex; justify-content: space-between;"><span>📧</span> <span>contact@rcs.com.np</span></div>
                <div style="display: flex; justify-content: space-between; margin: 3px 0;"><span>📞</span> <span>9741812381 | 9827765508</span></div>
                <div style="display: flex; justify-content: space-between;"><span>🌐</span> <span>www.rcs.com.np</span></div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const exportLedgerToCSV = () => {
    const csvRows = [];

    // Header Branding & Info
    csvRows.push(`"BUSINESS SARTHI - PROFESSIONAL ACCOUNT LEDGER"`);
    csvRows.push(`"Company:",${JSON.stringify(user?.company?.name || '')}`);
    csvRows.push(`"Address:",${JSON.stringify(user?.company?.address || '')}`);
    csvRows.push("");
    csvRows.push(`"DISTRIBUTOR INFORMATION"`);
    csvRows.push(`"Name:",${JSON.stringify(editing.name)}`);
    csvRows.push(`"Phone:",${JSON.stringify(editing.phone || '')}`);
    csvRows.push(`"Closing Balance:",${JSON.stringify(formatMoney(ledger.finalBalance))}`);
    csvRows.push("");
    csvRows.push(`"Exported On:",${JSON.stringify(new Date().toLocaleString())}`);
    csvRows.push("");

    const headers = ['Date', 'Ref/Type', 'Debit (+)', 'Credit (-)', 'Balance'];
    csvRows.push(headers.join(','));

    for (const e of ledger.entries) {
      const row = [
        formatDate(e.date, dateFormat),
        `${e.type} ${e.ref}`,
        e.type === 'INVOICE' ? e.amount : 0,
        e.type === 'PAYMENT' ? e.amount : 0,
        e.runningBalance
      ];
      csvRows.push(row.map(v => JSON.stringify(v || '')).join(','));
    }

    csvRows.push("");
    csvRows.push(`"--- END OF STATEMENT ---"`);
    csvRows.push(`"Powered by Business Sarthi"`);

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Ledger_${editing.name}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (featureBlocked) {
    return <Card><EmptyState icon={Truck} title="Distributor management not included in your package"
      subtitle="Upgrade your package to unlock distributor management." /></Card>;
  }
  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Distributors</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingCheque(null); setChequeForm(emptyCheque); setModal('cheque'); }}>
            Add Cheque
          </Button>
          <Button onClick={() => { setEditing(null); setForm(emptyDistributor); setModal('form'); }}>
            <Plus className="h-4 w-4" /> Add Distributor
          </Button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="p-3 border-l-4 border-l-primary-500 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Monthly Sales</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatMoney(analytics.monthlySales)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Monthly Received</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{formatMoney(analytics.monthlyPayments)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-orange-500 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Due</p>
            <p className="text-lg font-bold text-orange-600 mt-1">{formatMoney(analytics.totalOutstanding)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-red-500 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Expired Due</p>
            <p className="text-lg font-bold text-red-600 mt-1">{formatMoney(analytics.overdueOutstanding)}</p>
          </Card>
          <Card className="p-3 border-l-4 border-l-blue-500 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Dist</p>
            <p className="text-lg font-bold text-blue-600 mt-1">{analytics.activeDistributors}</p>
          </Card>
          <Card
            className="p-3 border-l-4 border-l-purple-500 bg-white dark:bg-slate-900 cursor-pointer hover:bg-slate-50 transition"
            onClick={loadCheques}
          >
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Upcoming Cheques</p>
            <p className="text-lg font-bold text-purple-600 mt-1">{analytics.upcomingCheques}</p>
          </Card>
        </div>
      )}

      <Card>
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <Input placeholder="Search distributors…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
        </div>
        <Table
          columns={['Distributor', 'Contact', 'Outstanding', 'Credit Limit', 'Status', 'Actions']}
          data={data.items}
          renderRow={(v) => (
            <tr key={v._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 text-sm">
              <td className="table-td font-medium text-primary-600">
                <Link to={`${v._id}`} className="hover:underline">{v.name}</Link>
              </td>
              <td className="table-td">
                <p>{v.phone}</p>
                <p className="text-xs text-slate-400">{v.email}</p>
              </td>
              <td className="table-td font-bold text-red-600">{formatMoney(v.outstandingBalance)}</td>
              <td className="table-td text-slate-500">{formatMoney(v.creditLimit)}</td>
              <td className="table-td"><Badge color={v.status === 'ACTIVE' ? 'green' : 'red'}>{v.status}</Badge></td>
              <td className="table-td">
                <div className="flex gap-1">
                  <button title="Record Payment" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => { setPayForm({ ...emptyPayment, distributorId: v._id }); setModal('payment'); }}>
                    <CreditCard className="h-4 w-4" />
                  </button>
                  <button title="Ledger" className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                    onClick={() => viewLedger(v)}>
                    <History className="h-4 w-4" />
                  </button>
                  <button title="Edit" className="rounded p-1.5 hover:bg-slate-100"
                    onClick={() => { setEditing(v); setForm({ ...emptyDistributor, ...v }); setModal('form'); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(v) => (
            <div key={v._id} className="p-4 space-y-3 border-b dark:border-slate-800">
               <div className="flex items-center justify-between">
                  <Link to={`${v._id}`} className="font-bold text-primary-600 hover:underline">{v.name}</Link>
                  <Badge color={v.status === 'ACTIVE' ? 'green' : 'red'}>{v.status}</Badge>
               </div>
               <div className="flex justify-between text-sm">
                  <p className="text-slate-500">Outstanding: <span className="font-bold text-red-600">{formatMoney(v.outstandingBalance)}</span></p>
                  <p className="text-slate-400">Limit: {formatMoney(v.creditLimit)}</p>
               </div>
               <div className="grid grid-cols-3 gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => { setPayForm({ ...emptyPayment, distributorId: v._id }); setModal('payment'); }}><CreditCard className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" onClick={() => viewLedger(v)}><History className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditing(v); setForm({ ...emptyDistributor, ...v }); setModal('form'); }}><Pencil className="h-3.5 w-3.5" /></Button>
               </div>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      {/* Distributor Form */}
      <Modal open={modal === 'form'} onClose={() => setModal(null)} title={editing ? 'Edit Distributor' : 'Add Distributor'}>
        <form onSubmit={submitDistributor} className="space-y-4">
          <Input label="Name *" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input label="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <Input label="Credit Limit" type="number" value={form.creditLimit} onChange={e => setForm({...form, creditLimit: e.target.value})} />
          <Textarea label="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setForm(emptyDistributor)}>Reset</Button>
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={modal === 'payment'} onClose={() => setModal(null)} title="Record Payment">
         <form onSubmit={submitPayment} className="space-y-4">
            <Input label="Amount Received *" type="number" required value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} />
            <Select label="Method" options={[{value:'CASH', label:'Cash'}, {value:'CHEQUE', label:'Cheque'}, {value:'BANK_TRANSFER', label:'Bank Transfer'}]} value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})} />

            {payForm.method === 'CHEQUE' && (
              <div className="space-y-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <Input label="Cheque Number" value={payForm.chequeDetails.number} onChange={e => setPayForm({...payForm, chequeDetails: {...payForm.chequeDetails, number: e.target.value}})} />
                <div className="grid grid-cols-2 gap-4">
                  <DatePicker label="Deposit Date" value={payForm.chequeDetails.depositDate} onChange={(val) => setPayForm({...payForm, chequeDetails: {...payForm.chequeDetails, depositDate: val}})} />
                  <DatePicker label="Maturity Date" value={payForm.chequeDetails.maturityDate} onChange={(val) => setPayForm({...payForm, chequeDetails: {...payForm.chequeDetails, maturityDate: val}})} />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
               <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
               <Button type="submit" loading={saving}>Record & Adjust (FIFO)</Button>
            </div>
         </form>
      </Modal>

      {/* Ledger Modal */}
      <Modal open={modal === 'ledger'} onClose={() => setModal(null)} title={`Account Ledger — ${editing?.name}`} wide>
         {!ledger ? <Spinner /> : (
           <div className="space-y-4">
             <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Closing Balance</p>
                  <p className="text-xl font-bold">{formatMoney(ledger.finalBalance)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="bg-white/10 border-white/20 hover:bg-white/20 text-white" onClick={(e) => handlePrintLedger(e)}>
                    <Printer className="h-4 w-4 mr-2" /> Print
                  </Button>
                  <Button variant="outline" size="sm" className="bg-white/10 border-white/20 hover:bg-white/20 text-white" onClick={exportLedgerToCSV}>
                    <Download className="h-4 w-4 mr-2" /> Download CSV
                  </Button>
                </div>
             </div>
             <div className="max-h-96 overflow-y-auto border rounded-lg dark:border-slate-800" id="ledger-table">
               <table className="w-full text-sm">
                 <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Ref/Type</th>
                      <th className="p-3 text-right">Debit (+)</th>
                      <th className="p-3 text-right">Credit (-)</th>
                      <th className="p-3 text-right">Balance</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y dark:divide-slate-800">
                    {ledger.entries.map((e, idx) => (
                      <tr key={idx}>
                        <td className="p-3 text-slate-500">{formatDate(e.date, dateFormat)}</td>
                        <td className="p-3 font-medium">{e.type} <br/><span className="text-[10px] text-slate-400 font-normal">{e.ref}</span></td>
                        <td className="p-3 text-right text-red-600">{e.type === 'INVOICE' ? formatMoney(e.amount) : ''}</td>
                        <td className="p-3 text-right text-emerald-600">{e.type === 'PAYMENT' ? formatMoney(e.amount) : ''}</td>
                        <td className="p-3 text-right font-semibold">{formatMoney(e.runningBalance)}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
           </div>
         )}
      </Modal>

      {/* Cheque Modal */}
      <Modal open={modal === 'cheque'} onClose={() => setModal(null)} title={editingCheque ? 'Edit Cheque Record' : 'Add Cheque Record'}>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            <p className="font-bold">{error}</p>
            {saving === false && typeof error === 'string' && error.includes('Validation') && (
              <p className="text-xs mt-1">Please check all required fields (*) and ensure the amount is positive.</p>
            )}
          </div>
        )}
        <form onSubmit={submitCheque} className="space-y-4">
          <Select
            label="Select Distributor *"
            required
            disabled={!!editingCheque}
            value={chequeForm.distributor}
            onChange={e => setChequeForm({...chequeForm, distributor: e.target.value})}
            options={[
              { value: '', label: 'Select a distributor...' },
              ...(data?.items?.map(d => ({ value: d._id, label: d.name })) || [])
            ]}
          />
          <Input
            label="Cheque NO *"
            required
            value={chequeForm.chequeNumber}
            onChange={e => setChequeForm({...chequeForm, chequeNumber: e.target.value})}
          />
          <Input
            label="Bank Name *"
            required
            value={chequeForm.bankName}
            onChange={e => setChequeForm({...chequeForm, bankName: e.target.value})}
          />
          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Issue Date"
              value={chequeForm.issueDate}
              onChange={val => setChequeForm({...chequeForm, issueDate: val})}
            />
            <DatePicker
              label="Cash Date *"
              required
              value={chequeForm.cashDate}
              onChange={val => setChequeForm({...chequeForm, cashDate: val})}
            />
          </div>
          <Input
            label="Amount *"
            type="number"
            required
            value={chequeForm.amount}
            onChange={e => setChequeForm({...chequeForm, amount: e.target.value})}
          />
          <Select
            label="Status"
            value={chequeForm.status}
            onChange={e => setChequeForm({...chequeForm, status: e.target.value})}
            options={[
              { value: 'ISSUED', label: 'Issued (by distributor)' },
              { value: 'COLLECTED', label: 'Collected (at company)' },
              { value: 'DEPOSITED', label: 'Deposited (in bank)' },
              { value: 'CASHED', label: 'Cashed (payment received)' },
              { value: 'BOUNCED', label: 'Bounced' }
            ]}
          />
          <Textarea
            label="Remarks"
            value={chequeForm.remarks}
            onChange={e => setChequeForm({...chequeForm, remarks: e.target.value})}
            placeholder="Add note for status change..."
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingCheque ? 'Update Cheque' : 'Add Cheque'}</Button>
          </div>
        </form>
      </Modal>

      {/* Upcoming Cheques Modal */}
      <Modal open={modal === 'upcoming-cheques'} onClose={() => setModal(null)} title="Upcoming & Pending Cheques" wide>
        <div className="space-y-4">
          <div className="max-h-[500px] overflow-y-auto border rounded-lg dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="p-3 text-left">Issue Date</th>
                  <th className="p-3 text-left">Cash Date</th>
                  <th className="p-3 text-left">Distributor</th>
                  <th className="p-3 text-left">Cheque NO</th>
                  <th className="p-3 text-left">Bank</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {cheques.length === 0 ? (
                  <tr><td colSpan="8" className="p-8 text-center text-slate-400">No pending cheques found</td></tr>
                ) : cheques.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="p-3 text-xs text-slate-500">{c.issueDate ? formatDate(c.issueDate, dateFormat) : '-'}</td>
                    <td className="p-3">{formatDate(c.cashDate, dateFormat)}</td>
                    <td className="p-3 font-medium">{c.distributor?.name}</td>
                    <td className="p-3">{c.chequeNumber}</td>
                    <td className="p-3 text-slate-500">{c.bankName}</td>
                    <td className="p-3 text-right font-bold">{formatMoney(c.amount)}</td>
                    <td className="p-3 text-center">
                      <Badge color={c.status === 'CASHED' ? 'green' : c.status === 'BOUNCED' ? 'red' : 'blue'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        {c.status !== 'CASHED' ? (
                          <>
                            <button className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                              onClick={() => { setEditingCheque(c); setChequeForm({ ...c, distributor: c.distributor?._id }); setModal('cheque'); }}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button className="p-1 text-red-600 hover:bg-red-50 rounded" onClick={() => deleteCheque(c._id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
