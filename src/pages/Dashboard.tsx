import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import {
  ShoppingCart, Package, Users, AlertTriangle, TrendingUp,
  Plus, LogOut, Smartphone, ArrowRight, Banknote, BarChart3, AlertCircle,
  Store, Boxes, DollarSign, CreditCard, Zap
} from "lucide-react";

const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [todaySales, setTodaySales] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [mbTodayCommission, setMbTodayCommission] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [dueCustomers, setDueCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = Timestamp.fromDate(today);

      const salesQ = query(collection(db, "sales"), where("createdAt", ">=", todayTs), orderBy("createdAt", "desc"));
      const salesSnap = await getDocs(salesQ);
      let salesTotal = 0, profitTotal = 0;
      salesSnap.forEach((doc) => {
        const d = doc.data();
        salesTotal += d.totalAmount || 0;
        profitTotal += d.profit || 0;
      });
      setTodaySales(salesTotal);
      setTodayCount(salesSnap.size);
      setTodayProfit(profitTotal);

      const mbQ = query(collection(db, "mobileBanking"), where("createdAt", ">=", todayTs));
      const mbSnap = await getDocs(mbQ);
      let mbComm = 0;
      mbSnap.forEach((doc) => { mbComm += doc.data().commission || 0; });
      setMbTodayCommission(mbComm);

      const custSnap = await getDocs(collection(db, "customers"));
      let dues = 0;
      const dueList: any[] = [];
      custSnap.forEach((doc) => {
        const d = doc.data();
        dues += d.totalDue || 0;
        if (d.totalDue > 0) dueList.push({ id: doc.id, ...d });
      });
      setTotalDue(dues);
      setTotalCustomers(custSnap.size);
      dueList.sort((a, b) => b.totalDue - a.totalDue);
      setDueCustomers(dueList);

      const prodSnap = await getDocs(collection(db, "products"));
      const lowStock: any[] = [];
      prodSnap.forEach((doc) => {
        const d = doc.data();
        if (d.currentStock <= (d.stockLimit || 5)) lowStock.push({ id: doc.id, ...d });
      });
      setTotalProducts(prodSnap.size);
      setLowStockItems(lowStock);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const totalProfitWithMB = todayProfit + mbTodayCommission;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-4">
      <div className="bg-primary px-5 pt-6 pb-12 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground">জিসান ট্রেডার্স</h1>
              <p className="text-primary-foreground/60 text-xs">ইনভেন্টরি ম্যানেজমেন্ট</p>
            </div>
          </div>
          <button onClick={logout} className="p-2.5 rounded-full bg-primary-foreground/10 text-primary-foreground active:scale-95 transition-transform">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: TrendingUp, label: "আজকের বিক্রয়", value: `৳${todaySales.toLocaleString("bn-BD")}`, sub: `${todayCount.toLocaleString("bn-BD")} টি` },
            { icon: DollarSign, label: "আজকের লাভ", value: `৳${totalProfitWithMB.toLocaleString("bn-BD")}`, sub: "বিক্রয় + কমিশন" },
            { icon: Banknote, label: "মোট বকেয়া", value: `৳${totalDue.toLocaleString("bn-BD")}`, sub: `${dueCustomers.length.toLocaleString("bn-BD")} জন` },
            { icon: Boxes, label: "মোট পণ্য", value: totalProducts.toLocaleString("bn-BD"), sub: `${lowStockItems.length} কম স্টক` },
            { icon: Users, label: "মোট কাস্টমার", value: totalCustomers.toLocaleString("bn-BD"), sub: "" },
            { icon: Smartphone, label: "মোবাইল ব্যাংকিং", value: `৳${mbTodayCommission.toLocaleString("bn-BD")}`, sub: "টোটাল কমিশন" },
          ].map((card, i) => (
            <div key={i} className="bg-primary-foreground/12 backdrop-blur-sm rounded-2xl p-3 border border-primary-foreground/10">
              <div className="w-7 h-7 rounded-lg bg-primary-foreground/15 flex items-center justify-center mb-1.5">
                <card.icon className="w-4 h-4 text-primary-foreground" />
              </div>
              <p className="text-primary-foreground/70 text-[10px] font-medium leading-tight">{card.label}</p>
              <p className="text-lg font-bold text-primary-foreground leading-tight mt-0.5">{card.value}</p>
              {card.sub && <p className="text-primary-foreground/50 text-[10px] mt-0.5">{card.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        <div className="bg-card rounded-2xl p-5 shadow-md border border-border">
          <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" /> দ্রুত অ্যাকশন
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Plus, label: "নতুন বিক্রয়", path: "/sales/new", bg: "bg-primary" },
              { icon: Package, label: "পণ্য যোগ", path: "/products/add", bg: "bg-info" },
              { icon: Users, label: "কাস্টমার", path: "/customers", bg: "bg-secondary" },
              { icon: Smartphone, label: "মোবাইল ব্যাংকিং", path: "/mobile-banking", bg: "bg-success" },
            ].map((a) => (
              <button key={a.path} onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2 active:scale-90 transition-transform">
                <div className={`w-14 h-14 rounded-2xl ${a.bg} flex items-center justify-center shadow-lg`}>
                  <a.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-xs text-foreground font-semibold text-center leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-destructive/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <h3 className="text-base font-bold text-foreground">স্টক কম আছে ({lowStockItems.length})</h3>
            </div>
            <div className="space-y-2">
              {lowStockItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <span className="text-base text-foreground font-medium">{item.name}</span>
                  <span className="text-sm font-bold text-destructive bg-destructive/10 px-3 py-1 rounded-full">
                    {item.currentStock} {item.unit}
                  </span>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <button onClick={() => navigate("/reports")} className="text-sm text-primary font-semibold mt-1">
                  আরও {lowStockItems.length - 5} টি দেখুন →
                </button>
              )}
            </div>
          </div>
        )}

        {dueCustomers.length > 0 && (
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-warning/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-base font-bold text-foreground">বকেয়া কাস্টমার ({dueCustomers.length})</h3>
            </div>
            <div className="space-y-2">
              {dueCustomers.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <span className="text-base font-medium text-foreground">{c.name}</span>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                  </div>
                  <span className="text-sm font-bold text-destructive bg-destructive/10 px-3 py-1 rounded-full">
                    ৳{c.totalDue.toLocaleString("bn-BD")}
                  </span>
                </div>
              ))}
              {dueCustomers.length > 5 && (
                <button onClick={() => navigate("/customers")} className="text-sm text-primary font-semibold mt-1">
                  সকল দেখুন →
                </button>
              )}
            </div>
          </div>
        )}

        <button onClick={() => navigate("/reports")}
          className="w-full bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-base font-semibold text-foreground">রিপোর্ট ও বিশ্লেষণ</span>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
