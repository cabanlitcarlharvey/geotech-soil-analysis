import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { X, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import PageLayout from "../components/shared/PageLayout";
import { getUscsMapping } from "../utils/uscsMapping";

const ExpertDashboard = () => {
  const [analyses, setAnalyses] = useState([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState([]);
  const [soilTypeFilter, setSoilTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDark] = useState(localStorage.getItem("theme") === "dark");
  const [setReviewComments] = useState({});
  const [userId, setUserId] = useState(null);
  const [userReviewMap, setUserReviewMap] = useState({});
  const [notification, setNotification] = useState({
    show: false,
    type: "",
    message: "",
  });
  const [engineerNameMap, setEngineerNameMap] = useState({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAnalysisDetails, setSelectedAnalysisDetails] = useState(null);
  const [reviewInDetailsModal, setReviewInDetailsModal] = useState("");
  const [statusInDetailsModal, setStatusInDetailsModal] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const getUserAndReviews = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      await fetchAnalyses(user?.id || null);
    };
    getUserAndReviews();
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    let filtered = analyses;

    if (soilTypeFilter !== "ALL") {
      const f = soilTypeFilter.toLowerCase();
      filtered = filtered.filter((a) => a.soil_type?.toLowerCase().includes(f));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.soil_type?.toLowerCase().includes(q) ||
          a.predicted_soil_type?.toLowerCase().includes(q) ||
          a.status?.toLowerCase().includes(q) ||
          a.location?.toLowerCase().includes(q) ||
          formatDateTime(a.created_at).toLowerCase().includes(q),
      );
    }

    setFilteredAnalyses(filtered);
    setCurrentPage(1);
  }, [soilTypeFilter, searchQuery, analyses]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, type: "", message: "" });
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
        .from("soil_analysis_results")
        .select(
          "id, engineer_id, total_weight, gravel_weight, sand_weight, gravel_percent, sand_percent, fines_percent, soil_type, predicted_soil_type, image_soil_type, created_at, status, location",
        )
        .order("created_at", { ascending: false });

      if (error) throw new Error("Failed to load analysis records.");

      const analysisIds = data.map((item) => item.id);
      const engineerIds = Array.from(
        new Set(data.map((item) => item.engineer_id).filter(Boolean)),
      );

      if (engineerIds.length) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", engineerIds);

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
        .from("analysis_reviews")
        .select("analysis_id")
        .in("analysis_id", analysisIds);

      const reviewCounts =
        reviewsData?.reduce((acc, review) => {
          acc[review.analysis_id] = (acc[review.analysis_id] || 0) + 1;
          return acc;
        }, {}) || {};

      let userReviewsMap = {};
      if (currentUserId) {
        const { data: userReviews } = await supabase
          .from("analysis_reviews")
          .select("analysis_id, comments")
          .eq("reviewer_id", currentUserId)
          .in("analysis_id", analysisIds);

        userReviewsMap = {};
        userReviews?.forEach((r) => {
          userReviewsMap[r.analysis_id] = r;
        });
        setUserReviewMap(userReviewsMap);
      }

      const enrichedData = data.map((item) => ({
        ...item,
        review_count: reviewCounts[item.id] || 0,
      }));

      setAnalyses(enrichedData);
      setFilteredAnalyses(enrichedData);
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const openDetailsModal = (analysis) => {
    setSelectedAnalysisDetails(analysis);
    setStatusInDetailsModal(analysis?.status || "PENDING");
    setReviewInDetailsModal(userReviewMap[analysis.id]?.comments || "");
    setDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedAnalysisDetails(null);
    setReviewInDetailsModal("");
    setStatusInDetailsModal("");
  };

  const handleReviewSubmitFromDetails = async () => {
    const comment = reviewInDetailsModal?.trim();
    if (!comment) {
      showNotification("warning", "Please enter a review comment.");
      return;
    }
    if (!statusInDetailsModal) {
      showNotification("warning", "Please select a status.");
      return;
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Authentication error:", authError);
        showNotification("error", "You must be logged in to submit a review.");
        return;
      }

      const { error: upsertError } = await supabase
        .from("analysis_reviews")
        .upsert(
          [
            {
              analysis_id: selectedAnalysisDetails.id,
              reviewer_id: user.id,
              comments: comment,
              reviewed_at: new Date().toISOString(),
            },
          ],
          {
            onConflict: ["analysis_id", "reviewer_id"],
          },
        );

      if (upsertError) {
        console.error("Review upsert error:", upsertError);
        showNotification("error", "Error submitting review.");
      } else {
        const statusToSave = statusInDetailsModal || "PENDING";
        const { error: statusError } = await supabase
          .from("soil_analysis_results")
          .update({ status: statusToSave })
          .eq("id", selectedAnalysisDetails.id);

        if (statusError) {
          console.error("Status update error:", statusError);
          showNotification("error", "Review saved but updating status failed.");
          return;
        }

        setAnalyses((prev) =>
          prev.map((analysis) =>
            analysis.id === selectedAnalysisDetails.id
              ? { ...analysis, status: statusToSave }
              : analysis,
          ),
        );
        setFilteredAnalyses((prev) =>
          prev.map((analysis) =>
            analysis.id === selectedAnalysisDetails.id
              ? { ...analysis, status: statusToSave }
              : analysis,
          ),
        );
        showNotification("success", "Review and status updated successfully.");
        setUserReviewMap((prev) => ({
          ...prev,
          [selectedAnalysisDetails.id]: {
            analysis_id: selectedAnalysisDetails.id,
            comments: comment,
          },
        }));
        closeDetailsModal();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      showNotification("error", "An unexpected error occurred.");
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
        .from("analysis_reviews")
        .delete()
        .eq("analysis_id", targetId)
        .eq("reviewer_id", userId);

      if (error) {
        showNotification("error", "Error deleting review.");
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
        showNotification("success", "Review deleted successfully.");
        closeDeleteModal();
      }
    } catch (err) {
      showNotification("error", "Unexpected error deleting review.");
    }
  };

  const formatDateTime = (utcDate) => {
    return DateTime.fromISO(utcDate, { zone: "utc" })
      .setZone("Asia/Manila")
      .toFormat("MMMM dd, yyyy, h:mm a");
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toUpperCase()) {
      case "APPROVED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "DISAPPROVED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    }
  };

  const uniqueSoilTypes = Array.from(
    new Set(analyses.map((a) => a.soil_type)),
  ).filter(Boolean);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAnalyses.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentAnalyses = filteredAnalyses.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <PageLayout currentPage="dashboard" userType="expert">
      {/* Notification Toast */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border-2 max-w-md ${
              notification.type === "success"
                ? "bg-green-50 dark:bg-green-900 border-green-500 text-green-800 dark:text-green-200"
                : notification.type === "error"
                  ? "bg-red-50 dark:bg-red-900 border-red-500 text-red-800 dark:text-red-200"
                  : "bg-yellow-50 dark:bg-yellow-900 border-yellow-500 text-yellow-800 dark:text-yellow-200"
            }`}
          >
            <div className="flex-shrink-0">
              {notification.type === "success" && (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {notification.type === "error" && (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {notification.type === "warning" && (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <p className="text-base font-semibold flex-1">
              {notification.message}
            </p>
            <button
              onClick={() =>
                setNotification({ show: false, type: "", message: "" })
              }
              className="flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-full mx-auto mt-12 px-6 pb-12">
        <div
          className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 border border-accent-700 transition-all duration-500 animate-in fade-in"
          style={{ backdropFilter: "blur(4px)" }}
        >
          {/* Title and Controls */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
            <h2 className="text-4xl font-bold text-accent-900 dark:text-accent-200 font-serif">
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
                  className="w-full border border-accent-400 dark:border-accent-600 rounded-lg px-4 py-3 bg-accent-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all duration-300"
                  aria-label="Search analysis records"
                />
              </div>
              <div className="w-full md:w-auto">
                <label htmlFor="soil-type-filter" className="sr-only">
                  Filter by USCS soil type
                </label>
                <select
                  id="soil-type-filter"
                  className="w-full border border-accent-400 dark:border-accent-600 rounded-lg px-4 py-3 bg-accent-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all duration-300"
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
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-700"></div>
              <p className="mt-4 text-lg text-gray-700 dark:text-gray-200">
                Loading data...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <svg
                  className="w-24 h-24 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h0m9-5v-2a10 10 0 00-10-10A10 10 0 003 11v2"
                  />
                </svg>
                <p className="text-lg text-red-600 dark:text-red-400">
                  {error}
                </p>
                <button
                  onClick={() => fetchAnalyses(userId)}
                  className="text-accent-700 dark:text-accent-300 hover:underline focus:outline-none focus:ring-2 focus:ring-accent-500 text-base font-medium"
                  aria-label="Retry loading data"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <svg
                  className="w-24 h-24 text-gray-400 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-lg text-gray-700 dark:text-gray-200">
                  No soil analysis records found. Try adjusting filters.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table
                  className="w-full table-auto border border-accent-400 dark:border-accent-600 text-base"
                  role="grid"
                  aria-describedby="analysis-records-caption"
                >
                  <caption id="analysis-records-caption" className="sr-only">
                    Soil analysis records for expert review
                  </caption>
                  <thead>
                    <tr className="bg-accent-100 dark:bg-accent-900 sticky top-0 z-10">
                      <th scope="col" className="px-6 py-4 text-left font-bold">
                        Analysis ID
                      </th>
                      <th scope="col" className="px-6 py-4 text-left font-bold">
                        Staff Name
                      </th>
                      <th scope="col" className="px-6 py-4 text-left font-bold">
                        Location
                      </th>
                      <th scope="col" className="px-6 py-4 text-left font-bold">
                        USCS Soil Type
                      </th>
                      <th scope="col" className="px-6 py-4 text-left font-bold">
                        Captured
                      </th>
                      <th scope="col" className="px-6 py-4 text-left font-bold">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-4 text-left font-bold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-accent-200 dark:divide-accent-800">
                    {currentAnalyses.map((analysis) => (
                      <tr
                        key={analysis.id}
                        className="odd:bg-accent-50 even:bg-white dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-accent-100 dark:hover:bg-accent-800 transition-colors duration-300"
                      >
                        <td className="px-6 py-4 font-semibold">
                          {analysis.id}
                        </td>
                        <td className="px-6 py-4">
                          {engineerNameMap[analysis.engineer_id] ||
                            analysis.engineer_id ||
                            "—"}
                        </td>
                        <td className="px-6 py-4 font-semibold text-accent-900 dark:text-accent-200">
                          {analysis.location ?? "—"}
                        </td>
                        <td className="px-6 py-4 font-bold">
                          {analysis.soil_type ?? "—"}
                        </td>
                        <td className="px-6 py-4">
                          {formatDateTime(analysis.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-3 py-2 text-sm font-bold rounded-full transition-all duration-300 ${getStatusBadgeClass(analysis.status)}`}
                            aria-label={`Status: ${analysis.status ?? "PENDING"}`}
                          >
                            {analysis.status ?? "PENDING"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <button
                              onClick={() => openDetailsModal(analysis)}
                              className="w-full px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                              aria-label={`View and review analysis ${analysis.id}`}
                            >
                              <Eye className="w-4 h-4" />
                              {userReviewMap[analysis.id]
                                ? "View & Edit Review"
                                : "View & Review"}
                            </button>
                            {userReviewMap[analysis.id] && (
                              <button
                                onClick={() => openDeleteModal(analysis.id)}
                                className="w-full px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                              >
                                Delete Review
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col md:flex-row items-center justify-between mt-6 gap-4">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="rows-per-page"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Rows per page:
                  </label>
                  <select
                    id="rows-per-page"
                    value={rowsPerPage}
                    onChange={handleRowsPerPageChange}
                    className="border border-accent-400 dark:border-accent-600 rounded-lg px-3 py-2 bg-accent-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Showing {startIndex + 1} to{" "}
                    {Math.min(endIndex, filteredAnalyses.length)} of{" "}
                    {filteredAnalyses.length} entries
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-accent-100 dark:bg-accent-800 text-accent-900 dark:text-accent-100 hover:bg-accent-200 dark:hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => {
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                currentPage === page
                                  ? "bg-accent-700 text-white"
                                  : "bg-accent-100 dark:bg-accent-800 text-accent-900 dark:text-accent-100 hover:bg-accent-200 dark:hover:bg-accent-700"
                              } focus:outline-none focus:ring-2 focus:ring-accent-500`}
                              aria-label={`Go to page ${page}`}
                              aria-current={
                                currentPage === page ? "page" : undefined
                              }
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return (
                            <span key={page} className="px-2 text-gray-500">
                              ...
                            </span>
                          );
                        }
                        return null;
                      },
                    )}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-accent-100 dark:bg-accent-800 text-accent-900 dark:text-accent-100 hover:bg-accent-200 dark:hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Details Modal with Review Functionality */}
      {detailsModalOpen && selectedAnalysisDetails && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
          onClick={closeDetailsModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col transform transition-all duration-300 animate-in fade-in scale-95 hover:scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-accent-200 dark:border-accent-700">
              <h3 className="text-2xl font-bold text-accent-900 dark:text-accent-200">
                {userReviewMap[selectedAnalysisDetails.id]
                  ? "Review Analysis Details"
                  : "View & Review Analysis"}
              </h3>
              <button
                onClick={closeDetailsModal}
                className="p-2 rounded-full hover:bg-accent-100 dark:hover:bg-accent-900 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors duration-300"
                aria-label="Close modal"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                  <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200 mb-4">
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Analysis ID
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Staff Name
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {engineerNameMap[selectedAnalysisDetails.engineer_id] ||
                          selectedAnalysisDetails.engineer_id ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Location
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.location ?? "Not provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Captured
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {formatDateTime(selectedAnalysisDetails.created_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Current Status
                      </p>
                      <span
                        className={`inline-block px-3 py-1 text-sm font-bold rounded-full ${getStatusBadgeClass(selectedAnalysisDetails.status)}`}
                      >
                        {selectedAnalysisDetails.status ?? "PENDING"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Weight Measurements */}
                <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                  <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200 mb-4">
                    Weight Measurements
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Total Weight
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.total_weight
                          ? `${selectedAnalysisDetails.total_weight.toFixed(2)} g`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Gravel Weight
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.gravel_weight
                          ? `${selectedAnalysisDetails.gravel_weight.toFixed(2)} g`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sand Weight
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.sand_weight
                          ? `${selectedAnalysisDetails.sand_weight.toFixed(2)} g`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Composition Percentages */}
                <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                  <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200 mb-4">
                    Composition Percentages
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Gravel %
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.gravel_percent
                          ? `${selectedAnalysisDetails.gravel_percent.toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sand %
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.sand_percent
                          ? `${selectedAnalysisDetails.sand_percent.toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Fines %
                      </p>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {selectedAnalysisDetails.fines_percent
                          ? `${selectedAnalysisDetails.fines_percent.toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ML Prediction Result (replaces Soil Classification) */}
                <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-xl">🧠</div>
                    <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200">
                      ML Prediction Result
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        USCS Soil Type
                      </p>
                      <p className="text-lg font-bold text-accent-900 dark:text-accent-200">
                        {selectedAnalysisDetails?.soil_type ?? "—"}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Predicted Soil Type
                      </p>
                      <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                        {selectedAnalysisDetails?.predicted_soil_type ??
                          "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* USCS Reference Mapping (Flowchart-based) */}
                <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                  {(() => {
                    const map = getUscsMapping({
                      gravel_percent: selectedAnalysisDetails.gravel_percent,
                      sand_percent: selectedAnalysisDetails.sand_percent,
                      fines_percent: selectedAnalysisDetails.fines_percent,
                    });

                    return (
                      <>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="text-xl">📊</div>
                          <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200">
                            USCS Reference Mapping
                          </h4>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            {map.headline}
                          </p>
                          <span className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-bold bg-accent-100 dark:bg-accent-900 text-accent-800 dark:text-accent-200">
                            {map.symbol}
                          </span>
                        </div>

                        {/* Quick % summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                          <div className="rounded-lg p-4 bg-white/70 dark:bg-gray-800/40 border border-accent-200 dark:border-accent-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Gravel
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {Number(
                                selectedAnalysisDetails.gravel_percent ?? 0,
                              ).toFixed(2)}
                              %
                            </p>
                          </div>
                          <div className="rounded-lg p-4 bg-white/70 dark:bg-gray-800/40 border border-accent-200 dark:border-accent-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Sand
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {Number(
                                selectedAnalysisDetails.sand_percent ?? 0,
                              ).toFixed(2)}
                              %
                            </p>
                          </div>
                          <div className="rounded-lg p-4 bg-white/70 dark:bg-gray-800/40 border border-accent-200 dark:border-accent-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Fines
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {Number(
                                selectedAnalysisDetails.fines_percent ?? 0,
                              ).toFixed(2)}
                              %
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                          Decision path (USCS flow):
                        </p>
                        <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                          {map.path.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                        {map.notes?.length > 0 && (
                          <div className="mt-4 border border-accent-200 dark:border-accent-700 rounded-lg p-4 bg-white/70 dark:bg-gray-800/40">
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                              Notes / What you need to finalize:
                            </p>
                            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                              {map.notes.map((n, idx) => (
                                <li key={idx}>{n}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Image */}
                {selectedAnalysisDetails.image_soil_type &&
                  (selectedAnalysisDetails.image_soil_type.startsWith("http") ||
                    selectedAnalysisDetails.image_soil_type.startsWith(
                      "https",
                    )) && (
                    <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                      <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200 mb-4">
                        Soil Sample Image
                      </h4>
                      <img
                        src={selectedAnalysisDetails.image_soil_type}
                        alt={`Soil sample for ${selectedAnalysisDetails.soil_type}`}
                        className="w-full max-w-md mx-auto rounded-lg border border-accent-400 cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() =>
                          window.open(
                            selectedAnalysisDetails.image_soil_type,
                            "_blank",
                          )
                        }
                        title="Click to view full size"
                      />
                    </div>
                  )}

                {/* Review Section */}
                <div className="bg-gradient-to-r from-accent-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-lg border-2 border-accent-300 dark:border-accent-600">
                  <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200 mb-4">
                    {userReviewMap[selectedAnalysisDetails.id]
                      ? "Edit Your Review"
                      : "Add Your Review"}
                  </h4>

                  <label
                    htmlFor="review-comment-details"
                    className="block text-base font-semibold text-accent-900 dark:text-accent-200 mb-3"
                  >
                    Review Comment
                  </label>
                  <textarea
                    id="review-comment-details"
                    rows={6}
                    className="w-full p-4 rounded-lg bg-white dark:bg-gray-800 border-2 border-accent-400 dark:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500 text-base transition-all duration-300"
                    value={reviewInDetailsModal}
                    onChange={(e) => setReviewInDetailsModal(e.target.value)}
                    placeholder="Enter your review comment..."
                    aria-label="Review comment input"
                  />

                  <div className="mt-6">
                    <p className="text-base font-semibold text-accent-900 dark:text-accent-200 mb-3">
                      Set Analysis Status
                    </p>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center p-4 border-2 border-green-400 dark:border-green-600 rounded-lg cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors duration-300">
                        <input
                          type="radio"
                          name="status-details"
                          value="APPROVED"
                          checked={statusInDetailsModal === "APPROVED"}
                          onChange={(e) =>
                            setStatusInDetailsModal(e.target.value)
                          }
                          className="w-5 h-5 focus:ring-green-500"
                          aria-label="Set status to APPROVED"
                        />
                        <span className="ml-3 text-lg font-semibold text-green-800 dark:text-green-300">
                          APPROVED
                        </span>
                      </label>
                      <label className="flex items-center p-4 border-2 border-red-400 dark:border-red-600 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-300">
                        <input
                          type="radio"
                          name="status-details"
                          value="DISAPPROVED"
                          checked={statusInDetailsModal === "DISAPPROVED"}
                          onChange={(e) =>
                            setStatusInDetailsModal(e.target.value)
                          }
                          className="w-5 h-5 focus:ring-red-500"
                          aria-label="Set status to DISAPPROVED"
                        />
                        <span className="ml-3 text-lg font-semibold text-red-800 dark:text-red-300">
                          DISAPPROVED
                        </span>
                      </label>
                      <label className="flex items-center p-4 border-2 border-accent-400 dark:border-accent-600 rounded-lg cursor-pointer hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors duration-300">
                        <input
                          type="radio"
                          name="status-details"
                          value="PENDING"
                          checked={statusInDetailsModal === "PENDING"}
                          onChange={(e) =>
                            setStatusInDetailsModal(e.target.value)
                          }
                          className="w-5 h-5 focus:ring-accent-500"
                          aria-label="Set status to PENDING"
                        />
                        <span className="ml-3 text-lg font-semibold text-accent-900 dark:text-accent-200">
                          PENDING
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-8 py-6 border-t border-accent-200 dark:border-accent-700 bg-accent-50 dark:bg-gray-700">
              <button
                onClick={closeDetailsModal}
                className="px-6 py-3 text-base font-medium bg-accent-300 dark:bg-accent-700 text-accent-900 dark:text-accent-100 rounded-lg hover:bg-accent-400 dark:hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-all duration-300"
                aria-label="Close details modal"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmitFromDetails}
                className="px-6 py-3 text-base font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                aria-label="Submit review"
              >
                {userReviewMap[selectedAnalysisDetails.id]
                  ? "Update Review"
                  : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 animate-in fade-in scale-95 hover:scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-8 py-6 border-b border-accent-200 dark:border-accent-700">
              <h3 className="text-2xl font-bold text-accent-900 dark:text-accent-200">
                Delete Review
              </h3>
              <button
                onClick={closeDeleteModal}
                className="p-2 rounded-full hover:bg-accent-100 dark:hover:bg-accent-900 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors duration-300"
                aria-label="Close delete modal"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="px-8 py-6 space-y-4">
              <p className="text-lg text-gray-800 dark:text-gray-200">
                Are you sure you want to delete the review for analysis{" "}
                <span className="font-bold text-accent-900 dark:text-accent-200">
                  {deleteTargetId}
                </span>
                ?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                It cannot be restored after deletion.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-8 py-6 border-t border-accent-200 dark:border-accent-700 bg-accent-50 dark:bg-gray-700">
              <button
                onClick={closeDeleteModal}
                className="px-6 py-3 text-base font-medium bg-accent-300 dark:bg-accent-700 text-accent-900 dark:text-accent-100 rounded-lg hover:bg-accent-400 dark:hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-all duration-300"
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
    </PageLayout>
  );
};

export default ExpertDashboard;
