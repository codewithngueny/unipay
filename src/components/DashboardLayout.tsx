import { type ReactNode, useState } from 'react';
import { LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui';
import type { Role } from '@/types';
import unipayLogo from '@/assets/images/unipaylogo.png';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const roleLabels: Record<Role, string> = {
  admin: 'Administrator',
  accountant: 'Accountant',
  customer: 'Student',
};

export function DashboardLayout({
  navItems,
  activeId,
  onNavigate,
  children,
}: {
  navItems: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (profile?.full_name ?? 'U')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 bg-[#6D001A] text-white flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
          <div className="w-36 h-11 flex items-center">
            <img src={unipayLogo} alt="UniPay" className="h-11 w-auto object-contain" />
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-white text-[#6D001A] font-bold shadow-sm'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-sm font-bold text-[#6D001A]">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
              <Badge status={profile?.role}>{roleLabels[profile?.role ?? 'customer']}</Badge>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-red-700 hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-[#6D001A] h-14 flex items-center px-4 shadow">
          <button className="text-white/80 hover:text-white" onClick={() => setMobileOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="ml-3">
            <img src={unipayLogo} alt="UniPay" className="h-9 w-auto object-contain" />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
