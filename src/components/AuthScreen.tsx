import React, { useState } from 'react';
import { Lock, ShieldCheck, Key, Eye, EyeOff, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  isSetup: boolean;
  onAuthenticated: (token: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ isSetup, onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'setup'>(isSetup ? 'login' : 'setup');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your passcode or master password.');
      return;
    }

    if (mode === 'setup') {
      if (password.length < 4) {
        setError('Password must be at least 4 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'setup' ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify your credentials.');
      }

      if (data.token) {
        onAuthenticated(data.token);
      } else {
        throw new Error('No session token returned from server.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-neutral-100 flex flex-col items-center justify-center p-4 selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Frosted glow highlight orbs */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl mb-4 text-blue-400 ring-2 ring-white/10">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Daily Accomplishments</h1>
          <p className="text-sm text-neutral-300 mt-1">
            Protected Security Checkpoint
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-dark rounded-3xl p-6 sm:p-8">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-neutral-200">
                {mode === 'login' ? 'Master Password Required' : 'Setup Master Passcode'}
              </span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-medium border border-blue-400/30">
              STRICT AUTH
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/70 backdrop-blur-md border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
              <span className="font-bold text-red-400">!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                {mode === 'login' ? 'Enter Passcode' : 'Create New Passcode'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? '••••••••' : 'Enter 4+ character password'}
                  autoFocus
                  required
                  className="w-full bg-black/40 backdrop-blur-md border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'setup' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                  Confirm Passcode
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full bg-black/40 backdrop-blur-md border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-blue-600/90 hover:bg-blue-600 active:scale-98 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 border border-blue-400/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Session...
                </>
              ) : mode === 'login' ? (
                <>
                  <Key className="w-4 h-4" />
                  Unlock Dashboard
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Initialize Master Key
                </>
              )}
            </button>
          </form>

          {/* Toggle setup mode */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === 'login' ? 'setup' : 'login');
              }}
              className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors underline cursor-pointer"
            >
              {mode === 'login' ? 'Set a custom master password' : 'Back to login'}
            </button>
          </div>
        </div>

        {/* Security notice */}
        <p className="text-center text-xs text-neutral-500 mt-6">
          Strict Security Checkpoint enforced by <code className="text-neutral-400 font-mono">middleware.ts</code>
        </p>
      </div>
    </div>
  );
};
