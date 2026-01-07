import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ProtectedRoute = ({ children, requiredRole }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          if (isMounted) {
            setIsAuthorized(false);
            setLoading(false);
          }
          return;
        }

        // Get user profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', session.user.id)
          .single();

        if (error || !profile) {
          if (isMounted) {
            setIsAuthorized(false);
            setLoading(false);
          }
          return;
        }

        // Check if approved
        if (profile.status !== 'APPROVED') {
          if (isMounted) {
            setIsAuthorized(false);
            setLoading(false);
          }
          return;
        }

        // Check role
        if (requiredRole && profile.role !== requiredRole) {
          if (isMounted) {
            setIsAuthorized(false);
            setLoading(false);
          }
          return;
        }

        // All checks passed
        if (isMounted) {
          setIsAuthorized(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth error:', err);
        if (isMounted) {
          setIsAuthorized(false);
          setLoading(false);
        }
      }
    };

    checkAuth();

    // Cleanup
    return () => {
      isMounted = false;
    };
  }, [requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-600 mx-auto mb-4"></div>
          <p className="text-xl text-amber-900 dark:text-amber-200 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;