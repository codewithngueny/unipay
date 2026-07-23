import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: SignUpData) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: Role;
  studentNumber?: string;
  program?: string;
  yearOfStudy?: number;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (active) {
        if (data) setProfile(data as Profile);
        if (error) console.error('Profile load error:', error.message);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue['signUp'] = async (data) => {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          phone: data.phone,
          role: data.role,
          student_number: data.studentNumber,
          program: data.program,
          year_of_study: data.yearOfStudy,
        },
      },
    });
    if (error) return { error: error.message };
    const userId = authData.user?.id;
    if (!userId) return { error: 'Sign-up failed. Please try again.' };

    // Trigger handle_new_user automatically creates profiles and students.
    // Try explicit fallback update/insert in case user is auto-authenticated:
    try {
      await supabase.from('profiles').update({ phone: data.phone }).eq('id', userId);

      if (data.role === 'customer' && data.studentNumber) {
        await supabase.from('students').upsert(
          {
            user_id: userId,
            student_number: data.studentNumber,
            program: data.program ?? 'Undeclared',
            year_of_study: data.yearOfStudy ?? 1,
          },
          { onConflict: 'student_number' }
        );
      }
    } catch (e) {
      console.warn('Post-signup metadata sync warning:', e);
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
