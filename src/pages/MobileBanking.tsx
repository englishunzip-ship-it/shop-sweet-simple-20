import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp, getDoc, setDoc } from "firebase/firestore";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, Smartphone, Download, RefreshCw, ChevronDown, Settings, Edit3, Trash2, Save, CheckCircle } from "lucide-react";

interface BankingLog {
  id: string;
  type: "cash_in" | "cash_out" | "recharge";
  operator: string;
  amount: number;
  commission: number;
  currentBalance: number;
  note: string;
  createdAt: any;
}

interface CommissionRates {
  [operator: string]: { cash_in: number; cash_out: number; recharge: number };
}

const DEFAULT_OPERATORS = [
  { value: "bkash", label: "বিকাশ", color: "bg-pink-500" },
  { value: "nagad", label: "নগদ", color: "bg-orange-500" },
  { value: "rocket", label: "রকেট", color: "bg-purple-500" },
  { value: "dbbl", label: "ডাচ বাংলা", color: "bg-blue-500" },
  { value: "upay", label: "উপায়", color: "bg-green-500" },
  { value: "tap", label: "ট্যাপ", color: "bg-teal-500" },
];

const DEFAULT_RATES: CommissionRates = {
  bkash: { cash_in: 0.01, cash_out: 0.0185, recharge: 0.02 },
  nagad: { cash_in: 0.01, cash_out: 0.0185, recharge: 0.02 },
  rocket: { cash_in: 0.01, cash_out: 0.018, recharge: 0.015 },
  dbbl: { cash_in: 0.01, cash_out: 0.018, recharge: 0.015 },
  upay: { cash_in: 0.01, cash_out: 0.018, recharge: 0.015 },
  tap: { cash_in: 0.01, cash_out: 0.018, recharge: 0.015 },
};

const PAGE_SIZE = 10;

