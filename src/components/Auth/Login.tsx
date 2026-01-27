/**
 * Login Component for AgencyOS
 *
 * Provides a complete authentication UI with:
 * - Email/password sign in and sign up
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
// LOGIN COMPONENT
// ============================================

export function Login() {
  const { signIn, signUp, resetPassword, error, clearError, isLoading } = useAuth();

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
