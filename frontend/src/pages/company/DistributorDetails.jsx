import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Receipt, History, AlertCircle, Pencil, Save, X, Phone, MapPin, Hash, Trash2, Plus, User, Printer, Download, Eye, FileText, ShoppingCart } from 'lucide-react';
import { api } from '@/api/client';
import { Card, Button, Input, Modal, Table, Spinner, Badge, Select, Textarea, DatePicker, Checkbox } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { InvoicePreview } from '@/components/InvoicePreview';

export default function DistributorDetails() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [modal, setModal] = useState(null); // 'payment' | 'edit-invoice' | 'new-invoice' | 'view-invoice' | 'print-confirm' | 'cheque' | 'credit-limit-warning'
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [distCheques, setDistCheques] = useState([]);
  const [editingCheque, setEditingCheque] = useState(null);
  const [chequeForm, setChequeForm] = useState({ chequeNumber: '', bankName: '', issueDate: '', cashDate: '', amount: 0, remarks: '', status: 'ISSUED' });
  const [payForm, setPayForm] = useState({ amount: 0, method: 'Cash', remarks: '' });
  const [newInvForm, setNewInvForm] = useState({
    items: [{ productName: '', productId: '', price: 0, quantity: 1, amount: 0 }],
    discountPct: 0,
    vatPct: 13,
    paymentMethod: 'Credit',
    dueDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';
  const printRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, meta, cRes] = await Promise.all([
        api.get(`/distributors/${id}`),
        api.get('/sales/metadata'),
        api.get('/cheques', { params: { distributorId: id } })
      ]);
      setData(res.data.data);
      setAllProducts(meta.data.data.products);
      setDistCheques(cRes.data.data);
    } catch (err) {
      setError('Failed to load distributor details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    window.print();
  };

  const handlePrintSection = (e, title) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const targetId = title.toLowerCase().replace(/\s+/g, '-');
    const element = document.getElementById(targetId);

    if (!element) {
      console.error("Print target not found:", targetId);
      alert("Print content not found for " + title);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    // Clean buttons and action areas from content
    let cleanContent = element.innerHTML;
    cleanContent = cleanContent.replace(/<button[^>]*>.*?<\/button>/gi, '');

    const companyLogo = user?.company?.logo || '';
    const logoHtml = companyLogo ? `<img src="${companyLogo}" style="max-height: 80px; margin-bottom: 10px;" />` : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>${title} - ${distributor.name}</title>
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
            .text-red-600 { color: #000 !important; } /* High contrast for print */
            .badge { border: 1px solid #000; padding: 1px 4px; border-radius: 2px; font-size: 11px; font-weight: normal; }

            /* Remove mobile view and hidden elements */
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
              ${title.toUpperCase()}
            </div>

            <div class="dist-box">
               <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: flex-end; margin-bottom: 8px;">
                      <span style="width: 80px;">Name:</span>
                      <span style="flex: 1; border-bottom: 1px dotted #000; font-weight: normal;">${distributor.name}</span>
                    </div>
                    <div style="display: flex; align-items: flex-end;">
                      <span style="width: 80px;">Address:</span>
                      <span style="flex: 1; border-bottom: 1px dotted #000; font-weight: normal;">${distributor.address || '—'}</span>
                    </div>
                  </div>
                  <div style="text-align: right; margin-left: 40px;">
                    Date: <span style="font-weight: normal;">${new Date().toLocaleDateString()}</span><br/>
                    Outstanding: <span style="font-size: 20px;">${formatMoney(distributor.outstandingBalance)}</span>
                  </div>
               </div>
            </div>

            <div class="content-table" style="flex: 1;">${cleanContent}</div>

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

  const exportToCSV = (dataList, filename, headers) => {
    const csvRows = [];

    // Header Branding & Info
    csvRows.push(`"BUSINESS SARTHI - PROFESSIONAL REPORT"`);
    csvRows.push(`"Company:",${JSON.stringify(user?.company?.name || '')}`);
    csvRows.push(`"Address:",${JSON.stringify(user?.company?.address || '')}`);
    csvRows.push("");
    csvRows.push(`"DISTRIBUTOR DETAILS"`);
    csvRows.push(`"Name:",${JSON.stringify(data?.distributor?.name)}`);
    csvRows.push(`"Outstanding Balance:",${JSON.stringify(formatMoney(data?.distributor?.outstandingBalance))}`);
    csvRows.push("");
    csvRows.push(`"REPORT: ${filename.replace(/_/g, ' ')}"`);
    csvRows.push(`"Generated On:",${JSON.stringify(new Date().toLocaleString())}`);
    csvRows.push("");

    // Table Headers
    csvRows.push(headers.map(h => h.label).join(','));

    // Data Rows
    for (const row of dataList) {
      csvRows.push(headers.map(h => {
        let val = typeof h.key === 'function' ? h.key(row) : row[h.key];
        return JSON.stringify(val || '');
      }).join(','));
    }

    csvRows.push("");
    csvRows.push(`"--- END OF REPORT ---"`);
    csvRows.push(`"Powered by Business Sarthi"`);

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      // Map frontend labels to backend enum if needed, or just use correct values
      const methodMap = {
        'Cash': 'CASH',
        'Online/QR': 'BANK_TRANSFER',
        'Cheque': 'CHEQUE'
      };
      await api.post('/payments', {
        ...payForm,
        method: methodMap[payForm.method] || payForm.method,
        distributorId: id
      });
      setModal(null);
      setPayForm({ amount: 0, method: 'Cash', remarks: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
    } finally { setSaving(false); }
  };

  const submitNewInvoice = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await api.post('/sales-invoices', {
        ...newInvForm,
        distributorId: id
      });
      setSelectedInvoice(res.data.data);
      setModal('print-confirm');
      setNewInvForm({
        items: [{ productName: '', productId: '', price: 0, quantity: 1, amount: 0 }],
        discountPct: 0,
        vatPct: 13,
        paymentMethod: 'Credit',
        dueDate: ''
      });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice creation failed');
    } finally { setSaving(false); }
  };

  const updateInvoice = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.patch(`/sales-invoices/${editingInvoice._id}`, editingInvoice);
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const deleteInv = async (invId) => {
    if (!window.confirm('Are you sure you want to delete this invoice? This will adjust the distributor outstanding balance.')) return;
    try {
      await api.delete(`/sales-invoices/${invId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const deletePayment = async (payId) => {
    if (!window.confirm('Are you sure you want to remove this payment record? This will increase the distributor outstanding balance.')) return;
    try {
      await api.delete(`/payments/${payId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const submitCheque = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editingCheque) await api.patch(`/cheques/${editingCheque._id}`, chequeForm);
      else await api.post('/cheques', { ...chequeForm, distributor: id });
      setModal(null); setEditingCheque(null);
      setChequeForm({ chequeNumber: '', bankName: '', issueDate: '', cashDate: '', amount: 0, remarks: '', status: 'ISSUED' });
      load();
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

  const deleteCheque = async (cid) => {
    if (!window.confirm('Are you sure you want to delete this cheque record?')) return;
    try {
      await api.delete(`/cheques/${cid}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const addEditRow = () => {
    const next = { ...editingInvoice };
    next.items.push({ productName: '', price: 0, quantity: 1, amount: 0 });
    setEditingInvoice(next);
  };

  const updateEditRow = (idx, field, value) => {
    const next = { ...editingInvoice };
    next.items[idx][field] = value;
    if (field === 'price' || field === 'quantity') {
      next.items[idx].amount = (Number(next.items[idx].price) || 0) * (Number(next.items[idx].quantity) || 0);
    }
    setEditingInvoice(next);
  };

  const removeEditRow = (idx) => {
    const next = { ...editingInvoice };
    if (next.items.length === 1) return;
    next.items = next.items.filter((_, i) => i !== idx);
    setEditingInvoice(next);
  };

  const addNewInvRow = () => {
    setNewInvForm({
      ...newInvForm,
      items: [...newInvForm.items, { productName: '', productId: '', price: 0, quantity: 1, amount: 0 }]
    });
  };

  const updateNewInvRow = (idx, field, value) => {
    const next = { ...newInvForm };
    next.items[idx][field] = value;
    if (field === 'price' || field === 'quantity') {
      next.items[idx].amount = (Number(next.items[idx].price) || 0) * (Number(next.items[idx].quantity) || 0);
    }
    setNewInvForm(next);
  };

  const removeNewInvRow = (idx) => {
    if (newInvForm.items.length === 1) return;
    setNewInvForm({
      ...newInvForm,
      items: newInvForm.items.filter((_, i) => i !== idx)
    });
  };

  const calculateNewInvTotals = () => {
    const totalAmount = newInvForm.items.reduce((sum, row) => sum + row.amount, 0);
    const discount = (totalAmount * newInvForm.discountPct) / 100;
    const taxableAmount = totalAmount - discount;
    const vat = (taxableAmount * newInvForm.vatPct) / 100;
    const netTotal = taxableAmount + vat;
    return { totalAmount, discount, taxableAmount, vat, netTotal };
  };

  const calculateEditTotals = () => {
    if (!editingInvoice) return { totalAmount: 0, discount: 0, taxableAmount: 0, vat: 0, netTotal: 0 };
    const totalAmount = editingInvoice.items.reduce((sum, row) => sum + row.amount, 0);
    const discount = (totalAmount * (editingInvoice.discountPct || 0)) / 100;
    const taxableAmount = totalAmount - discount;
    const vat = (taxableAmount * (editingInvoice.vatPct || 0)) / 100;
    const netTotal = taxableAmount + vat;
    return { totalAmount, discount, taxableAmount, vat, netTotal };
  };

  if (loading) return <Spinner />;
  if (!data) return <div className="p-8 text-center text-red-500">{error || 'Distributor not found'}</div>;

  const { distributor, invoices, payments, aging, history } = data;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{distributor.name}</h1>
        <Badge color={distributor.status === 'ACTIVE' ? 'green' : 'red'}>{distributor.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        {/* Profile Card */}
        <Card className="md:col-span-1 p-5 space-y-4">
          <h3 className="font-bold border-b pb-2 flex items-center gap-2">
            <User className="h-4 w-4 text-primary-600" /> Basic Info
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 text-slate-600">
              <Phone className="h-4 w-4 mt-0.5" />
              <span>{distributor.phone || 'N/A'}</span>
            </div>
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="h-4 w-4 mt-0.5" />
              <span>{distributor.address || 'N/A'}</span>
            </div>
            <div className="flex items-start gap-2 text-slate-600">
              <Hash className="h-4 w-4 mt-0.5" />
              <div>
                <p>PAN: {distributor.panVat || 'N/A'}</p>
                <p>Reg: {distributor.registrationNumber || 'N/A'}</p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Financial Summary</p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Credit Limit:</span>
              <span className="font-semibold">{formatMoney(distributor.creditLimit)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-sm">Outstanding:</span>
              <span className="font-bold text-red-600 text-lg">{formatMoney(distributor.outstandingBalance)}</span>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  if (distributor.outstandingBalance > distributor.creditLimit) {
                    setModal('credit-limit-warning');
                  } else {
                    setModal('new-invoice');
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> New Invoice
              </Button>
              <Button className="w-full" variant="outline" onClick={() => setModal('payment')}>
                <CreditCard className="h-4 w-4 mr-2" /> Record Payment
              </Button>
              <Button className="w-full" variant="outline" onClick={() => { setEditingCheque(null); setChequeForm({ chequeNumber: '', bankName: '', issueDate: '', cashDate: '', amount: 0, remarks: '', status: 'ISSUED' }); setModal('cheque'); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Cheque
              </Button>
            </div>
          </div>
        </Card>

        {/* Aging & Recent Invoices */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-0 overflow-hidden" id="aging-report">
             <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><AlertCircle className="h-4 w-4 text-orange-500" /> Aging Report (Unpaid Invoices)</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={(e) => handlePrintSection(e, 'Aging Report')}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => exportToCSV(aging, `Aging_${distributor.name}`, [
                    { label: 'Invoice #', key: 'invoiceNumber' },
                    { label: 'Date', key: (r) => formatDate(r.date, dateFormat) },
                    { label: 'Age (Days)', key: 'ageDays' },
                    { label: 'Due Amount', key: 'amount' }
                  ])}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
             </div>
             <Table
                columns={['Invoice #', 'Date', 'Age', 'Due Amount']}
                data={aging}
                renderRow={(row) => (
                  <tr key={row.invoiceNumber}>
                    <td className="table-td font-medium">{row.invoiceNumber}</td>
                    <td className="table-td text-xs">{formatDate(row.date, dateFormat)}</td>
                    <td className="table-td">
                      <Badge color={row.ageDays > 30 ? 'red' : row.ageDays > 15 ? 'yellow' : 'blue'}>
                        {row.ageDays} days
                      </Badge>
                    </td>
                    <td className="table-td font-bold text-red-600">{formatMoney(row.amount)}</td>
                  </tr>
                )}
             />
          </Card>

          <Card className="p-0 overflow-hidden" id="transaction-history">
             <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><Receipt className="h-4 w-4 text-blue-500" /> Transaction History</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={(e) => handlePrintSection(e, 'Transaction History')}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => exportToCSV(history, `History_${distributor.name}`, [
                    { label: 'Date', key: (r) => formatDate(r.date, dateFormat) },
                    { label: 'Type', key: 'type' },
                    { label: 'Ref', key: 'ref' },
                    { label: 'Method', key: 'method' },
                    { label: 'Amount', key: 'amount' }
                  ])}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
             </div>
             <Table
                columns={['Date', 'Type', 'Ref / Method', 'Amount']}
                data={history}
                renderRow={(h, idx) => (
                  <tr key={idx}>
                    <td className="table-td text-xs">{formatDate(h.date, dateFormat)}</td>
                    <td className="table-td">
                      <Badge color={h.type === 'INVOICE' ? 'blue' : 'green'}>{h.type}</Badge>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-between group">
                        <div>
                          <p className="font-medium text-xs">{h.ref}</p>
                          <p className="text-[10px] text-slate-400">{h.method}</p>
                        </div>
                        {h.type === 'PAYMENT' && (
                          <button onClick={() => deletePayment(h.id)} className="opacity-0 group-hover:opacity-100 text-red-500 p-1 hover:bg-red-50 rounded transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className={`table-td font-bold ${h.type === 'INVOICE' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {h.type === 'INVOICE' ? '+' : '-'}{formatMoney(h.amount)}
                    </td>
                  </tr>
                )}
             />
          </Card>

          <Card className="p-0 overflow-hidden" id="cheque-report">
             <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><History className="h-4 w-4 text-purple-500" /> Pending & Cashed Cheques</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={(e) => handlePrintSection(e, 'Cheque Report')}>
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => exportToCSV(distCheques, `Cheques_${distributor.name}`, [
                    { label: 'Issue Date', key: (r) => r.issueDate ? formatDate(r.issueDate, dateFormat) : '' },
                    { label: 'Cash Date', key: (r) => formatDate(r.cashDate, dateFormat) },
                    { label: 'Cheque #', key: 'chequeNumber' },
                    { label: 'Bank', key: 'bankName' },
                    { label: 'Amount', key: 'amount' },
                    { label: 'Status', key: 'status' }
                  ])}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
             </div>
             <Table
                columns={['Issue Date', 'Cash Date', 'Cheque #', 'Bank', 'Amount', 'Status', 'Actions']}
                data={distCheques}
                renderRow={(c) => (
                  <tr key={c._id}>
                    <td className="table-td text-xs text-slate-500">{c.issueDate ? formatDate(c.issueDate, dateFormat) : '-'}</td>
                    <td className="table-td text-xs">{formatDate(c.cashDate, dateFormat)}</td>
                    <td className="table-td font-medium">{c.chequeNumber}</td>
                    <td className="table-td text-xs">{c.bankName}</td>
                    <td className="table-td font-bold">{formatMoney(c.amount)}</td>
                    <td className="table-td">
                      <Badge color={c.status === 'CASHED' ? 'green' : c.status === 'BOUNCED' ? 'red' : 'blue'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        {c.status !== 'CASHED' ? (
                          <>
                            <button className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                              onClick={() => {
                                setEditingCheque(c);
                                setChequeForm({ ...c, distributor: c.distributor?._id || id });
                                setModal('cheque');
                              }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1 text-red-600 hover:bg-red-50 rounded" onClick={() => deleteCheque(c._id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase font-bold">Locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
             />
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden no-print">
         <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b flex justify-between items-center">
            <h3 className="font-bold">Detailed Invoices</h3>
         </div>
         <Table
            columns={['Inv #', 'Date', 'Total', 'Paid', 'Due', 'Method', 'Actions']}
            data={invoices}
            renderRow={(inv) => (
              <tr key={inv._id} className="text-sm">
                <td className="table-td font-mono text-xs">{inv.invoiceNumber}</td>
                <td className="table-td">{formatDate(inv.saleDate, dateFormat)}</td>
                <td className="table-td font-bold">{formatMoney(inv.netTotal)}</td>
                <td className="table-td text-emerald-600">{formatMoney(inv.amountPaid)}</td>
                <td className="table-td text-red-600 font-semibold">{formatMoney(inv.balanceDue)}</td>
                <td className="table-td text-xs text-slate-500">{inv.paymentMethod}</td>
                <td className="table-td">
                   <div className="flex gap-1">
                     <Button size="sm" variant="ghost" title="View/Print" onClick={() => { setSelectedInvoice(inv); setModal('view-invoice'); }}>
                        <Printer className="h-4 w-4" />
                     </Button>
                     <Button size="sm" variant="ghost" onClick={() => { setEditingInvoice(inv); setModal('edit-invoice'); }}>
                        <Pencil className="h-4 w-4" />
                     </Button>
                     <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => deleteInv(inv._id)}>
                        <Trash2 className="h-4 w-4" />
                     </Button>
                   </div>
                </td>
              </tr>
            )}
         />
      </Card>

      {/* Print Confirmation Modal */}
      <Modal open={modal === 'print-confirm'} onClose={() => setModal(null)} title="Invoice Issued Successfully">
         <div className="p-4 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
               <Receipt className="w-8 h-8" />
            </div>
            <p className="font-medium text-slate-700">Invoice {selectedInvoice?.invoiceNumber} has been generated.</p>
            <p className="text-sm text-slate-500">Would you like to print or download the invoice now?</p>
            <div className="flex gap-3 justify-center pt-4">
               <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Later</Button>
               <Button className="flex-1" onClick={() => { setModal('view-invoice'); setTimeout(handlePrint, 500); }}>
                  <Printer className="h-4 w-4 mr-2" /> Print Now
               </Button>
            </div>
         </div>
      </Modal>

      {/* View Invoice Modal */}
      <Modal open={modal === 'view-invoice'} onClose={() => setModal(null)} title={`Invoice ${selectedInvoice?.invoiceNumber}`} wide>
         <div className="flex justify-end gap-2 mb-4 no-print">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Print / Download PDF</Button>
            <Button variant="outline" size="sm" onClick={() => setModal(null)}>Close</Button>
         </div>
         <div className="bg-slate-100 p-8 rounded-xl overflow-auto max-h-[70vh]">
            <InvoicePreview invoice={selectedInvoice} company={user?.company} distributor={distributor} dateFormat={dateFormat} />
         </div>
      </Modal>

      {/* Payment Modal */}
      <Modal open={modal === 'payment'} onClose={() => setModal(null)} title="Record Payment">
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submitPayment} className="space-y-4">
          <Input label="Amount Paid *" type="number" required min="1" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} />
          <Select
            label="Payment Method *"
            required
            options={[
              { value: 'Cash', label: 'Cash' },
              { value: 'Online/QR', label: 'Online/QR' },
              { value: 'Cheque', label: 'Cheque' }
            ]}
            value={payForm.method}
            onChange={e => setPayForm({...payForm, method: e.target.value})}
          />
          <Textarea label="Remarks" value={payForm.remarks} onChange={e => setPayForm({...payForm, remarks: e.target.value})} />
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Record Payment</Button>
          </div>
        </form>
      </Modal>

      {/* New Invoice Modal */}
      <Modal open={modal === 'new-invoice'} onClose={() => setModal(null)} title="Create Sales Invoice" wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submitNewInvoice} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border">
            <div className="space-y-4">
               <Input label="Distributor" value={distributor.name} disabled className="bg-slate-100" />
               <DatePicker label="Due Date" value={newInvForm.dueDate} onChange={(val) => setNewInvForm({...newInvForm, dueDate: val})} required />
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border">
              <p className="text-sm font-medium mb-2">Payment Method *</p>
              <div className="flex flex-wrap gap-4">
                {['Cash', 'Online/QR', 'Cheque', 'Credit'].map(method => (
                  <Checkbox
                    key={method}
                    label={method}
                    checked={newInvForm.paymentMethod === method}
                    onChange={() => setNewInvForm({...newInvForm, paymentMethod: method})}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-2 py-3">S.N</th>
                  <th className="px-2 py-3">Product Name</th>
                  <th className="px-2 py-3">Batch</th>
                  <th className="px-2 py-3">Price</th>
                  <th className="px-2 py-3">Quantity</th>
                  <th className="px-2 py-3">Amount</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {newInvForm.items.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2 min-w-[200px]">
                      <Select
                        className="w-full"
                        value={row.productId}
                        onChange={(e) => {
                          const prod = allProducts.find(p => p._id === e.target.value);
                          updateNewInvRow(idx, 'productId', e.target.value);
                          updateNewInvRow(idx, 'productName', prod?.productName || '');
                          updateNewInvRow(idx, 'batch', prod?.batchNumber || '');
                          if (prod) updateNewInvRow(idx, 'price', prod.sellingPrice);
                        }}
                        options={[
                          { value: '', label: 'Select product...' },
                          ...allProducts.map(p => ({ value: p._id, label: `${p.productName} (Stock: ${p.quantity})` }))
                        ]}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={row.batch} onChange={e => updateNewInvRow(idx, 'batch', e.target.value)} placeholder="Batch" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" step="0.01" value={row.price} onChange={e => updateNewInvRow(idx, 'price', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="1" value={row.quantity} onChange={e => updateNewInvRow(idx, 'quantity', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold">{formatMoney(row.amount)}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                       <button type="button" onClick={() => removeNewInvRow(idx)} className="text-red-500 hover:text-red-700">
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addNewInvRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>

          <div className="flex flex-col items-end gap-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-full max-w-xs text-sm">
              <span className="text-slate-500">Total Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculateNewInvTotals().totalAmount)}</span>

              <span className="text-slate-500 flex items-center">Discount %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={newInvForm.discountPct} onChange={e => setNewInvForm({...newInvForm, discountPct: Number(e.target.value)})} />

              <span className="text-slate-500">Discount:</span>
              <span className="font-semibold text-right text-red-500">-{formatMoney(calculateNewInvTotals().discount)}</span>

              <span className="text-slate-500">Taxable Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculateNewInvTotals().taxableAmount)}</span>

              <span className="text-slate-500 flex items-center">VAT %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={newInvForm.vatPct} onChange={e => setNewInvForm({...newInvForm, vatPct: Number(e.target.value)})} />

              <span className="text-slate-500">VAT:</span>
              <span className="font-semibold text-right">+{formatMoney(calculateNewInvTotals().vat)}</span>

              <div className="col-span-2 border-t mt-2 pt-2 grid grid-cols-2">
                <span className="text-base font-bold">Net Total:</span>
                <span className="text-base font-bold text-right text-primary-600">{formatMoney(calculateNewInvTotals().netTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Generate Invoice</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal open={modal === 'edit-invoice'} onClose={() => setModal(null)} title={`Edit Invoice ${editingInvoice?.invoiceNumber}`} wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={updateInvoice} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border">
            <div className="space-y-4">
               <Input label="Customer Name" value={editingInvoice?.customerName || ''} onChange={e => setEditingInvoice({...editingInvoice, customerName: e.target.value})} />
               <DatePicker label="Due Date" value={editingInvoice?.dueDate ? new Date(editingInvoice.dueDate).toISOString().split('T')[0] : ''} onChange={(val) => setEditingInvoice({...editingInvoice, dueDate: val})} />
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border">
              <p className="text-sm font-medium mb-2">Payment Method *</p>
              <div className="flex flex-wrap gap-4">
                {['Cash', 'Online/QR', 'Cheque', 'Credit'].map(method => (
                  <Checkbox
                    key={method}
                    label={method}
                    checked={editingInvoice?.paymentMethod === method}
                    onChange={() => setEditingInvoice({...editingInvoice, paymentMethod: method})}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-2 py-3">S.N</th>
                  <th className="px-2 py-3">Product Name</th>
                  <th className="px-2 py-3">Batch</th>
                  <th className="px-2 py-3">Price</th>
                  <th className="px-2 py-3">Quantity</th>
                  <th className="px-2 py-3">Amount</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editingInvoice?.items.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2 min-w-[200px]">
                      <Input
                        className="w-full"
                        value={row.productName}
                        onChange={e => updateEditRow(idx, 'productName', e.target.value)}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={row.batch || ''} onChange={e => updateEditRow(idx, 'batch', e.target.value)} placeholder="Batch" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" step="0.01" value={row.price} onChange={e => updateEditRow(idx, 'price', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="1" value={row.quantity} onChange={e => updateEditRow(idx, 'quantity', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold">{formatMoney(row.amount)}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                       <button type="button" onClick={() => removeEditRow(idx)} className="text-red-500 hover:text-red-700">
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addEditRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>

          <div className="flex flex-col items-end gap-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-full max-w-xs text-sm">
              <span className="text-slate-500">Total Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculateEditTotals().totalAmount)}</span>

              <span className="text-slate-500 flex items-center">Discount %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={editingInvoice?.discountPct || 0} onChange={e => setEditingInvoice({...editingInvoice, discountPct: Number(e.target.value)})} />

              <span className="text-slate-500">Discount:</span>
              <span className="font-semibold text-right text-red-500">-{formatMoney(calculateEditTotals().discount)}</span>

              <span className="text-slate-500">Taxable Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculateEditTotals().taxableAmount)}</span>

              <span className="text-slate-500 flex items-center">VAT %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={editingInvoice?.vatPct || 0} onChange={e => setEditingInvoice({...editingInvoice, vatPct: Number(e.target.value)})} />

              <span className="text-slate-500">VAT:</span>
              <span className="font-semibold text-right">+{formatMoney(calculateEditTotals().vat)}</span>

              <div className="col-span-2 border-t mt-2 pt-2 grid grid-cols-2">
                <span className="text-base font-bold">Net Total:</span>
                <span className="text-base font-bold text-right text-primary-600">{formatMoney(calculateEditTotals().netTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Corrections</Button>
          </div>
        </form>
      </Modal>

      {/* Cheque Modal */}
      <Modal open={modal === 'cheque'} onClose={() => setModal(null)} title={editingCheque ? 'Update Cheque Status' : 'Add Cheque Record'}>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submitCheque} className="space-y-4">
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
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingCheque ? 'Update Cheque' : 'Add Cheque'}</Button>
          </div>
        </form>
      </Modal>

      {/* Credit Limit Warning Modal */}
      <Modal open={modal === 'credit-limit-warning'} onClose={() => setModal(null)} title="Credit Limit Warning">
        <div className="p-4 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="font-semibold text-slate-800 text-lg">Distributor Due is above credit limit</p>
          <p className="text-sm text-slate-500">The current outstanding balance exceeds the assigned credit limit. Do you want to proceed with issuing a new invoice?</p>
          <div className="flex gap-3 justify-center pt-4 border-t">
            <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => setModal('new-invoice')}>
              Proceed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
