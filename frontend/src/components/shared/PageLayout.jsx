import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import Header from './Header';
import ExpertHeader from './ExpertHeader';

/**
 * Enhanced Page Layout Component
 * Supports both Engineer and Expert portals
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @param {string} props.currentPage - Current page identifier
 * @param {boolean} props.requireAuth - Whether page requires authentication (default: true)
 * @param {string} props.userType - 'engineer' or 'expert' (auto-detected if not provided)
 */
function PageLayout({ children, currentPage = 'home', requireAuth = true, userType = null }) {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [detectedUserType, setDetectedUserType] = useState(userType);

  // Apply theme on mount and when changed
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Check authentication and detect user type
  useEffect(() => {
    if (requireAuth) {
      const checkAuth = async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!session) {
            navigate('/login');
            return;
          }

          // Auto-detect user type if not provided
          if (!userType) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();

            if (profile?.role) {
              setDetectedUserType(profile.role.toLowerCase());
            } else {
              // Fallback: detect based on current route
              const path = window.location.pathname;
              if (path.includes('expert')) {
                setDetectedUserType('expert');
              } else if (path.includes('engineer')) {
                setDetectedUserType('engineer');
              }
            }
          }
        } catch (err) {
          console.error('Auth check error:', err);
          navigate('/login');
        }
      };
      checkAuth();
    }
  }, [requireAuth, navigate, userType]);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setIsDark(!isDark);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      alert('Failed to log out.');
    }
  };

  // Use appropriate header based on user type
  const HeaderComponent = (detectedUserType || userType) === 'expert' ? ExpertHeader : Header;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <HeaderComponent
        isDark={isDark} 
        toggleTheme={toggleTheme} 
        onLogout={handleLogout}
        currentPage={currentPage}
      />
      
      <main className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 lg:px-8 pb-12">
        {children}
      </main>
    </div>
  );
}

export default PageLayout;