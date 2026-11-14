import React from "react";
import { NavLink } from "react-router-dom";
import {
  TrendingUp,
  Users,
  MapPin,
  Package,
  CheckCircle,
  QrCode,
  Target,
  LogOut,
  X,
  Bot,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: "/admin", label: "Tableau de bord", icon: TrendingUp, end: true },
  { to: "/admin/etudiants", label: "Étudiants", icon: Users },
  { to: "/admin/programme", label: "Programme (7j)", icon: MapPin },
  { to: "/admin/voitures", label: "Voitures", icon: Package },
  { to: "/admin/affectations", label: "Affectations", icon: CheckCircle },
  { to: "/admin/badges", label: "Badges & QR", icon: QrCode },
  { to: "/admin/agent-ia", label: "Agent IA", icon: Bot }, // ← NOUVEAU
  { to: "/admin/parametres", label: "Paramètres", icon: Target },
];

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { logout } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-eni-900 to-eni-950 text-white flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/10">
          <NavLink
            to="/"
            className="font-display text-lg font-bold tracking-tight whitespace-nowrap"
          >
            VoyageE <span className="text-gold-400">ENI</span>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-eni-200 hover:text-white lg:hidden cursor-pointer"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                    ? "bg-gold-400 text-eni-950 font-semibold"
                    : "text-eni-100 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-eni-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;