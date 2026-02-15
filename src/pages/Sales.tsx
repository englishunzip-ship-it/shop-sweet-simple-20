import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy, where
} from "firebase/firestore";
import { ArrowLeft, Plus, ShoppingCart, Check, Search, X, UserPlus, User, Trash2, Edit3, ChevronDown } from "lucide-react";

interface Product {
  id: string;
  name: string;
  wholesalePrice: number;
  salePrice: number;
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
  _rawQty?: string;
}

interface Sale {
  id: string;
  customerId?: string;
  customerName?: string;
  items?: any[];
  totalAmount: number;
  discount: number;
  paidAmount: number;
  dueAmount: number;
  profit: number;
  createdAt: any;
}

const PAGE_SIZE = 10;

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname === "/sales/new";

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [discount, setDiscount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustLocation, setNewCustLocation] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (isNew) { loadForNewSale(); } else { loadSales(); }
  }, [isNew]);

  const loadSales = async () => {
    try {
      const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
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
      setProducts(pList.sort((a, b) => a.name.localeCompare(b.name)));

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
  const extraPayment = Math.max(0, paidNum - total);
  const profit = cart.reduce((s, i) => s + (i.price - (i.product.wholesalePrice || 0)) * i.quantity, 0) - discountNum + extraPayment;

  const addToCart = (p: Product) => {
    const existing = cart.find((c) => c.product.id === p.id);
    if (existing) {
      setCart(cart.map((c) => c.product.id === p.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product: p, quantity: 1, price: p.salePrice }]);
    }
    setShowProductPicker(false);
    setSearchProduct("");
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
        name: newCustName, phone: newCustPhone, location: newCustLocation,
        note: "", totalDue: 0, createdAt: Timestamp.now(),
      });
      const newCust: Customer = { id: custRef.id, name: newCustName, phone: newCustPhone };
      setCustomers([...customers, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCustomer(newCust);
      setShowNewCustomerForm(false);
      setShowCustomerPicker(false);
      setNewCustName(""); setNewCustPhone(""); setNewCustLocation("");
    } catch (e) { console.error(e); }
    finally { setSavingCustomer(false); }
  };

  const handleSaveSale = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    try {
      const items = cart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        salePrice: i.price,
        wholesalePrice: i.product.wholesalePrice || 0,
      }));

      const saleData = {
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || "ক্যাশ বিক্রয়",
        items,
        totalAmount: total,
        discount: discountNum,
        paidAmount: paidNum,
        dueAmount,
        profit,
        createdAt: Timestamp.now(),
      };

      if (isEditMode && editingSale) {
        await updateDoc(doc(db, "sales", editingSale.id), saleData);
        setIsEditMode(false);
        setEditingSale(null);
      } else {
        await addDoc(collection(db, "sales"), saleData);

        // Update stock
        for (const item of cart) {
          const newStock = Math.max(0, item.product.currentStock - item.quantity);
          await updateDoc(doc(db, "products", item.product.id), { currentStock: newStock });
        }

        // Update customer due
        if (selectedCustomer && dueAmount > 0) {
          const custSnap = await getDocs(query(collection(db, "customers"), where("__name__", "==", selectedCustomer.id)));
          if (!custSnap.empty) {
            const custData = custSnap.docs[0].data();
            await updateDoc(doc(db, "customers", selectedCustomer.id), {
              totalDue: (custData.totalDue || 0) + dueAmount,
            });
          }
        }
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

  const handleEditSale = async (sale: Sale) => {
    setEditingSale(sale);
    setIsEditMode(true);
    setLoading(true);

    try {
      const [pSnap, cSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "customers")),
      ]);
      const pList: Product[] = [];
      pSnap.forEach((d) => pList.push({ id: d.id, ...d.data() } as Product));
      setProducts(pList.sort((a, b) => a.name.localeCompare(b.name)));

      const cList: Customer[] = [];
      cSnap.forEach((d) => cList.push({ id: d.id, ...d.data() } as Customer));
      setCustomers(cList.sort((a, b) => a.name.localeCompare(b.name)));

      if (sale.customerId) {
        const cust = cList.find(c => c.id === sale.customerId);
        if (cust) setSelectedCustomer(cust);
      }

      if (sale.items && sale.items.length > 0) {
        const cartItems: CartItem[] = sale.items.map((item: any) => {
          const product = pList.find(p => p.id === item.productId) || {
            id: item.productId,
            name: item.productName,
            wholesalePrice: item.wholesalePrice || 0,
            salePrice: item.salePrice,
            currentStock: 0,
            unit: "",
          };
          return { product, quantity: item.quantity, price: item.salePrice };
        });
        setCart(cartItems);
      }

      setDiscount(String(sale.discount || ""));
      setPaidAmount(String(sale.paidAmount || ""));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // NEW/EDIT SALE FORM
  if (isNew || isEditMode) {
    const filteredProducts = products.filter((p) =>
      p.name.toLowerCase().includes(searchProduct.toLowerCase())
    );
    const filteredCustomers = customers.filter((c) =>
      c.name.toLowerCase().includes(searchCustomer.toLowerCase()) || c.phone.includes(searchCustomer)
    );

    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
          <button onClick={() => { if (isEditMode) { setIsEditMode(false); setEditingSale(null); setCart([]); } else navigate("/sales"); }} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h2 className="text-xl font-bold text-foreground">{isEditMode ? "বিক্রয় সম্পাদনা" : "নতুন বিক্রয়"}</h2>
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
                    <input value={newCustLocation} onChange={(e) => setNewCustLocation(e.target.value)}
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
                      <span className="text-foreground font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-sm">৳{p.salePrice} | {p.currentStock} {p.unit}</span>
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
                      <span className="text-base font-semibold text-foreground">{item.product.name}</span>
                      <button onClick={() => removeFromCart(item.product.id)}>
                        <X className="w-5 h-5 text-destructive" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">পরিমাণ:</label>
                        <input type="text" inputMode="decimal"
                          value={item._rawQty !== undefined ? item._rawQty : item.quantity}
                          onChange={(e) => setQtyDirectly(item.product.id, e.target.value)}
                          className="w-20 h-10 text-center rounded-xl border border-input bg-background text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                        <span className="text-sm text-muted-foreground">{item.product.unit}</span>
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

          {/* Summary */}
          {cart.length > 0 && (
            <div className="bg-card rounded-xl p-4 border-2 border-primary/20 space-y-2 shadow-sm">
              <div className="flex justify-between text-base"><span className="text-muted-foreground">সাবটোটাল</span><span className="text-foreground font-medium">৳{subtotal.toLocaleString()}</span></div>
              {discountNum > 0 && <div className="flex justify-between text-base"><span className="text-muted-foreground">ডিসকাউন্ট</span><span className="text-destructive">-৳{discountNum.toLocaleString()}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2"><span className="text-foreground">মোট</span><span className="text-primary">৳{total.toLocaleString()}</span></div>
              {paidNum > 0 && <div className="flex justify-between text-base"><span className="text-muted-foreground">প্রদান</span><span className="text-success font-semibold">৳{paidNum.toLocaleString()}</span></div>}
              {dueAmount > 0 && <div className="flex justify-between text-base"><span className="text-muted-foreground">বাকি</span><span className="text-destructive font-semibold">৳{dueAmount.toLocaleString()}</span></div>}
              {extraPayment > 0 && <div className="flex justify-between text-base"><span className="text-muted-foreground">অতিরিক্ত (লাভ)</span><span className="text-success font-semibold">+৳{extraPayment.toLocaleString()}</span></div>}
              <div className="flex justify-between text-base border-t border-border pt-2"><span className="text-muted-foreground">লাভ</span><span className={`font-semibold ${profit >= 0 ? "text-success" : "text-destructive"}`}>৳{profit.toLocaleString()}</span></div>
            </div>
          )}

          <button onClick={handleSaveSale} disabled={saving || cart.length === 0}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform shadow-md">
            <Check className="w-6 h-6" />{saving ? "সেভ হচ্ছে..." : isEditMode ? "আপডেট করুন" : "বিক্রয় সম্পন্ন করুন"}
          </button>
        </div>
      </div>
    );
  }

  // SALES LIST
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
              const date = s.createdAt?.toDate?.();
              return (
                <div key={s.id} className="bg-card rounded-xl p-4 border border-border shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-bold text-foreground">{s.customerName || "ক্যাশ"}</h4>
                      <p className="text-sm text-muted-foreground">
                        {date ? date.toLocaleDateString("bn-BD") : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-base font-bold text-foreground">৳{s.totalAmount?.toLocaleString("bn-BD")}</p>
                        {s.dueAmount > 0 && <p className="text-sm text-destructive font-semibold">বাকি: ৳{s.dueAmount.toLocaleString("bn-BD")}</p>}
                        {(s.profit || 0) > 0 && <p className="text-xs text-success font-medium">লাভ: ৳{s.profit.toLocaleString("bn-BD")}</p>}
                      </div>
                      <button onClick={() => handleEditSale(s)} className="p-2 rounded-lg hover:bg-primary/10">
                        <Edit3 className="w-4 h-4 text-primary" />
                      </button>
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
