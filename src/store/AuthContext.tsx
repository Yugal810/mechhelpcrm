import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';

const ADMIN_EMAIL = 'mechadmin@gmail.com';
const useSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const mapDbProfile = (row: any): UserProfile => {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  const email = row.email || '';
  const role: UserRole =
    row.role === 'admin' || (!row.role && email.toLowerCase() === ADMIN_EMAIL)
      ? 'admin'
      : 'sales';

  return {
    id: row.id,
    email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    displayName: fullName || email || 'User',
    role,
    createdAt: row.created_at,
  };
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  allProfiles: UserProfile[];
  salesEmployees: UserProfile[];
  loading: boolean;
  refreshProfiles: () => Promise<void>;
  updateProfileRole: (profileId: string, role: UserRole) => Promise<void>;
  getEmployeeLabel: (userId?: string | null) => string;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfiles = useCallback(async () => {
    if (!useSupabase || !supabase?.from) {
      setAllProfiles([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) {
        console.warn('Could not load profiles:', error.message);
        return;
      }
      setAllProfiles((data || []).map(mapDbProfile));
    } catch (err) {
      console.warn('Error loading profiles:', err);
    }
  }, []);

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

  useEffect(() => {
    if (!user) {
      setAllProfiles([]);
      return;
    }

    refreshProfiles();

    let profilesChannel: any = null;
    if (useSupabase && supabase?.channel) {
      try {
        profilesChannel = supabase
          .channel('crm-profiles-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
            refreshProfiles();
          })
          .subscribe();
      } catch (err) {
        console.warn('Profiles realtime subscription error:', err);
      }
    }

    return () => {
      if (profilesChannel && supabase?.removeChannel) {
        supabase.removeChannel(profilesChannel);
      }
    };
  }, [user?.id, refreshProfiles]);

  const profile = useMemo(() => {
    if (!user) return null;
    return allProfiles.find((p) => p.id === user.id) || null;
  }, [allProfiles, user]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (profile) return profile.role === 'admin';
    return (user.email || '').toLowerCase() === ADMIN_EMAIL;
  }, [profile, user]);

  const salesEmployees = useMemo(
    () => allProfiles.filter((p) => p.role === 'sales'),
    [allProfiles]
  );

  const getEmployeeLabel = useCallback(
    (userId?: string | null) => {
      if (!userId) return 'Unassigned';
      const found = allProfiles.find((p) => p.id === userId);
      if (found) return found.displayName;
      if (user?.id === userId) return user.email || 'You';
      return 'Unknown User';
    },
    [allProfiles, user]
  );

  const updateProfileRole = useCallback(
    async (profileId: string, role: UserRole) => {
      if (!useSupabase || !supabase?.from) return;
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', profileId);
      if (error) throw error;
      await refreshProfiles();
    },
    [refreshProfiles]
  );

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
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isAdmin,
        allProfiles,
        salesEmployees,
        loading,
        refreshProfiles,
        updateProfileRole,
        getEmployeeLabel,
        login,
        logout,
        updatePassword,
        resetPassword,
      }}
    >
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
      profile: null,
      isAdmin: false,
      allProfiles: [],
      salesEmployees: [],
      loading: false,
      refreshProfiles: async () => {},
      updateProfileRole: async () => {},
      getEmployeeLabel: () => 'Unassigned',
      login: async () => ({ error: new Error('Auth not initialized') }),
      logout: async () => {},
      updatePassword: async () => ({ error: new Error('Auth not initialized') }),
      resetPassword: async () => ({ error: new Error('Auth not initialized') }),
    };
  }
  return context;
};
