import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';

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
        setSuccess('Registration successful! Please wait for admin approval before logging in.');

        setTimeout(() => {
          navigate('/');
        }, 5000);
      }
    } catch (err) {
      setError(err.message || 'Unexpected error during registration.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      <form
        onSubmit={handleSubmit}
        className="bg-white/95 dark:bg-gray-800/95 p-14 rounded-3xl shadow-2xl w-max max-w-2xl transition-all border border-amber-700"
        style={{ backdropFilter: 'blur(6px)' }}
      >
        <div className="flex flex-col items-center mb-8">
          <svg width="96" height="96" fill="none" viewBox="0 0 48 48">
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
          </svg>

          <h2 className="text-5xl font-bold text-center mb-3 text-amber-900 dark:text-amber-200 font-serif">
            Create Account
          </h2>
          <p className="text-center text-xl text-amber-800 dark:text-amber-100 max-w-prose">
            Join GeoTech Soil Analysis for smarter, sustainable soil solutions.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
            Email
          </label>
          <input
            name="email"
            onChange={handleChange}
            placeholder="Email"
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white dark:border-amber-600 bg-amber-50"
            required
            type="email"
          />
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
            Password
          </label>
          <input
            type="password"
            name="password"
            onChange={handleChange}
            placeholder="Password"
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white dark:border-amber-600 bg-amber-50"
            required
          />

          <small className="block mt-2 text-base text-amber-800 dark:text-amber-200">
            Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters, include numbers and a special character.
          </small>

          {passwordErrors.length > 0 && (
            <ul className="mt-2 text-base text-red-600 list-disc list-inside">
              {passwordErrors.map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
            Full Name
          </label>
          <input
            name="full_name"
            onChange={handleChange}
            placeholder="Full Name"
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white dark:border-amber-600 bg-amber-50"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
            Role
          </label>
          <select
            name="role"
            onChange={handleChange}
            className="w-full p-4 text-xl border border-amber-400 rounded-lg dark:bg-gray-700 dark:text-white dark:border-amber-600 bg-amber-50"
            value={form.role}
          >
            <option value="engineer">Engineer</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={!isPasswordValid}
          className={`w-full p-4 rounded-lg font-semibold text-white text-xl ${isPasswordValid ? 'bg-amber-700 hover:bg-amber-800' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          Sign Up
        </button>

        {error && <p className="text-red-600 mt-4 text-lg text-center">{error}</p>}
        {success && <p className="text-green-700 mt-4 text-lg text-center">{success}</p>}

        <p className="mt-6 text-center text-lg text-amber-700 dark:text-amber-200">
          Already have an account?{' '}
          <Link to="/" className="text-amber-800 hover:underline dark:text-amber-300">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
