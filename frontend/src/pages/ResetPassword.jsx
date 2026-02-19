import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 12;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/;
const DIGIT_REGEX = /\d/;

// Bago - tumatarget lang ng actual emoji, hindi digits/symbols:
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

// Strips all emoji from a string
const stripEmoji = (value) => value.replace(/\p{Extended_Pictographic}/gu, "");

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emojiWarning, setEmojiWarning] = useState("");
  const [isDark, setIsDark] = useState(
    localStorage.getItem("theme") === "dark",
  );

  const [isReady, setIsReady] = useState(false);
  const [isInvalidLink, setIsInvalidLink] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const theme = localStorage.getItem("theme") || "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    setIsDark(theme === "dark");

    const hasRecoveryParams = () => {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const hasAccessToken = hash.includes("access_token=");
      const hasRefreshToken = hash.includes("refresh_token=");
      const hasCode = search.includes("code=");
      return hasAccessToken || hasRefreshToken || hasCode;
    };

    let mounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        setIsReady(true);
      }
    });

    const verifySession = async () => {
      try {
        await new Promise((r) => setTimeout(r, 400));

        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;

        if (session) {
          if (mounted) setIsReady(true);
          return;
        }

        if (hasRecoveryParams()) {
          await new Promise((r) => setTimeout(r, 900));

          const { data: data2 } = await supabase.auth.getSession();
          if (data2?.session) {
            if (mounted) setIsReady(true);
            return;
          }

          if (mounted) {
            setIsInvalidLink(true);
            setErrors([
              "Invalid or expired reset link. Please request a new one.",
            ]);
          }
          return;
        }

        if (error || !session) {
          if (mounted) {
            setIsInvalidLink(true);
            setErrors([
              "Invalid reset session. Please request a new reset link.",
            ]);
          }
        }
      } catch (e) {
        if (mounted) {
          setIsInvalidLink(true);
          setErrors([
            "Something went wrong verifying your reset link. Please request a new one.",
          ]);
        }
      }
    };

    verifySession();

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (isInvalidLink) {
      const t = setTimeout(() => navigate("/forgot-password"), 3000);
      return () => clearTimeout(t);
    }
  }, [isInvalidLink, navigate]);

  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    setIsDark(!isDark);
  };

  const validatePassword = (pwd) => {
    const errs = [];
    if (pwd.length < MIN_PASSWORD_LENGTH)
      errs.push(`Minimum ${MIN_PASSWORD_LENGTH} characters.`);
    if (pwd.length > MAX_PASSWORD_LENGTH)
      errs.push(`Maximum ${MAX_PASSWORD_LENGTH} characters.`);
    if (!DIGIT_REGEX.test(pwd)) errs.push("Include at least one number.");
    if (!SPECIAL_CHAR_REGEX.test(pwd))
      errs.push("Include at least one special character.");
    return errs;
  };

  const handlePasswordChange = (e) => {
    const { value } = e.target;
    if (EMOJI_REGEX.test(value)) {
      setEmojiWarning("Emoji are not allowed in the password fields.");
      setPassword(stripEmoji(value));
      return;
    }
    setEmojiWarning("");
    setPassword(value);
  };

  const handleConfirmPasswordChange = (e) => {
    const { value } = e.target;
    if (EMOJI_REGEX.test(value)) {
      setEmojiWarning("Emoji are not allowed in the password fields.");
      setConfirmPassword(stripEmoji(value));
      return;
    }
    setEmojiWarning("");
    setConfirmPassword(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setMessage("");

    if (!isReady) {
      setErrors(["Please wait… still validating your reset link."]);
      return;
    }

    // Final safety check before submit
    if (EMOJI_REGEX.test(password) || EMOJI_REGEX.test(confirmPassword)) {
      setErrors(["Emoji are not allowed in the password fields."]);
      return;
    }

    if (password !== confirmPassword) {
      setErrors(["Passwords do not match."]);
      return;
    }

    const pwdErrors = validatePassword(password);
    if (pwdErrors.length > 0) {
      setErrors(pwdErrors);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrors([error.message]);
        return;
      }

      setMessage("Password successfully updated! Redirecting to login...");

      await supabase.auth.signOut();

      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setErrors([err?.message || "An error occurred"]);
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
        {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      <form
        onSubmit={handleSubmit}
        className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-14 rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200/50 dark:border-slate-700/50"
      >
        <h2 className="text-4xl font-bold text-center mb-6 text-accent-900 dark:text-accent-200 font-serif">
          Reset Password
        </h2>

        {!isReady && !isInvalidLink && (
          <p className="mb-4 text-center text-slate-600 dark:text-slate-300">
            Preparing your reset link…
          </p>
        )}

        {/* Emoji Warning */}
        {emojiWarning && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded">
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              ⚠️ {emojiWarning}
            </p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2 text-accent-900 dark:text-accent-200">
            New Password
          </label>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full p-4 pr-14 text-xl border border-accent-400 rounded-lg dark:bg-gray-700 dark:text-white bg-accent-50"
              value={password}
              onChange={handlePasswordChange}
              required
              disabled={!isReady}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-4 flex items-center text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <Eye className="w-6 h-6" />
              ) : (
                <EyeOff className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-lg font-semibold mb-2 text-accent-900 dark:text-accent-200">
            Confirm Password
          </label>

          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="w-full p-4 pr-14 text-xl border border-accent-400 rounded-lg dark:bg-gray-700 dark:text-white bg-accent-50"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              required
              disabled={!isReady}
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute inset-y-0 right-4 flex items-center text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
            >
              {showConfirmPassword ? (
                <Eye className="w-6 h-6" />
              ) : (
                <EyeOff className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        <small className="block mb-4 text-accent-800 dark:text-accent-200">
          Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH}{" "}
          characters, include numbers and special characters.
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
          disabled={loading || !isReady}
          className={`w-full p-4 rounded-lg font-semibold text-white text-xl ${
            loading || !isReady
              ? "bg-accent-400 cursor-not-allowed"
              : "bg-accent-700 hover:bg-accent-800"
          }`}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
