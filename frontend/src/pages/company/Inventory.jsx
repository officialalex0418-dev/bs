import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, PackagePlus, AlertTriangle, FileUp, Download, X, MoreVertical, ToggleLeft, ToggleRight, ShoppingCart, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Input, Select, Modal, Table, Badge, Spinner, Pagination, EmptyState, Textarea, Checkbox, DatePicker } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';
import { Boxes } from 'lucide-react';

const emptyForm = {
  productName: '', sku: '', category: '', costPrice: 0, sellingPrice: 0,
  vendor: '', reorderLevel: 10, vatPct: 0, batchNumber: '', expiryDate: '',
  description: '', customFields: {}
};

export default function InventoryPage() {
  const { user, setUser } = useAuth();
  const [data, setData] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [modal, setModal] = useState(null); // 'form' | 'stock' | 'bulk' | 'vendor' | 'purchase' | 'invoice'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Purchase Entry State
  const [purchaseRows, setPurchaseRows] = useState([
    { productName: '', productId: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }
  ]);
  const [purchaseVendorId, setPurchaseVendorId] = useState('');
  const [purchaseDiscountPct, setPurchaseDiscountPct] = useState(0);
  const [purchaseVatPct, setPurchaseVatPct] = useState(0);

  // Invoice Entry State
  const [invoiceRows, setInvoiceRows] = useState([
    { productName: '', productId: '', batch: '', price: 0, quantity: 1, amount: 0 }
  ]);
  const [invoiceDistributorId, setInvoiceDistributorId] = useState('');
  const [invoiceDiscountPct, setInvoiceDiscountPct] = useState(0);
  const [invoiceVatPct, setInvoiceVatPct] = useState(0);
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState('');

  // New Product Modal State (Table-like as requested)
  const [productRows, setProductRows] = useState([
    { productName: '', sku: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }
  ]);
  const [customFieldKey, setCustomFieldKey] = useState('');
  const [customFieldValue, setCustomFieldKeyVal] = useState('');
  const [stockForm, setStockForm] = useState({ type: 'IN', quantity: 1, note: '' });
  const [saving, setSaving] = useState(false);
  const [updatingSync, setUpdatingSync] = useState(false);
  const [error, setError] = useState('');
  const [featureBlocked, setFeatureBlocked] = useState(false);

  const inventorySync = user?.company?.settings?.inventorySync || false;
  const dateFormat = user?.company?.settings?.dateFormat || 'BS';

  const toggleInventorySync = async () => {
    setUpdatingSync(true);
    setError('');
    try {
      const nextSync = !inventorySync;
      // We send the entire settings object to ensure other settings are preserved
      const currentSettings = user.company?.settings || {};
      const { data } = await api.patch('/companies/me', {
        settings: { ...currentSettings, inventorySync: nextSync }
      });
      setUser({ ...user, company: data.data.company });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to toggle sales sync');
    } finally {
      setUpdatingSync(false);
    }
  };

  const addPurchaseRow = () => {
    setPurchaseRows([...purchaseRows, { productName: '', productId: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }]);
  };

  const updatePurchaseRow = (index, field, value) => {
    const next = [...purchaseRows];
    next[index][field] = value;
    if (field === 'price' || field === 'quantity') {
      next[index].amount = (Number(next[index].price) || 0) * (Number(next[index].quantity) || 0);
    }
    setPurchaseRows(next);
  };

  const removePurchaseRow = (index) => {
    if (purchaseRows.length === 1) return;
    setPurchaseRows(purchaseRows.filter((_, i) => i !== index));
  };

  const calculatePurchaseTotals = () => {
    const totalAmount = purchaseRows.reduce((sum, row) => sum + row.amount, 0);
    const discount = (totalAmount * purchaseDiscountPct) / 100;
    const taxableAmount = totalAmount - discount;
    const vat = (taxableAmount * purchaseVatPct) / 100;
    const netTotal = taxableAmount + vat;
    return { totalAmount, discount, taxableAmount, vat, netTotal };
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post('/purchases', {
        items: purchaseRows,
        vendorId: purchaseVendorId,
        discountPct: purchaseDiscountPct,
        vatPct: purchaseVatPct
      });
      setModal(null);
      setPurchaseRows([{ productName: '', productId: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }]);
      setPurchaseVendorId('');
      load();
      loadAllProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Purchase entry failed');
    } finally { setSaving(false); }
  };

  const addInvoiceRow = () => {
    setInvoiceRows([...invoiceRows, { productName: '', productId: '', batch: '', price: 0, quantity: 1, amount: 0 }]);
  };

  const updateInvoiceRow = (index, field, value) => {
    const next = [...invoiceRows];
    next[index][field] = value;
    if (field === 'price' || field === 'quantity') {
      next[index].amount = (Number(next[index].price) || 0) * (Number(next[index].quantity) || 0);
    }
    setInvoiceRows(next);
  };

  const removeInvoiceRow = (index) => {
    if (invoiceRows.length === 1) return;
    setInvoiceRows(invoiceRows.filter((_, i) => i !== index));
  };

  const calculateInvoiceTotals = () => {
    const totalAmount = invoiceRows.reduce((sum, row) => sum + row.amount, 0);
    const discount = (totalAmount * invoiceDiscountPct) / 100;
    const taxableAmount = totalAmount - discount;
    const vat = (taxableAmount * invoiceVatPct) / 100;
    const netTotal = taxableAmount + vat;
    return { totalAmount, discount, taxableAmount, vat, netTotal };
  };

  const submitInvoice = async (e) => {
    e.preventDefault();
    if (!invoicePaymentMethod) { setError('Please select a payment method'); return; }
    setSaving(true); setError('');
    try {
      await api.post('/sales-invoices', {
        items: invoiceRows,
        discountPct: invoiceDiscountPct,
        vatPct: invoiceVatPct,
        paymentMethod: invoicePaymentMethod,
        distributorId: invoiceDistributorId
      });
      setModal(null);
      setInvoiceRows([{ productName: '', productId: '', batch: '', price: 0, quantity: 1, amount: 0 }]);
      setInvoiceDistributorId('');
      setInvoicePaymentMethod('');
      load();
      loadAllProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice entry failed');
    } finally { setSaving(false); }
  };

  const addProductRow = () => {
    setProductRows([...productRows, { productName: '', sku: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }]);
  };

  const updateProductRow = (index, field, value) => {
    const next = [...productRows];
    next[index][field] = value;
    if (field === 'price' || field === 'quantity') {
      next[index].amount = (Number(next[index].price) || 0) * (Number(next[index].quantity) || 0);
    }
    setProductRows(next);
  };

  const removeProductRow = (index) => {
    if (productRows.length === 1) return;
    setProductRows(productRows.filter((_, i) => i !== index));
  };

  const submitProductsTable = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) {
        // Single update case
        const row = productRows[0];
        await api.patch(`/inventory/${editing._id}`, {
          productName: row.productName,
          sku: row.sku,
          costPrice: Number(row.price),
          quantity: Number(row.quantity),
          batchNumber: row.batch,
          expiryDate: row.expiryDate
        });
      } else {
        // Bulk creation case
        const productsToCreate = productRows.map(r => ({
          productName: r.productName,
          sku: r.sku || `AUTO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          costPrice: Number(r.price),
          sellingPrice: Number(r.price) * 1.2, // Default 20% markup
          quantity: Number(r.quantity),
          batchNumber: r.batch,
          expiryDate: r.expiryDate
        }));
        await api.post('/inventory/bulk-upload', { products: productsToCreate });
      }

      setModal(null);
      setEditing(null);
      setProductRows([{ productName: '', sku: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }]);
      load();
      loadAllProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save products');
    } finally { setSaving(false); }
  };

  // Bulk upload state
  const [bulkData, setBulkData] = useState([]);
  const [bulkResults, setBulkResults] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory', { params: { page, search: search || undefined, lowStock: lowOnly || undefined } });
      setData(data.data);
    } catch (err) {
      if (err.response?.status === 403) setFeatureBlocked(true);
    }
  }, [page, search, lowOnly]);

  const loadVendors = useCallback(async () => {
    try {
      const { data } = await api.get('/vendors?limit=100');
      setVendors(data.data.items);
    } catch {}
  }, []);

  const loadDistributors = useCallback(async () => {
    try {
      const { data } = await api.get('/distributors?limit=100');
      setDistributors(data.data.items);
    } catch {}
  }, []);

  const loadAllProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/sales/metadata');
      setAllProducts(data.data.products);
    } catch {}
  }, []);

  useEffect(() => { load(); loadVendors(); loadDistributors(); loadAllProducts(); }, [load, loadVendors, loadDistributors, loadAllProducts]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { ...form };
      if (editing) await api.patch(`/inventory/${editing._id}`, body);
      else await api.post('/inventory', body);
      setModal(null); setEditing(null); setForm(emptyForm); load(); loadAllProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally { setSaving(false); }
  };

  const handleBulkFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setBulkData(data);
    };
    reader.readAsBinaryString(file);
  };

  const confirmBulkUpload = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/inventory/bulk-upload', { products: bulkData });
      setBulkResults(data.data);
      load();
    } catch (err) {
      setError('Bulk upload failed');
    } finally { setSaving(false); }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { productName: 'Sample Product', sku: 'PRD-001', category: 'Electronics', costPrice: 100, sellingPrice: 150, reorderLevel: 5, vatPct: 13 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "inventory_template.xlsx");
  };

  const addCustomField = () => {
    if (!customFieldKey) return;
    setForm({ ...form, customFields: { ...form.customFields, [customFieldKey]: customFieldValue } });
    setCustomFieldKey(''); setCustomFieldKeyVal('');
  };

  const removeCustomField = (key) => {
    const next = { ...form.customFields };
    delete next[key];
    setForm({ ...form, customFields: next });
  };

  if (featureBlocked) return <Card><EmptyState icon={Boxes} title="Inventory locked" subtitle="Upgrade to unlock inventory management." /></Card>;
  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Inventory</h1>
          {data.lowStockCount > 0 && <Badge color="red">{data.lowStockCount} Low Stock</Badge>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={toggleInventorySync}
            loading={updatingSync}
            className={inventorySync ? 'border-emerald-500 text-emerald-600' : 'text-slate-400'}
          >
            {inventorySync ? <ToggleRight className="h-5 w-5 mr-2" /> : <ToggleLeft className="h-5 w-5 mr-2" />}
            Sales {inventorySync ? 'ON' : 'OFF'}
          </Button>
          <Button variant="outline" onClick={() => setModal('invoice')}><FileText className="h-4 w-4 mr-2" /> Create Invoice</Button>
          <Button variant="outline" onClick={() => setModal('purchase')}><ShoppingCart className="h-4 w-4 mr-2" /> Purchase Entry</Button>
          <Button variant="outline" onClick={() => setModal('bulk')}><FileUp className="h-4 w-4" /> Bulk Upload</Button>
          <Button onClick={() => {
            setEditing(null);
            setProductRows([{ productName: '', sku: '', batch: '', price: 0, quantity: 1, amount: 0, expiryDate: '' }]);
            setModal('form');
          }}><Plus className="h-4 w-4" /> Add Product</Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
          <Input placeholder="Search SKU or Name…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs" />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }} />
            Low stock only
          </label>
        </div>
        <Table
          columns={['S.N', 'Name', 'Batch', 'Price', 'Quantity', 'Expiry Date', 'Actions']}
          data={data.items}
          renderRow={(p, idx) => (
            <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td text-slate-500">
                {idx + 1 + ((data.pagination?.page || 1) - 1) * (data.pagination?.limit || 10)}
              </td>
              <td className="table-td font-semibold">{p.productName}</td>
              <td className="table-td">{p.batchNumber || '-'}</td>
              <td className="table-td">{formatMoney(p.costPrice)}</td>
              <td className="table-td">
                <Badge color={p.isLowStock ? 'red' : 'green'}>{p.quantity}</Badge>
              </td>
              <td className="table-td text-xs">
                {p.expiryDate ? formatDate(p.expiryDate, dateFormat) : '-'}
              </td>
              <td className="table-td">
                <div className="flex gap-1">
                  <Button title="Edit Product" variant="ghost" size="sm" onClick={() => {
                    setEditing(p);
                    setProductRows([{
                      productName: p.productName,
                      sku: p.sku,
                      batch: p.batchNumber || '',
                      price: p.costPrice,
                      quantity: p.quantity,
                      amount: p.costPrice * p.quantity,
                      expiryDate: p.expiryDate ? p.expiryDate.slice(0, 10) : ''
                    }]);
                    setModal('form');
                  }}><Pencil className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(p, idx) => (
            <div key={p._id} className="p-4 space-y-3 border-b dark:border-slate-800 last:border-0">
               <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 mr-2">#{idx + 1 + ((data.pagination?.page || 1) - 1) * (data.pagination?.limit || 10)}</span>
                    <span className="font-bold">{p.productName}</span>
                  </div>
                  <Badge color={p.isLowStock ? 'red' : 'green'}>{p.quantity} in stock</Badge>
               </div>
               <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <p>Batch: <span className="text-slate-900 dark:text-slate-300">{p.batchNumber || '-'}</span></p>
                  <p>Price: <span className="text-slate-900 dark:text-slate-300">{formatMoney(p.costPrice)}</span></p>
                  <p>Expiry: <span className="text-slate-900 dark:text-slate-300">{p.expiryDate ? formatDate(p.expiryDate, dateFormat) : '-'}</span></p>
               </div>
               <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(p);
                    setProductRows([{
                      productName: p.productName,
                      sku: p.sku,
                      batch: p.batchNumber || '',
                      price: p.costPrice,
                      quantity: p.quantity,
                      amount: p.costPrice * p.quantity,
                      expiryDate: p.expiryDate ? p.expiryDate.slice(0, 10) : ''
                    }]);
                    setModal('form');
                  }}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
               </div>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      {/* Product Form Modal - Transformed to look like Purchase Entry */}
      <Modal open={modal === 'form'} onClose={() => setModal(null)} title="Add Products" wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submitProductsTable} className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-2 py-3">S.N</th>
                  <th className="px-2 py-3">Name</th>
                  <th className="px-2 py-3">Batch</th>
                  <th className="px-2 py-3">Price</th>
                  <th className="px-2 py-3">Quantity</th>
                  <th className="px-2 py-3">Amount</th>
                  <th className="px-2 py-3">Expiry Date</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {productRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2 min-w-[200px]">
                      <Input
                        value={row.productName}
                        onChange={e => updateProductRow(idx, 'productName', e.target.value)}
                        placeholder="Product Name"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={row.batch} onChange={e => updateProductRow(idx, 'batch', e.target.value)} placeholder="Batch" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" step="0.01" value={row.price} onChange={e => updateProductRow(idx, 'price', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" value={row.quantity} onChange={e => updateProductRow(idx, 'quantity', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold">{formatMoney(row.amount)}</div>
                    </td>
                    <td className="px-2 py-2">
                      <DatePicker value={row.expiryDate} onChange={val => updateProductRow(idx, 'expiryDate', val)} />
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removeProductRow(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addProductRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Product Row
          </Button>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Products</Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal open={modal === 'bulk'} onClose={() => {setModal(null); setBulkResults(null); setBulkData([]);}} title="Bulk Product Upload">
        {bulkResults ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4 text-emerald-700 dark:bg-emerald-900/20">
              <p className="font-bold">Upload Complete!</p>
              <p className="text-sm">{bulkResults.created} products created successfully.</p>
              {bulkResults.duplicates > 0 && <p className="text-sm">{bulkResults.duplicates} duplicates skipped.</p>}
            </div>
            <Button onClick={() => setModal(null)} className="w-full">Close</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
              <FileUp className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm font-medium">Click to select or drag & drop Excel file</p>
              <input type="file" accept=".xlsx,.xls" className="mt-4 w-full text-xs" onChange={handleBulkFile} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Download Template</Button>
              <Button className="flex-1" disabled={!bulkData.length} loading={saving} onClick={confirmBulkUpload}>Upload {bulkData.length} Rows</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Simple Quick Vendor Create Modal */}
      <Modal open={modal === 'vendor'} onClose={() => setModal(purchaseVendorId ? 'purchase' : 'form')} title="Quick Add Vendor">
         <form onSubmit={async (e) => {
           e.preventDefault();
           const name = e.target.name.value;
           const panVat = e.target.panVat.value;
           const registrationNumber = e.target.registrationNumber.value;
           const { data } = await api.post('/vendors', { name, panVat, registrationNumber });
           setVendors([...vendors, data.data.vendor]);
           if (modal === 'vendor' && purchaseRows.length > 0) {
             setPurchaseVendorId(data.data.vendor._id);
             setModal('purchase');
           } else {
             setForm({...form, vendor: data.data.vendor._id});
             setModal('form');
           }
         }} className="space-y-4">
            <Input name="name" label="Vendor Name *" required />
            <Input name="panVat" label="Vendor PAN" />
            <Input name="registrationNumber" label="Registration Number" />
            <Button type="submit" className="w-full">Create & Select</Button>
         </form>
      </Modal>

      {/* Simple Quick Distributor Create Modal */}
      <Modal open={modal === 'distributor'} onClose={() => setModal('invoice')} title="Quick Add Distributor">
         <form onSubmit={async (e) => {
           e.preventDefault();
           const body = {
             name: e.target.name.value,
             panVat: e.target.panVat.value,
             registrationNumber: e.target.registrationNumber.value,
             phone: e.target.phone.value,
             address: e.target.address.value
           };
           const { data } = await api.post('/distributors', body);
           setDistributors([...distributors, data.data.distributor]);
           setInvoiceDistributorId(data.data.distributor._id);
           setModal('invoice');
         }} className="space-y-4">
            <Input name="name" label="Distributor Name *" required />
            <Input name="panVat" label="Distributor PAN" />
            <Input name="registrationNumber" label="Registration Number" />
            <Input name="phone" label="Phone Number" />
            <Input name="address" label="Location / Address" />
            <Button type="submit" className="w-full">Create & Select</Button>
         </form>
      </Modal>

      {/* Purchase Entry Modal */}
      <Modal open={modal === 'purchase'} onClose={() => setModal(null)} title="New Purchase Entry" wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submitPurchase} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border">
            <div>
              <Select
                label="Select Vendor *"
                value={purchaseVendorId}
                onChange={e => {
                  if (e.target.value === 'NEW') setModal('vendor');
                  else setPurchaseVendorId(e.target.value);
                }}
                options={[
                  { value: '', label: 'Select vendor...' },
                  { value: 'NEW', label: '+ Add New Vendor' },
                  ...vendors.map(v => ({ value: v._id, label: v.name }))
                ]}
                required
              />
            </div>
            {purchaseVendorId && purchaseVendorId !== 'NEW' && (
              <div className="text-xs space-y-1 p-2 bg-white dark:bg-slate-800 rounded border">
                {(() => {
                  const v = vendors.find(x => x._id === purchaseVendorId);
                  return v ? (
                    <>
                      <p><strong>PAN:</strong> {v.panVat || 'N/A'}</p>
                      <p><strong>Reg Num:</strong> {v.registrationNumber || 'N/A'}</p>
                    </>
                  ) : null;
                })()}
              </div>
            )}
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
                  <th className="px-2 py-3">Expiry Date</th>
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
                          if (prod) updatePurchaseRow(idx, 'price', prod.costPrice);
                        }}
                        options={[
                          { value: '', label: 'Select product...' },
                          ...allProducts.map(p => ({ value: p._id, label: p.productName }))
                        ]}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={row.batch} onChange={e => updatePurchaseRow(idx, 'batch', e.target.value)} placeholder="Batch" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" step="0.01" value={row.price} onChange={e => updatePurchaseRow(idx, 'price', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="1" value={row.quantity} onChange={e => updatePurchaseRow(idx, 'quantity', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold">{formatMoney(row.amount)}</div>
                    </td>
                    <td className="px-2 py-2">
                      <DatePicker value={row.expiryDate} onChange={val => updatePurchaseRow(idx, 'expiryDate', val)} />
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removePurchaseRow(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addPurchaseRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>

          <div className="flex flex-col items-end gap-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-full max-w-xs text-sm">
              <span className="text-slate-500">Total Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculatePurchaseTotals().totalAmount)}</span>

              <span className="text-slate-500 flex items-center">Discount %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={purchaseDiscountPct} onChange={e => setPurchaseDiscountPct(Number(e.target.value))} />

              <span className="text-slate-500">Discount:</span>
              <span className="font-semibold text-right text-red-500">-{formatMoney(calculatePurchaseTotals().discount)}</span>

              <span className="text-slate-500">Taxable Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculatePurchaseTotals().taxableAmount)}</span>

              <span className="text-slate-500 flex items-center">VAT %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={purchaseVatPct} onChange={e => setPurchaseVatPct(Number(e.target.value))} />

              <span className="text-slate-500">VAT:</span>
              <span className="font-semibold text-right">+{formatMoney(calculatePurchaseTotals().vat)}</span>

              <div className="col-span-2 border-t mt-2 pt-2 grid grid-cols-2">
                <span className="text-base font-bold">Net Total:</span>
                <span className="text-base font-bold text-right text-primary-600">{formatMoney(calculatePurchaseTotals().netTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Purchase</Button>
          </div>
        </form>
      </Modal>

      {/* Sales Invoice Modal */}
      <Modal open={modal === 'invoice'} onClose={() => setModal(null)} title="Create Sales Invoice" wide>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <form onSubmit={submitInvoice} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border">
            <div className="space-y-4">
              <Select
                label="Distributor Name *"
                value={invoiceDistributorId}
                onChange={e => {
                  if (e.target.value === 'NEW') setModal('distributor');
                  else setInvoiceDistributorId(e.target.value);
                }}
                options={[
                  { value: '', label: 'Select distributor...' },
                  { value: 'NEW', label: '+ Add New Distributor' },
                  ...distributors.map(d => ({ value: d._id, label: d.name }))
                ]}
                required
              />
            </div>

            {invoiceDistributorId && invoiceDistributorId !== 'NEW' && (
              <div className="text-xs space-y-1 p-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm">
                {(() => {
                  const d = distributors.find(x => x._id === invoiceDistributorId);
                  return d ? (
                    <>
                      <p className="font-bold border-b pb-1 mb-1">{d.name}</p>
                      <p><strong>PAN:</strong> {d.panVat || 'N/A'}</p>
                      <p><strong>Reg Num:</strong> {d.registrationNumber || 'N/A'}</p>
                      <p><strong>Phone:</strong> {d.phone || 'N/A'}</p>
                      <p><strong>Location:</strong> {d.address || 'N/A'}</p>
                    </>
                  ) : null;
                })()}
              </div>
            )}

            <div className="md:col-span-2 bg-white dark:bg-slate-800 p-3 rounded-lg border">
              <p className="text-sm font-medium mb-2">Payment Method *</p>
              <div className="flex flex-wrap gap-4">
                {['Cash', 'Online/QR', 'Cheque', 'Credit'].map(method => (
                  <Checkbox
                    key={method}
                    label={method}
                    checked={invoicePaymentMethod === method}
                    onChange={() => setInvoicePaymentMethod(method)}
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
                {invoiceRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">{idx + 1}</td>
                    <td className="px-2 py-2 min-w-[200px]">
                      <Select
                        className="w-full"
                        value={row.productId}
                        onChange={(e) => {
                          const prod = allProducts.find(p => p._id === e.target.value);
                          updateInvoiceRow(idx, 'productId', e.target.value);
                          updateInvoiceRow(idx, 'productName', prod?.productName || '');
                          updateInvoiceRow(idx, 'batch', prod?.batchNumber || '');
                          if (prod) updateInvoiceRow(idx, 'price', prod.sellingPrice);
                        }}
                        options={[
                          { value: '', label: 'Select product...' },
                          ...allProducts.map(p => ({ value: p._id, label: `${p.productName} (Stock: ${p.quantity})` }))
                        ]}
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input value={row.batch} onChange={e => updateInvoiceRow(idx, 'batch', e.target.value)} placeholder="Batch" />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="0" step="0.01" value={row.price} onChange={e => updateInvoiceRow(idx, 'price', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <Input type="number" min="1" value={row.quantity} onChange={e => updateInvoiceRow(idx, 'quantity', e.target.value)} required />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold">{formatMoney(row.amount)}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => removeInvoiceRow(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addInvoiceRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>

          <div className="flex flex-col items-end gap-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-full max-w-xs text-sm">
              <span className="text-slate-500">Total Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculateInvoiceTotals().totalAmount)}</span>

              <span className="text-slate-500 flex items-center">Discount %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={invoiceDiscountPct} onChange={e => setInvoiceDiscountPct(Number(e.target.value))} />

              <span className="text-slate-500">Discount:</span>
              <span className="font-semibold text-right text-red-500">-{formatMoney(calculateInvoiceTotals().discount)}</span>

              <span className="text-slate-500">Taxable Amount:</span>
              <span className="font-bold text-right">{formatMoney(calculateInvoiceTotals().taxableAmount)}</span>

              <span className="text-slate-500 flex items-center">VAT %:</span>
              <Input type="number" min="0" max="100" className="h-8 text-right" value={invoiceVatPct} onChange={e => setInvoiceVatPct(Number(e.target.value))} />

              <span className="text-slate-500">VAT:</span>
              <span className="font-semibold text-right">+{formatMoney(calculateInvoiceTotals().vat)}</span>

              <div className="col-span-2 border-t mt-2 pt-2 grid grid-cols-2">
                <span className="text-base font-bold">Net Total:</span>
                <span className="text-base font-bold text-right text-primary-600">{formatMoney(calculateInvoiceTotals().netTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Invoice</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
