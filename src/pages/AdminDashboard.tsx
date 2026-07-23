import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Plus,
  Power,
  Search,
  Settings,
  TrendingUp,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Invoice, Payment, PaymentMethod, Profile, Receipt } from '@/types';
import { DashboardLayout, type NavItem } from '@/components/DashboardLayout';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  formatCurrency,
  formatDateTime,
  Input,
  PageLoader,
  Select,
  Spinner,
} from '@/components/ui';
import { Modal } from '@/components/Modal';

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'methods', label: 'Payment Methods', icon: CreditCard },
  { id: 'transactions', label: 'Transactions', icon: Wallet },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export function AdminDashboard() {
  const [active, setActive] = useState('overview');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: prof }, { data: meth }, { data: pays }, { data: inv }, { data: rcpts }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_methods').select('*').order('name'),
        supabase
          .from('payments')
          .select('*, payment_methods(name, code), invoices(invoice_number, title), students(student_number, program)')
          .order('created_at', { ascending: false }),
        supabase.from('invoices').select('*, students(student_number, program)').order('created_at', { ascending: false }),
        supabase
          .from('receipts')
          .select('*, payments(*, payment_methods(name, code), invoices(invoice_number, title)), students(student_number, program, year_of_study)')
          .order('issued_at', { ascending: false }),
      ]);
      setProfiles((prof ?? []) as Profile[]);
      setMethods((meth ?? []) as PaymentMethod[]);
      setPayments((pays ?? []) as Payment[]);
      setInvoices((inv ?? []) as Invoice[]);
      setReceipts((rcpts ?? []) as Receipt[]);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) return <PageLoader />;

  return (
    <DashboardLayout navItems={navItems} activeId={active} onNavigate={setActive}>
      {active === 'overview' && <Overview profiles={profiles} payments={payments} invoices={invoices} methods={methods} />}
      {active === 'users' && <UsersView profiles={profiles} onReload={loadAll} />}
      {active === 'methods' && <MethodsView methods={methods} onReload={loadAll} />}
      {active === 'transactions' && <TransactionsView payments={payments} />}
      {active === 'reports' && <ReportsView payments={payments} invoices={invoices} />}
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon, accent = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent ? 'bg-[#6D001A] text-white' : 'bg-slate-100 text-slate-500'}`}>{icon}</div>
      </div>
    </Card>
  );
}

function Overview({ profiles, payments, invoices, methods }: { profiles: Profile[]; payments: Payment[]; invoices: Invoice[]; methods: PaymentMethod[] }) {
  const totalRevenue = payments.filter((p) => p.status === 'successful').reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoices.reduce((s, i) => s + Number(i.balance_due), 0);
  const adminCount = profiles.filter((p) => p.role === 'admin').length;
  const studentCount = profiles.filter((p) => p.role === 'customer').length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administrator Dashboard</h1>
        <p className="text-slate-500 mt-0.5 text-sm">System-wide overview and administration.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} accent />
        <StatCard label="Total Users" value={String(profiles.length)} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Payment Methods" value={String(methods.filter((m) => m.is_active).length)} icon={<CreditCard className="w-5 h-5" />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="User Breakdown" />
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Administrators</span>
              <Badge status="admin">{adminCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Accountants</span>
              <Badge status="accountant">{profiles.filter((p) => p.role === 'accountant').length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Students</span>
              <Badge status="customer">{studentCount}</Badge>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent Transactions" />
          {payments.length === 0 ? (
            <EmptyState icon={<Wallet className="w-10 h-10" />} title="No transactions" />
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.payment_reference}</p>
                    <p className="text-xs text-slate-500">{p.students?.student_number} · {formatDateTime(p.created_at)}</p>
                  </div>
                  <span className="font-semibold text-sm">{formatCurrency(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function UsersView({ profiles, onReload }: { profiles: Profile[]; onReload: () => void }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<Profile['role']>('customer');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (roleFilter && p.role !== roleFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return p.full_name.toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [profiles, query, roleFilter]);

  async function saveRole() {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ role: editRole }).eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      onReload();
    } catch (err) {
      console.error('Update role error:', err);
      alert('Failed to update role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
        <p className="text-slate-500 mt-1">View and manage user roles and access.</p>
      </div>
      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search by name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="sm:w-44">
            <option value="">All roles</option>
            <option value="admin">Administrator</option>
            <option value="accountant">Accountant</option>
            <option value="customer">Student</option>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Users className="w-10 h-10" />} title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Joined</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-medium text-slate-800">{p.full_name}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.phone ?? '—'}</td>
                    <td className="px-6 py-3.5"><Badge status={p.role} /></td>
                    <td className="px-6 py-3.5 text-slate-500">{formatDateTime(p.created_at)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(p); setEditRole(p.role); }}>
                        <Settings className="w-3.5 h-3.5" /> Edit Role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit User Role" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="font-medium text-slate-800">{editing?.full_name}</p>
            <p className="text-sm text-slate-500">{editing?.phone ?? 'No phone'}</p>
          </div>
          <Select label="Role" value={editRole} onChange={(e) => setEditRole(e.target.value as Profile['role'])}>
            <option value="customer">Student</option>
            <option value="accountant">Accountant</option>
            <option value="admin">Administrator</option>
          </Select>
          <Button className="w-full" onClick={saveRole} disabled={saving}>
            {saving ? <Spinner className="w-4 h-4" /> : 'Save Changes'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function MethodsView({ methods, onReload }: { methods: PaymentMethod[]; onReload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(m: PaymentMethod) {
    try {
      const { error } = await supabase.from('payment_methods').update({ is_active: !m.is_active }).eq('id', m.id);
      if (error) throw error;
      onReload();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !code.trim()) return setError('Name and code are required.');
    setLoading(true);
    try {
      const { error: insError } = await supabase.from('payment_methods').insert({
        name: name.trim(),
        code: code.trim().toLowerCase().replace(/\s/g, '_'),
        description: description.trim() || null,
        is_active: true,
      });
      if (insError) throw insError;
      setShowCreate(false);
      setName('');
      setCode('');
      setDescription('');
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create method.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payment Methods</h1>
          <p className="text-slate-500 mt-1">Configure available payment options.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Add Method
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {methods.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">{m.name}</h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{m.code}</p>
              </div>
              <Badge status={m.is_active ? 'active' : 'inactive'}>{m.is_active ? 'Active' : 'Disabled'}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-2">{m.description ?? 'No description'}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleActive(m)}>
                <Power className="w-3.5 h-3.5" /> {m.is_active ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Payment Method" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Digital Wallet" required />
          <Input label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="digital_wallet" required />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pay via digital wallet" />
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner className="w-4 h-4" /> : 'Add Method'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function TransactionsView({ payments }: { payments: Payment[] }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          p.payment_reference.toLowerCase().includes(q) ||
          p.students?.student_number?.toLowerCase().includes(q) ||
          p.payment_methods?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [payments, query, statusFilter]);

  function exportCsv() {
    const rows = [['Reference', 'Student', 'Method', 'Invoice', 'Date', 'Amount', 'Status']];
    filtered.forEach((p) => {
      rows.push([
        p.payment_reference,
        p.students?.student_number ?? '',
        p.payment_methods?.name ?? '',
        p.invoices?.invoice_number ?? '',
        new Date(p.created_at).toISOString(),
        String(p.amount),
        p.status,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All Transactions</h1>
          <p className="text-slate-500 mt-1">Search and export all payment transactions.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search transactions…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44">
            <option value="">All statuses</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Wallet className="w-10 h-10" />} title="No transactions found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">Reference</th>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Method</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-700">{p.payment_reference}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.students?.student_number ?? '—'}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.payment_methods?.name ?? '—'}</td>
                    <td className="px-6 py-3.5 text-slate-500">{formatDateTime(p.created_at)}</td>
                    <td className="px-6 py-3.5 text-right font-medium">{formatCurrency(Number(p.amount))}</td>
                    <td className="px-6 py-3.5"><Badge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ReportsView({ payments, invoices }: { payments: Payment[]; invoices: Invoice[] }) {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'annual'>('monthly');

  const revenueByPeriod = useMemo(() => {
    const map = new Map<string, number>();
    payments
      .filter((p) => p.status === 'successful')
      .forEach((p) => {
        const d = new Date(p.created_at);
        let key: string;
        if (period === 'daily') key = d.toISOString().slice(0, 10);
        else if (period === 'monthly') key = d.toISOString().slice(0, 7);
        else key = String(d.getFullYear());
        map.set(key, (map.get(key) ?? 0) + Number(p.amount));
      });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [payments, period]);

  const totalRevenue = payments.filter((p) => p.status === 'successful').reduce((s, p) => s + Number(p.amount), 0);
  const successful = payments.filter((p) => p.status === 'successful').length;
  const failed = payments.filter((p) => p.status === 'failed').length;
  const pending = payments.filter((p) => p.status === 'pending').length;
  const outstanding = invoices.reduce((s, i) => s + Number(i.balance_due), 0);
  const maxRev = Math.max(...revenueByPeriod.map(([, v]) => v), 1);

  function exportCsv() {
    const rows = [['Reference', 'Student', 'Method', 'Invoice', 'Date', 'Amount', 'Status']];
    payments.forEach((p) => {
      rows.push([
        p.payment_reference,
        p.students?.student_number ?? '',
        p.payment_methods?.name ?? '',
        p.invoices?.invoice_number ?? '',
        new Date(p.created_at).toISOString(),
        String(p.amount),
        p.status,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">Revenue summaries and transaction reports.</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="w-36">
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </Select>
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={<Wallet className="w-5 h-5" />} tone="amber" />
        <StatCard label="Successful" value={String(successful)} icon={<Wallet className="w-5 h-5" />} tone="blue" />
        <StatCard label="Failed / Pending" value={`${failed} / ${pending}`} icon={<Trash2 className="w-5 h-5" />} tone="slate" />
      </div>

      <Card>
        <CardHeader title={`Revenue by ${period === 'daily' ? 'Day' : period === 'monthly' ? 'Month' : 'Year'}`} />
        <div className="p-6">
          {revenueByPeriod.length === 0 ? (
            <EmptyState icon={<BarChart3 className="w-10 h-10" />} title="No data" />
          ) : (
            <div className="space-y-3">
              {revenueByPeriod.slice(-12).map(([key, val]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="text-sm text-slate-500 w-24 font-mono">{key}</span>
                  <div className="flex-1 bg-slate-100 rounded-lg h-8 overflow-hidden">
                    <div
                      className="h-full bg-[#14213D] rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(val / maxRev) * 100}%`, minWidth: '2rem' }}
                    >
                      <span className="text-xs font-semibold text-white">{formatCurrency(val)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
