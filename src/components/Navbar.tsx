import React from "react";
import { Menu, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  title: string;
  onMenuClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ title, onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <Link
          to="/scan"
          className="hidden sm:inline-flex items-center gap-2 text-xs font-medium text-eni-700 hover:text-eni-900 transition-colors whitespace-nowrap"
        >
          <QrCode className="w-4 h-4" />
          <span>Scanner un badge</span>
        </Link>
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-eni-700 text-white text-xs font-semibold flex items-center justify-center">
            {(user?.username || "A").slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:inline">
            {user?.username || "Admin"}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
