import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, BarChart3 } from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "ড্যাশবোর্ড" },
  { path: "/sales", icon: ShoppingCart, label: "বিক্রয়" },
  { path: "/products", icon: Package, label: "পণ্য" },
  { path: "/customers", icon: Users, label: "কাস্টমার" },
  { path: "/reports", icon: BarChart3, label: "রিপোর্ট" },
];

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-18 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          const isExactHome = item.path === "/" && location.pathname === "/";
          const active = item.path === "/" ? isExactHome : isActive;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-2 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`w-6 h-6 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
