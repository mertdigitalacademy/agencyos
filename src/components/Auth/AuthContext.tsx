/**
 * Auth Context for AgencyOS
 *
 * Provides authentication state and methods throughout the application.
 *
 * Usage:
 * ```tsx
 * import { useAuth } from './components/Auth/AuthContext';
 *
 * function MyComponent() {
 *   const { user, isLoading, signIn, signOut } = useAuth();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!user) return <LoginForm />;
 *
 *   return <div>Welcome, {user.email}</div>;
 * }
 * ```
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth, supabase, isSupabaseConfigured, type User, type Session, type AuthChangeEvent } from "../../lib/supabase";

// ============================================
// TYPES
// ============================================

export interface AuthContextType {
  // State
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSupabaseEnabled: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  // Errors
  error: string | null;
  clearError: () => void;
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================
// PROVIDER
// ============================================

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Skip auth initialization if Supabase is not configured
      // This allows the app to run in "local mode" without auth
      setIsLoading(false);
      return;
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const currentSession = await auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      } catch (e) {
        console.error("Error initializing auth:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Handle specific events
        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const { user: newUser, session: newSession } = await auth.signIn(email, password);
      setUser(newUser);
      setSession(newSession);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign in failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const { user: newUser, session: newSession } = await auth.signUp(email, password, name);
      setUser(newUser);
      setSession(newSession);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign up failed";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setError(null);

    try {
      await auth.signOut();
      setUser(null);
      setSession(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sign out failed";
      setError(message);
      throw e;
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    setError(null);

    try {
      await auth.resetPassword(email);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Password reset failed";
      setError(message);
      throw e;
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: user !== null,
    isSupabaseEnabled: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
    resetPassword,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

// ============================================
// PROTECTED ROUTE COMPONENT
// ============================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isSupabaseEnabled } = useAuth();

  // If Supabase is not configured, allow access (local mode)
  if (!isSupabaseEnabled) {
    return <>{children}</>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show fallback (login form) if not authenticated
  if (!isAuthenticated) {
    return <>{fallback ?? <div>Please log in to continue.</div>}</>;
  }

  // Render protected content
  return <>{children}</>;
}
