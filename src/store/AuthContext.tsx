import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Initial session fetch
    let mounted = true;

    async function getInitialSession() {
      try {
        if (supabase?.auth) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.warn('Session refresh error, clearing stale auth session:', error.message);
            await supabase.auth.signOut().catch(() => {});
          }
          if (mounted) {
            setSession(data?.session ?? null);
            setUser(data?.session?.user ?? null);
          }
        }
      } catch (err) {
        console.warn('Error fetching initial session:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    getInitialSession();

    // 2. Listen to real-time auth state changes
    let authListener: { subscription?: { unsubscribe: () => void } } | null = null;
    try {
      if (supabase?.auth) {
        const { data } = supabase.auth.onAuthStateChange((_event: any, currentSession: any) => {
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            setLoading(false);
          }
        });
        authListener = data;
      }
    } catch (err) {
      console.error('Error setting up onAuthStateChange listener:', err);
    }

    return () => {
      mounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ error: Error | null }> => {
    if (!supabase?.auth) {
      return { error: new Error('Supabase client is not initialized.') };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { error };
    }
    setSession(data.session);
    setUser(data.user);
    return { error: null };
  };

  const logout = async () => {
    try {
      if (supabase?.auth) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setSession(null);
      setUser(null);
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
    if (!supabase?.auth) {
      return { error: new Error('Supabase client is not initialized.') };
    }
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      return { error };
    }
    if (data.user) {
      setUser(data.user);
    }
    return { error: null };
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    if (!supabase?.auth) {
      return { error: new Error('Supabase client is not initialized.') };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/settings`,
    });
    if (error) {
      return { error };
    }
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, login, logout, updatePassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      session: null,
      user: null,
      loading: false,
      login: async () => ({ error: new Error('Auth not initialized') }),
      logout: async () => {},
      updatePassword: async () => ({ error: new Error('Auth not initialized') }),
      resetPassword: async () => ({ error: new Error('Auth not initialized') }),
    };
  }
  return context;
};
