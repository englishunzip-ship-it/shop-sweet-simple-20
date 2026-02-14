import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy, where
} from "firebase/firestore";
import { ArrowLeft, Plus, Minus, ShoppingCart, Check, Search, X, UserPlus, User, Trash2, Edit3, ChevronDown } from "lucide-react";

interface Product {
  id: string;
  product_name: string;
  buying_price: number;
  selling_price: number;
  currentStock: number;
  unit: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
}

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  discount: number;
  paid_amount: number;
  due_amount: number;
  profit: number;
  payment_type: string;
  created_at: any;
}

const PAGE_SIZE = 10;

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname === "/sales/new";

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  // New sale state
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discount, setDiscount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [searchProduct, setSearchProduct] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // New customer inline form
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  useEffect(() => {
    if (isNew) { loadForNewSale(); } else { loadSales(); }
  }, [isNew]);

  const loadSales = async () => {
    try {
      const q = query(collection(db, "sales"), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      const list: Sale[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Sale));
      setSales(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadForNewSale = async () => {
    try {
      const [pSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "customers")),
      ]);
      const pList: Product[] = [];
      pSnap.forEach((d) => pList.push({ id: d.id, ...d.data() } as Product));
      setProducts(pList.sort((a, b) => a.product_name.localeCompare(b.product_name)));

      const cList: Customer[] = [];
      cSnap.forEach((d) => cList.push({ id: d.id, ...d.data() } as Customer));
      setCustomers(cList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountNum = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountNum);
  const paidNum = Number(paidAmount) || 0;
  const dueAmount = Math.max(0, total - paidNum);
  const profit = cart.reduce((s, i) => s + (i.price - (i.product.buying_price || 0)) * i.quantity, 0) - discountNum;

  const addToCart = (p: Product) => {
    const existing = cart.find((c) => c.product.id === p.id);
    if (existing) {
      setCart(cart.map((c) => c.product.id === p.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product: p, quantity: 1, price: p.selling_price }]);
    }
    setShowProductPicker(false);
    setSearchProduct("");
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.product.id === productId) {
        const newQty = Math.round((c.quantity + delta) * 100) / 100;
        return newQty <= 0 ? c : { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const setQtyDirectly = (productId: string, value: string) => {
    const num = parseFloat(value);
    if (value === "" || value === "." || value.endsWith(".")) {
      setCart(cart.map((c) => c.product.id === productId ? { ...c, quantity: num || 0, _rawQty: value } : c));
      return;
    }
    if (!isNaN(num) && num >= 0) {
      setCart(cart.map((c) => c.product.id === productId ? { ...c, quantity: num, _rawQty: undefined } : c));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product.id !== productId));
  };

  const handleAddNewCustomer = async () => {
    if (!newCustName) return;
    setSavingCustomer(true);
    try {
      const custRef = await addDoc(collection(db, "customers"), {
        name: newCustName, phone: newCustPhone, address: newCustAddress,
        notes: "", total_due: 0, created_at: Timestamp.now(),
      });
      const newCust: Customer = { id: custRef.id, name: newCustName, phone: newCustPhone };
      setCustomers([...customers, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCustomer(newCust);
      setShowNewCustomerForm(false);
      setShowCustomerPicker(false);
      setNewCustName(""); setNewCustPhone(""); setNewCustAddress("");
    } catch (e) { console.error(e); }
    finally { setSavingCustomer(false); }
  };

  const handleSaveSale = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const items = cart.map(i => ({
        productId: i.product.id,
        productName: i.product.product_name,
        quantity: i.quantity,
        salePrice: i.price,
        wholesalePrice: i.product.buying_price || 0,
      }));

      const saleData = {
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || "ক্যাশ বিক্রয়",
        items,
        total_amount: total,
        discount: discountNum,
        paid_amount: paidNum,
        due_amount: dueAmount,
        profit,
        payment_type: paymentType,
        created_at: Timestamp.now(),
      };

      const saleRef = await addDoc(collection(db, "sales"), saleData);

      // Also save to sale_items for backward compatibility
      for (const item of cart) {
        await addDoc(collection(db, "sale_items"), {
          sale_id: saleRef.id, product_id: item.product.id,
          product_name: item.product.product_name, quantity: item.quantity,
          price: item.price, created_at: Timestamp.now(),
        });
        const newStock = Math.max(0, item.product.currentStock - item.quantity);
        await updateDoc(doc(db, "products", item.product.id), { currentStock: newStock });
      }

      if (selectedCustomer && dueAmount > 0) {
        const custDoc = await getDocs(query(collection(db, "customers"), where("__name__", "==", selectedCustomer.id)));
        if (!custDoc.empty) {
          const custData = custDoc.docs[0].data();
          await updateDoc(doc(db, "customers", selectedCustomer.id), {
            total_due: (custData.total_due || 0) + dueAmount,
          });
        }
      }

      if (paidNum > 0) {
        await addDoc(collection(db, "payments"), {
          customer_id: selectedCustomer?.id || null, sale_id: saleRef.id,
          amount: paidNum, payment_method: paymentType, created_at: Timestamp.now(),
        });
      }

      navigate("/sales");
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm("এই বিক্রয়টি মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, "sales", saleId));
      setSales(sales.filter(s => s.id !== saleId));
    } catch (e) { console.error(e); }
  };

  // NEW SALE FORM
  if (isNew) {
    const filteredProducts = products.filter((p) =>
      p.product_name.toLowerCase().includes(searchProduct.toLowerCase())
    );
    const filteredCustomers = customers.filter((c) =>
      c.name.toLowerCase().includes(searchCustomer.toLowerCase()) || c.phone.includes(searchCustomer)
    );

    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
          <button onClick={() => navigate("/sales")} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h2 className="text-xl font-bold text-foreground">নতুন বিক্রয়</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Customer Selection */}
          <div>
            <label className="text-base font-semibold text-foreground mb-2 block">কাস্টমার (ঐচ্ছিক)</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 rounded-xl border-2 border-primary bg-primary/5">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-base text-foreground font-semibold">{selectedCustomer.name}</span>
                </div>
                <button onClick={() => setSelectedCustomer(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input value={searchCustomer}
                    onChange={(e) => { setSearchCustomer(e.target.value); setShowCustomerPicker(true); }}
                    onFocus={() => setShowCustomerPicker(true)}
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="কাস্টমার খুঁজুন..." />
                </div>
                {showCustomerPicker && (
                  <div className="border border-border rounded-xl bg-card shadow-lg max-h-48 overflow-y-auto">
                    <button onClick={() => setShowNewCustomerForm(true)}
                      className="w-full text-left px-4 py-3 text-base text-primary font-semibold flex items-center gap-2 border-b border-border hover:bg-primary/5">
                      <UserPlus className="w-5 h-5" /> নতুন কাস্টমার যোগ করুন
                    </button>
                    {filteredCustomers.map((c) => (
                      <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerPicker(false); setSearchCustomer(""); }}
                        className="w-full text-left px-4 py-3 text-base text-foreground hover:bg-muted border-b border-border last:border-0">
                        <span className="font-medium">{c.name}</span> {c.phone && <span className="text-muted-foreground">· {c.phone}</span>}
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">কোনো কাস্টমার পাওয়া যায়নি</p>
                    )}
                  </div>
                )}
                {showNewCustomerForm && (
                  <div className="bg-card rounded-xl border-2 border-primary/30 p-4 space-y-3 animate-fade-in">
                    <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-primary" /> নতুন কাস্টমার
                    </h4>
                    <input value={newCustName} onChange={(e) => setNewCustName(e.target.value)}
                      className="w-full h-12 px-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="কাস্টমারের নাম *" />
                    <input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} type="tel"
                      className="w-full h-12 px-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="ফোন নম্বর" />
                    <input value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)}
                      className="w-full h-12 px-3 rounded-xl border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="ঠিকানা" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowNewCustomerForm(false)}
                        className="flex-1 h-11 rounded-xl border border-border text-base text-foreground font-medium">বাতিল</button>
                      <button onClick={handleAddNewCustomer} disabled={savingCustomer || !newCustName}
                        className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-base font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                        <Check className="w-4 h-4" />{savingCustomer ? "সেভ..." : "যোগ করুন"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add Products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-base font-semibold text-foreground">পণ্য যোগ করুন</label>
              <button onClick={() => setShowProductPicker(!showProductPicker)}
                className="text-sm text-primary font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10">
                <Plus className="w-4 h-4" /> পণ্য নির্বাচন
              </button>
            </div>
            {showProductPicker && (
              <div className="border border-border rounded-xl bg-card mb-3 shadow-lg">
                <div className="relative p-2">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-lg border border-input bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="পণ্য খুঁজুন..." autoFocus />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredProducts.map((p) => (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="w-full text-left px-4 py-3 text-base border-t border-border hover:bg-muted flex justify-between">
                      <span className="text-foreground font-medium">{p.product_name}</span>
                      <span className="text-muted-foreground text-sm">৳{p.selling_price} | {p.currentStock} {p.unit}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cart Items */}
            {cart.length > 0 && (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="bg-secondary/10 rounded-xl p-4 border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-semibold text-foreground">{item.product.product_name}</span>
                      <button onClick={() => removeFromCart(item.product.id)}>
                        <X className="w-5 h-5 text-destructive" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.product.id, -0.5)}
                          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95 text-xs font-bold">-½</button>
                        <button onClick={() => updateQty(item.product.id, -1)}
                          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95">
                          <Minus className="w-4 h-4" />
                        </button>
                        <input type="text" inputMode="decimal"
                          value={(item as any)._rawQty !== undefined ? (item as any)._rawQty : item.quantity}
                          onChange={(e) => setQtyDirectly(item.product.id, e.target.value)}
                          className="w-14 h-9 text-center rounded-lg border border-input bg-background text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                        <button onClick={() => updateQty(item.product.id, 1)}
                          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => updateQty(item.product.id, 0.5)}
                          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center active:scale-95 text-xs font-bold">+½</button>
                      </div>
                      <span className="text-base font-bold text-foreground">৳{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discount & Paid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-base font-semibold text-foreground mb-1 block">ডিসকাউন্ট (৳)</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
            </div>
            <div>
              <label className="text-base font-semibold text-foreground mb-1 block">প্রদান (৳)</label>
              <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-input bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
            </div>
          </div>

          {/* Payment Type */}
          <div>
            <label className="text-base font-semibold text-foreground mb-2 block">পেমেন্ট পদ্ধতি</label>
            <div className="flex gap-2">
              {[
                { value: "cash", label: "💵 নগদ" },
                { value: "due", label: "📋 বাকি" },
              ].map((pt) => (
                <button key={pt.value} onClick={() => {
                  setPaymentType(pt.value);
                  if (pt.value === "due") setPaidAmount("0");
                }}
                  className={`flex-1 py-3 rounded-xl text-base font-semibold border transition-colors ${
                    paymentType === pt.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                  }`}>
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {cart.length > 0 && (
            <div className="bg-card rounded-xl p-4 border-2 border-primary/20 space-y-2 shadow-sm">
              <div className="flex justify-between text-base"><span className="text-muted-foreground">সাবটোটাল</span><span className="text-foreground font-medium">৳{subtotal.toLocaleString()}</span></div>
              {discountNum > 0 && <div className="flex justify-between text-base"><span className="text-muted-foreground">ডিসকাউন্ট</span><span className="text-destructive">-৳{discountNum.toLocaleString()}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2"><span className="text-foreground">মোট</span><span className="text-primary">৳{total.toLocaleString()}</span></div>
              {paidNum > 0 && <div className="flex justify-between text-base"><span className="text-muted-foreground">প্রদান</span><span className="text-success font-semibold">৳{paidNum.toLocaleString()}</span></div>}
              {dueAmount > 0 && <div className="flex justify-between text-base"><span className="text-muted-foreground">বাকি</span><span className="text-destructive font-semibold">৳{dueAmount.toLocaleString()}</span></div>}
              <div className="flex justify-between text-base border-t border-border pt-2"><span className="text-muted-foreground">লাভ</span><span className={`font-semibold ${profit >= 0 ? "text-success" : "text-destructive"}`}>৳{profit.toLocaleString()}</span></div>
            </div>
          )}

          <button onClick={handleSaveSale} disabled={saving || cart.length === 0}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform shadow-md">
            <Check className="w-6 h-6" />{saving ? "সেভ হচ্ছে..." : "বিক্রয় সম্পন্ন করুন"}
          </button>
        </div>
      </div>
    );
  }

  // SALES LIST with pagination
  const displayedSales = sales.slice(0, displayedCount);
  const hasMore = displayedCount < sales.length;

  return (
    <div className="animate-fade-in">
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">বিক্রয়</h2>
          <button onClick={() => navigate("/sales/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-base font-semibold active:scale-95 transition-transform shadow-md">
            <Plus className="w-5 h-5" />নতুন বিক্রয়
          </button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-base">লোড হচ্ছে...</div>
        ) : sales.length === 0 ? (
          <div className="text-center py-10">
            <ShoppingCart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-base">কোনো বিক্রয় নেই</p>
          </div>
        ) : (
          <>
            {displayedSales.map((s) => {
              const date = s.created_at?.toDate?.();
              return (
                <div key={s.id} className="bg-card rounded-xl p-4 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-foreground">{s.customer_name || "ক্যাশ"}</h4>
                      <p className="text-sm text-muted-foreground">
                        {date ? date.toLocaleDateString("bn-BD") : ""} · {s.payment_type === "cash" ? "💵 নগদ" : "📋 বাকি"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-base font-bold text-foreground">৳{s.total_amount?.toLocaleString("bn-BD")}</p>
                        {s.due_amount > 0 && <p className="text-sm text-destructive font-semibold">বাকি: ৳{s.due_amount.toLocaleString("bn-BD")}</p>}
                        {(s.profit || 0) > 0 && <p className="text-xs text-success font-medium">লাভ: ৳{s.profit.toLocaleString("bn-BD")}</p>}
                      </div>
                      <button onClick={() => handleDeleteSale(s.id)} className="p-2 rounded-lg hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Sales;
