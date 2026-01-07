import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
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
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-600 mx-auto mb-4"></div>
          <p className="text-xl text-amber-900 dark:text-amber-200 font-semibold">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      <form
        onSubmit={handleSubmit}
        className="bg-white/95 dark:bg-gray-800/95 p-16 rounded-3xl shadow-2xl w-full max-w-2xl transition-all border border-amber-700"
        style={{ backdropFilter: 'blur(6px)' }}
      >
        <div className="flex flex-col items-center mb-8">
          {/* Soil SVG Icon */}
          <svg width="96" height="96" fill="none" viewBox="0 0 48 48" aria-hidden>
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
          </svg>
          <h2 className="text-5xl font-bold text-center mb-4 text-amber-900 dark:text-amber-200 font-serif">
            GeoTech Soil Analysis
          </h2>
          <p className="text-center text-xl text-amber-800 dark:text-amber-100 mb-3 max-w-prose">
            Empowering soil experts and engineers for a sustainable future.
          </p>
        </div>

        <div className="mb-6">
          <label htmlFor="email" className="block text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="your.email@example.com"
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white dark:border-amber-600 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white dark:border-amber-600 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full p-4 rounded-lg font-semibold text-white text-xl transition-all duration-300 ${
            loading 
              ? 'bg-amber-400 cursor-not-allowed' 
              : 'bg-amber-700 hover:bg-amber-800 transform hover:scale-[1.02]'
          }`}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded">
            <p className="text-red-600 dark:text-red-300 text-base">{error}</p>
          </div>
        )}

        <div className="mt-6 text-center space-y-2">
          <p className="text-lg">
            <Link 
              to="/forgot-password" 
              className="text-amber-700 dark:text-amber-300 hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </p>

          <p className="text-lg text-amber-700 dark:text-amber-200">
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className="text-amber-800 dark:text-amber-300 hover:underline font-semibold"
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