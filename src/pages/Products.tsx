import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, Timestamp } from "firebase/firestore";
import { Plus, Search, Edit2, Trash2, ArrowLeft, Package, Save, Download, Upload, FileUp, AlertCircle } from "lucide-react";

interface Product {
  id: string;
  product_name: string;
  buying_price: number;
  selling_price: number;
  currentStock: number;
  lowStockLimit: number;
  unit: string;
}

const unitOptions = ["পিস", "ব্যাগ", "কেজি", "লিটার", "ফুট", "মিটার", "সেট", "গজ"];

const Products: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    product_name: "", buying_price: "", selling_price: "", currentStock: "", lowStockLimit: "5", unit: "পিস",
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      const snap = await getDocs(collection(db, "products"));
      const list: Product[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Product));
      list.sort((a, b) => a.product_name.localeCompare(b.product_name));
      setProducts(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ product_name: "", buying_price: "", selling_price: "", currentStock: "", lowStockLimit: "5", unit: "পিস" });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      product_name: p.product_name, buying_price: String(p.buying_price), selling_price: String(p.selling_price),
      currentStock: String(p.currentStock), lowStockLimit: String(p.lowStockLimit), unit: p.unit,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.product_name || !form.selling_price) return;
    setSaving(true);
    try {
      const data = {
        product_name: form.product_name, buying_price: Number(form.buying_price) || 0,
        selling_price: Number(form.selling_price) || 0, currentStock: Number(form.currentStock) || 0,
        lowStockLimit: Number(form.lowStockLimit) || 5, unit: form.unit,
      };
      if (editingProduct) {
        await updateDoc(doc(db, "products", editingProduct.id), data);
      } else {
        await addDoc(collection(db, "products"), { ...data, created_at: Timestamp.now() });
      }
      setShowForm(false);
      await loadProducts();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("এই পণ্যটি মুছে ফেলতে চান?")) return;
    await deleteDoc(doc(db, "products", id));
    await loadProducts();
  };

  // Export products as JSON
  const handleExport = () => {
    const exportData = products.map(({ id, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import products from JSON
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("Invalid format");
      let count = 0;
      for (const item of data) {
        if (!item.product_name) continue;
        await addDoc(collection(db, "products"), {
          product_name: item.product_name || "",
          buying_price: Number(item.buying_price) || 0,
          selling_price: Number(item.selling_price) || 0,
          currentStock: Number(item.currentStock) || 0,
          lowStockLimit: Number(item.lowStockLimit) || 5,
          unit: item.unit || "পিস",
          created_at: Timestamp.now(),
        });
        count++;
      }
      setImportResult(`✅ ${count} টি পণ্য সফলভাবে ইমপোর্ট হয়েছে`);
      await loadProducts();
    } catch (err) {
      setImportResult("❌ ইমপোর্ট ব্যর্থ। সঠিক JSON ফাইল ব্যবহার করুন।");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = products.filter((p) => p.product_name.toLowerCase().includes(search.toLowerCase()));

  if (showForm) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
          <button onClick={() => setShowForm(false)} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h2 className="text-xl font-bold text-foreground">{editingProduct ? "📝 পণ্য সম্পাদনা" : "➕ নতুন পণ্য যোগ"}</h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-base font-semibold text-foreground mb-1 block">পণ্যের নাম *</label>
            <input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="পণ্যের নাম লিখুন" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-base font-semibold text-foreground mb-1 block">ক্রয় মূল্য (৳)</label>
              <input type="number" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
            </div>
            <div>
              <label className="text-base font-semibold text-foreground mb-1 block">বিক্রয় মূল্য (৳) *</label>
              <input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-base font-semibold text-foreground mb-1 block">বর্তমান স্টক</label>
              <input type="number" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
            </div>
            <div>
              <label className="text-base font-semibold text-foreground mb-1 block">স্টক লিমিট</label>
              <input type="number" value={form.lowStockLimit} onChange={(e) => setForm({ ...form, lowStockLimit: e.target.value })}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="5" />
            </div>
          </div>
          <div>
            <label className="text-base font-semibold text-foreground mb-2 block">একক</label>
            <div className="flex flex-wrap gap-2">
              {unitOptions.map((u) => (
                <button key={u} onClick={() => setForm({ ...form, unit: u })}
                  className={`px-4 py-2 rounded-xl text-base border transition-colors ${
                    form.unit === u ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                  }`}>{u}</button>
              ))}
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !form.product_name || !form.selling_price}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform mt-4">
            <Save className="w-5 h-5" />{saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">📦 পণ্য সমূহ ({products.length})</h2>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-base font-semibold active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />যোগ করুন
          </button>
        </div>

        {/* Export / Import Buttons */}
        <div className="flex gap-2 mb-3">
          <button onClick={handleExport} disabled={products.length === 0}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-info/10 text-info text-sm font-semibold border border-info/20 active:scale-95 transition-transform disabled:opacity-50">
            <Download className="w-4 h-4" /> এক্সপোর্ট
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-success/10 text-success text-sm font-semibold border border-success/20 active:scale-95 transition-transform cursor-pointer">
            <Upload className="w-4 h-4" /> ইমপোর্ট
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {importing && (
          <div className="text-center py-2 text-sm text-muted-foreground">ইমপোর্ট হচ্ছে...</div>
        )}
        {importResult && (
          <div className={`text-center py-2 text-sm font-medium rounded-xl mb-2 px-3 ${importResult.startsWith("✅") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {importResult}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-10 pr-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="পণ্য খুঁজুন..." />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-base">লোড হচ্ছে...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-base">কোনো পণ্য পাওয়া যায়নি</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-foreground truncate">{p.product_name}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-muted-foreground">ক্রয়: ৳{p.buying_price}</span>
                  <span className="text-sm text-foreground font-medium">বিক্রয়: ৳{p.selling_price}</span>
                </div>
                <div className="mt-1">
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-lg ${p.currentStock <= p.lowStockLimit ? "text-destructive bg-destructive/10" : "text-success bg-success/10"}`}>
                    স্টক: {p.currentStock} {p.unit}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(p)} className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-2.5 rounded-xl text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Products;
