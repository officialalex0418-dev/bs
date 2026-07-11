import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ShoppingCart, CreditCard, History, Phone, Mail,
  MapPin, Hash, Plus, Printer, Download, Trash2, Edit
} from 'lucide-react';
import { api } from '@/api/client';
import {
  Card, Button, Spinner, Table, Badge,
  EmptyState, Modal, Input, Select, Textarea, DatePicker
} from '@/components/ui';
import { formatMoney, formatDate, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const emptyPayment = { amount: 0, method: 'CASH', remarks: '', paymentDate: '' };

export default function VendorDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'payment'
  const [payForm, setPayForm] = useState(emptyPayment);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [purchaseRows, setPurchaseRows] = useState([]);
  const [purchaseVendorId, setPurchaseVendorId] = useState('');
  const [purchaseDiscountPct, setPurchaseDiscountPct] = useState(0);
  const [purchaseVatPct, setPurchaseVatPct] = useState(0);
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';

  const loadProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/sales/metadata');
      setAllProducts(data.data.products);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/vendors/${id}`);
      setData(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); loadProducts(); }, [load, loadProducts]);

  const handlePrintLedger = (e) => {
    if (e) e.preventDefault();
    const element = document.getElementById('vendor-ledger-table');
    if (!element) return;

    // Fix: Only select the table element to prevent double entry (text below table)
    const tableElement = element.querySelector('table');
    const tableHtml = tableElement ? tableElement.outerHTML : element.innerHTML;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    const companyLogo = user?.company?.logo || '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Vendor Ledger - ${vendor.name}</title>
          <style>
            body { font-family: "Times New Roman", Times, serif; padding: 40px; color: #000; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; border: 2.5px solid #000; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f0f0f0; font-weight: bold; text-transform: uppercase; }
            /* Hide the Actions column in print */
            th:last-child, td:last-child { display: none !important; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
            .company-name { font-size: 28px; font-weight: bold; text-transform: uppercase; }
            .ledger-title { font-size: 20px; font-weight: bold; text-decoration: underline; margin: 20px 0; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-weight: bold; }
            .no-print { display: none !important; }
            .text-right { text-align: right; }
            .whitespace-nowrap { white-space: nowrap; }
          </style>
        </head>
        <body>
          <div class="header">
            ${companyLogo ? `<img src="${companyLogo}" style="max-height: 80px;" /><br/>` : ''}
            <div class="company-name">${user?.company?.name || 'Business Sarthi'}</div>
            <div>${user?.company?.address || ''} | PAN: ${user?.company?.panVat || '—'}</div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <strong>Vendor:</strong> ${vendor.name}<br/>
              <strong>Address:</strong> ${vendor.address || '—'}
            </div>
            <div class="text-right">
              Date: ${new Date().toLocaleDateString()}<br/>
              <strong>Closing Balance: ${formatMoney(vendor.outstandingBalance)}</strong>
            </div>
          </div>

          <center><div class="ledger-title">VENDOR ACCOUNT LEDGER</div></center>

          ${tableHtml}

          <div class="footer">
            <div style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px;">Prepared By</div>
            <div style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px;">Authorized Signatory</div>
          </div>

          <script>
            window.onload = function() { window.print(); setTimeout(window.close, 500); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const exportLedgerCSV = () => {
    const csvRows = [];
    csvRows.push(`"VENDOR ACCOUNT LEDGER - ${vendor.name}"`);
    csvRows.push(`"Generated On:",${new Date().toLocaleString()}`);
    csvRows.push(`"Outstanding Balance:",${formatMoney(vendor.outstandingBalance)}`);
    csvRows.push("");
    csvRows.push("Date,Type,Reference,Debit (+),Credit (-)");

    for (const item of history) {
      const row = [
        formatDateTime(item.date, dateFormat),
        item.type,
        `"${item.ref || ''}"`,
        item.type === 'PURCHASE' ? item.amount : 0,
        item.type === 'PAYMENT' ? item.amount : 0
      ];
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ledger_${vendor.name.replace(/\s+/g, '_')}.csv`;
    a.click();
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/vendor-payments', { ...payForm, vendorId: id });
      setModal(null);
      setPayForm(emptyPayment);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed');
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (paymentId) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
      await api.delete(`/vendor-payments/${paymentId}`);
      load();
    } catch (err) {
      alert('Failed to delete payment');
    }
  };

  const startEdit = (item) => {
    setEditingItem(item);
    if (item.type === 'PAYMENT') {
      const p = payments.find(p => p._id === item.id);
      setPayForm({
        amount: p.amount,
        method: p.method,
        remarks: p.remarks || '',
        paymentDate: p.paymentDate.split('T')[0]
      });
      setModal('edit-payment');
    } else {
      const p = purchases.find(p => p._id === item.id);
      setPurchaseRows(p.items.map(i => ({
        ...i,
        productId: i.product || '',
        amount: i.amount || (i.price * i.quantity),
        expiryDate: i.expiryDate ? i.expiryDate.split('T')[0] : ''
      })));
      setPurchaseDiscountPct(p.discountPct || 0);
      setPurchaseVatPct(p.vatPct || 0);
      setPayForm({ paymentDate: p.createdAt.split('T')[0] });
      setModal('edit-purchase');
    }
  };

  const updatePurchaseRow = (index, field, value) => {
    const next = [...purchaseRows];
    next[index][field] = value;
    if (field === 'price' || field === 'quantity') {
      next[index].amount = (Number(next[index].price) || 0) * (Number(next[index].quantity) || 0);
    }
    setPurchaseRows(next);
  };

  const calculatePurchaseTotals = () => {
    const totalAmount = purchaseRows.reduce((sum, row) => sum + row.amount, 0);
    const discount = (totalAmount * purchaseDiscountPct) / 100;
    const taxableAmount = totalAmount - discount;
    const vat = (taxableAmount * purchaseVatPct) / 100;
    const netTotal = taxableAmount + vat;
    return { totalAmount, discount, taxableAmount, vat, netTotal };
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem.type === 'PAYMENT') {
        await api.patch(`/vendor-payments/${editingItem.id}`, payForm);
      } else {
        await api.patch(`/purchases/${editingItem.id}`, {
          purchaseDate: payForm.paymentDate,
          items: purchaseRows,
          discountPct: purchaseDiscountPct,
          vatPct: purchaseVatPct
        });
      }
      setModal(null);
      setEditingItem(null);
      setPayForm(emptyPayment);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;
  if (!data) return <EmptyState title="Vendor not found" />;

  const { vendor, purchases, payments, history } = data;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/company/vendors" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{vendor.name}</h1>
          <p className="text-sm text-slate-500">Vendor Account Details</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setModal('payment')}>
            <CreditCard className="h-4 w-4 mr-2" /> Pay Vendor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-4">
          <h3 className="font-bold border-b pb-2">Profile Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <Phone className="h-4 w-4" /> {vendor.phone || 'N/A'}
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <Mail className="h-4 w-4" /> {vendor.email || 'N/A'}
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <MapPin className="h-4 w-4" /> {vendor.address || 'N/A'}
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <Hash className="h-4 w-4" /> PAN/VAT: {vendor.panVat || 'N/A'}
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Total Outstanding (Payable)</p>
          <p className="text-3xl font-black text-red-700 dark:text-red-400 mt-1">{formatMoney(vendor.outstandingBalance)}</p>
          <p className="text-xs text-red-500 mt-2 italic">How much you owe to this vendor.</p>
        </Card>

        <Card className="p-6 bg-slate-900 text-white">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Summary</p>
                <div className="mt-4 space-y-2">
                   <p className="text-sm">Total Purchases: <span className="font-bold">{formatMoney(purchases.reduce((s, p) => s + p.netTotal, 0))}</span></p>
                   <p className="text-sm">Total Paid: <span className="font-bold">{formatMoney(payments.reduce((s, p) => s + p.amount, 0))}</span></p>
                </div>
             </div>
             <History className="h-8 w-8 text-slate-700" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="border-b px-4 flex justify-between items-center">
           <div className="flex gap-6 overflow-x-auto no-scrollbar">
              <button className="px-4 py-4 text-sm font-bold border-b-2 border-primary-600 text-primary-600">Full Ledger</button>
           </div>
           <div className="flex gap-2 py-2">
              <Button variant="outline" size="sm" onClick={handlePrintLedger}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={exportLedgerCSV}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
           </div>
        </div>

        <div id="vendor-ledger-table">
          <Table
            columns={['Date & Time', 'Type/Ref', 'Debit (Purchase)', 'Credit (Payment)', 'Status', 'Actions']}
            data={history}
            renderRow={(item) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="table-td text-slate-500 whitespace-nowrap text-xs">{formatDateTime(item.date, dateFormat)}</td>
                <td className="table-td">
                  <p className="font-bold text-xs uppercase">{item.type}</p>
                  <p className="text-[10px] text-slate-400">{item.ref} {item.method ? `(${item.method})` : ''}</p>
                </td>
                <td className="table-td text-red-600 font-medium">
                  {item.type === 'PURCHASE' ? `+ ${formatMoney(item.amount)}` : ''}
                </td>
                <td className="table-td text-emerald-600 font-medium">
                  {item.type === 'PAYMENT' ? `- ${formatMoney(item.amount)}` : ''}
                </td>
                <td className="table-td">
                  <Badge color={item.type === 'PURCHASE' ? 'blue' : 'green'}>Recorded</Badge>
                </td>
                <td className="table-td no-print">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(item)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded">
                      <Edit className="h-4 w-4" />
                    </button>
                    {item.type === 'PAYMENT' && (
                      <button onClick={() => deletePayment(item.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </Card>

      {/* Payment Modal */}
      <Modal open={modal === 'payment'} onClose={() => setModal(null)} title="Record Payment to Vendor">
         <form onSubmit={submitPayment} className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl mb-4 border">
               <p className="text-xs text-slate-500 uppercase font-bold">Outstanding Balance</p>
               <p className="text-xl font-black text-red-600">{formatMoney(vendor.outstandingBalance)}</p>
            </div>

            <Input
              label="Amount Paid *"
              type="number"
              required
              value={payForm.amount}
              onChange={e => setPayForm({...payForm, amount: e.target.value})}
              autoFocus
            />

            <Select
              label="Payment Method"
              value={payForm.method}
              onChange={e => setPayForm({...payForm, method: e.target.value})}
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'CHEQUE', label: 'Cheque' }
              ]}
            />

            <DatePicker
              label="Payment Date"
              value={payForm.paymentDate}
              onChange={val => setPayForm({...payForm, paymentDate: val})}
            />

            <Textarea
              label="Remarks"
              value={payForm.remarks}
              onChange={e => setPayForm({...payForm, remarks: e.target.value})}
              placeholder="Cheque number, bank ref, etc."
            />

            <div className="flex justify-end gap-2 pt-4">
               <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
               <Button type="submit" loading={saving}>Record Payment</Button>
            </div>
         </form>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal open={modal === 'edit-payment'} onClose={() => setModal(null)} title="Edit Payment Record">
         <form onSubmit={submitEdit} className="space-y-4">
            <Input
              label="Amount Paid *"
              type="number"
              required
              value={payForm.amount}
              onChange={e => setPayForm({...payForm, amount: e.target.value})}
            />
            <Select
              label="Payment Method"
              value={payForm.method}
              onChange={e => setPayForm({...payForm, method: e.target.value})}
              options={[
                { value: 'CASH', label: 'Cash' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'CHEQUE', label: 'Cheque' }
              ]}
            />
            <DatePicker
              label="Payment Date"
              value={payForm.paymentDate}
              onChange={val => setPayForm({...payForm, paymentDate: val})}
            />
            <Textarea
              label="Remarks"
              value={payForm.remarks}
              onChange={e => setPayForm({...payForm, remarks: e.target.value})}
            />
            <div className="flex justify-end gap-2 pt-4">
               <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
               <Button type="submit" loading={saving}>Update Payment</Button>
            </div>
         </form>
      </Modal>

      {/* Edit Purchase Modal */}
      <Modal open={modal === 'edit-purchase'} onClose={() => setModal(null)} title="Edit Purchase Entry" wide>
         <form onSubmit={submitEdit} className="space-y-6">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 text-sm">
               <strong>Inventory Sync:</strong> Editing items here updates the Vendor Statement.
               Note: If stock has already been sold, changing quantities may result in negative inventory balances.
            </div>

            <div className="flex gap-4 items-end">
               <DatePicker
                 label="Purchase Date"
                 value={payForm.paymentDate}
                 onChange={val => setPayForm({...payForm, paymentDate: val})}
               />
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 dark:bg-slate-900/50">
                     <tr>
                        <th className="px-2 py-3">S.N</th>
                        <th className="px-2 py-3">Product Name</th>
                        <th className="px-2 py-3">Batch</th>
                        <th className="px-2 py-3">Price</th>
                        <th className="px-2 py-3">Qty</th>
                        <th className="px-2 py-3">Amount</th>
                        <th className="px-2 py-3">Expiry</th>
                        <th className="px-2 py-3"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y">
                     {purchaseRows.map((row, idx) => (
                        <tr key={idx}>
                           <td className="px-2 py-2">{idx + 1}</td>
                           <td className="px-2 py-2 min-w-[200px]">
                              <Select
                                className="w-full"
                                value={row.productId}
                                onChange={(e) => {
                                   const prod = allProducts.find(p => p._id === e.target.value);
                                   updatePurchaseRow(idx, 'productId', e.target.value);
                                   updatePurchaseRow(idx, 'productName', prod?.productName || '');
                                   if (prod) {
                                      updatePurchaseRow(idx, 'price', prod.costPrice);
                                      updatePurchaseRow(idx, 'batch', prod.batchNumber || '');
                                   }
                                }}
                                options={[
                                   { value: '', label: 'Select product...' },
                                   ...allProducts.map(p => ({
                                      value: p._id,
                                      label: `${p.productName} (Batch: ${p.batchNumber || 'N/A'})`
                                   }))
                                ]}
                                required
                              />
                           </td>
                           <td className="px-2 py-2">
                              <Input value={row.batch} onChange={e => updatePurchaseRow(idx, 'batch', e.target.value)} />
                           </td>
                           <td className="px-2 py-2 w-24">
                              <Input type="number" step="0.01" value={row.price} onChange={e => updatePurchaseRow(idx, 'price', e.target.value)} required />
                           </td>
                           <td className="px-2 py-2 w-20">
                              <Input type="number" value={row.quantity} onChange={e => updatePurchaseRow(idx, 'quantity', e.target.value)} required />
                           </td>
                           <td className="px-2 py-2 font-bold">{formatMoney(row.amount)}</td>
                           <td className="px-2 py-2">
                              <DatePicker value={row.expiryDate} onChange={val => updatePurchaseRow(idx, 'expiryDate', val)} />
                           </td>
                           <td className="px-2 py-2">
                              <button type="button" onClick={() => setPurchaseRows(purchaseRows.filter((_, i) => i !== idx))} className="text-red-500">
                                 <Trash2 className="h-4 w-4" />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={() => setPurchaseRows([...purchaseRows, { productName: '', productId: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }])}>
               <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>

            <div className="flex flex-col items-end gap-2 border-t pt-4">
               <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-full max-w-xs text-sm">
                  <span className="text-slate-500">Total Amount:</span>
                  <span className="font-bold text-right">{formatMoney(calculatePurchaseTotals().totalAmount)}</span>
                  <span className="text-slate-500 flex items-center">Discount %:</span>
                  <Input type="number" className="h-8 text-right" value={purchaseDiscountPct} onChange={e => setPurchaseDiscountPct(Number(e.target.value))} />
                  <span className="text-slate-500 flex items-center">VAT %:</span>
                  <Input type="number" className="h-8 text-right" value={purchaseVatPct} onChange={e => setPurchaseVatPct(Number(e.target.value))} />
                  <div className="col-span-2 border-t mt-2 pt-2 grid grid-cols-2">
                     <span className="text-base font-bold">Net Total:</span>
                     <span className="text-base font-bold text-right text-primary-600">{formatMoney(calculatePurchaseTotals().netTotal)}</span>
                  </div>
               </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
               <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
               <Button type="submit" loading={saving}>Save Changes</Button>
            </div>
         </form>
      </Modal>
    </div>
  );
}
