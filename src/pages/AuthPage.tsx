import { useState, type FormEvent, type ReactNode } from 'react';
import { Lock, Mail, User, UserCog, Wallet, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';
import type { Role } from '@/types';
import uniStudentImg from '@/assets/images/unistudent.jpg';
import unipayLogo from '@/assets/images/unipaylogo.png';

type Mode = 'login' | 'register';

const roleOptions: { value: Role; label: string; description: string; icon: ReactNode }[] = [
  { value: 'customer',   label: 'Student',       description: 'Pay fees and view receipts',       icon: <User className="w-5 h-5" /> },
  { value: 'accountant', label: 'Accountant',    description: 'Manage invoices and payments',     icon: <Wallet className="w-5 h-5" /> },
  { value: 'admin',      label: 'Administrator', description: 'Full system administration',       icon: <UserCog className="w-5 h-5" /> },
];

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // register fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [studentNumber, setStudentNumber] = useState('');
  const [program, setProgram] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('1');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setError(error);
      } else {
        if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return; }
        if (role === 'customer' && !studentNumber.trim()) { setError('Student number is required for students.'); setLoading(false); return; }
        const { error } = await signUp({
          email, password, fullName, phone, role,
          studentNumber: studentNumber.trim() || undefined,
          program: program.trim() || undefined,
          yearOfStudy: Number(yearOfStudy) || 1,
        });
        if (error) setError(error);
        else {
          setError(null);
          setMode('login');
          setEmail(''); setPassword(''); setFullName(''); setPhone('');
          setStudentNumber(''); setProgram(''); setYearOfStudy('1');
          alert('Account created. Please sign in.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">

      {/* ─── LEFT: Image panel ─────────────────────────────────────────────── */}
      <div className="relative lg:w-1/2 min-h-[280px] lg:min-h-screen overflow-hidden">
        {/* Full-bleed photo */}
        <img
          src={uniStudentImg}
          alt="University students"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Maroon overlay — stronger at bottom so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#6D001A]/90 via-[#6D001A]/40 to-[#6D001A]/20" />

        {/* Content on top of photo */}
        <div className="relative z-10 h-full flex flex-col justify-between p-8 lg:p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur-sm px-4 py-2.5 rounded-xl">
              <img src={unipayLogo} alt="UniPay" className="h-12 w-auto object-contain" />
            </div>
            <p className="text-xs text-white/70 font-medium uppercase tracking-wider"></p>
          </div>

          {/* Bottom text */}
          <div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-3">
              Pay your university<br />Fees, Securely.
            </h2>
            <p className="text-white/80 text-base leading-relaxed max-w-sm">
              M-Pesa &amp; Bank Payments Accepted. Official receipts issued instantly.
            </p>
            <div className="mt-6 flex items-center gap-2 text-white/60 text-xs">
              <ShieldCheck className="w-4 h-4 text-white/70" />
              <span>Trusted by students across 20 Kenyan universities</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Form panel ──────────────────────────────────────────────── */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md">

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              {mode === 'login' ? 'Sign in to your student portal.' : 'Register to manage your university fees.'}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-7">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  mode === m ? 'bg-[#6D001A] text-white shadow' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Jane Wanjiku" />
                <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="254712345678" />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {roleOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                          role === opt.value
                            ? 'border-[#6D001A] bg-[#6D001A] text-white font-bold'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {opt.icon}
                        <span className="text-xs font-semibold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {role === 'customer' && (
                  <div className="grid grid-cols-3 gap-3 p-4 bg-red-50/60 rounded-xl border border-[#6D001A]/15">
                    <div className="col-span-1">
                      <Input label="Student No." value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="STU-001" required />
                    </div>
                    <div className="col-span-1">
                      <Input label="Programme" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="BSc CS" />
                    </div>
                    <div className="col-span-1">
                      <Input label="Year" type="number" min={1} max={6} value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-[38px] w-4 h-4 text-slate-400" />
              <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@university.ac.ke" className="pl-9" />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-[38px] w-4 h-4 text-slate-400" />
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#6D001A] hover:bg-[#4d0012] text-white font-bold text-base rounded-xl transition-all duration-150 shadow focus:outline-none focus:ring-2 focus:ring-[#6D001A] focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Processing…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-6">
            By continuing you agree to the UniPay Terms of Service &amp; Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
