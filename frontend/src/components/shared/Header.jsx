/* eslint-disable no-unused-vars */
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, Home, History, Beaker } from 'lucide-react';

/**
 * Reusable Header Component for Staff Portal
 * @param {Object} props
 * @param {boolean} props.isDark - Dark mode state
 * @param {Function} props.toggleTheme - Function to toggle theme
 * @param {Function} props.onLogout - Function to handle logout
 * @param {string} props.currentPage - Current page identifier (optional)
 */
function Header({ isDark, toggleTheme, onLogout, currentPage = 'home' }) {
  const navigate = useNavigate();

  const navigationButtons = [
    {
      id: 'home',
      icon: Home,
      label: 'Home',
      onClick: () => navigate('/engineer-home'),
      hoverColor: 'amber',
      title: 'Go to Home'
    },
    {
      id: 'analysis',
      icon: Beaker,
      label: 'Soil Analysis',
      onClick: () => navigate('/soil-analysis'),
      hoverColor: 'blue',
      title: 'Start Soil Analysis'
    },
    {
      id: 'history',
      icon: History,
      label: 'History',
      onClick: () => navigate('/engineer-history'),
      hoverColor: 'green',
      title: 'View Analysis History'
    }
  ];


  return (
    <header 
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm border-b border-slate-200/50 dark:border-slate-700/50 px-6 lg:px-8 py-4 flex justify-between items-center sticky top-0 z-50 transition-all duration-300" 
    >
      {/* Logo and Title */}
      <div
        className="flex items-center gap-3 cursor-pointer group transition-transform duration-300 hover:scale-105"
        onClick={() => navigate('/engineer-home')}
        title="Go to Staff Home"
        tabIndex={0}
        role="button"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/engineer-home'); }}
        aria-label="Go to Engineer Home"
      >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
          <svg width="24" height="24" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#ffffff" opacity="0.9" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#ffffff" opacity="0.7" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#ffffff" opacity="0.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-sans">
          GeoTech Portal
        </h1>
      </div>
  
      {/* Navigation Buttons */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          aria-label="Toggle theme"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
  
        {/* Navigation Buttons */}
        {navigationButtons.map(({ id, icon: Icon, onClick, title }) => (
          <button
            key={id}
            onClick={onClick}
            className={`p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 ${
              currentPage === id 
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label={title}
            title={title}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
  
        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="p-2.5 rounded-lg text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"
          aria-label="Log out"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

export default Header;