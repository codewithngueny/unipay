import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CreditCard,
  Download,
  FileText,
  LayoutDashboard,
  Printer,
  Receipt as ReceiptIcon,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Building2,
  Banknote,
  Clock,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  fetchActivePaymentMethods,
  fetchStudentForUser,
  initiateStripePayment,
  initiateMpesaPayment,
  pollPaymentStatus,
  makeManualPayment,
} from '@/lib/payments';
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
import { ReceiptDocument, type ReceiptData } from '@/components/ReceiptDocument';
import { KENYA_UNIVERSITIES, getCourses } from '@/lib/kenyaUniversities';

const navItems: NavItem[] = [
  { id: 'overview',  label: 'Overview',        icon: LayoutDashboard },
  { id: 'invoices',  label: 'My Invoices',      icon: FileText },
  { id: 'pay',       label: 'Make Payment',     icon: CreditCard },
  { id: 'history',   label: 'Payment History',  icon: Wallet },
  { id: 'receipts',  label: 'Receipts',         icon: ReceiptIcon },
];

export function CustomerDashboard() {
  const { profile } = useAuth();
  const [active, setActive] = useState('overview');
  const [student, setStudent] = useState<Student | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const stu = await fetchStudentForUser(profile.id);
      setStudent(stu);
      const m = await fetchActivePaymentMethods();
      setMethods(m);
      if (stu) {
        const [{ data: inv }, { data: pays }, { data: rcpts }] = await Promise.all([
          supabase.from('invoices').select('*').eq('student_id', stu.id).order('created_at', { ascending: false }),
          supabase
            .from('payments')
            .select('*, payment_methods(name, code), invoices(invoice_number, title)')
            .eq('student_id', stu.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('receipts')
            .select('*, payments(*, payment_methods(name, code), invoices(invoice_number, title)), students(student_number, program, year_of_study)')
            .eq('student_id', stu.id)
            .order('issued_at', { ascending: false }),
        ]);
        setInvoices((inv ?? []) as Invoice[]);
        setPayments((pays ?? []) as Payment[]);
        setReceipts((rcpts ?? []) as Receipt[]);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return <PageLoader />;
  if (!student) {
    return (
      <DashboardLayout navItems={navItems} activeId={active} onNavigate={setActive}>
        <Card className="p-8">
          <EmptyState
            icon={<AlertCircle className="w-10 h-10" />}
            title="Student profile not found"
            message="Please contact the registrar to set up your student record."
          />
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} activeId={active} onNavigate={setActive}>
      {active === 'overview'  && <Overview invoices={invoices} payments={payments} student={student} />}
      {active === 'invoices'  && <InvoicesView invoices={invoices} onPay={() => setActive('pay')} />}
      {active === 'pay' && (
        <MakePaymentView
          student={student}
          methods={methods}
          invoices={invoices}
          onDone={() => { loadAll(); setActive('history'); }}
        />
      )}
      {active === 'history'  && <HistoryView payments={payments} />}
      {active === 'receipts' && (
        <ReceiptsView receipts={receipts} studentName={profile?.full_name ?? ''} />
      )}
    </DashboardLayout>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent ? 'bg-[#6D001A] text-white' : 'bg-slate-100 text-slate-500'}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function Overview({ invoices, payments, student }: { invoices: Invoice[]; payments: Payment[]; student: Student }) {
  const totalPaid    = payments.filter((p) => p.status === 'successful').reduce((s, p) => s + Number(p.amount), 0);
  const outstanding  = invoices.reduce((s, i) => s + Number(i.balance_due), 0);
  const pendingCount = invoices.filter((i) => i.status !== 'paid').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hello, {student.program ? student.program + ' Student' : 'Student'}
        </h1>
        <p className="text-slate-500 mt-0.5 text-sm">
          Student No: <span className="font-semibold text-slate-700">{student.student_number}</span> &middot; Year {student.year_of_study}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Paid"       value={formatCurrency(totalPaid)}     icon={<Wallet className="w-5 h-5" />}      accent />
        <StatCard label="Outstanding"      value={formatCurrency(outstanding)}   icon={<AlertCircle className="w-5 h-5" />} />
        <StatCard label="Total Invoices"   value={String(invoices.length)}       icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Pending"          value={String(pendingCount)}          icon={<Clock className="w-5 h-5" />} />
      </div>

      <Card>
        <CardHeader title="Recent Payments" subtitle="Your latest transactions" />
        {payments.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-10 h-10" />}
            title="No payments yet"
            message="Your payment history will appear here once you make a payment."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between px-6 py-3.5">
                <div>
                  <p className="font-medium text-slate-800 text-sm">{p.payment_reference}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.payment_methods?.name} &middot; {formatDateTime(p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">{formatCurrency(Number(p.amount))}</span>
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

// ─── Invoices view ────────────────────────────────────────────────────────────
function InvoicesView({ invoices, onPay }: { invoices: Invoice[]; onPay: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Invoices</h1>
        <p className="text-slate-500 mt-0.5 text-sm">View your outstanding and paid fee invoices.</p>
      </div>
      <Card>
        <CardHeader title="All Invoices" action={<Button size="sm" onClick={onPay}>Make Payment</Button>} />
        {invoices.length === 0 ? (
          <EmptyState icon={<FileText className="w-10 h-10" />} title="No invoices issued yet" message="Invoices will appear here once the accounts office raises them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 font-semibold">Invoice #</th>
                  <th className="px-6 py-3 font-semibold">Description</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                  <th className="px-6 py-3 font-semibold text-right">Balance</th>
                  <th className="px-6 py-3 font-semibold">Due</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-700">{inv.invoice_number}</td>
                    <td className="px-6 py-3.5 text-slate-700">{inv.title}</td>
                    <td className="px-6 py-3.5 text-right">{formatCurrency(Number(inv.amount))}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-[#6D001A]">{formatCurrency(Number(inv.balance_due))}</td>
                    <td className="px-6 py-3.5 text-slate-500">{formatDate(inv.due_date)}</td>
                    <td className="px-6 py-3.5"><Badge status={inv.status} /></td>
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

// ─── Make Payment view ────────────────────────────────────────────────────────
function MakePaymentView({
  student,
  methods,
  invoices,
  onDone,
}: {
  student: Student;
  methods: PaymentMethod[];
  invoices: Invoice[];
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid');

  // Form state
  const [universityId, setUniversityId] = useState('');
  const [course, setCourse] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ receiptNo: string; amount: number } | null>(null);
  const [mpesaWaiting, setMpesaWaiting] = useState(false);

  const availableCourses = useMemo(() => universityId ? getCourses(universityId) : [], [universityId]);
  const selectedUniversity = useMemo(() => KENYA_UNIVERSITIES.find((u) => u.id === universityId) ?? null, [universityId]);
  const selectedInvoice    = useMemo(() => invoices.find((i) => i.id === invoiceId) ?? null, [invoices, invoiceId]);
  const selectedMethod     = useMemo(() => methods.find((m) => m.id === methodId) ?? null, [methods, methodId]);

  useEffect(() => {
    if (selectedInvoice) setAmount(String(selectedInvoice.balance_due));
  }, [selectedInvoice]);

  // Handle Stripe redirect-back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const ref = params.get('ref');
    if (paymentStatus === 'success' && ref) {
      setSuccess({ receiptNo: ref, amount: 0 });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      setError('Payment was cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!universityId)     return setError('Please select a university.');
    if (!course)           return setError('Please select the course you are paying for.');
    const amt = Number(amount);
    if (!methodId)         return setError('Select a payment method.');
    if (!amt || amt <= 0)  return setError('Enter a valid amount.');
    if (selectedInvoice && amt > Number(selectedInvoice.balance_due))
      return setError('Amount exceeds the invoice balance due.');

    const methodCode = selectedMethod?.code;

    if (methodCode === 'mpesa') {
      const cleaned = mpesaNumber.replace(/\s/g, '');
      if (!cleaned || cleaned.length < 10) return setError('Enter a valid M-Pesa phone number (e.g. 254712345678).');
      if (!/^254\d{9}$/.test(cleaned))     return setError('Phone must be in format 2547XXXXXXXX.');
    }
    if (methodCode === 'bank_transfer' && !bankRef.trim()) return setError('Enter your bank transfer reference.');

    setLoading(true);
    const payerDetails: Record<string, unknown> = {
      university: selectedUniversity?.name,
      course,
    };

    try {
      if (methodCode === 'card') {
        await initiateStripePayment({
          studentId: student.id,
          invoiceId: invoiceId || null,
          paymentMethodId: methodId,
          amount: amt,
          invoiceNumber: selectedInvoice?.invoice_number,
          invoiceTitle: selectedInvoice?.title ?? course,
          studentName: profile?.full_name,
        });
      } else if (methodCode === 'mpesa') {
        setMpesaWaiting(true);
        const result = await initiateMpesaPayment({
          studentId: student.id,
          invoiceId: invoiceId || null,
          paymentMethodId: methodId,
          amount: amt,
          phoneNumber: mpesaNumber.replace(/\s/g, ''),
          invoiceNumber: selectedInvoice?.invoice_number,
          invoiceTitle: selectedInvoice?.title ?? course,
          studentName: profile?.full_name,
        });
        const confirmed = await pollPaymentStatus(result.paymentId, 120000, 4000);
        setMpesaWaiting(false);
        if (confirmed?.status === 'successful') {
          const { data: receipt } = await supabase.from('receipts').select('*').eq('payment_id', confirmed.id).maybeSingle();
          setSuccess({ receiptNo: receipt?.receipt_number ?? '—', amount: Number(confirmed.amount) });
        } else if (confirmed?.status === 'failed') {
          setError('M-Pesa payment was declined or cancelled on your phone.');
        } else {
          setError('M-Pesa payment pending. Check your payment history in a moment.');
        }
      } else {
        if (methodCode === 'bank_transfer') payerDetails.bank_reference = bankRef;
        const { receipt } = await makeManualPayment({
          studentId: student.id,
          invoiceId: invoiceId || null,
          paymentMethodId: methodId,
          amount: amt,
          payerDetails,
        });
        setSuccess({ receiptNo: receipt.receipt_number, amount: amt });
      }
    } catch (err) {
      setMpesaWaiting(false);
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="p-10 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-[#6D001A] rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-9 h-9 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Payment Successful</h2>
        <p className="text-slate-500 mt-2 text-sm">
          {success.amount > 0
            ? <>Receipt <span className="font-mono font-semibold text-slate-800">{success.receiptNo}</span> &middot; {formatCurrency(success.amount)}</>
            : 'Payment confirmed. Check your receipts for the official document.'}
        </p>
        <div className="flex justify-center gap-3 mt-8">
          <Button onClick={onDone}>View Payment History</Button>
        </div>
      </Card>
    );
  }

  if (mpesaWaiting) {
    return (
      <Card className="p-10 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Smartphone className="w-9 h-9 text-emerald-600 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Check Your Phone</h2>
        <p className="text-slate-500 mt-2 text-sm">
          An M-Pesa STK push has been sent to your phone. Enter your M-Pesa PIN to complete the payment.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6 text-emerald-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Waiting for confirmation…</span>
        </div>
      </Card>
    );
  }

  const methodIcons: Record<string, React.ReactNode> = {
    card:          <CreditCard className="w-5 h-5" />,
    mpesa:         <Smartphone className="w-5 h-5" />,
    mobile_money:  <Smartphone className="w-5 h-5" />,
    bank_transfer: <Building2  className="w-5 h-5" />,
    cash:          <Banknote   className="w-5 h-5" />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Make a Payment</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Pay your university fees securely via card or M-Pesa.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment form */}
        <Card className="lg:col-span-2">
          <CardHeader title="Payment Details" subtitle="Complete all fields below" />
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* University */}
            <Select
              label="University"
              value={universityId}
              onChange={(e) => { setUniversityId(e.target.value); setCourse(''); }}
              required
            >
              <option value="">— Select your university —</option>
              <optgroup label="Public Universities">
                {KENYA_UNIVERSITIES.filter((u) => u.type === 'public').map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>
                ))}
              </optgroup>
              <optgroup label="Private Universities">
                {KENYA_UNIVERSITIES.filter((u) => u.type === 'private').map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>
                ))}
              </optgroup>
            </Select>

            {/* Course — only shown once university is selected */}
            {universityId && (
              <Select
                label="Course / Programme"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                required
              >
                <option value="">— Select your course —</option>
                {availableCourses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            )}

            {/* Invoice */}
            <Select
              label="Invoice (optional)"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            >
              <option value="">— No specific invoice —</option>
              {unpaidInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.title} (Bal: {formatCurrency(Number(inv.balance_due))})
                </option>
              ))}
            </Select>

            {/* Amount */}
            <Input
              label="Amount (KES)"
              type="number"
              min={1}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
            />

            {/* Payment method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethodId(m.id)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${
                      methodId === m.id
                        ? 'border-[#6D001A] bg-[#6D001A] text-white font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    {methodIcons[m.code] ?? <CreditCard className="w-5 h-5" />}
                    <span className="block text-xs font-semibold">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Method-specific fields */}
            {selectedMethod?.code === 'card' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-[#6D001A] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Secure Stripe Checkout</p>
                  <p className="text-xs text-slate-500 mt-1">
                    You'll be redirected to Stripe's secure page. Test card: <span className="font-mono font-medium">4242 4242 4242 4242</span> (any future date, any CVC).
                  </p>
                </div>
              </div>
            )}

            {selectedMethod?.code === 'mpesa' && (
              <div className="space-y-2 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <Input
                  label="M-Pesa Phone Number"
                  value={mpesaNumber}
                  onChange={(e) => setMpesaNumber(e.target.value)}
                  placeholder="254712345678"
                  maxLength={12}
                />
                <p className="text-xs text-emerald-700 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                  STK push will be sent. Enter M-Pesa PIN on your phone to confirm.
                </p>
              </div>
            )}

            {selectedMethod?.code === 'bank_transfer' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <Input label="Bank Transfer Reference" value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="TRF-2026-00123" />
                <p className="text-xs text-slate-400 mt-2">Enter the reference from your bank confirmation slip.</p>
              </div>
            )}

            {selectedMethod?.code === 'cash' && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600">Cash payments are processed at the Bursar's office. Submit this form to log your intent; the accountant will verify and confirm.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#6D001A] hover:bg-[#4d0012] text-white font-bold rounded-xl transition-all shadow focus:outline-none focus:ring-2 focus:ring-[#6D001A] focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Spinner className="w-4 h-4" /> Processing…</> : (
                selectedMethod?.code === 'card'
                  ? 'Pay with Card (Stripe)'
                  : `Pay ${amount ? formatCurrency(Number(amount)) : ''}`
              )}
            </button>
          </form>
        </Card>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#6D001A]" /> Payment Summary
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Student No.</dt>
                <dd className="font-semibold text-slate-800">{student.student_number}</dd>
              </div>
              {selectedUniversity && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-slate-500">University</dt>
                  <dd className="font-semibold text-slate-800 text-right">{selectedUniversity.name}</dd>
                </div>
              )}
              {course && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-slate-500">Course</dt>
                  <dd className="font-semibold text-slate-800 text-right text-xs">{course}</dd>
                </div>
              )}
              {selectedInvoice && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Invoice</dt>
                  <dd className="font-mono text-xs font-semibold text-slate-700">{selectedInvoice.invoice_number}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Method</dt>
                <dd className="font-semibold">{selectedMethod?.name ?? '—'}</dd>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between">
                <dt className="font-bold text-slate-800">Total</dt>
                <dd className="font-black text-xl text-[#6D001A]">{formatCurrency(Number(amount) || 0)}</dd>
              </div>
            </dl>
          </Card>
          <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
            Sandbox mode. No real money is transferred.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── History view ─────────────────────────────────────────────────────────────
function HistoryView({ payments }: { payments: Payment[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment History</h1>
        <p className="text-slate-500 mt-0.5 text-sm">All your completed and pending transactions.</p>
      </div>
      <Card>
        {payments.length === 0 ? (
          <EmptyState icon={<Wallet className="w-10 h-10" />} title="No payments yet" message="Payments you make will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide text-left">
                <tr>
                  <th className="px-6 py-3 font-semibold">Reference</th>
                  <th className="px-6 py-3 font-semibold">Invoice</th>
                  <th className="px-6 py-3 font-semibold">Method</th>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-700">{p.payment_reference}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.invoices?.invoice_number ?? '—'}</td>
                    <td className="px-6 py-3.5 text-slate-600">{p.payment_methods?.name ?? '—'}</td>
                    <td className="px-6 py-3.5 text-slate-500">{formatDateTime(p.created_at)}</td>
                    <td className="px-6 py-3.5 text-right font-semibold">{formatCurrency(Number(p.amount))}</td>
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

// ─── Receipts view ────────────────────────────────────────────────────────────
function ReceiptsView({ receipts, studentName }: { receipts: Receipt[]; studentName: string }) {
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);

  function handlePrint() {
    window.print();
  }

  function handleDownload(r: Receipt) {
    setActiveReceipt(r);
    setTimeout(() => {
      const el = document.getElementById('receipt-print-area');
      if (!el) return;
      const html = `<!DOCTYPE html><html><head><title>Receipt ${r.receipt_number}</title>
<style>
  body { font-family: sans-serif; margin: 0; padding: 0; }
  * { box-sizing: border-box; }
</style>
</head><body>${el.outerHTML}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `receipt-${r.receipt_number}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }, 400);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Receipts</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Download or print your official fee payment receipts.</p>
      </div>

      <Card>
        {receipts.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon className="w-10 h-10" />}
            title="No receipts yet"
            message="Receipts are generated automatically after each successful payment."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-mono text-sm font-bold text-slate-800">{r.receipt_number}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateTime(r.issued_at)} &middot; <span className="font-semibold text-[#6D001A]">{formatCurrency(Number(r.amount))}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setActiveReceipt(r); setTimeout(() => window.print(), 300); }}>
                    <Printer className="w-4 h-4" /> Print
                  </Button>
                  <Button size="sm" onClick={() => handleDownload(r)}>
                    <Download className="w-4 h-4" /> Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Receipt modal for preview */}
      <Modal open={!!activeReceipt} onClose={() => setActiveReceipt(null)} title="Payment Receipt" size="md">
        {activeReceipt && (
          <ReceiptDocument
            data={{
              receipt:      activeReceipt,
              payment:      activeReceipt.payments as Payment,
              student:      activeReceipt.students as Pick<Student, 'student_number' | 'program' | 'year_of_study'>,
              studentName,
            } as ReceiptData}
          />
        )}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 no-print">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Print
          </Button>
          {activeReceipt && (
            <Button onClick={() => handleDownload(activeReceipt)}>
              <Download className="w-4 h-4" /> Download
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
