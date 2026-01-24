import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Home } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 12;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/;
const DIGIT_REGEX = /\d/;

const Register = () => {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'engineer' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const validatePassword = (pwd) => {
    const errs = [];
    if (pwd.length < MIN_PASSWORD_LENGTH) errs.push(`Minimum ${MIN_PASSWORD_LENGTH} characters.`);
    if (pwd.length > MAX_PASSWORD_LENGTH) errs.push(`Maximum ${MAX_PASSWORD_LENGTH} characters.`);
    if (!DIGIT_REGEX.test(pwd)) errs.push('Include at least one number.');
    if (!SPECIAL_CHAR_REGEX.test(pwd)) errs.push('Include at least one special character (e.g. !@#$%).');
    setPasswordErrors(errs);
    setIsPasswordValid(errs.length === 0);
    return errs.length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    if (name === 'password') {
      validatePassword(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
  
    if (!validatePassword(form.password)) {
      setError('Password does not meet requirements.');
      return;
    }
  
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });
  
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
  
      if (data.user) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: form.full_name,
          role: form.role,
          status: 'PENDING'
        });
  
        if (insertError) {
          setError(insertError.message);
          return;
        }
  
        setSuccess(
          'Registration successful! Please check your email to verify your account. After verification, wait for admin approval.'
        );
      }
  
    } catch (err) {
      setError(err.message || 'Unexpected error during registration.');
    }
  };

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
          {/* Logo - Same as Login */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg mb-6">
            <svg width="48" height="48" fill="none" viewBox="0 0 48 48" aria-hidden>
              <ellipse cx="24" cy="40" rx="18" ry="6" fill="#ffffff" opacity="0.9" />
              <ellipse cx="24" cy="34" rx="14" ry="5" fill="#ffffff" opacity="0.7" />
              <ellipse cx="24" cy="28" rx="10" ry="4" fill="#ffffff" opacity="0.5" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-center mb-2 text-slate-900 dark:text-slate-100 font-sans">
            Create Account
          </h2>
          <p className="text-center text-base text-slate-600 dark:text-slate-400 mb-6 max-w-prose">
            Join GeoTech Soil Analysis for smarter, sustainable soil solutions.
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Email
          </label>
          <input
            name="email"
            onChange={handleChange}
            placeholder="your.email@example.com"
            className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            required
            type="email"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Password
          </label>

          <div className="relative">
            <input
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

          <small className="block mt-2 text-xs text-slate-500 dark:text-slate-400">
            Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters, include numbers and a special character.
          </small>

          {passwordErrors.length > 0 && (
            <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
              {passwordErrors.map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Full Name
          </label>
          <input
            name="full_name"
            onChange={handleChange}
            placeholder="Full Name"
            className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Role
          </label>
          <select
            name="role"
            onChange={handleChange}
            className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            value={form.role}
          >
            <option value="engineer">Engineer</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={!isPasswordValid}
          className={`w-full py-3 rounded-lg font-semibold text-white text-base transition-all duration-200 ${
            isPasswordValid 
              ? 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98] shadow-lg shadow-primary-500/30' 
              : 'bg-slate-400 cursor-not-allowed'
          }`}
        >
          Sign Up
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded">
            <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link 
            to="/login" 
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold transition-colors"
          >
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;