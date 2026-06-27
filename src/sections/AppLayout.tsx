import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Users,
  FileText,
  Wallet,
  BarChart3,
  Landmark,
  Settings,
  LogOut,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Projecten', icon: FolderKanban, end: true },
  { to: '/clients', label: 'Klanten', icon: Users },
  { to: '/documents', label: 'Documenten', icon: FileText },
  { to: '/payments', label: 'Betalingen', icon: Wallet },
  { to: '/rapportage', label: 'Rapportage', icon: BarChart3 },
  { to: '/btw-aangifte', label: 'BTW-aangifte', icon: Landmark },
  { to: '/instellingen', label: 'Instellingen', icon: Settings },
];

export default function AppLayout() {
  const navigate = useNavigate();

  const logout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Toaster position="top-center" richColors />

      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-brand-blue text-white flex flex-col min-h-screen sticky top-0">
        <div className="px-5 py-6 border-b border-white/10">
          <h1 className="text-xl font-bold tracking-tight">
            Tech<span className="text-brand-orange">Solutions</span>
          </h1>
          <p className="text-xs text-white/60 mt-1">Boekhouding & Documenten</p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-5 py-4 text-sm text-white/70 hover:text-white border-t border-white/10"
        >
          <LogOut className="w-4 h-4" />
          Uitloggen
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
