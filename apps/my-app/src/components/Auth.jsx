// src/auth/AuthGate.jsx
import React from "react";
import { User as UserEntity } from "@/api/entities";
import mixpanel from "../../../../lib/mixpanel";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Briefcase, AlertTriangle, Loader2 } from "lucide-react";

export const AuthContext = React.createContext(null);
export const useAuth = () => React.useContext(AuthContext);

export default function AuthGate({ children }) {
  const [user, setUser] = React.useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);

  // form state (moved from Layout)
  const [mode, setMode] = React.useState("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await UserEntity.me();
        setUser(currentUser);
      } catch {
        setUser(null);
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await UserEntity.logout();
    } catch {}
    setUser(null);
    window.location.href = "/";
  };

  const handleLogin = async (emailArg, passwordArg) => {
    try {
      await UserEntity.login("dev", emailArg, passwordArg);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const handleSignup = async (nameArg, emailArg, passwordArg) => {
    try {
      await UserEntity.signUp("email", emailArg, passwordArg, nameArg);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setIsGoogleLoading(true);
      await UserEntity.login("google");
    } catch (e) {
      setError("Google sign-in failed. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  const resetErrors = () => setError(null);

  const submit = async (e) => {
    e.preventDefault();
    resetErrors();

    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (mode === "signup") {
      if (!name) {
        setError("Please enter your name.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    try {
      setIsLoading(true);
      const res =
        mode === "login"
          ? await handleLogin(email, password)
          : await handleSignup(name, email, password);

      if (!res.ok) throw new Error("Invalid credentials.");

      const currentUser = await UserEntity.me();
      if (currentUser) {
        setUser(currentUser);
        mixpanel.identify(currentUser?.id);
        mixpanel.people.set({
          $email: currentUser?.email,
          plan: currentUser?.user_metadata?.role ?? "trial",
        });
      }
      mixpanel.track("Signup or Login", { "Signup Type": "Email" });
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // While checking, show the spinner (kept from original)
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center pt-32">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // If logged in, provide context + render children (Layout and pages)
  if (user) {
    return (
      <AuthContext.Provider value={{ user, handleLogout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Otherwise render the existing auth UI (moved here 1:1)
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/50 p-8">
          {/* Card Header with Company Name */}
          <div className="flex justify-center mb-6">
            {import.meta.env.APP_LOGO || import.meta.env.VITE_APP_LOGO ? (
              <img 
                src={import.meta.env.APP_LOGO || import.meta.env.VITE_APP_LOGO} 
                alt="Logo" 
                className="w-14 h-14 object-contain rounded-2xl"
              />
            ) : (
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 rounded-2xl shadow-sm">
                <Briefcase className="w-7 h-7 text-white" />
              </div>
            )}
          </div>

          <div className="text-center mb-8">
            <h1 className="text-[28px] font-semibold text-gray-900 mb-4">
            {import.meta.env.APP_NAME || import.meta.env.VITE_APP_NAME ? (import.meta.env.APP_NAME || import.meta.env.VITE_APP_NAME) : "OwnMyApp"}  
            </h1>
            <h3 className="text-[20px] font-semibold tracking-[-0.5px] text-gray-900 mb-2">
            {mode === "login" ? "Welcome back" : "Get started"}
          </h3>
            <p className="text-[13px] text-gray-500">
              {mode === "login" ? "Sign in to continue to your account" : "Create an account to get started"}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 mb-8 p-1 bg-gray-50 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                resetErrors();
              }}
              className={`flex-1 h-9 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                mode === "login" 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                resetErrors();
              }}
              className={`flex-1 h-9 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                mode === "signup" 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Sign up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-red-50/80 rounded-2xl border border-red-100">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-2xl bg-gray-50 border-0 text-[15px] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-0 px-4 transition-all duration-200"
                />
              </div>
            )}

            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 text-[15px] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-0 px-4 transition-all duration-200"
              />
            </div>

            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 text-[15px] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-0 px-4 transition-all duration-200"
              />
            </div>

            {mode === "signup" && (
              <div>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 rounded-2xl bg-gray-50 border-0 text-[15px] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-0 px-4 transition-all duration-200"
                />
              </div>
            )}

            <Button 
              type="submit" 
              disabled={isLoading} 
              className="w-full h-12 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white text-[15px] font-medium mt-6 shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                mode === "login" ? "Sign in" : "Create account"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-[13px] text-gray-400 font-medium">or</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* Google Sign In - Industry standard position (after form) */}
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full h-12 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl font-medium text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 shadow-sm hover:shadow"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                <span>Continuing...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-[12px] text-gray-400 mt-8 leading-relaxed">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-gray-600 hover:text-gray-900 underline underline-offset-2">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="text-gray-600 hover:text-gray-900 underline underline-offset-2">Privacy Policy</a>
          .
        </p>
      </div>
    </div>
  );
}
