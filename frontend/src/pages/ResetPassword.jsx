import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  useEffect(() => {
    const verifySession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        setErrors(['Invalid or expired reset link. Please request a new one.']);
        setTimeout(() => navigate('/forgot-password'), 3000);
      }
    };
    
    verifySession();
  }, [navigate]);

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
      <form
        onSubmit={handleSubmit}
        className="bg-white/95 dark:bg-gray-800/95 p-14 rounded-3xl shadow-2xl w-full max-w-xl border border-amber-700"
      >
        <h2 className="text-4xl font-bold text-center mb-6 text-amber-900 dark:text-amber-200 font-serif">
          Reset Password
        </h2>

        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2 text-amber-900 dark:text-amber-200">
            New Password
          </label>
          <input
            type="password"
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white bg-amber-50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2 text-amber-900 dark:text-amber-200">
            Confirm Password
          </label>
          <input
            type="password"
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white bg-amber-50"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <small className="block mb-4 text-amber-800 dark:text-amber-200">
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
              ? 'bg-amber-400'
              : 'bg-amber-700 hover:bg-amber-800'
          }`}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
