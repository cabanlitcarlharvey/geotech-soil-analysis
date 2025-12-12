import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Sun, Moon, LogOut, Home, History, Download, Trash2, X, Beaker } from 'lucide-react';
import Papa from 'papaparse';
import { DateTime } from 'luxon';

const EngineerAnalysisHistory = () => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const [selectedReviews, setSelectedReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    setIsDark(!isDark);
  };

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || !user.id) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('soil_analysis_results')
        .select('id, total_weight, gravel_weight, sand_weight, gravel_percent, sand_percent, fines_percent, soil_type, predicted_soil_type, image_soil_type, created_at, engineer_id, status, location')
        .eq('engineer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw new Error('Failed to load analysis history.');

      const analysisIds = data.map((item) => item.id);
      const { data: reviewsData } = await supabase
        .from('analysis_reviews')
        .select('analysis_id')
        .in('analysis_id', analysisIds);

      const reviewCounts = reviewsData?.reduce((acc, review) => {
        acc[review.analysis_id] = (acc[review.analysis_id] || 0) + 1;
        return acc;
      }, {}) || {};

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

  useEffect(() => {
    fetchHistory();
  }, [navigate]);

  useEffect(() => {
    if (filter === 'All' && !searchQuery) {
      setFilteredAnalyses(analyses);
    } else {
      setFilteredAnalyses(
        analyses.filter((item) =>
          (filter === 'All' || item.soil_type?.toLowerCase().includes(filter.toLowerCase())) &&
          (item.soil_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.image_soil_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            formatDateTime(item.created_at).toLowerCase().includes(searchQuery.toLowerCase()))
        )
      );
    }
  }, [filter, searchQuery, analyses]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch {
      alert('Failed to log out.');
    }
  };

  const formatDateTime = (utcDate) => {
    return DateTime.fromISO(utcDate, { zone: 'utc' })
      .setZone('Asia/Manila')
      .toFormat('MMMM dd, yyyy, h:mm a');
  };

  const fetchReviews = async (analysisId) => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const { data, error } = await supabase
        .from('analysis_reviews')
        .select('id, comments, reviewed_at, reviewer_id')
        .eq('analysis_id', analysisId);

      if (error) throw new Error(error.message);

      const reviewerIds = data.map((review) => review.reviewer_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', reviewerIds);

      const profilesMap = profilesData.reduce((acc, profile) => {
        acc[profile.id] = profile.full_name;
        return acc;
      }, {});

      setSelectedReviews(
        data.map((review) => ({
          ...review,
          reviewer_name: profilesMap[review.reviewer_id] || review.reviewer_id || 'Unknown',
        }))
      );
    } catch {
      setReviewError('Failed to load reviews. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    setDeleteError(null);
    try {
      const analysis = analyses.find((item) => item.id === analysisId);
      if (!['PENDING', 'DISAPPROVED'].includes(analysis.status?.toUpperCase())) {
        throw new Error('Only pending or disapproved analyses can be deleted.');
      }
      await supabase.from('analysis_reviews').delete().eq('analysis_id', analysisId);
      await supabase
        .from('soil_analysis_results')
        .delete()
        .eq('id', analysisId)
        .eq('engineer_id', (await supabase.auth.getUser()).data.user.id);

      const updatedAnalyses = analyses.filter((item) => item.id !== analysisId);
      setAnalyses(updatedAnalyses);
      setFilteredAnalyses(
        updatedAnalyses.filter((item) =>
          (filter === 'All' || item.soil_type?.toLowerCase().includes(filter.toLowerCase())) &&
          (item.soil_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.image_soil_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            formatDateTime(item.created_at).toLowerCase().includes(searchQuery.toLowerCase()))
        )
      );
      alert('Analysis deleted successfully. Refresh the dashboard to update charts.');
    } catch (err) {
      setDeleteError(err.message || 'An unexpected error occurred.');
    }
  };

  const openReviewModal = (analysisId) => {
    fetchReviews(analysisId);
    setModalType('review');
    setSelectedAnalysisId(analysisId);
    setModalOpen(true);
  };

  const openDeleteModal = (analysisId) => {
    setModalType('delete');
    setSelectedAnalysisId(analysisId);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setSelectedAnalysisId(null);
    setSelectedReviews([]);
    setReviewError(null);
    setDeleteError(null);
  };

  const exportToCSV = () => {
    const dataToExport = filteredAnalyses.map((item) => ({
      Date: formatDateTime(item.created_at),
      Location: item.location ?? 'Not provided',
      'Total Weight (g)': item.total_weight ? parseFloat(item.total_weight.toFixed(2)) : 0,
      'Gravel Weight (g)': item.gravel_weight ? parseFloat(item.gravel_weight.toFixed(2)) : 0,
      'Sand Weight (g)': item.sand_weight ? parseFloat(item.sand_weight.toFixed(2)) : 0,
      'Gravel %': item.gravel_percent ? parseFloat(item.gravel_percent.toFixed(2)) : 0,
      'Sand %': item.sand_percent ? parseFloat(item.sand_percent.toFixed(2)) : 0,
      'Fines %': item.fines_percent ? parseFloat(item.fines_percent.toFixed(2)) : 0,
      'USCS Soil Type': item.soil_type,
      'Predicted Soil Type': item.predicted_soil_type ?? 'Not provided',
      'Image URL': item.image_soil_type ?? 'Not provided',
      Status: item.status,
      'Review Count': item.review_count || 0,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'analysis_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white/95 dark:bg-gray-800/95 shadow px-8 py-6 flex justify-between items-center border-b border-amber-700 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
        <div
          className="flex items-center gap-3 cursor-pointer group transition-transform duration-300 hover:scale-105"
          onClick={() => navigate('/engineer-home')}
          title="Go to Staff Home"
          tabIndex={0}
          role="button"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/engineer-home'); }}
          aria-label="Go to Engineer Home"
        >
          <svg width="44" height="44" fill="none" viewBox="0 0 48 48" aria-hidden>
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
          </svg>
          <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-200 font-serif">
            Geotech Staff Portal
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
            onClick={() => navigate('/engineer-home')}
            className="p-3 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-300"
            aria-label="Go to home page"
            title="Home"
          >
            <Home className="w-6 h-6" />
          </button>
          <button
            onClick={() => navigate('/soil-analysis')}
            className="p-3 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300"
            aria-label="Start soil analysis"
            title="Soil Analysis"
          >
            <Beaker className="w-6 h-6" />
          </button>
          <button
            onClick={() => navigate('/engineer-history')}
            className="p-3 rounded-full hover:bg-green-200 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-300"
            aria-label="View analysis history"
            title="History"
          >
            <History className="w-6 h-6" />
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
              Analysis History
            </h2>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full lg:w-auto flex-wrap">
              <div className="w-full md:w-72">
                <label htmlFor="search-input" className="sr-only">
                  Search analysis history
                </label>
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search by soil type, location, status, or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-amber-400 dark:border-amber-600 rounded-lg px-4 py-3 bg-amber-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-300"
                  aria-label="Search analysis history"
                />
              </div>
              <div className="w-full md:w-auto">
                <label htmlFor="soil-type-filter" className="sr-only">
                  Filter by USCS soil type
                </label>
                <select
                  id="soil-type-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full border border-amber-400 dark:border-amber-600 rounded-lg px-4 py-3 bg-amber-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-300"
                  aria-label="Filter by USCS soil type"
                >
                  <option value="All">All Soil Types</option>
                  <option value="Clean gravel">Clean gravel</option>
                  <option value="Gravel with fines">Gravel with fines</option>
                  <option value="Silty or clayey gravel">Silty or clayey gravel</option>
                  <option value="Clean sand">Clean sand</option>
                  <option value="Sand with fines">Sand with fines</option>
                  <option value="Silty or clayey sand">Silty or clayey sand</option>
                  <option value="Clay or Silt">Clay or Silt</option>
                </select>
              </div>
              <button
                onClick={exportToCSV}
                className="flex items-center justify-center gap-2 px-5 py-3 text-base font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-300 w-full md:w-auto"
                aria-label="Export analysis history to CSV"
              >
                <Download className="w-5 h-5" /> Export CSV
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
                  onClick={fetchHistory}
                  className="text-amber-700 dark:text-amber-300 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 text-base font-medium"
                  aria-label="Retry loading data"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredAnalyses.length > 0 ? (
            <div className="overflow-x-auto">
              <table
                className="w-full table-auto border border-amber-400 dark:border-amber-600 text-base"
                role="grid"
                aria-describedby="analysis-history-caption"
              >
                <caption id="analysis-history-caption" className="sr-only">
                  History of soil analysis results submitted by the engineer
                </caption>
                <thead>
                  <tr className="bg-amber-100 dark:bg-amber-900 sticky top-0 z-10">
                    <th scope="col" className="px-6 py-4 text-left font-bold">Date</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Location</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Total Weight (g)</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Gravel Weight (g)</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Sand Weight (g)</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Gravel %</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Sand %</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Fines %</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">USCS Soil Type</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Predicted Soil Type</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Image</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Status</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Reviews</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200 dark:divide-amber-800">
                  {filteredAnalyses.map((item) => (
                    <tr key={item.id} className="odd:bg-amber-50 even:bg-white dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors duration-300">
                      <td className="px-6 py-4">{formatDateTime(item.created_at)}</td>
                      <td className="px-6 py-4 font-semibold text-amber-900 dark:text-amber-200">{item.location ?? '—'}</td>
                      <td className="px-6 py-4">{item.total_weight ? item.total_weight.toFixed(2) : '—'}</td>
                      <td className="px-6 py-4">{item.gravel_weight ? item.gravel_weight.toFixed(2) : '—'}</td>
                      <td className="px-6 py-4">{item.sand_weight ? item.sand_weight.toFixed(2) : '—'}</td>
                      <td className="px-6 py-4">{item.gravel_percent ? `${item.gravel_percent.toFixed(2)}%` : '—'}</td>
                      <td className="px-6 py-4">{item.sand_percent ? `${item.sand_percent.toFixed(2)}%` : '—'}</td>
                      <td className="px-6 py-4">{item.fines_percent ? `${item.fines_percent.toFixed(2)}%` : '—'}</td>
                      <td className="px-6 py-4">{item.soil_type ?? '—'}</td>
                      <td className="px-6 py-4">{item.predicted_soil_type ?? 'Not provided'}</td>
                      <td className="px-6 py-4">
                        {item.image_soil_type && (item.image_soil_type.startsWith('http') || item.image_soil_type.startsWith('https')) ? (
                          <img
                            src={item.image_soil_type}
                            alt={`Soil image for ${item.soil_type}`}
                            className="h-16 w-16 object-cover rounded border border-amber-400 cursor-pointer hover:scale-110 transition-transform duration-300"
                            onClick={() => window.open(item.image_soil_type, '_blank')}
                            title="Click to view full size"
                          />
                        ) : (
                          <span className="italic text-gray-400">No image</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-3 py-2 text-sm font-bold rounded-full transition-all duration-300 ${getStatusBadgeClass(item.status)}`}
                          aria-label={`Status: ${item.status ?? 'PENDING'}`}
                        >
                          {item.status ?? 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.review_count > 0 ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openReviewModal(item.id)}
                              className="px-4 py-2 text-sm font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                              aria-label={`View ${item.review_count} reviews for analysis ${item.id}`}
                            >
                              View Review
                            </button>
                            <span className="bg-amber-100 text-amber-800 text-sm font-bold px-3 py-2 rounded-lg dark:bg-amber-900 dark:text-amber-300">
                              {item.review_count}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {['PENDING', 'DISAPPROVED'].includes(item.status?.toUpperCase()) ? (
                          <button
                            onClick={() => openDeleteModal(item.id)}
                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 w-full"
                            aria-label={`Delete analysis ${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <svg className="w-24 h-24 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg text-gray-700 dark:text-gray-200">No analysis history available.</p>
                <button
                  onClick={() => navigate('/engineer-home')}
                  className="text-amber-700 dark:text-amber-300 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 text-base font-medium"
                  aria-label="Submit a new analysis"
                >
                  Submit a new analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal for Review or Delete */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={closeModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 animate-in fade-in scale-95 hover:scale-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-amber-200 dark:border-amber-700">
              <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-200">
                {modalType === 'review' ? 'Review Details' : 'Confirm Deletion'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-300"
                aria-label="Close modal"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {modalType === 'review' ? (
                <>
                  {reviewLoading ? (
                    <div className="flex justify-center items-center h-48">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-700"></div>
                    </div>
                  ) : reviewError ? (
                    <p className="text-lg text-red-600 dark:text-red-400">{reviewError}</p>
                  ) : selectedReviews.length > 0 ? (
                    <div className="space-y-6">
                      {selectedReviews.map((review) => (
                        <div
                          key={review.id}
                          className="border-l-4 border-amber-700 dark:border-amber-400 bg-amber-50 dark:bg-gray-700 p-5 rounded-lg"
                        >
                          <p className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2">
                            {review.reviewer_name}
                          </p>
                          <p className="text-base text-gray-700 dark:text-gray-300 mb-3">
                            {review.comments || 'No comment provided'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Reviewed: {formatDateTime(review.reviewed_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-lg text-gray-700 dark:text-gray-200 text-center py-8">
                      No reviews available for this analysis.
                    </p>
                  )}
                </>
              ) : (
                <>
                  {deleteError ? (
                    <p className="text-lg text-red-600 dark:text-red-400 mb-6">{deleteError}</p>
                  ) : (
                    <p className="text-lg text-gray-700 dark:text-gray-200 mb-6">
                      Are you sure you want to delete this{' '}
                      <span className="font-bold">
                        {analyses.find((item) => item.id === selectedAnalysisId)?.status?.toUpperCase() || 'PENDING'}
                      </span>
                      {' '}analysis? This action cannot be undone.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-8 py-6 border-t border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-gray-700">
              <button
                onClick={closeModal}
                className="px-6 py-3 text-base font-medium bg-amber-300 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded-lg hover:bg-amber-400 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300"
                aria-label={modalType === 'review' ? 'Close review modal' : 'Cancel deletion'}
              >
                {modalType === 'review' ? 'Close' : 'Cancel'}
              </button>
              {modalType === 'delete' && (
                <button
                  onClick={() => {
                    handleDeleteAnalysis(selectedAnalysisId);
                    closeModal();
                  }}
                  className="px-6 py-3 text-base font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                  aria-label="Confirm deletion"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EngineerAnalysisHistory;