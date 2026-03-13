import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Hexagon, ArrowRight, X, Loader2, Github } from 'lucide-react';
import { authApi } from '@src/services/api';
import { useGoogleLogin } from '@react-oauth/google';

interface UserLoginProps {
  onLoginSuccess: (user: any) => void;
  onSwitchToSignup: () => void;
  onClose?: () => void;
}

const UserLogin: React.FC<UserLoginProps> = ({ onLoginSuccess, onSwitchToSignup, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'github' | 'discord' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });

      if (response.success && response.data.user) {
        // Include token in user data so App.tsx can use it for migrations
        const userWithToken = {
          ...response.data.user,
          token: response.data.token
        };
        onLoginSuccess(userWithToken);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      // Handle network errors specifically
      if (err.message === 'Failed to fetch' || err.name === 'TypeError' || err.message?.includes('fetch')) {
        const API_URL = ((import.meta as any)?.env?.VITE_API_URL) || 'http://localhost:3002';
        setError(`Unable to connect to the server. Please ensure the backend is running at ${API_URL}`);
      } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        setError('Invalid email or password. Please try again.');
        // Specifically handle AbortError
      } else if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        console.warn('[UserLogin] Request aborted');
        setError('Login request timed out. Please try again.');
      } else if (err.message?.includes('NetworkError') || err.message?.includes('network')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse: any) => {
    try {
      setSocialLoading('google');
      const API_URL = ((import.meta as any)?.env?.VITE_API_URL) || 'http://localhost:3002';
      
      const response = await fetch(`${API_URL}/api/auth/oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', credential: tokenResponse.access_token || tokenResponse.credential })
      });
      
      const data = await response.json();
      if (data.success && data.data?.token) {
        localStorage.setItem('token', data.data.token);
        onLoginSuccess({ ...data.data.user, token: data.data.token });
      } else {
        throw new Error(data.message || 'Google authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setSocialLoading(null);
    }
  };

  const loginGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google Login Failed')
  });

  const handleGoogleSignIn = () => {
    setError(null);
    loginGoogle();
  };

  const handleGithubSignIn = () => {
    setError(null);
    setSocialLoading('github');
    const clientId = (import.meta as any)?.env?.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      setError('GitHub authentication is not properly configured.');
      setSocialLoading(null);
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=github`;
  };

  const handleDiscordSignIn = () => {
    setError(null);
    setSocialLoading('discord');
    const clientId = (import.meta as any)?.env?.VITE_DISCORD_CLIENT_ID;
    if (!clientId) {
      setError('Discord authentication is not properly configured.');
      setSocialLoading(null);
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20email&state=discord`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md relative" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors z-10 p-2 hover:bg-white/10 rounded-lg backdrop-blur-sm"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
          {/* Minimalist Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Hexagon className="text-white" size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
                <p className="text-sm text-slate-500">Sign in to your account</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50/80 border border-red-200/50 rounded-xl p-3 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm leading-snug">{error}</p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all duration-200"
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-12 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all duration-200"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group mt-6"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Social Login Buttons */}
            <div className="space-y-3 mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white/95 text-sm text-slate-500">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading || socialLoading !== null}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl text-slate-700 font-semibold transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Continue with Google"
                >
                  {socialLoading === 'google' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                </button>

                {/* GitHub Sign In */}
                <button
                  type="button"
                  onClick={handleGithubSignIn}
                  disabled={loading || socialLoading !== null}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#24292e] hover:bg-[#1b1f23] border-2 border-[#24292e] rounded-xl text-white font-semibold transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Continue with GitHub"
                >
                  {socialLoading === 'github' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Github size={20} />
                  )}
                </button>

                {/* Discord Sign In */}
                <button
                  type="button"
                  onClick={handleDiscordSignIn}
                  disabled={loading || socialLoading !== null}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#5865F2] hover:bg-[#4752C4] border-2 border-[#5865F2] rounded-xl text-white font-semibold transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                   title="Continue with Discord"
                >
                  {socialLoading === 'discord' ? (
                    <Loader2 size={18} className="animate-spin text-white" />
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 127.14 96.36">
                      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.2,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-white/95 text-sm text-slate-500">New to OrbitAI?</span>
              </div>
            </div>

            {/* Switch to Signup */}
            <button
              onClick={onSwitchToSignup}
              className="w-full border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 hover:text-blue-600 font-semibold py-3 px-4 rounded-xl transition-all duration-200"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;
