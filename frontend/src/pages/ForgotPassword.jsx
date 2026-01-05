import { useState } from 'react';
import { supabase } from '../supabaseClient';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) setError(error.message);
    else setMessage('Password reset email sent. Check your inbox.');
  };

  return (
    <form onSubmit={handleReset} className="max-w-md mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Reset Password</h2>

      <input
        type="email"
        required
        placeholder="Your email"
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 border rounded mb-4"
      />

      <button className="w-full bg-amber-700 text-white p-3 rounded">
        Send Reset Link
      </button>

      {error && <p className="text-red-600 mt-3">{error}</p>}
      {message && <p className="text-green-600 mt-3">{message}</p>}
    </form>
  );
};

export default ForgotPassword;
