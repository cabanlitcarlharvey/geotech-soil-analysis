import { useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, Home, BarChart2 } from 'lucide-react';

/**
 * Reusable Header Component for Expert Portal
 * @param {Object} props
 * @param {boolean} props.isDark - Dark mode state
 * @param {Function} props.toggleTheme - Function to toggle theme
 * @param {Function} props.onLogout - Function to handle logout
 * @param {string} props.currentPage - Current page identifier (optional)
 */
function ExpertHeader({ isDark, toggleTheme, onLogout, currentPage = 'home' }) {
  const navigate = useNavigate();

  const navigationButtons = [
    {
      id: 'home',
      icon: Home,
      label: 'Home',
      onClick: () => navigate('/expert-home'),
      hoverColor: 'amber',
      title: 'Go to Home'
    },
    {
      id: 'dashboard',
      icon: BarChart2,
      label: 'Dashboard',
      onClick: () => navigate('/expert-dashboard'),
      hoverColor: 'green',
      title: 'Validation Dashboard'
    }
  ];

  const getHoverClasses = (color) => {
    const colorMap = {
      amber: 'hover:bg-amber-200 dark:hover:bg-amber-800 focus:ring-amber-500',
      green: 'hover:bg-green-200 dark:hover:bg-green-800 focus:ring-green-500',
      red: 'hover:bg-red-100 dark:hover:bg-red-800 focus:ring-red-500'
    };
    return colorMap[color] || colorMap.amber;
  };

  return (
    <header 
      className="bg-white/95 dark:bg-gray-800/95 shadow px-8 py-6 flex justify-between items-center border-b border-amber-700 transition-all duration-300" 
      style={{ backdropFilter: 'blur(4px)' }}
    >
      {/* Logo and Title */}
      <div
        className="flex items-center gap-3 cursor-pointer group transition-transform duration-300 hover:scale-105"
        onClick={() => navigate('/expert-home')}
        title="Go to Expert Home"
        tabIndex={0}
        role="button"
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/expert-home'); }}
        aria-label="Go to Expert Home"
      >
        <svg width="44" height="44" fill="none" viewBox="0 0 48 48" aria-hidden="true">
          <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
          <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
          <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
        </svg>
        <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-200 font-serif">
          Geotech Expert Portal
        </h1>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-300 ${getHoverClasses('amber')}`}
          aria-label="Toggle theme"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
        </button>

        {/* Navigation Buttons */}
        {navigationButtons.map(({ id, icon: Icon, onClick, hoverColor, title }) => (
          <button
            key={id}
            onClick={onClick}
            className={`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-300 ${getHoverClasses(hoverColor)} ${
              currentPage === id ? 'bg-amber-100 dark:bg-amber-900' : ''
            }`}
            aria-label={title}
            title={title}
          >
            <Icon className="w-6 h-6" />
          </button>
        ))}

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className={`p-3 rounded-full text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-300 ${getHoverClasses('red')}`}
          aria-label="Log out"
          title="Logout"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
}

export default ExpertHeader;