const MobileBanking: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<BankingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<BankingLog | null>(null);
  const [form, setForm] = useState({
    type: "cash_in" as "cash_in" | "cash_out" | "recharge",
    operator: "bkash",
    amount: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [showSettings, setShowSettings] = useState(false);
  const [commissionRates, setCommissionRates] = useState<CommissionRates>(DEFAULT_RATES);
  const [editRates, setEditRates] = useState<CommissionRates>(DEFAULT_RATES);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => { loadLogs(); loadCommissionRates(); }, []);

  const loadCommissionRates = async () => {
    try {
      const docRef = doc(db, "settings", "commission_rates");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as CommissionRates;
        setCommissionRates(data);
        setEditRates(data);
      }
    } catch (e) { console.error(e); }
  };

  const saveCommissionRates = async () => {
    setSavingRates(true);
    try {
      await setDoc(doc(db, "settings", "commission_rates"), editRates);
      setCommissionRates(editRates);
      setShowSettings(false);
    } catch (e) { console.error(e); }
    finally { setSavingRates(false); }
  };

  const loadLogs = async () => {
    try {
      const q = query(collection(db, "mobileBanking"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const list: BankingLog[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as BankingLog));
      setLogs(list);
      if (list.length > 0) setCurrentBalance(list[0].currentBalance || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const calcCommission = (amount: number, operator: string, type: string) => {
    const rate = commissionRates[operator]?.[type as keyof typeof commissionRates[string]] || 0;
    return Math.round(amount * rate * 100) / 100;
  };

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!amount) return;
    setSaving(true);
    try {
      const commission = calcCommission(amount, form.operator, form.type);

      if (editingLog) {
        await updateDoc(doc(db, "mobileBanking", editingLog.id), {
          type: form.type,
          operator: form.operator,
          amount,
          commission,
          note: form.note,
        });
      } else {
        const newBalance = form.type === "cash_in" ? currentBalance + amount : currentBalance - amount;
        await addDoc(collection(db, "mobileBanking"), {
          type: form.type,
          operator: form.operator,
          amount,
          commission,
          currentBalance: newBalance,
          note: form.note,
          createdAt: Timestamp.now(),
        });
      }
      setShowForm(false);
      setEditingLog(null);
      setForm({ type: "cash_in", operator: "bkash", amount: "", note: "" });
      await loadLogs();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleEdit = (log: BankingLog) => {
    setEditingLog(log);
    setForm({
      type: log.type,
      operator: log.operator,
      amount: String(log.amount),
      note: log.note || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (logId: string) => {
    if (!confirm("এই লেনদেনটি মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, "mobileBanking", logId));
      await loadLogs();
    } catch (e) { console.error(e); }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let todayCashIn = 0, todayCashOut = 0, todayRecharge = 0, todayCommission = 0;
  logs.forEach((l) => {
    const d = l.createdAt?.toDate?.();
    if (d && d >= today) {
      if (l.type === "cash_in") todayCashIn += l.amount;
      else if (l.type === "cash_out") todayCashOut += l.amount;
      else if (l.type === "recharge") todayRecharge += l.amount;
      todayCommission += l.commission || 0;
    }
  });

  const amountNum = Number(form.amount) || 0;
  const liveCommission = calcCommission(amountNum, form.operator, form.type);

  const displayedLogs = logs.slice(0, displayedCount);
  const hasMore = displayedCount < logs.length;

  const downloadReport = () => {
    const now = new Date();
    let content = `জিসান ট্রেডার্স - মোবাইল ব্যাংকিং রিপোর্ট\nতারিখ: ${now.toLocaleDateString("bn-BD")}\n${"=".repeat(40)}\n\n`;
    content += `বর্তমান ব্যালেন্স: ৳${currentBalance.toLocaleString("bn-BD")}\n`;
    content += `আজ ক্যাশ ইন: ৳${todayCashIn.toLocaleString("bn-BD")}\n`;
    content += `আজ ক্যাশ আউট: ৳${todayCashOut.toLocaleString("bn-BD")}\n`;
    content += `আজ রিচার্জ: ৳${todayRecharge.toLocaleString("bn-BD")}\n`;
    content += `আজ কমিশন: ৳${todayCommission.toLocaleString("bn-BD")}\n\n`;
    content += `লেনদেন ইতিহাস:\n${"-".repeat(40)}\n`;
    logs.forEach((l) => {
      const date = l.createdAt?.toDate?.();
      const typeLabel2 = l.type === "cash_in" ? "ক্যাশ ইন" : l.type === "cash_out" ? "ক্যাশ আউট" : "রিচার্জ";
      content += `${date ? date.toLocaleDateString("bn-BD") : ""} | ${l.operator} | ${typeLabel2} | ৳${l.amount.toLocaleString("bn-BD")} | কমিশন: ৳${(l.commission || 0).toLocaleString("bn-BD")}${l.note ? ` | ${l.note}` : ""}\n`;
    });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mobile-banking-report-${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeLabel = (t: string) => t === "cash_in" ? "ক্যাশ ইন" : t === "cash_out" ? "ক্যাশ আউট" : "রিচার্জ";
  const opLabel = (op: string) => DEFAULT_OPERATORS.find(o => o.value === op)?.label || op;

  if (showSettings) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
          <button onClick={() => setShowSettings(false)} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5" /> কমিশন সেটিংস
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {DEFAULT_OPERATORS.map((op) => (
            <div key={op.value} className="bg-card rounded-xl p-4 border border-border space-y-3">
              <h4 className="text-base font-bold text-foreground">{op.label}</h4>
              <div className="grid grid-cols-3 gap-2">
                {(["cash_in", "cash_out", "recharge"] as const).map((type) => (
                  <div key={type}>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {type === "cash_in" ? "ক্যাশ ইন %" : type === "cash_out" ? "ক্যাশ আউট %" : "রিচার্জ %"}
                    </label>
                    <input type="number" step="0.001"
                      value={((editRates[op.value]?.[type] || 0) * 100).toFixed(2)}
                      onChange={(e) => {
                        const val = Number(e.target.value) / 100;
                        setEditRates({
                          ...editRates,
                          [op.value]: { ...editRates[op.value], [type]: val }
                        });
                      }}
                      className="w-full h-10 px-2 rounded-lg border border-input bg-background text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button onClick={saveCommissionRates} disabled={savingRates}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
            <Save className="w-5 h-5" />{savingRates ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" /> মোবাইল ব্যাংকিং
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(true)} className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted">
            <Settings className="w-5 h-5" />
          </button>
          <button onClick={downloadReport} className="p-2.5 rounded-xl text-primary hover:bg-primary/10">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="bg-primary rounded-xl p-5 text-center">
          <p className="text-primary-foreground/70 text-base">বর্তমান ব্যালেন্স</p>
          <p className="text-4xl font-bold text-primary-foreground">৳{currentBalance.toLocaleString("bn-BD")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
            <ArrowDownLeft className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">আজ ক্যাশ ইন</p>
            <p className="text-base font-bold text-success">৳{todayCashIn.toLocaleString("bn-BD")}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
            <ArrowUpRight className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">আজ ক্যাশ আউট</p>
            <p className="text-base font-bold text-destructive">৳{todayCashOut.toLocaleString("bn-BD")}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
            <RefreshCw className="w-5 h-5 text-info mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">আজ রিচার্জ</p>
            <p className="text-base font-bold text-info">৳{todayRecharge.toLocaleString("bn-BD")}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
            <Smartphone className="w-5 h-5 text-secondary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">আজ কমিশন</p>
            <p className="text-base font-bold text-secondary">৳{todayCommission.toLocaleString("bn-BD")}</p>
          </div>
        </div>

        <button onClick={() => { setEditingLog(null); setForm({ type: "cash_in", operator: "bkash", amount: "", note: "" }); setShowForm(!showForm); }}
          className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md">
          <Plus className="w-5 h-5" />নতুন লেনদেন
        </button>

        {showForm && (
          <div className="bg-card rounded-xl p-4 border border-border space-y-3 animate-slide-up shadow-sm">
            <div className="flex gap-2">
              {(["cash_in", "cash_out", "recharge"] as const).map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                    form.type === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                  }`}>
                  {t === "cash_in" ? "ক্যাশ ইন" : t === "cash_out" ? "ক্যাশ আউট" : "রিচার্জ"}
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">অপারেটর</label>
              <div className="grid grid-cols-3 gap-2">
                {DEFAULT_OPERATORS.map((op) => (
                  <button key={op.value} onClick={() => setForm({ ...form, operator: op.value })}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      form.operator === op.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                    }`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full h-12 px-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="টাকার পরিমাণ" />

            {amountNum > 0 && (
              <div className="bg-secondary/10 rounded-xl p-3 text-center">
                <p className="text-sm text-muted-foreground">কমিশন (লাভ)</p>
                <p className="text-xl font-bold text-secondary">৳{liveCommission.toLocaleString("bn-BD")}</p>
              </div>
            )}

            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full h-12 px-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="কাস্টমার নম্বর / নোট (ঐচ্ছিক)" />

            <button onClick={handleSave} disabled={saving || !form.amount}
              className="w-full h-14 rounded-xl bg-success text-success-foreground text-lg font-bold disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {saving ? "সেভ হচ্ছে..." : editingLog ? "আপডেট করুন" : "সেভ করুন"}
            </button>

            {editingLog && (
              <button onClick={() => { setEditingLog(null); setShowForm(false); setForm({ type: "cash_in", operator: "bkash", amount: "", note: "" }); }}
                className="w-full h-12 rounded-xl border border-border text-foreground text-base font-medium">
                বাতিল
              </button>
            )}
          </div>
        )}

        <div className="space-y-2 mt-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" /> লেনদেন ইতিহাস
          </h3>
          {displayedLogs.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-base">কোনো লেনদেন নেই</p>
            </div>
          ) : displayedLogs.map((l) => {
            const date = l.createdAt?.toDate?.();
            return (
              <div key={l.id} className="bg-card rounded-xl p-4 border border-border shadow-sm">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {l.type === "cash_in" ? (
                      <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                        <ArrowDownLeft className="w-5 h-5 text-success" />
                      </div>
                    ) : l.type === "cash_out" ? (
                      <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-destructive" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-info" />
                      </div>
                    )}
                    <div>
                      <p className="text-base font-semibold text-foreground">{typeLabel(l.type)}</p>
                      <p className="text-sm text-muted-foreground">{opLabel(l.operator)} {date ? `· ${date.toLocaleDateString("bn-BD")}` : ""} {l.note && `· ${l.note}`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-bold ${l.type === "cash_in" ? "text-success" : l.type === "cash_out" ? "text-destructive" : "text-info"}`}>
                      {l.type === "cash_in" ? "+" : "-"}৳{l.amount.toLocaleString("bn-BD")}
                    </p>
                    {(l.commission || 0) > 0 && <p className="text-xs text-secondary font-semibold">কমিশন: ৳{l.commission.toLocaleString("bn-BD")}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                  <button onClick={() => handleEdit(l)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-primary bg-primary/5 hover:bg-primary/10">
                    <Edit3 className="w-4 h-4" /> এডিট
                  </button>
                  <button onClick={() => handleDelete(l.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-destructive bg-destructive/5 hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" /> মুছুন
                  </button>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button onClick={() => setDisplayedCount(prev => prev + PAGE_SIZE)}
              className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <ChevronDown className="w-4 h-4" />
              আরও দেখুন
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileBanking;
