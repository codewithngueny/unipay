import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// Brand colours
const M = '#6D001A'; // maroon
const MD = '#4d0012'; // maroon dark (hover)

type Variant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:   `bg-[${M}] text-white hover:bg-[${MD}] focus:ring-[${M}] shadow-sm`,
  secondary: 'bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-600',
  accent:    `border-2 border-[${M}] text-[${M}] bg-white hover:bg-[${M}] hover:text-white focus:ring-[${M}] shadow-sm transition-colors`,
  outline:   'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-[#6D001A]',
  ghost:     'text-slate-600 hover:bg-slate-100 focus:ring-slate-400',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100">
      <div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Input({ label, error, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <input
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D001A] focus:border-[#6D001A] transition ${
          error ? 'border-red-400' : 'border-slate-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, error, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <select
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#6D001A] focus:border-[#6D001A] transition ${
          error ? 'border-red-400' : 'border-slate-300'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <textarea
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D001A] focus:border-[#6D001A] transition resize-y ${
          error ? 'border-red-400' : 'border-slate-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const badgeColors: Record<string, string> = {
  unpaid:     'bg-red-50 text-red-800 border-red-200',
  partial:    'bg-amber-50 text-amber-800 border-amber-200',
  paid:       'bg-emerald-50 text-emerald-800 border-emerald-200',
  overdue:    'bg-red-100 text-red-900 border-red-300',
  successful: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed:     'bg-red-100 text-red-800 border-red-200',
  pending:    'bg-amber-50 text-amber-800 border-amber-200',
  admin:      'bg-purple-100 text-purple-800 border-purple-200',
  accountant: 'bg-teal-100 text-teal-800 border-teal-200',
  customer:   'bg-slate-100 text-slate-700 border-slate-200',
  active:     'bg-emerald-50 text-emerald-800 border-emerald-200',
  inactive:   'bg-slate-100 text-slate-500 border-slate-200',
};

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const key = status ?? String(children);
  const colorClass = badgeColors[key] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
      {children ?? status}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Spinner className="w-8 h-8 text-[#6D001A]" />
    </div>
  );
}

export function EmptyState({ icon, title, message }: { icon?: ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-600 text-base">{title}</p>
      {message && <p className="text-sm text-slate-400 mt-1 max-w-xs">{message}</p>}
    </div>
  );
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
