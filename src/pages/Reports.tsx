import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, query, orderBy, where, Timestamp,
  writeBatch, doc
} from "firebase/firestore";
import { TrendingUp, Package, Users, Download, Calendar, ChevronDown } from "lucide-react";
import jsPDF from "jspdf";

const PAGE_SIZE = 10;
const CLEANUP_DAYS = 40;

const toBn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

const Reports: React.FC = () => {
  const [tab, setTab] = useState<"daily" | "monthly" | "stock" | "due">("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailySales, setDailySales] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [dailyProfit, setDailyProfit] = useState(0);
  const [dailyDue, setDailyDue] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [dueCustomers, setDueCustomers] = useState<any[]>([]);
  const [allSalesForDay, setAllSalesForDay] = useState<any[]>([]);
  const [mbLogsForDay, setMbLogsForDay] = useState<any[]>([]);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [cleanupDone, setCleanupDone] = useState(false);

  useEffect(() => {
    loadReports();
    if (!cleanupDone) { cleanupOldSales(); setCleanupDone(true); }
  }, [selectedDate]);

  const cleanupOldSales = async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - CLEANUP_DAYS);
      const cutoffTs = Timestamp.fromDate(cutoff);
      const oldSalesQ = query(collection(db, "sales"), where("created_at", "<", cutoffTs));
      const oldSnap = await getDocs(oldSalesQ);
      if (oldSnap.empty) return;
      const saleIds = oldSnap.docs.map(d => d.id);
      const batch = writeBatch(db);
      let count = 0;
      for (const saleDoc of oldSnap.docs) { batch.delete(saleDoc.ref); count++; if (count >= 400) break; }
      if (saleIds.length > 0) {
        const chunks = [];
        for (let i = 0; i < Math.min(saleIds.length, 30); i += 10) chunks.push(saleIds.slice(i, i + 10));
        for (const chunk of chunks) {
          const itemsQ = query(collection(db, "sale_items"), where("sale_id", "in", chunk));
          const itemsSnap = await getDocs(itemsQ);
          itemsSnap.forEach(d => { if (count < 450) { batch.delete(d.ref); count++; } });
        }
      }
      await batch.commit();
    } catch (e) { console.error("Cleanup error:", e); }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const selDate = new Date(selectedDate);
      const dayStart = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate());
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const monthStart = new Date(selDate.getFullYear(), selDate.getMonth(), 1);
      const monthEnd = new Date(selDate.getFullYear(), selDate.getMonth() + 1, 1);

      // Daily sales
      const daySalesQ = query(collection(db, "sales"), where("created_at", ">=", Timestamp.fromDate(dayStart)), where("created_at", "<", Timestamp.fromDate(dayEnd)), orderBy("created_at", "desc"));
      const daySalesSnap = await getDocs(daySalesQ);
      let dSales = 0, dProfit = 0, dDue = 0;
      const dayList: any[] = [];
      daySalesSnap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        dayList.push(data);
        dSales += (data as any).total_amount || 0;
        dProfit += (data as any).profit || 0;
        dDue += (data as any).due_amount || 0;
      });
      setDailySales(dSales); setDailyCount(dayList.length); setDailyProfit(dProfit); setDailyDue(dDue);
      setAllSalesForDay(dayList); setDisplayedCount(PAGE_SIZE);

      // Daily mobile banking
      const mbDayQ = query(collection(db, "mobile_banking_logs"), where("created_at", ">=", Timestamp.fromDate(dayStart)), where("created_at", "<", Timestamp.fromDate(dayEnd)), orderBy("created_at", "desc"));
      const mbDaySnap = await getDocs(mbDayQ);
      const mbList: any[] = [];
      mbDaySnap.forEach((d) => mbList.push({ id: d.id, ...d.data() }));
      setMbLogsForDay(mbList);

      // Monthly
      const monthSalesQ = query(collection(db, "sales"), where("created_at", ">=", Timestamp.fromDate(monthStart)), where("created_at", "<", Timestamp.fromDate(monthEnd)));
      const monthSnap = await getDocs(monthSalesQ);
      let mSales = 0, mProfit = 0;
      monthSnap.forEach((d) => { const data = d.data(); mSales += data.total_amount || 0; mProfit += data.profit || 0; });
      setMonthlySales(mSales); setMonthlyCount(monthSnap.size); setMonthlyProfit(mProfit);

      // Stock
      const prodSnap = await getDocs(collection(db, "products"));
      const items: any[] = [];
      prodSnap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      items.sort((a, b) => a.currentStock - b.currentStock);
      setStockItems(items);

      // Due
      const custSnap = await getDocs(collection(db, "customers"));
      const dues: any[] = [];
      custSnap.forEach((d) => { const c = d.data(); if (c.total_due > 0) dues.push({ id: d.id, ...c }); });
      dues.sort((a, b) => b.total_due - a.total_due);
      setDueCustomers(dues);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const displayedSales = allSalesForDay.slice(0, displayedCount);
  const hasMore = displayedCount < allSalesForDay.length;

  const generatePDF = (type: string) => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const lineHeight = 8;
    let y = margin;

    const drawNotebookPage = () => {
      pdf.setFillColor(255, 253, 245);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.setDrawColor(220, 100, 100);
      pdf.setLineWidth(0.3);
      pdf.line(margin - 3, 0, margin - 3, pageHeight);
      pdf.setDrawColor(200, 220, 240);
      pdf.setLineWidth(0.15);
      for (let ly = 20; ly < pageHeight - 10; ly += lineHeight) {
        pdf.line(margin - 5, ly, pageWidth - margin + 5, ly);
      }
      pdf.setFillColor(180, 180, 180);
      for (let x = 30; x < pageWidth - 20; x += 15) pdf.circle(x, 5, 1.5, "F");
    };

    drawNotebookPage();

    const addNewPage = () => { pdf.addPage(); drawNotebookPage(); y = margin + 5; };
    const checkPageBreak = (needed: number) => { if (y + needed > pageHeight - margin) addNewPage(); };

    pdf.setFont("helvetica", "bold");
    const selDateObj = new Date(selectedDate);

    y = 25;
    pdf.setFontSize(16);
    pdf.setTextColor(30, 58, 138);
    pdf.text("Zisan Traders - Report", margin, y);
    y += lineHeight;
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text("Date: " + selDateObj.toLocaleDateString("en-GB"), margin, y);
    y += lineHeight * 1.5;
    pdf.setTextColor(40, 40, 40);

    if (type === "daily") {
      pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(30, 58, 138);
      pdf.text("Daily Sales Report", margin, y);
      y += lineHeight * 1.2;
      pdf.setFontSize(10); pdf.setFont("helvetica", "normal"); pdf.setTextColor(40, 40, 40);

      // Summary box with Total Sales, Number, Profit, Due
      pdf.setFillColor(240, 248, 255);
      pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 32, 3, 3, "F");
      pdf.text("Total Sales: Tk " + dailySales.toLocaleString(), margin + 5, y + 4);
      pdf.text("Number of Sales: " + dailyCount, margin + 5, y + 12);
      pdf.text("Total Profit: Tk " + dailyProfit.toLocaleString(), margin + 5, y + 20);
      pdf.text("Total Due: Tk " + dailyDue.toLocaleString(), margin + 5, y + 28);
      y += 38;

      // Sales table
      checkPageBreak(15);
      pdf.setFillColor(30, 58, 138);
      pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 9, 2, 2, "F");
      pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text("SL", margin + 3, y + 3);
      pdf.text("Customer", margin + 15, y + 3);
      pdf.text("Amount", margin + 80, y + 3);
      pdf.text("Profit", margin + 110, y + 3);
      pdf.text("Payment", margin + 135, y + 3);
      pdf.text("Due", margin + 158, y + 3);
      y += lineHeight + 2;
      pdf.setTextColor(40, 40, 40); pdf.setFont("helvetica", "normal");

      allSalesForDay.forEach((s, i) => {
        checkPageBreak(lineHeight + 2);
        const bgColor = i % 2 === 0 ? [255, 253, 245] : [245, 248, 255];
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
        pdf.setFontSize(9);
        pdf.text(String(i + 1), margin + 3, y + 1);
        pdf.text(String(s.customer_name || "Cash").substring(0, 20), margin + 15, y + 1);
        pdf.text("Tk " + (s.total_amount || 0).toLocaleString(), margin + 80, y + 1);
        pdf.text("Tk " + (s.profit || 0).toLocaleString(), margin + 110, y + 1);
        pdf.text(s.payment_type === "cash" ? "Cash" : "Due", margin + 135, y + 1);
        pdf.text(s.due_amount > 0 ? "Tk " + s.due_amount.toLocaleString() : "-", margin + 158, y + 1);
        y += lineHeight;
      });

      // Mobile Banking Sub-Table
      if (mbLogsForDay.length > 0) {
        y += lineHeight;
        checkPageBreak(30);
        pdf.setFontSize(12); pdf.setFont("helvetica", "bold"); pdf.setTextColor(16, 185, 129);
        pdf.text("Mobile Banking Transactions", margin, y);
        y += lineHeight * 1.2;

        // MB summary by operator
        const opSummary: Record<string, { cashIn: number; cashOut: number; recharge: number; commission: number }> = {};
        mbLogsForDay.forEach((l: any) => {
          const op = l.operator || "unknown";
          if (!opSummary[op]) opSummary[op] = { cashIn: 0, cashOut: 0, recharge: 0, commission: 0 };
          if (l.type === "cash_in") opSummary[op].cashIn += l.amount || 0;
          else if (l.type === "cash_out") opSummary[op].cashOut += l.amount || 0;
          else if (l.type === "recharge") opSummary[op].recharge += l.amount || 0;
          opSummary[op].commission += l.commission || 0;
        });

        pdf.setFillColor(16, 185, 129);
        pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 9, 2, 2, "F");
        pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
        pdf.text("Operator", margin + 3, y + 3);
        pdf.text("Cash In", margin + 40, y + 3);
        pdf.text("Cash Out", margin + 75, y + 3);
        pdf.text("Recharge", margin + 110, y + 3);
        pdf.text("Commission", margin + 145, y + 3);
        y += lineHeight + 2;
        pdf.setTextColor(40, 40, 40); pdf.setFont("helvetica", "normal");

        const opNames: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" };
        Object.entries(opSummary).forEach(([op, data], i) => {
          checkPageBreak(lineHeight + 2);
          const bgColor = i % 2 === 0 ? [245, 255, 250] : [255, 253, 245];
          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
          pdf.setFontSize(9);
          pdf.text(opNames[op] || op, margin + 3, y + 1);
          pdf.text("Tk " + data.cashIn.toLocaleString(), margin + 40, y + 1);
          pdf.text("Tk " + data.cashOut.toLocaleString(), margin + 75, y + 1);
          pdf.text("Tk " + data.recharge.toLocaleString(), margin + 110, y + 1);
          pdf.text("Tk " + data.commission.toLocaleString(), margin + 145, y + 1);
          y += lineHeight;
        });

        const totalMBComm = mbLogsForDay.reduce((s: number, l: any) => s + (l.commission || 0), 0);
        y += 2;
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
        pdf.text("Total MB Commission: Tk " + totalMBComm.toLocaleString(), margin + 3, y + 1);
        y += lineHeight;
      }

    } else if (type === "monthly") {
      pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(30, 58, 138);
      pdf.text("Monthly Sales Report", margin, y);
      y += lineHeight * 1.5;
      pdf.setFontSize(11); pdf.setFont("helvetica", "normal"); pdf.setTextColor(40, 40, 40);
      pdf.setFillColor(240, 245, 255);
      pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 30, 3, 3, "F");
      pdf.text("Total Sales: Tk " + monthlySales.toLocaleString(), margin + 5, y + 5);
      pdf.text("Number of Sales: " + monthlyCount, margin + 5, y + 14);
      pdf.text("Estimated Profit: Tk " + monthlyProfit.toLocaleString(), margin + 5, y + 23);
      y += 38;

    } else if (type === "stock") {
      pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(120, 80, 30);
      pdf.text("Stock Report", margin, y);
      y += lineHeight * 1.2;
      checkPageBreak(15);
      pdf.setFillColor(80, 120, 60);
      pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 9, 2, 2, "F");
      pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text("SL", margin + 3, y + 3);
      pdf.text("Product", margin + 15, y + 3);
      pdf.text("Stock", margin + 100, y + 3);
      pdf.text("Unit", margin + 125, y + 3);
      pdf.text("Status", margin + 145, y + 3);
      y += lineHeight + 2;
      pdf.setTextColor(40, 40, 40); pdf.setFont("helvetica", "normal");

      stockItems.forEach((p, i) => {
        checkPageBreak(lineHeight + 2);
        const isLow = p.currentStock <= (p.lowStockLimit || 5);
        const bgColor = isLow ? [255, 240, 240] : i % 2 === 0 ? [255, 253, 245] : [245, 255, 245];
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
        pdf.setFontSize(9);
        pdf.text(String(i + 1), margin + 3, y + 1);
        pdf.text(String(p.product_name || ""), margin + 15, y + 1);
        pdf.text(String(p.currentStock), margin + 100, y + 1);
        pdf.text(String(p.unit || ""), margin + 125, y + 1);
        pdf.setTextColor(isLow ? 200 : 30, isLow ? 50 : 130, isLow ? 50 : 50);
        pdf.text(isLow ? "LOW" : "OK", margin + 145, y + 1);
        pdf.setTextColor(40, 40, 40);
        y += lineHeight;
      });

    } else if (type === "due") {
      pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.setTextColor(160, 50, 50);
      pdf.text("Due Report", margin, y);
      y += lineHeight * 1.2;
      const totalD = dueCustomers.reduce((s, c) => s + c.total_due, 0);
      pdf.setFontSize(11); pdf.setFont("helvetica", "normal");
      pdf.setFillColor(255, 240, 240);
      pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 14, 3, 3, "F");
      pdf.text("Total Due: Tk " + totalD.toLocaleString(), margin + 5, y + 6);
      y += 20;

      checkPageBreak(15);
      pdf.setFillColor(160, 60, 60);
      pdf.roundedRect(margin, y - 3, pageWidth - margin * 2, 9, 2, 2, "F");
      pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
      pdf.text("SL", margin + 3, y + 3);
      pdf.text("Customer", margin + 15, y + 3);
      pdf.text("Phone", margin + 85, y + 3);
      pdf.text("Due Amount", margin + 130, y + 3);
      y += lineHeight + 2;
      pdf.setTextColor(40, 40, 40); pdf.setFont("helvetica", "normal");

      dueCustomers.forEach((c, i) => {
        checkPageBreak(lineHeight + 2);
        const bgColor = i % 2 === 0 ? [255, 253, 245] : [255, 245, 245];
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        pdf.rect(margin, y - 4, pageWidth - margin * 2, lineHeight, "F");
        pdf.setFontSize(9);
        pdf.text(String(i + 1), margin + 3, y + 1);
        pdf.text(String(c.name || ""), margin + 15, y + 1);
        pdf.text(String(c.phone || "N/A"), margin + 85, y + 1);
        pdf.setTextColor(180, 40, 40);
        pdf.text("Tk " + c.total_due.toLocaleString(), margin + 130, y + 1);
        pdf.setTextColor(40, 40, 40);
        y += lineHeight;
      });
    }

    const footerY = pageHeight - 8;
    pdf.setFontSize(7); pdf.setTextColor(150, 150, 150);
    pdf.text("Generated: " + new Date().toLocaleString("en-GB"), margin, footerY);
    pdf.text("Zisan Traders - Inventory Management", pageWidth - margin - 55, footerY);

    pdf.save("zisan-traders-" + type + "-report-" + selectedDate + ".pdf");
  };

  const tabs = [
    { key: "daily" as const, label: "📅 আজ" },
    { key: "monthly" as const, label: "📆 মাসিক" },
    { key: "stock" as const, label: "📦 স্টক" },
    { key: "due" as const, label: "💰 বাকি" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-foreground">📊 রিপোর্ট</h2>
          <button onClick={() => generatePDF(tab)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform shadow-md">
            <Download className="w-4 h-4" /> PDF ডাউনলোড
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 h-10 px-3 rounded-xl border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-base">লোড হচ্ছে...</div>
        ) : tab === "daily" ? (
          <div className="space-y-3">
            {/* Daily summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
                <p className="text-xs text-muted-foreground">মোট বিক্রয়</p>
                <p className="text-2xl font-bold text-primary">৳{toBn(dailySales.toLocaleString())}</p>
                <p className="text-xs text-muted-foreground">{toBn(dailyCount)} টি</p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
                <p className="text-xs text-muted-foreground">মোট লাভ</p>
                <p className={`text-2xl font-bold ${dailyProfit >= 0 ? "text-success" : "text-destructive"}`}>৳{toBn(dailyProfit.toLocaleString())}</p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
                <p className="text-xs text-muted-foreground">মোট বাকি</p>
                <p className="text-2xl font-bold text-destructive">৳{toBn(dailyDue.toLocaleString())}</p>
              </div>
              <div className="bg-card rounded-xl p-4 border border-border text-center shadow-sm">
                <p className="text-xs text-muted-foreground">MB কমিশন</p>
                <p className="text-2xl font-bold text-secondary">৳{toBn(mbLogsForDay.reduce((s, l) => s + (l.commission || 0), 0).toLocaleString())}</p>
              </div>
            </div>

            <div className="space-y-2">
              {displayedSales.map((s) => {
                const date = s.created_at?.toDate?.();
                return (
                  <div key={s.id} className="bg-card rounded-xl p-3 border border-border flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-base font-medium text-foreground">{s.customer_name || "ক্যাশ"}</p>
                      <p className="text-sm text-muted-foreground">{date ? date.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-foreground">৳{toBn((s.total_amount || 0).toLocaleString())}</p>
                      {s.due_amount > 0 && <p className="text-xs text-destructive font-semibold">বাকি: ৳{toBn(s.due_amount.toLocaleString())}</p>}
                      {(s.profit || 0) > 0 && <p className="text-xs text-success font-medium">লাভ: ৳{toBn(s.profit.toLocaleString())}</p>}
                    </div>
                  </div>
                );
              })}
              {allSalesForDay.length === 0 && (
                <p className="text-center text-muted-foreground py-6 text-base">এই দিনে কোনো বিক্রয় নেই</p>
              )}
              {hasMore && (
                <button onClick={() => setDisplayedCount(prev => prev + PAGE_SIZE)}
                  className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                  <ChevronDown className="w-4 h-4" />
                  আরও {toBn(Math.min(PAGE_SIZE, allSalesForDay.length - displayedCount))} টি দেখুন
                </button>
              )}
            </div>
          </div>
        ) : tab === "monthly" ? (
          <div className="space-y-3">
            <div className="bg-card rounded-xl p-5 border border-border text-center shadow-sm">
              <p className="text-muted-foreground text-base">
                {new Date(selectedDate).toLocaleDateString("bn-BD", { year: "numeric", month: "long" })} এর বিক্রয়
              </p>
              <p className="text-4xl font-bold text-primary mt-1">৳{toBn(monthlySales.toLocaleString())}</p>
              <p className="text-muted-foreground text-sm mt-1">{toBn(monthlyCount)} টি বিক্রয়</p>
            </div>
            <div className="bg-card rounded-xl p-5 border border-border text-center shadow-sm">
              <p className="text-muted-foreground text-base">আনুমানিক লাভ</p>
              <p className={`text-3xl font-bold mt-1 ${monthlyProfit >= 0 ? "text-success" : "text-destructive"}`}>
                ৳{toBn(monthlyProfit.toLocaleString())}
              </p>
            </div>
          </div>
        ) : tab === "stock" ? (
          <div className="space-y-2">
            {stockItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-base">কোনো পণ্য নেই</p>
            ) : stockItems.map((p) => (
              <div key={p.id} className="bg-card rounded-xl p-4 border border-border flex justify-between items-center shadow-sm">
                <div>
                  <span className="text-base font-medium text-foreground">{p.product_name}</span>
                  <p className="text-sm text-muted-foreground">ক্রয়: ৳{toBn(p.buying_price)} | বিক্রয়: ৳{toBn(p.selling_price)}</p>
                </div>
                <span className={`text-base font-bold px-2 py-1 rounded-lg ${p.currentStock <= (p.lowStockLimit || 5) ? "text-destructive bg-destructive/10" : "text-success bg-success/10"}`}>
                  {toBn(p.currentStock)} {p.unit}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {dueCustomers.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-base">কোনো বাকি নেই ✅</p>
            ) : (
              <>
                <div className="bg-destructive/10 rounded-xl p-4 text-center mb-3">
                  <p className="text-base text-muted-foreground">মোট বকেয়া</p>
                  <p className="text-3xl font-bold text-destructive">৳{toBn(dueCustomers.reduce((s, c) => s + c.total_due, 0).toLocaleString())}</p>
                </div>
                {dueCustomers.map((c) => (
                  <div key={c.id} className="bg-card rounded-xl p-4 border border-border flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-base font-semibold text-foreground">{c.name}</p>
                      <p className="text-sm text-muted-foreground">{c.phone || "ফোন নেই"}</p>
                    </div>
                    <span className="text-base font-bold text-destructive">৳{toBn(c.total_due.toLocaleString())}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
