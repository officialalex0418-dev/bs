import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Truck, FileText, CreditCard, Receipt, History, AlertCircle } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Input, Modal, Table, Spinner, Pagination, EmptyState, Badge, Select, Textarea } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';

const emptyDistributor = { name: '', phone: '', email: '', address: '', panVat: '', creditLimit: 0 };
const emptyInvoice = { distributorId: '', items: [{ product: '', productName: '', quantity: 1, rate: 0 }], dueDate: '', remarks: '' };
const emptyPayment = { distributorId: '', amount: 0, method: 'CASH', remarks: '', chequeDetails: { number: '', bankName: '', maturityDate: '' } };

export default function Distributors() {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'form' | 'invoice' | 'payment' | 'ledger'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyDistributor);
  const [invForm, setInvForm] = useState(emptyInvoice);
  const [payForm, setPayForm] = useState(emptyPayment);
  const [ledger, setLedger] = useState(null);
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

  const submitDistributor = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api.patch(`/distributors/${editing._id}`, form);
      else await api.post('/distributors', form);
      setModal(null); setEditing(null); setForm(emptyDistributor); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const submitInvoice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/invoices', invForm);
      setModal(null); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice failed');
    } finally { setSaving(false); }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/payments', payForm);
      setModal(null); load();
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
    } finally { setSaving(false); }
  };

  const viewLedger = async (d) => {
    setEditing(d);
    setModal('ledger');
    const { data } = await api.get(`/distributors/${d._id}/ledger`);
    setLedger(data.data);
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
        <Button onClick={() => { setEditing(null); setForm(emptyDistributor); setModal('form'); }}>
          <Plus className="h-4 w-4" /> Add Distributor
        </Button>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4 bg-primary-50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/30">
            <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold uppercase tracking-wider">Total Outstanding</p>
            <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{formatMoney(analytics.totalOutstanding)}</p>
          </Card>
          <Card className="p-4 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase tracking-wider">Overdue Invoices</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{analytics.overdueInvoices}</p>
          </Card>
          <Card className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Active Distributors</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{data.pagination.total}</p>
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
              <td className="table-td font-medium">{v.name}</td>
              <td className="table-td">
                <p>{v.phone}</p>
                <p className="text-xs text-slate-400">{v.email}</p>
              </td>
              <td className="table-td font-bold text-red-600">{formatMoney(v.outstandingBalance)}</td>
              <td className="table-td text-slate-500">{formatMoney(v.creditLimit)}</td>
              <td className="table-td"><Badge color={v.status === 'ACTIVE' ? 'green' : 'red'}>{v.status}</Badge></td>
              <td className="table-td">
                <div className="flex gap-1">
                  <button title="Create Invoice" className="rounded p-1.5 text-primary-600 hover:bg-primary-50"
                    onClick={() => { setInvForm({ ...emptyInvoice, distributorId: v._id }); setModal('invoice'); }}>
                    <Receipt className="h-4 w-4" />
                  </button>
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
                  <p className="font-bold text-slate-900 dark:text-white">{v.name}</p>
                  <Badge color={v.status === 'ACTIVE' ? 'green' : 'red'}>{v.status}</Badge>
               </div>
               <div className="flex justify-between text-sm">
                  <p className="text-slate-500">Outstanding: <span className="font-bold text-red-600">{formatMoney(v.outstandingBalance)}</span></p>
                  <p className="text-slate-400">Limit: {formatMoney(v.creditLimit)}</p>
               </div>
               <div className="grid grid-cols-4 gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => { setInvForm({ ...emptyInvoice, distributorId: v._id }); setModal('invoice'); }}><Receipt className="h-3.5 w-3.5" /></Button>
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

      {/* Invoice Modal */}
      <Modal open={modal === 'invoice'} onClose={() => setModal(null)} title="Create Sales Invoice" wide>
        <form onSubmit={submitInvoice} className="space-y-4">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Due Date" type="date" required value={invForm.dueDate} onChange={e => setInvForm({...invForm, dueDate: e.target.value})} />
              <Input label="Remarks" value={invForm.remarks} onChange={e => setInvForm({...invForm, remarks: e.target.value})} />
           </div>

           <div className="space-y-3">
              <p className="font-semibold text-sm">Products</p>
              {invForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Input placeholder="Product Name" value={item.productName} onChange={e => {
                      const items = [...invForm.items];
                      items[idx].productName = e.target.value;
                      setInvForm({...invForm, items});
                    }} />
                  </div>
                  <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => {
                    const items = [...invForm.items];
                    items[idx].quantity = e.target.value;
                    setInvForm({...invForm, items});
                  }} />
                  <Input type="number" placeholder="Rate" value={item.rate} onChange={e => {
                    const items = [...invForm.items];
                    items[idx].rate = e.target.value;
                    setInvForm({...invForm, items});
                  }} />
                </div>
              ))}
           </div>

           <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button type="submit" loading={saving}>Generate Invoice</Button>
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
                <Input label="Maturity Date" type="date" value={payForm.chequeDetails.maturityDate} onChange={e => setPayForm({...payForm, chequeDetails: {...payForm.chequeDetails, maturityDate: e.target.value}})} />
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
                <p>Closing Balance</p>
                <p className="text-xl font-bold">{formatMoney(ledger.finalBalance)}</p>
             </div>
             <div className="max-h-96 overflow-y-auto border rounded-lg dark:border-slate-800">
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
                        <td className="p-3 text-slate-500">{formatDate(e.date)}</td>
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
    </div>
  );
}
