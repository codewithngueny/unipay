import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Plus,
  Receipt as ReceiptIcon,
  Search,
  TrendingUp,
  Wallet,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchActivePaymentMethods } from '@/lib/payments';
import type { Invoice, Payment, PaymentMethod, Receipt, Student } from '@/types';
import { DashboardLayout, type NavItem } from '@/components/DashboardLayout';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  formatCurrency,
  formatDate,
  formatDateTime,
  Input,
  PageLoader,
  Select,
  Spinner,
} from '@/components/ui';
import { Modal } from '@/components/Modal';

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'receipts', label: 'Receipts', icon: ReceiptIcon },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

interface StudentWithProfile extends Student {
  profiles?: { full_name: string } | null;
}

export function AccountantDashboard() {
  const { profile } = useAuth();
  const [active, setActive] = useState('overview');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [invoices, setInvoices] = useState<(Invoice & { students?: Pick<Student, 'student_number' | 'program'>; profiles?: { full_name: string } | null })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const m = await fetchActivePaymentMethods();
      setMethods(m);
      const [{ data: stu }, { data: inv }, { data: pays }, { data: rcpts }] = await Promise.all([
        supabase.from('students').select('*, profiles(full_name)').order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('*, students(student_number, program)')
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('*, payment_methods(name, code), invoices(invoice_number, title), students(student_number, program)')
          .order('created_at', { ascending: false }),
        supabase
          .from('receipts')
          .select('*, payments(*, payment_methods(name, code), invoices(invoice_number, title)), students(student_number, program, year_of_study)')
          .order('issued_at', { ascending: false }),
      ]);
      setStudents((stu ?? []) as StudentWithProfile[]);
      setInvoices((inv ?? []) as typeof invoices);
      setPayments((pays ?? []) as Payment[]);
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
      {active === 'overview' && <Overview payments={payments} invoices={invoices} students={students} />}
      {active === 'invoices' && (
        <InvoicesView students={students} invoices={invoices} onReload={loadAll} />
      )}
      {active === 'payments' && <PaymentsView payments={payments} />}
      {active === 'receipts' && <ReceiptsView receipts={receipts} />}
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

function Overview({ payments, invoices, students }: { payments: Payment[]; invoices: Invoice[]; students: StudentWithProfile[] }) {
  const totalRevenue = payments.filter((p) => p.status === 'successful').reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = invoices.reduce((s, i) => s + Number(i.balance_due), 0);
  const pending = invoices.filter((i) => i.status !== 'paid').length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Accountant Dashboard</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Manage invoices, payments, and financial reports.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} accent />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Students" value={String(students.length)} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Pending Invoices" value={String(pending)} icon={<ReceiptIcon className="w-5 h-5" />} />
      </div>
      <Card>
        <CardHeader title="Recent Payments" subtitle="Latest transactions across all students" />
        {payments.length === 0 ? (
          <EmptyState icon={<Wallet className="w-10 h-10" />} title="No payments yet" />
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-6 py-3.5">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{p.payment_reference}</p>
                  <p className="text-xs text-slate-500">
                    {p.students?.student_number ?? '—'} · {p.payment_methods?.name} · {formatDateTime(p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatCurrency(Number(p.amount))}</span>
                  <Badge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InvoicesView({ students, invoices, onReload }: { students: StudentWithProfile[]; invoices: (Invoice & { students?: Pick<Student, 'student_number' | 'program'>; profiles?: { full_name: string } | null })[]; onReload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId) return setError('Select a student.');
    if (!title.trim()) return setError('Enter a title.');
    if (!amount || Number(amount) <= 0) return setError('Enter a valid amount.');
    setLoading(true);
    try {
      const { data: ref, error: refError } = await supabase.rpc('generate_invoice_number');
      if (refError) throw refError;
      const { error: insError } = await supabase.from('invoices').insert({
        invoice_number: ref,
        student_id: studentId,
        title: title.trim(),
        description: description.trim() || null,
        amount: Number(amount),
        balance_due: Number(amount),
        due_date: dueDate || null,
        status: 'unpaid',
      });
      if (insError) throw insError;
      setShowCreate(false);
      setStudentId('');
      setTitle('');
      setDescription('');
      setAmount('');
      setDueDate('');
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Create and manage student fee invoices.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>
      <Card>
        <CardHeader title="All Invoices" subtitle={`${invoices.length} total`} />
        {invoices.length === 0 ? (
          <EmptyState icon={<FileText className="w-10 h-10" />} title="No invoices" message="Create an invoice to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">Invoice #</th>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  <th className="px-6 py-3 font-medium text-right">Balance</th>
                  <th className="px-6 py-3 font-medium">Due</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-medium text-slate-800">{inv.invoice_number}</td>
                    <td className="px-6 py-3.5 text-slate-600">{inv.students?.student_number ?? '—'}</td>
                    <td className="px-6 py-3.5 text-slate-600">{inv.title}</td>
                    <td className="px-6 py-3.5 text-right">{formatCurrency(Number(inv.amount))}</td>
                    <td className="px-6 py-3.5 text-right font-medium">{formatCurrency(Number(inv.balance_due))}</td>
                    <td className="px-6 py-3.5 text-slate-500">{formatDate(inv.due_date)}</td>
                    <td className="px-6 py-3.5"><Badge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.student_number} — {s.profiles?.full_name ?? 'Unknown'} ({s.program})
              </option>
            ))}
          </Select>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tuition — Semester 1, 2026" required />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional notes" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (KES)" type="number" min={1} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner className="w-4 h-4" /> : 'Create Invoice'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function PaymentsView({ payments }: { payments: Payment[] }) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">All Payments</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Search and filter transactions across all students.</p>
      </div>
      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search by reference, student, method…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44">
            <option value="">All statuses</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Wallet className="w-10 h-10" />} title="No payments found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">Reference</th>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">Invoice</th>
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
                    <td className="px-6 py-3.5 text-slate-600">{p.invoices?.invoice_number ?? '—'}</td>
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

function ReceiptsView({ receipts }: { receipts: Receipt[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receipts</h1>
        <p className="text-slate-500 mt-0.5 text-sm">All issued payment receipts.</p>
      </div>
      <Card>
        {receipts.length === 0 ? (
          <EmptyState icon={<ReceiptIcon className="w-10 h-10" />} title="No receipts" />
        ) : (
          <div className="divide-y divide-slate-100">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-800">{r.receipt_number}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.students?.student_number ?? '—'} · {formatDateTime(r.issued_at)}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(Number(r.amount))}</span>
              </div>
            ))}
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
    const rows = [['Reference', 'Student', 'Method', 'Date', 'Amount', 'Status']];
    payments.forEach((p) => {
      rows.push([
        p.payment_reference,
        p.students?.student_number ?? '',
        p.payment_methods?.name ?? '',
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
    a.download = `payments-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Revenue summaries and transaction analytics.</p>
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
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="w-5 h-5" />} accent />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Successful" value={String(successful)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Failed / Pending" value={`${failed} / ${pending}`} icon={<ReceiptIcon className="w-5 h-5" />} />
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
                      className="h-full bg-[#6D001A] rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
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
