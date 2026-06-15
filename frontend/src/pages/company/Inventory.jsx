import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, PackagePlus, AlertTriangle, FileUp, Download, X, MoreVertical } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/api/client';
import { Card, Button, Input, Select, Modal, Table, Badge, Spinner, Pagination, EmptyState, Textarea } from '@/components/ui';
import { formatMoney } from '@/lib/utils';
import { Boxes } from 'lucide-react';

const emptyForm = {
  productName: '', sku: '', category: '', costPrice: 0, sellingPrice: 0,
  vendor: '', reorderLevel: 10, vatPct: 0, batchNumber: '', expiryDate: '',
  description: '', customFields: {}
};

export default function InventoryPage() {
  const [data, setData] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [modal, setModal] = useState(null); // 'form' | 'stock' | 'bulk' | 'vendor'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [customFieldKey, setCustomFieldKey] = useState('');
  const [customFieldValue, setCustomFieldKeyVal] = useState('');
  const [stockForm, setStockForm] = useState({ type: 'IN', quantity: 1, note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [featureBlocked, setFeatureBlocked] = useState(false);

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

  useEffect(() => { load(); loadVendors(); }, [load, loadVendors]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { ...form };
      if (editing) await api.patch(`/inventory/${editing._id}`, body);
      else await api.post('/inventory', body);
      setModal(null); setEditing(null); setForm(emptyForm); load();
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
          <Button variant="outline" onClick={() => setModal('bulk')}><FileUp className="h-4 w-4" /> Bulk Upload</Button>
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setModal('form'); }}><Plus className="h-4 w-4" /> Add Product</Button>
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
          columns={['Product', 'SKU', 'Stock', 'Prices', 'Status', 'Actions']}
          data={data.items}
          renderRow={(p) => (
            <tr key={p._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td className="table-td">
                <p className="font-semibold">{p.productName}</p>
                <p className="text-xs text-slate-400">{p.category || 'No category'}</p>
              </td>
              <td className="table-td font-mono text-xs">{p.sku}</td>
              <td className="table-td">
                <Badge color={p.isLowStock ? 'red' : 'green'}>{p.quantity}</Badge>
              </td>
              <td className="table-td text-xs">
                <p>Buy: {formatMoney(p.costPrice)}</p>
                <p>Sell: {formatMoney(p.sellingPrice)}</p>
              </td>
              <td className="table-td text-xs">
                {p.vatPct > 0 && <Badge color="blue">{p.vatPct}% VAT</Badge>}
              </td>
              <td className="table-td">
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setStockForm({ type: 'IN', quantity: 1, note: '' }); setModal('stock'); }}><PackagePlus className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setForm({ ...emptyForm, ...p, vendor: p.vendor?._id || '' }); setModal('form'); }}><Pencil className="h-4 w-4" /></Button>
                </div>
              </td>
            </tr>
          )}
          mobileRender={(p) => (
            <div key={p._id} className="p-4 space-y-3 border-b dark:border-slate-800 last:border-0">
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{p.productName}</p>
                    <p className="text-xs text-slate-500">{p.sku} · {p.category}</p>
                  </div>
                  <Badge color={p.isLowStock ? 'red' : 'green'}>{p.quantity} in stock</Badge>
               </div>
               <div className="flex justify-between text-sm">
                  <p>Cost: <span className="font-medium">{formatMoney(p.costPrice)}</span></p>
                  <p>Sell: <span className="font-bold text-primary-600">{formatMoney(p.sellingPrice)}</span></p>
               </div>
               <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(p); setStockForm({ type: 'IN', quantity: 1, note: '' }); setModal('stock'); }}><PackagePlus className="h-4 w-4 mr-2" /> Stock</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(p); setForm({ ...emptyForm, ...p, vendor: p.vendor?._id || '' }); setModal('form'); }}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
               </div>
            </div>
          )}
        />
        <Pagination pagination={data.pagination} onPage={setPage} />
      </Card>

      {/* Product Form Modal */}
      <Modal open={modal === 'form'} onClose={() => setModal(null)} title={editing ? 'Edit Product' : 'Add New Product'} wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Input label="Product Name *" required value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} />
          <Input label="SKU / Barcode *" required disabled={!!editing} value={form.sku} onChange={e => setForm({...form, sku: e.target.value.toUpperCase()})} />

          <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
             <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pricing & Tax</p>
             <div className="grid grid-cols-2 gap-4">
                <Input label="Cost Price *" type="number" required value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} />
                <Input label="Selling Price *" type="number" required value={form.sellingPrice} onChange={e => setForm({...form, sellingPrice: e.target.value})} />
                <Input label="VAT %" type="number" value={form.vatPct} onChange={e => setForm({...form, vatPct: e.target.value})} />
                <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={e => setForm({...form, reorderLevel: e.target.value})} />
             </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
             <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Inventory Details</p>
             <div className="grid grid-cols-2 gap-4">
                <Input label="Batch Number" value={form.batchNumber} onChange={e => setForm({...form, batchNumber: e.target.value})} />
                <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate: e.target.value})} />
             </div>
             <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select label="Vendor" value={form.vendor} onChange={e => {
                    if (e.target.value === 'NEW') setModal('vendor');
                    else setForm({...form, vendor: e.target.value});
                  }} options={[{value:'', label:'Select Vendor'}, {value:'NEW', label:'+ Create New Vendor'}, ...vendors.map(v=>({value:v._id, label:v.name}))]} />
                </div>
             </div>
          </div>

          <div className="sm:col-span-2">
            <Textarea label="Product Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>

          <div className="sm:col-span-2 space-y-4">
            <p className="text-sm font-semibold">Custom Fields</p>
            <div className="flex gap-2">
              <Input placeholder="Field Name (e.g. Color)" value={customFieldKey} onChange={e => setCustomFieldKey(e.target.value)} />
              <Input placeholder="Value (e.g. Red)" value={customFieldValue} onChange={e => setCustomFieldKeyVal(e.target.value)} />
              <Button type="button" onClick={addCustomField} variant="outline">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(form.customFields || {}).map(([k, v]) => (
                <Badge key={k} color="gray" className="gap-2">
                  {k}: {v} <X className="h-3 w-3 cursor-pointer" onClick={() => removeCustomField(k)} />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update Product' : 'Save Product'}</Button>
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
      <Modal open={modal === 'vendor'} onClose={() => setModal('form')} title="Quick Add Vendor">
         <form onSubmit={async (e) => {
           e.preventDefault();
           const name = e.target.name.value;
           const { data } = await api.post('/vendors', { name });
           setVendors([...vendors, data.data.vendor]);
           setForm({...form, vendor: data.data.vendor._id});
           setModal('form');
         }} className="space-y-4">
            <Input name="name" label="Vendor Name *" required />
            <Button type="submit" className="w-full">Create & Select</Button>
         </form>
      </Modal>
    </div>
  );
}
