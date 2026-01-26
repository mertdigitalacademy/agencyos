/**
 * Supabase Client for AgencyOS Frontend
 *
 * This module provides a configured Supabase client for:
 * - Authentication (login, signup, session management)
 * - Real-time subscriptions (job status updates)
 * - Direct database access (for simple queries)
 *
 * Usage:
 * ```typescript
 * import { supabase, auth } from './lib/supabase';
 *
 * // Authentication
 * await auth.signUp(email, password);
 * await auth.signIn(email, password);
 * await auth.signOut();
 *
 * // Get current user
 * const user = await auth.getUser();
 *
 * // Direct database access
 * const { data } = await supabase.from('projects').select('*');
 * ```
 *
 * Environment Variables (set in .env):
 * - VITE_SUPABASE_URL: Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Supabase anonymous key
 */

import { createClient, SupabaseClient, User, Session, AuthChangeEvent } from "@supabase/supabase-js";

// ============================================
// CONFIGURATION
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create client (or null if not configured)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ============================================
// AUTHENTICATION HELPERS
// ============================================

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Authentication helper functions
 */
export const auth = {
  /**
   * Sign up a new user
   */
  async signUp(email: string, password: string, name?: string) {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in with OAuth provider
   */
  async signInWithProvider(provider: "google" | "github") {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    if (!supabase) throw new Error("Supabase not configured");

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get the current user
   */
  async getUser() {
    if (!supabase) return null;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Error getting user:", error);
      return null;
    }
    return user;
  },

  /**
   * Get the current session
   */
  async getSession() {
    if (!supabase) return null;

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session:", error);
      return null;
    }
    return session;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    if (!supabase) {
      console.warn("Supabase not configured, auth state changes won't work");
      return { data: { subscription: { unsubscribe: () => {} } } };
    }

    return supabase.auth.onAuthStateChange(callback);
  },

  /**
   * Request password reset
   */
  async resetPassword(email: string) {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Update password
   */
  async updatePassword(newPassword: string) {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return data;
  },
};

// ============================================
// COUNCIL JOB HELPERS
// ============================================

export interface CouncilJob {
  id: string;
  user_id?: string;
  project_id?: string;
  job_type: "council_run" | "council_playground" | "doc_generate";
  status: "pending" | "processing" | "completed" | "failed";
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export const councilJobs = {
  /**
   * Create a new council job
   */
  async create(
    jobType: CouncilJob["job_type"],
    input: Record<string, unknown>,
    projectId?: string
  ): Promise<CouncilJob> {
    if (!supabase) throw new Error("Supabase not configured");

    const user = await auth.getUser();

    const { data, error } = await supabase
      .from("council_jobs")
      .insert({
        job_type: jobType,
        input,
        project_id: projectId,
        user_id: user?.id,
        status: "pending",
        progress: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get a council job by ID
   */
  async get(jobId: string): Promise<CouncilJob | null> {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase
      .from("council_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }
    return data;
  },

  /**
   * Subscribe to job updates (real-time)
   */
  subscribe(jobId: string, callback: (job: CouncilJob) => void) {
    if (!supabase) {
      console.warn("Supabase not configured, real-time updates won't work");
      return { unsubscribe: () => {} };
    }

    const channel = supabase
      .channel(`council_job_${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "council_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          callback(payload.new as CouncilJob);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },

  /**
   * Poll for job status (fallback if real-time unavailable)
   */
  async poll(
    jobId: string,
    onUpdate: (job: CouncilJob) => void,
    options: { interval?: number; timeout?: number } = {}
  ): Promise<CouncilJob> {
    const { interval = 2000, timeout = 300000 } = options; // 2s interval, 5min timeout

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await this.get(jobId);
      if (!job) throw new Error("Job not found");

      onUpdate(job);

      if (job.status === "completed" || job.status === "failed") {
        return job;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error("Job polling timeout");
  },
};

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

export const realtime = {
  /**
   * Subscribe to project changes
   */
  subscribeToProjects(callback: (payload: { eventType: string; new: unknown; old: unknown }) => void) {
    if (!supabase) {
      console.warn("Supabase not configured, real-time updates won't work");
      return { unsubscribe: () => {} };
    }

    const channel = supabase
      .channel("projects_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
        },
        (payload) => {
          callback({
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },

  /**
   * Subscribe to council sessions
   */
  subscribeToCouncilSessions(callback: (payload: { eventType: string; new: unknown; old: unknown }) => void) {
    if (!supabase) {
      console.warn("Supabase not configured, real-time updates won't work");
      return { unsubscribe: () => {} };
    }

    const channel = supabase
      .channel("council_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "council_sessions",
        },
        (payload) => {
          callback({
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          });
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get authorization header for API requests
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};

  const session = await auth.getSession();
  if (!session?.access_token) return {};

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await auth.getUser();
  return user !== null;
}

// ============================================
// TYPE EXPORTS
// ============================================

export type { User, Session, AuthChangeEvent };
