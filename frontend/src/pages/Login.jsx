import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Home } from 'lucide-react';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // ✅ SIMPLIFIED: Only set theme, let ProtectedRoute handle session
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    
    // Quick check: if already logged in, redirect
    const quickCheck = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', session.user.id)
          .single();

        if (profile?.status === 'APPROVED') {
          if (profile.role === 'admin') {
            navigate('/admin-dashboard', { replace: true });
          } else if (profile.role === 'engineer') {
            navigate('/engineer-home', { replace: true });
          } else if (profile.role === 'expert') {
            navigate('/expert-home', { replace: true });
          }
        }
      }
      setCheckingSession(false);
    };
    
    quickCheck();
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password
      });
      
      if (signInError) throw signInError;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      if (!data.user.email_confirmed_at) {
        setError('Please verify your email before logging in.');
        await supabase.auth.signOut(); // Sign out unverified user
        return;
      }
      
      if (profile.status !== 'APPROVED') {
        setError('Account pending approval by admin.');
        await supabase.auth.signOut(); // Sign out unapproved user
        return;
      }

      // Redirect based on role
      if (profile.role === 'engineer') {
        navigate('/engineer-home', { replace: true });
      } else if (profile.role === 'expert') {
        navigate('/expert-home', { replace: true });
      } else if (profile.role === 'admin') {
        navigate('/admin-dashboard', { replace: true });
      } else {
        setError('User role not recognized.');
        await supabase.auth.signOut();
      }

    } catch (err) {
      setError(err.message || 'Failed to login.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking session
  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-geotech-600 mx-auto mb-4"></div>
          <p className="text-xl text-geotech-900 dark:text-geotech-200 font-semibold">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <button
      onClick={() => navigate('/')}
      className="fixed top-4 left-4 z-50 p-3 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-2"
      aria-label="Back to home"
      title="Back to Home"
    >
      <Home className="w-5 h-5" />
      <span className="hidden sm:inline text-sm font-medium">Home</span>
    </button>
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-8 sm:p-12 rounded-2xl shadow-xl w-full max-w-md transition-all border border-slate-200/50 dark:border-slate-700/50"
      >
        <div className="flex flex-col items-center mb-8">
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg mb-6">
            <svg width="48" height="48" fill="none" viewBox="0 0 48 48" aria-hidden>
              <ellipse cx="24" cy="40" rx="18" ry="6" fill="#ffffff" opacity="0.9" />
              <ellipse cx="24" cy="34" rx="14" ry="5" fill="#ffffff" opacity="0.7" />
              <ellipse cx="24" cy="28" rx="10" ry="4" fill="#ffffff" opacity="0.5" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-center mb-2 text-slate-900 dark:text-slate-100 font-sans">
            GeoTech Soil Analysis
          </h2>
          <p className="text-center text-base text-slate-600 dark:text-slate-400 mb-6 max-w-prose">
            Empowering soil experts and engineers for a sustainable future.
          </p>
        </div>
  
        <div className="mb-5">
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="your.email@example.com"
            className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            required
          />
        </div>
  
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
          >
            Password
          </label>
  
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-4 py-3 pr-12 text-base border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              required
            />
  
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
          </div>
        </div>
  
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-lg font-semibold text-white text-base transition-all duration-200 ${
            loading 
              ? 'bg-primary-400 cursor-not-allowed' 
              : 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98] shadow-lg shadow-primary-500/30'
          }`}
        >
          {loading ? 'Logging in...' : 'Sign In'}
        </button>
  
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}
  
        <div className="mt-6 text-center space-y-3">
          <p className="text-sm">
            <Link 
              to="/forgot-password" 
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </p>
  
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold transition-colors"
            >
              Register
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;