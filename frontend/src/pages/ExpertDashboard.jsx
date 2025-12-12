import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Sun, Moon, LogOut, Home, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DateTime } from 'luxon';

const ExpertDashboard = () => {
  const [analyses, setAnalyses] = useState([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState([]);
  const [soilTypeFilter, setSoilTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [reviewComments, setReviewComments] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [currentAnalysisData, setCurrentAnalysisData] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [userReviewMap, setUserReviewMap] = useState({});
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [engineerNameMap, setEngineerNameMap] = useState({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  useEffect(() => {
    const getUserAndReviews = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      await fetchAnalyses(user?.id || null);
    };
    getUserAndReviews();
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    applyFilter();
  }, [soilTypeFilter, searchQuery, analyses]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, type: '', message: '' });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
  };

  const fetchAnalyses = async (currentUserId) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('soil_analysis_results')
        .select('id, engineer_id, total_weight, gravel_weight, sand_weight, gravel_percent, sand_percent, fines_percent, soil_type, predicted_soil_type, image_soil_type, created_at, status, location')
        .order('created_at', { ascending: false });

      if (error) throw new Error('Failed to load analysis records.');

      const analysisIds = data.map((item) => item.id);
      const engineerIds = Array.from(
        new Set(
          data
            .map((item) => item.engineer_id)
            .filter(Boolean)
        )
      );

      if (engineerIds.length) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', engineerIds);

        if (!profilesError && profilesData) {
          const namesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile.full_name;
            return acc;
          }, {});
          setEngineerNameMap(namesMap);
        }
      } else {
        setEngineerNameMap({});
      }

      const { data: reviewsData } = await supabase
        .from('analysis_reviews')
        .select('analysis_id')
        .in('analysis_id', analysisIds);

      const reviewCounts = reviewsData?.reduce((acc, review) => {
        acc[review.analysis_id] = (acc[review.analysis_id] || 0) + 1;
        return acc;
      }, {}) || {};

      let userReviewsMap = {};
      if (currentUserId) {
        const { data: userReviews } = await supabase
          .from('analysis_reviews')
          .select('analysis_id, comments')
          .eq('reviewer_id', currentUserId)
          .in('analysis_id', analysisIds);

        userReviewsMap = {};
        userReviews?.forEach(r => { userReviewsMap[r.analysis_id] = r; });
        setUserReviewMap(userReviewsMap);
      }

      const enrichedData = data.map((item) => ({
        ...item,
        review_count: reviewCounts[item.id] || 0,
      }));

      setAnalyses(enrichedData);
      setFilteredAnalyses(enrichedData);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = analyses;
    if (soilTypeFilter !== 'ALL') {
      filtered = filtered.filter((a) =>
        a.soil_type?.toLowerCase().includes(soilTypeFilter.toLowerCase())
      );
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (a) =>
          a.soil_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.predicted_soil_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          formatDateTime(a.created_at).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredAnalyses(filtered);
  };

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
      showNotification('error', 'Failed to log out. Please try again.');
    }
  };

  const openReviewModal = (analysisId) => {
    const analysis = analyses.find((a) => a.id === analysisId);
    setCurrentAnalysisId(analysisId);
    setCurrentAnalysisData(analysis);
    setSelectedStatus(analysis?.status || 'PENDING');

    setReviewComments((prev) => ({
      ...prev,
      [analysisId]: userReviewMap[analysisId]?.comments || ''
    }));

    setModalOpen(true);
  };

  const closeReviewModal = () => {
    const idToClear = currentAnalysisId;
    setModalOpen(false);
    setCurrentAnalysisId(null);
    setCurrentAnalysisData(null);
    if (idToClear) {
      setReviewComments((prev) => ({ ...prev, [idToClear]: '' }));
    }
    setSelectedStatus('');
  };

  const handleReviewChange = (comment) => {
    setReviewComments((prev) => ({ ...prev, [currentAnalysisId]: comment }));
  };

  const handleReviewSubmit = async () => {
    const comment = reviewComments[currentAnalysisId]?.trim();
    if (!comment) {
      showNotification('warning', 'Please enter a review comment.');
      return;
    }
    if (!selectedStatus) {
      showNotification('warning', 'Please select a status.');
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('Authentication error:', authError);
        showNotification('error', 'You must be logged in to submit a review.');
        return;
      }

      const { error: upsertError } = await supabase
        .from('analysis_reviews')
        .upsert(
          [
            {
              analysis_id: currentAnalysisId,
              reviewer_id: user.id,
              comments: comment,
              reviewed_at: new Date().toISOString(),
            },
          ],
          {
            onConflict: ['analysis_id', 'reviewer_id'],
          }
        );

      if (upsertError) {
        console.error('Review upsert error:', upsertError);
        showNotification('error', 'Error submitting review.');
      } else {
        const statusToSave = selectedStatus || 'PENDING';
        const { error: statusError } = await supabase
          .from('soil_analysis_results')
          .update({ status: statusToSave })
          .eq('id', currentAnalysisId);

        if (statusError) {
          console.error('Status update error:', statusError);
          showNotification('error', 'Review saved but updating status failed.');
          return;
        }

        setAnalyses((prev) =>
          prev.map((analysis) =>
            analysis.id === currentAnalysisId ? { ...analysis, status: statusToSave } : analysis
          )
        );
        setFilteredAnalyses((prev) =>
          prev.map((analysis) =>
            analysis.id === currentAnalysisId ? { ...analysis, status: statusToSave } : analysis
          )
        );
        showNotification('success', 'Review and status updated successfully.');
        setUserReviewMap((prev) => ({
          ...prev,
          [currentAnalysisId]: { analysis_id: currentAnalysisId, comments: comment }
        }));
        setReviewComments((prev) => ({
          ...prev,
          [currentAnalysisId]: comment
        }));
        closeReviewModal();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      showNotification('error', 'An unexpected error occurred.');
    }
  };

  const openDeleteModal = (analysisId) => {
    setDeleteTargetId(analysisId);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteTargetId(null);
  };

  const handleDeleteReview = async (analysisId) => {
    const targetId = analysisId ?? deleteTargetId;
    if (!targetId) return;
    try {
      const { error } = await supabase
        .from('analysis_reviews')
        .delete()
        .eq('analysis_id', targetId)
        .eq('reviewer_id', userId);

      if (error) {
        showNotification('error', 'Error deleting review.');
      } else {
        setUserReviewMap((prev) => {
          const updated = { ...prev };
          delete updated[targetId];
          return updated;
        });
        setReviewComments((prev) => {
          const updated = { ...prev };
          delete updated[targetId];
          return updated;
        });
        showNotification('success', 'Review deleted successfully.');
        closeDeleteModal();
      }
    } catch (err) {
      showNotification('error', 'Unexpected error deleting review.');
    }
  };

  const formatDateTime = (utcDate) => {
    return DateTime.fromISO(utcDate, { zone: 'utc' })
      .setZone('Asia/Manila')
      .toFormat('MMMM dd, yyyy, h:mm a');
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'DISAPPROVED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const uniqueSoilTypes = Array.from(new Set(analyses.map((a) => a.soil_type))).filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border-2 max-w-md ${
              notification.type === 'success'
                ? 'bg-green-50 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200'
                : notification.type === 'error'
                ? 'bg-red-50 dark:bg-red-900 border-red-500 text-red-800 dark:text-red-200'
                : 'bg-yellow-50 dark:bg-yellow-900 border-yellow-500 text-yellow-800 dark:text-yellow-200'
            }`}
          >
            <div className="flex-shrink-0">
              {notification.type === 'success' && (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'warning' && (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-base font-semibold flex-1">{notification.message}</p>
            <button
              onClick={() => setNotification({ show: false, type: '', message: '' })}
              className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/95 dark:bg-gray-800/95 shadow px-8 py-6 flex justify-between items-center border-b border-amber-700 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
        <div
          className="flex items-center gap-3 cursor-pointer group transition-transform duration-300 hover:scale-105"
          onClick={() => navigate('/expert-home')}
          title="Go to Expert Home"
          tabIndex={0}
          role="button"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/expert-home'); }}
          aria-label="Go to Expert Home"
        >
          <svg width="44" height="44" fill="none" viewBox="0 0 48 48" aria-hidden>
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
          </svg>
          <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-200 font-serif">
            Geotech Expert Portal
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-300"
            aria-label="Toggle theme"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
          <button
            onClick={() => navigate('/expert-home')}
            className="p-3 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-300"
            aria-label="Go to home page"
            title="Home"
          >
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={handleLogout}
            className="p-3 rounded-full hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-300"
            aria-label="Log out"
            title="Logout"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-full mx-auto mt-12 px-6 pb-12">
        <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 border border-amber-700 transition-all duration-500 animate-in fade-in" style={{ backdropFilter: 'blur(4px)' }}>
          {/* Title and Controls */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
            <h2 className="text-4xl font-bold text-amber-900 dark:text-amber-200 font-serif">
              Soil Analysis Records
            </h2>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full lg:w-auto flex-wrap">
              <div className="w-full md:w-72">
                <label htmlFor="search-input" className="sr-only">
                  Search analysis records
                </label>
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search by soil type, location, status, or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-amber-400 dark:border-amber-600 rounded-lg px-4 py-3 bg-amber-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-300"
                  aria-label="Search analysis records"
                />
              </div>
              <div className="w-full md:w-auto">
                <label htmlFor="soil-type-filter" className="sr-only">
                  Filter by USCS soil type
                </label>
                <select
                  id="soil-type-filter"
                  className="w-full border border-amber-400 dark:border-amber-600 rounded-lg px-4 py-3 bg-amber-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-300"
                  value={soilTypeFilter}
                  onChange={(e) => setSoilTypeFilter(e.target.value)}
                  aria-label="Filter by USCS soil type"
                >
                  <option value="ALL">All Soil Types</option>
                  {uniqueSoilTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => fetchAnalyses(userId)}
                className="px-5 py-3 text-base font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-300 w-full md:w-auto"
                aria-label="Refresh analysis records"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Table or Loading/Error States */}
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-700"></div>
              <p className="mt-4 text-lg text-gray-700 dark:text-gray-200">Loading data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <svg className="w-24 h-24 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h0m9-5v-2a10 10 0 00-10-10A10 10 0 003 11v2" />
                </svg>
                <p className="text-lg text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={() => fetchAnalyses(userId)}
                  className="text-amber-700 dark:text-amber-300 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 text-base font-medium"
                  aria-label="Retry loading data"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <svg className="w-24 h-24 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg text-gray-700 dark:text-gray-200">No soil analysis records found. Try adjusting filters.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full table-auto border border-amber-400 dark:border-amber-600 text-base"
                role="grid"
                aria-describedby="analysis-records-caption"
              >
                <caption id="analysis-records-caption" className="sr-only">
                  Soil analysis records for expert review
                </caption>
                <thead>
                  <tr className="bg-amber-100 dark:bg-amber-900 sticky top-0 z-10">
                    <th scope="col" className="px-6 py-4 text-left font-bold">Analysis ID</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Staff Name</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Location</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Total Weight (g)</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Gravel Weight (g)</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Sand Weight (g)</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Gravel %</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Sand %</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Fines %</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">USCS Soil Type</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Predicted Type</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Image</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Captured</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Status</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200 dark:divide-amber-800">
                  {filteredAnalyses.map((analysis) => (
                    <tr key={analysis.id} className="odd:bg-amber-50 even:bg-white dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors duration-300">
                      <td className="px-6 py-4 font-semibold">{analysis.id}</td>
                      <td className="px-6 py-4">{engineerNameMap[analysis.engineer_id] || analysis.engineer_id || '—'}</td>
                      <td className="px-6 py-4 font-semibold text-amber-900 dark:text-amber-200">{analysis.location ?? '—'}</td>
                      <td className="px-6 py-4">{analysis.total_weight ? analysis.total_weight.toFixed(2) : '—'}</td>
                      <td className="px-6 py-4">{analysis.gravel_weight ? analysis.gravel_weight.toFixed(2) : '—'}</td>
                      <td className="px-6 py-4">{analysis.sand_weight ? analysis.sand_weight.toFixed(2) : '—'}</td>
                      <td className="px-6 py-4">{analysis.gravel_percent ? `${analysis.gravel_percent.toFixed(2)}%` : '—'}</td>
                      <td className="px-6 py-4">{analysis.sand_percent ? `${analysis.sand_percent.toFixed(2)}%` : '—'}</td>
                      <td className="px-6 py-4">{analysis.fines_percent ? `${analysis.fines_percent.toFixed(2)}%` : '—'}</td>
                      <td className="px-6 py-4 font-bold">{analysis.soil_type ?? '—'}</td>
                      <td className="px-6 py-4">{analysis.predicted_soil_type ?? 'Not provided'}</td>
                      <td className="px-6 py-4">
                        {analysis.image_soil_type && 
                         (analysis.image_soil_type.startsWith('http') || analysis.image_soil_type.startsWith('https')) ? (
                          <img
                            src={analysis.image_soil_type}
                            alt={`Soil image for ${analysis.soil_type}`}
                            className="h-16 w-16 object-cover rounded border border-amber-400 cursor-pointer hover:scale-110 transition-transform duration-300"
                            onClick={() => window.open(analysis.image_soil_type, '_blank')}
                            title="Click to view full size"
                          />
                        ) : (
                          <span className="italic text-gray-400">No image</span>
                        )}
                      </td>
                      <td className="px-6 py-4">{formatDateTime(analysis.created_at)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-2 text-sm font-bold rounded-full transition-all duration-300 ${getStatusBadgeClass(analysis.status)}`}
                          aria-label={`Status: ${analysis.status ?? 'PENDING'}`}
                        >
                          {analysis.status ?? 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-3">
                          {userReviewMap[analysis.id] ? (
                            <>
                              <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-2 rounded dark:bg-green-900 dark:text-green-300">
                                Reviewed
                              </span>
                              <button
                                onClick={() => openReviewModal(analysis.id)}
                                className="w-full px-4 py-2 text-base font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                              >
                                Edit Review
                              </button>
                              <button
                                onClick={() => openDeleteModal(analysis.id)}
                                className="w-full px-4 py-2 text-base font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openReviewModal(analysis.id)}
                              className="w-full px-4 py-2 text-base font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                            >
                              Add Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Review Modal */}
      {modalOpen && currentAnalysisData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={closeReviewModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 animate-in fade-in scale-95 hover:scale-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-amber-200 dark:border-amber-700">
              <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-200">
                {userReviewMap[currentAnalysisId] ? 'Edit Review Comment' : 'Add Review Comment'}
              </h3>
              <button
                onClick={closeReviewModal}
                className="p-2 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-300"
                aria-label="Close modal"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Analysis ID</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisId}</p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Staff Name</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                    {engineerNameMap[currentAnalysisData.engineer_id] || currentAnalysisData.engineer_id || '—'}
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Location</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisData.location ?? 'Not provided'}</p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">USCS Soil Type</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisData.soil_type ?? '—'}</p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Predicted Type</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisData.predicted_soil_type ?? 'Not provided'}</p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Weight</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisData.total_weight ?? '—'} g</p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gravel %</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisData.gravel_percent ? `${currentAnalysisData.gravel_percent}%` : '—'}</p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sand %</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisData.sand_percent ? `${currentAnalysisData.sand_percent}%` : '—'}</p>
                </div>
                <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fines %</p>
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{currentAnalysisData.fines_percent ? `${currentAnalysisData.fines_percent}%` : '—'}</p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Captured</p>
                <p className="text-base font-semibold text-amber-900 dark:text-amber-200">{formatDateTime(currentAnalysisData.created_at)}</p>
              </div>

              <label htmlFor="review-comment" className="block text-base font-semibold text-amber-900 dark:text-amber-200 mb-3">
                Review Comment
              </label>
              <textarea
                id="review-comment"
                rows={8}
                className="w-full p-4 rounded-lg bg-amber-50 dark:bg-gray-700 border-2 border-amber-400 dark:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base transition-all duration-300"
                value={reviewComments[currentAnalysisId] || ''}
                onChange={(e) => handleReviewChange(e.target.value)}
                placeholder="Enter your review comment..."
                aria-label="Review comment input"
              />

              <div className="mt-6">
                <p className="text-base font-semibold text-amber-900 dark:text-amber-200 mb-3">
                  Set Analysis Status
                </p>
                <div className="flex flex-col gap-4">
                  <label className="flex items-center p-4 border-2 border-green-400 dark:border-green-600 rounded-lg cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors duration-300">
                    <input
                      type="radio"
                      name="status"
                      value="APPROVED"
                      checked={selectedStatus === 'APPROVED'}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-5 h-5 focus:ring-green-500"
                      aria-label="Set status to APPROVED"
                    />
                    <span className="ml-3 text-lg font-semibold text-green-800 dark:text-green-300">APPROVED</span>
                  </label>
                  <label className="flex items-center p-4 border-2 border-red-400 dark:border-red-600 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-300">
                    <input
                      type="radio"
                      name="status"
                      value="DISAPPROVED"
                      checked={selectedStatus === 'DISAPPROVED'}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-5 h-5 focus:ring-red-500"
                      aria-label="Set status to DISAPPROVED"
                    />
                    <span className="ml-3 text-lg font-semibold text-red-800 dark:text-red-300">DISAPPROVED</span>
                  </label>
                  <label className="flex items-center p-4 border-2 border-amber-400 dark:border-amber-600 rounded-lg cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors duration-300">
                    <input
                      type="radio"
                      name="status"
                      value="PENDING"
                      checked={selectedStatus === 'PENDING'}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-5 h-5 focus:ring-amber-500"
                      aria-label="Set status to PENDING"
                    />
                    <span className="ml-3 text-lg font-semibold text-amber-900 dark:text-amber-200">PENDING</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-8 py-6 border-t border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-gray-700">
              <button
                onClick={closeReviewModal}
                className="px-6 py-3 text-base font-medium bg-amber-300 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded-lg hover:bg-amber-400 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300"
                aria-label="Cancel review"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmit}
                className="px-6 py-3 text-base font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                aria-label="Submit review"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={closeDeleteModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 animate-in fade-in scale-95 hover:scale-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-8 py-6 border-b border-amber-200 dark:border-amber-700">
              <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-200">Delete Review</h3>
              <button
                onClick={closeDeleteModal}
                className="p-2 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-300"
                aria-label="Close delete modal"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="px-8 py-6 space-y-4">
              <p className="text-lg text-gray-800 dark:text-gray-200">
                Are you sure you want to delete the review for analysis{' '}
                <span className="font-bold text-amber-900 dark:text-amber-200">{deleteTargetId}</span>?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                It cannot be restored after deletion.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-8 py-6 border-t border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-gray-700">
              <button
                onClick={closeDeleteModal}
                className="px-6 py-3 text-base font-medium bg-amber-300 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded-lg hover:bg-amber-400 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteReview(deleteTargetId)}
                className="px-6 py-3 text-base font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                aria-label="Confirm delete review"
              >
                Delete Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpertDashboard;