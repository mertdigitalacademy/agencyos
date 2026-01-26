/**
 * Login Component for AgencyOS
 *
 * Provides a complete authentication UI with:
 * - Email/password sign in and sign up
 * - OAuth providers (Google, GitHub)
 * - Password reset
 * - Form validation
 * - Error handling
 */

import React, { useState, FormEvent } from "react";
import { useAuth } from "./AuthContext";

// ============================================
// TYPES
// ============================================

type AuthMode = "signin" | "signup" | "reset";

// ============================================
// STYLES (inline for simplicity - move to CSS if needed)
// ============================================

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    padding: "1rem",
  } as React.CSSProperties,
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "0.75rem",
    padding: "2rem",
    width: "100%",
    maxWidth: "24rem",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  } as React.CSSProperties,
  logo: {
    textAlign: "center" as const,
    marginBottom: "2rem",
  } as React.CSSProperties,
  logoText: {
    fontSize: "1.875rem",
    fontWeight: "bold",
    color: "#f1f5f9",
  } as React.CSSProperties,
  logoSubtext: {
    color: "#94a3b8",
    fontSize: "0.875rem",
    marginTop: "0.25rem",
  } as React.CSSProperties,
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  } as React.CSSProperties,
  inputGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  } as React.CSSProperties,
  label: {
    color: "#94a3b8",
    fontSize: "0.875rem",
    fontWeight: "500",
  } as React.CSSProperties,
  input: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "0.5rem",
    padding: "0.75rem 1rem",
    color: "#f1f5f9",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.2s",
  } as React.CSSProperties,
  button: {
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    fontWeight: "600",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    transition: "background-color 0.2s",
  } as React.CSSProperties,
  buttonDisabled: {
    backgroundColor: "#1e40af",
    cursor: "not-allowed",
    opacity: 0.7,
  } as React.CSSProperties,
  secondaryButton: {
    backgroundColor: "transparent",
    border: "1px solid #334155",
    color: "#f1f5f9",
    fontWeight: "500",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    cursor: "pointer",
    fontSize: "1rem",
    transition: "background-color 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
  } as React.CSSProperties,
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    color: "#64748b",
    fontSize: "0.875rem",
  } as React.CSSProperties,
  dividerLine: {
    flex: 1,
    height: "1px",
    backgroundColor: "#334155",
  } as React.CSSProperties,
  error: {
    backgroundColor: "#7f1d1d",
    color: "#fecaca",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
  } as React.CSSProperties,
  success: {
    backgroundColor: "#14532d",
    color: "#bbf7d0",
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
  } as React.CSSProperties,
  link: {
    color: "#60a5fa",
    textDecoration: "none",
    cursor: "pointer",
    fontSize: "0.875rem",
  } as React.CSSProperties,
  footer: {
    marginTop: "1.5rem",
    textAlign: "center" as const,
    color: "#94a3b8",
    fontSize: "0.875rem",
  } as React.CSSProperties,
};

// ============================================
// ICONS
// ============================================

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

// ============================================
// LOGIN COMPONENT
// ============================================

export function Login() {
  const { signIn, signUp, signInWithGoogle, signInWithGitHub, resetPassword, error, clearError, isLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Clear messages when switching modes
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    clearError();
    setSuccessMessage("");
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMessage("");

    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else if (mode === "signup") {
        await signUp(email, password, name || undefined);
        setSuccessMessage("Account created! Please check your email to verify.");
      } else if (mode === "reset") {
        await resetPassword(email);
        setSuccessMessage("Password reset email sent! Check your inbox.");
      }
    } catch {
      // Error is handled by AuthContext
    }
  };

  // Get title based on mode
  const getTitle = () => {
    switch (mode) {
      case "signin":
        return "Welcome back";
      case "signup":
        return "Create account";
      case "reset":
        return "Reset password";
    }
  };

  // Get button text based on mode
  const getButtonText = () => {
    if (isLoading) return "Please wait...";
    switch (mode) {
      case "signin":
        return "Sign in";
      case "signup":
        return "Create account";
      case "reset":
        return "Send reset link";
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoText}>🏢 AgencyOS</div>
          <div style={styles.logoSubtext}>{getTitle()}</div>
        </div>

        {/* Error message */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Success message */}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Name field (signup only) */}
          {mode === "signup" && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={styles.input}
              />
            </div>
          )}

          {/* Email field */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
          </div>

          {/* Password field (not for reset) */}
          {mode !== "reset" && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                style={styles.input}
              />
            </div>
          )}

          {/* Forgot password link (signin only) */}
          {mode === "signin" && (
            <div style={{ textAlign: "right" }}>
              <span style={styles.link} onClick={() => switchMode("reset")}>
                Forgot password?
              </span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.button,
              ...(isLoading ? styles.buttonDisabled : {}),
            }}
          >
            {getButtonText()}
          </button>
        </form>

        {/* OAuth providers (not for reset) */}
        {mode !== "reset" && (
          <>
            <div style={{ ...styles.divider, marginTop: "1.5rem", marginBottom: "1.5rem" }}>
              <div style={styles.dividerLine}></div>
              <span>or continue with</span>
              <div style={styles.dividerLine}></div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={signInWithGoogle}
                style={{ ...styles.secondaryButton, flex: 1 }}
              >
                <GoogleIcon />
                Google
              </button>
              <button
                type="button"
                onClick={signInWithGitHub}
                style={{ ...styles.secondaryButton, flex: 1 }}
              >
                <GitHubIcon />
                GitHub
              </button>
            </div>
          </>
        )}

        {/* Mode switcher */}
        <div style={styles.footer}>
          {mode === "signin" && (
            <>
              Don't have an account?{" "}
              <span style={styles.link} onClick={() => switchMode("signup")}>
                Sign up
              </span>
            </>
          )}
          {mode === "signup" && (
            <>
              Already have an account?{" "}
              <span style={styles.link} onClick={() => switchMode("signin")}>
                Sign in
              </span>
            </>
          )}
          {mode === "reset" && (
            <>
              Remember your password?{" "}
              <span style={styles.link} onClick={() => switchMode("signin")}>
                Sign in
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Export default
export default Login;
