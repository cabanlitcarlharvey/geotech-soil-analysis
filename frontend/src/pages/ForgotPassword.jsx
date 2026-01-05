import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle, XCircle } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Password reset link sent! Check your email inbox.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 flex items-center justify-center transition-colors duration-300 px-4">
      <div className="bg-white/95 dark:bg-gray-800/95 p-10 rounded-3xl shadow-2xl w-full max-w-md border border-amber-700 dark:border-amber-600 backdrop-blur-sm">
        {/* Back Button */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Login</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-amber-700 dark:text-amber-300" />
          </div>
          <h2 className="text-3xl font-bold text-amber-900 dark:text-amber-200 font-serif mb-2">
            Forgot Password?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleReset} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2 text-amber-900 dark:text-amber-200">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 text-base border border-amber-400 dark:border-amber-600 rounded-lg dark:bg-gray-700 dark:text-white bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-lg flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                  {message}
                </p>
                <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                  The link will expire in 1 hour.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full p-3 rounded-lg font-semibold text-white transition-all duration-300 ${
              loading
                ? 'bg-amber-400 cursor-not-allowed'
                : 'bg-amber-700 hover:bg-amber-800 transform hover:scale-[1.02]'
            }`}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        {/* Additional Info */}
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Remember your password?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-amber-700 dark:text-amber-300 font-semibold hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;