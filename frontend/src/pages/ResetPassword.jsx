import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 12;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/;
const DIGIT_REGEX = /\d/;

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const navigate = useNavigate();

  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    setIsDark(theme === 'dark');

    const verifySession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        setErrors(['Invalid or expired reset link. Please request a new one.']);
        setTimeout(() => navigate('/forgot-password'), 3000);
      }
    };
    
    verifySession();
  }, [navigate]);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setIsDark(!isDark);
  };

  const validatePassword = (pwd) => {
    const errs = [];
    if (pwd.length < MIN_PASSWORD_LENGTH)
      errs.push(`Minimum ${MIN_PASSWORD_LENGTH} characters.`);
    if (pwd.length > MAX_PASSWORD_LENGTH)
      errs.push(`Maximum ${MAX_PASSWORD_LENGTH} characters.`);
    if (!DIGIT_REGEX.test(pwd))
      errs.push('Include at least one number.');
    if (!SPECIAL_CHAR_REGEX.test(pwd))
      errs.push('Include at least one special character.');

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setMessage('');
  
    if (password !== confirmPassword) {
      setErrors(['Passwords do not match.']);
      return;
    }
  
    const pwdErrors = validatePassword(password);
    if (pwdErrors.length > 0) {
      setErrors(pwdErrors);
      return;
    }
  
    setLoading(true);
  
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });
  
      if (error) {
        setErrors([error.message]);
        setLoading(false);
        return;
      }
  
      setMessage('Password successfully updated! Redirecting to login...');
      
      // Sign out after password reset (best practice)
      await supabase.auth.signOut();
      
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setErrors([err.message || 'An error occurred']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 transition-colors duration-300">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400"
        aria-label="Toggle theme"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <form
        onSubmit={handleSubmit}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-14 rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200/50 dark:border-slate-700/50"
      >
        <h2 className="text-4xl font-bold text-center mb-6 text-accent-900 dark:text-accent-200 font-serif">
          Reset Password
        </h2>

        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2 text-accent-900 dark:text-accent-200">
            New Password
          </label>
          <input
            type="password"
            className="w-full p-4 text-xl border border-accent-400 rounded-lg dark:bg-gray-700 dark:text-white bg-accent-50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2 text-accent-900 dark:text-accent-200">
            Confirm Password
          </label>
          <input
            type="password"
            className="w-full p-4 text-xl border border-accent-400 rounded-lg dark:bg-gray-700 dark:text-white bg-accent-50"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <small className="block mb-4 text-accent-800 dark:text-accent-200">
          Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters,
          include numbers and special characters.
        </small>

        {errors.length > 0 && (
          <ul className="mb-4 text-red-600 list-disc list-inside">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}

        {message && (
          <p className="mb-4 text-green-600 text-center">{message}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full p-4 rounded-lg font-semibold text-white text-xl ${
            loading
              ? 'bg-accent-400'
              : 'bg-accent-700 hover:bg-accent-800'
          }`}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
