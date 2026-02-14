import React, { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, Timestamp, query, where, orderBy } from "firebase/firestore";
import { Plus, Search, Edit2, Trash2, Phone, ArrowLeft, Save, Users as UsersIcon, Banknote, History, ChevronDown, ChevronUp, Download, Upload } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  total_due: number;
  notes: string;
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  created_at: any;
  sale_id?: string;
}

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [savingPayment, setSavingPayment] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const snap = await getDocs(collection(db, "customers"));
      const list: Customer[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Customer));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm({ name: "", phone: "", address: "", notes: "" }); setShowForm(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone, address: c.address, notes: c.notes || "" }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "customers", editing.id), { ...form });
      } else {
        await addDoc(collection(db, "customers"), { ...form, total_due: 0, created_at: Timestamp.now() });
      }
      setShowForm(false);
      await loadCustomers();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("এই কাস্টমার মুছে ফেলতে চান?")) return;
    await deleteDoc(doc(db, "customers", id));
    await loadCustomers();
  };

  // Export customers as JSON
  const handleExport = () => {
    const exportData = customers.map(({ id, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import customers from JSON
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
        if (!item.name) continue;
        await addDoc(collection(db, "customers"), {
          name: item.name || "",
          phone: item.phone || "",
          address: item.address || "",
          notes: item.notes || "",
          total_due: Number(item.total_due) || 0,
          created_at: Timestamp.now(),
        });
        count++;
      }
      setImportResult(`✅ ${count} জন কাস্টমার সফলভাবে ইমপোর্ট হয়েছে`);
      await loadCustomers();
    } catch (err) {
      setImportResult("❌ ইমপোর্ট ব্যর্থ। সঠিক JSON ফাইল ব্যবহার করুন।");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openDueManagement = async (c: Customer) => {
    if (selectedCustomer?.id === c.id) { setSelectedCustomer(null); return; }
    setSelectedCustomer(c);
    setPaymentAmount("");
    setLoadingPayments(true);
    try {
      const q = query(collection(db, "payments"), where("customer_id", "==", c.id), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      const list: Payment[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Payment));
      setPayments(list);
    } catch (e) { console.error(e); setPayments([]); }
    finally { setLoadingPayments(false); }
  };

  const handleCollectPayment = async () => {
    if (!selectedCustomer || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (amount <= 0) return;
    setSavingPayment(true);
    try {
      await addDoc(collection(db, "payments"), {
        customer_id: selectedCustomer.id, sale_id: null, amount, payment_method: paymentMethod, created_at: Timestamp.now(),
      });
      const newDue = Math.max(0, (selectedCustomer.total_due || 0) - amount);
      await updateDoc(doc(db, "customers", selectedCustomer.id), { total_due: newDue });
      setPaymentAmount("");
      setSelectedCustomer({ ...selectedCustomer, total_due: newDue });
      await loadCustomers();
      const q = query(collection(db, "payments"), where("customer_id", "==", selectedCustomer.id), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      const list: Payment[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Payment));
      setPayments(list);
    } catch (e) { console.error(e); }
    finally { setSavingPayment(false); }
  };

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );
  const totalDues = customers.reduce((s, c) => s + (c.total_due || 0), 0);

  if (showForm) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
          <button onClick={() => setShowForm(false)} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h2 className="text-xl font-bold text-foreground">{editing ? "📝 কাস্টমার সম্পাদনা" : "➕ নতুন কাস্টমার"}</h2>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "নাম *", key: "name", placeholder: "কাস্টমারের নাম" },
            { label: "ফোন", key: "phone", placeholder: "01XXXXXXXXX", type: "tel" },
            { label: "ঠিকানা", key: "address", placeholder: "ঠিকানা লিখুন" },
            { label: "নোট", key: "notes", placeholder: "বিশেষ নোট" },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-base font-semibold text-foreground mb-1 block">{f.label}</label>
              <input type={(f as any).type || "text"} value={(form as any)[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={f.placeholder} />
            </div>
          ))}
          <button onClick={handleSave} disabled={saving || !form.name}
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
          <h2 className="text-xl font-bold text-foreground">👥 কাস্টমার ({customers.length})</h2>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-base font-semibold active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />যোগ করুন
          </button>
        </div>

        {/* Export / Import */}
        <div className="flex gap-2 mb-3">
          <button onClick={handleExport} disabled={customers.length === 0}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-info/10 text-info text-sm font-semibold border border-info/20 active:scale-95 transition-transform disabled:opacity-50">
            <Download className="w-4 h-4" /> এক্সপোর্ট
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-success/10 text-success text-sm font-semibold border border-success/20 active:scale-95 transition-transform cursor-pointer">
            <Upload className="w-4 h-4" /> ইমপোর্ট
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {importing && <div className="text-center py-2 text-sm text-muted-foreground">ইমপোর্ট হচ্ছে...</div>}
        {importResult && (
          <div className={`text-center py-2 text-sm font-medium rounded-xl mb-2 px-3 ${importResult.startsWith("✅") ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {importResult}
          </div>
        )}

        {totalDues > 0 && (
          <div className="bg-destructive/10 rounded-xl p-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-destructive" />
              <span className="text-base font-semibold text-foreground">মোট বকেয়া</span>
            </div>
            <span className="text-lg font-bold text-destructive">৳{totalDues.toLocaleString("bn-BD")}</span>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-10 pr-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="নাম বা ফোন দিয়ে খুঁজুন..." />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-base">লোড হচ্ছে...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <UsersIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-base">কোনো কাস্টমার পাওয়া যায়নি</p>
          </div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-foreground truncate">{c.name}</h4>
                    <p className="text-sm text-muted-foreground">{c.phone || "ফোন নেই"}</p>
                    {c.address && <p className="text-sm text-muted-foreground">{c.address}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="p-2.5 rounded-xl text-primary hover:bg-primary/10">
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                    <button onClick={() => openEdit(c)} className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-2.5 rounded-xl text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {(c.total_due > 0 || selectedCustomer?.id === c.id) && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <button onClick={() => openDueManagement(c)} className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-destructive" />
                        <span className="text-base font-semibold text-destructive">
                          বকেয়া: ৳{(selectedCustomer?.id === c.id ? selectedCustomer.total_due : c.total_due).toLocaleString("bn-BD")}
                        </span>
                      </div>
                      {selectedCustomer?.id === c.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </button>
                  </div>
                )}
                {c.total_due === 0 && selectedCustomer?.id !== c.id && (
                  <div className="mt-2"><span className="text-sm text-success font-medium">✅ কোনো বকেয়া নেই</span></div>
                )}
              </div>

              {selectedCustomer?.id === c.id && (
                <div className="bg-muted/50 p-4 space-y-3 border-t border-border animate-fade-in">
                  {selectedCustomer.total_due > 0 && (
                    <div className="bg-card rounded-xl p-3 space-y-2 border border-border">
                      <h5 className="text-base font-semibold text-foreground">💰 বকেয়া আদায়</h5>
                      <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full h-12 px-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="টাকার পরিমাণ" />
                      <div className="flex gap-2">
                        {[{ v: "cash", l: "💵 নগদ" }, { v: "mobile_banking", l: "📱 মোবাইল" }].map((m) => (
                          <button key={m.v} onClick={() => setPaymentMethod(m.v)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                              paymentMethod === m.v ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                            }`}>{m.l}</button>
                        ))}
                      </div>
                      <button onClick={handleCollectPayment} disabled={savingPayment || !paymentAmount}
                        className="w-full h-12 rounded-xl bg-success text-success-foreground text-base font-bold disabled:opacity-50 active:scale-[0.98] transition-transform">
                        {savingPayment ? "সেভ হচ্ছে..." : "পেমেন্ট সেভ করুন"}
                      </button>
                    </div>
                  )}
                  <div>
                    <h5 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
                      <History className="w-4 h-4" /> পেমেন্ট ইতিহাস
                    </h5>
                    {loadingPayments ? (
                      <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>
                    ) : payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">কোনো পেমেন্ট নেই</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {payments.map((p) => {
                          const date = p.created_at?.toDate?.();
                          return (
                            <div key={p.id} className="bg-card rounded-lg p-2.5 border border-border flex justify-between items-center">
                              <p className="text-sm text-muted-foreground">
                                {date ? date.toLocaleDateString("bn-BD") : ""} · {p.payment_method === "cash" ? "💵 নগদ" : "📱 মোবাইল"}
                              </p>
                              <span className="text-base font-bold text-success">৳{p.amount.toLocaleString("bn-BD")}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Customers;
