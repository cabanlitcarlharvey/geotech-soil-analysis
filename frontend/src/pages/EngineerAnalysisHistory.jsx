import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  Download,
  Trash2,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Papa from "papaparse";
import { DateTime } from "luxon";
import PageLayout from "../components/shared/PageLayout";
import { getUscsMapping } from "../utils/uscsMapping";

const EngineerAnalysisHistory = () => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState([]);
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [selectedReviews, setSelectedReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user || !user.id) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("soil_analysis_results")
        .select(
          "id, total_weight, gravel_weight, sand_weight, gravel_percent, sand_percent, fines_percent, soil_type, predicted_soil_type, image_soil_type, created_at, engineer_id, status, location",
        )
        .eq("engineer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw new Error("Failed to load analysis history.");

      const analysisIds = data.map((item) => item.id);

      const { data: reviewsData } = await supabase
        .from("analysis_reviews")
        .select("analysis_id")
        .in("analysis_id", analysisIds);

      const reviewCounts =
        reviewsData?.reduce((acc, review) => {
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
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (filter === "All" && !searchQuery) {
      setFilteredAnalyses(analyses);
    } else {
      setFilteredAnalyses(
        analyses.filter(
          (item) =>
            (filter === "All" ||
              item.soil_type?.toLowerCase().includes(filter.toLowerCase())) &&
            (item.soil_type
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
              item.image_soil_type
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              item.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.location
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              formatDateTime(item.created_at)
                .toLowerCase()
                .includes(searchQuery.toLowerCase())),
        ),
      );
    }
    setCurrentPage(1); // Reset to first page when filters change
  }, [filter, searchQuery, analyses]);

  const formatDateTime = (utcDate) => {
    return DateTime.fromISO(utcDate, { zone: "utc" })
      .setZone("Asia/Manila")
      .toFormat("MMMM dd, yyyy, h:mm a");
  };

  const fetchReviews = async (analysisId) => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const { data, error } = await supabase
        .from("analysis_reviews")
        .select("id, comments, reviewed_at, reviewer_id")
        .eq("analysis_id", analysisId);

      if (error) throw new Error(error.message);

      const reviewerIds = data.map((review) => review.reviewer_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", reviewerIds);

      const profilesMap = profilesData.reduce((acc, profile) => {
        acc[profile.id] = profile.full_name;
        return acc;
      }, {});

      setSelectedReviews(
        data.map((review) => ({
          ...review,
          reviewer_name:
            profilesMap[review.reviewer_id] || review.reviewer_id || "Unknown",
        })),
      );
    } catch {
      setReviewError("Failed to load reviews. Please try again.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    setDeleteError(null);
    try {
      const analysis = analyses.find((item) => item.id === analysisId);
      if (
        !["PENDING", "DISAPPROVED"].includes(analysis.status?.toUpperCase())
      ) {
        throw new Error("Only pending or disapproved analyses can be deleted.");
      }
      await supabase
        .from("analysis_reviews")
        .delete()
        .eq("analysis_id", analysisId);
      await supabase
        .from("soil_analysis_results")
        .delete()
        .eq("id", analysisId)
        .eq("engineer_id", (await supabase.auth.getUser()).data.user.id);

      const updatedAnalyses = analyses.filter((item) => item.id !== analysisId);
      setAnalyses(updatedAnalyses);
      setFilteredAnalyses(
        updatedAnalyses.filter(
          (item) =>
            (filter === "All" ||
              item.soil_type?.toLowerCase().includes(filter.toLowerCase())) &&
            (item.soil_type
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
              item.image_soil_type
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              item.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.location
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              formatDateTime(item.created_at)
                .toLowerCase()
                .includes(searchQuery.toLowerCase())),
        ),
      );
      alert(
        "Analysis deleted successfully. Refresh the dashboard to update charts.",
      );
    } catch (err) {
      setDeleteError(err.message || "An unexpected error occurred.");
    }
  };

  const openReviewModal = (analysisId) => {
    fetchReviews(analysisId);
    setModalType("review");
    setSelectedAnalysisId(analysisId);
    setModalOpen(true);
  };

  const openDetailsModal = (analysis) => {
    setModalType("details");
    setSelectedAnalysis(analysis);
    setModalOpen(true);
  };

  const openDeleteModal = (analysisId) => {
    setModalType("delete");
    setSelectedAnalysisId(analysisId);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setSelectedAnalysisId(null);
    setSelectedAnalysis(null);
    setSelectedReviews([]);
    setReviewError(null);
    setDeleteError(null);
  };

  const exportToCSV = () => {
    const dataToExport = filteredAnalyses.map((item) => ({
      Date: formatDateTime(item.created_at),
      Location: item.location ?? "Not provided",
      "Total Weight (g)": item.total_weight
        ? parseFloat(item.total_weight.toFixed(2))
        : 0,
      "Gravel Weight (g)": item.gravel_weight
        ? parseFloat(item.gravel_weight.toFixed(2))
        : 0,
      "Sand Weight (g)": item.sand_weight
        ? parseFloat(item.sand_weight.toFixed(2))
        : 0,
      "Gravel %": item.gravel_percent
        ? parseFloat(item.gravel_percent.toFixed(2))
        : 0,
      "Sand %": item.sand_percent
        ? parseFloat(item.sand_percent.toFixed(2))
        : 0,
      "Fines %": item.fines_percent
        ? parseFloat(item.fines_percent.toFixed(2))
        : 0,
      "USCS Soil Type": item.soil_type,
      "Predicted Soil Type": item.predicted_soil_type ?? "Not provided",
      "Image URL": item.image_soil_type ?? "Not provided",
      Status: item.status,
      "Review Count": item.review_count || 0,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "analysis_history.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <PageLayout currentPage="history">
      <div
        className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 border border-accent-700 transition-all duration-500 animate-in fade-in"
        style={{ backdropFilter: "blur(4px)" }}
      >
        {/* Title and Controls */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
          <h2 className="text-4xl font-bold text-accent-900 dark:text-accent-200 font-serif">
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
                className="w-full border border-accent-400 dark:border-accent-600 rounded-lg px-4 py-3 bg-accent-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all duration-300"
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
                className="w-full border border-accent-400 dark:border-accent-600 rounded-lg px-4 py-3 bg-accent-50 dark:bg-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all duration-300"
                aria-label="Filter by USCS soil type"
              >
                <option value="All">All Soil Types</option>
                <option value="Clean gravel">Clean gravel</option>
                <option value="Gravel with fines">Gravel with fines</option>
                <option value="Silty or clayey gravel">
                  Silty or clayey gravel
                </option>
                <option value="Clean sand">Clean sand</option>
                <option value="Sand with fines">Sand with fines</option>
                <option value="Silty or clayey sand">
                  Silty or clayey sand
                </option>
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
              <p className="text-lg text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={fetchHistory}
                className="text-accent-700 dark:text-accent-300 hover:underline focus:outline-none focus:ring-2 focus:ring-accent-500 text-base font-medium"
                aria-label="Retry loading data"
              >
                Retry
              </button>
            </div>
          </div>
        ) : filteredAnalyses.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table
                className="w-full table-auto border border-accent-400 dark:border-accent-600 text-base"
                role="grid"
                aria-describedby="analysis-history-caption"
              >
                <caption id="analysis-history-caption" className="sr-only">
                  History of soil analysis results submitted by the engineer
                </caption>
                <thead>
                  <tr className="bg-accent-100 dark:bg-accent-900 sticky top-0 z-10">
                    <th scope="col" className="px-6 py-4 text-left font-bold">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">
                      Location
                    </th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">
                      USCS Soil Type
                    </th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">
                      Reviews
                    </th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent-200 dark:divide-accent-800">
                  {currentAnalyses.map((item) => (
                    <tr
                      key={item.id}
                      className="odd:bg-accent-50 even:bg-white dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-accent-100 dark:hover:bg-accent-800 transition-colors duration-300"
                    >
                      <td className="px-6 py-4">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-accent-900 dark:text-accent-200">
                        {item.location ?? "—"}
                      </td>
                      <td className="px-6 py-4">{item.soil_type ?? "—"}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-3 py-2 text-sm font-bold rounded-full transition-all duration-300 ${getStatusBadgeClass(item.status)}`}
                          aria-label={`Status: ${item.status ?? "PENDING"}`}
                        >
                          {item.status ?? "PENDING"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.review_count > 0 ? (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openReviewModal(item.id)}
                              className="px-4 py-2 text-sm font-medium bg-accent-700 text-white rounded-lg hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                              aria-label={`View ${item.review_count} reviews for analysis ${item.id}`}
                            >
                              View Review
                            </button>
                            <span className="bg-accent-100 text-accent-800 text-sm font-bold px-3 py-2 rounded-lg dark:bg-accent-900 dark:text-accent-300">
                              {item.review_count}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDetailsModal(item)}
                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                            aria-label={`View full details for analysis ${item.id}`}
                          >
                            <Eye className="w-4 h-4" /> View Details
                          </button>
                          {["PENDING", "DISAPPROVED"].includes(
                            item.status?.toUpperCase(),
                          ) && (
                            <button
                              onClick={() => openDeleteModal(item.id)}
                              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
                              aria-label={`Delete analysis ${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" /> Delete
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
                      // Show first page, last page, current page, and pages around current page
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
        ) : (
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
                No analysis history available.
              </p>
              <button
                onClick={() => navigate("/engineer-home")}
                className="text-accent-700 dark:text-accent-300 hover:underline focus:outline-none focus:ring-2 focus:ring-accent-500 text-base font-medium"
                aria-label="Submit a new analysis"
              >
                Submit a new analysis
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Review, Details, or Delete */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 animate-in fade-in scale-95 hover:scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-accent-200 dark:border-accent-700">
              <h3 className="text-2xl font-bold text-accent-900 dark:text-accent-200">
                {modalType === "review"
                  ? "Review Details"
                  : modalType === "details"
                    ? "Full Analysis Details"
                    : "Confirm Deletion"}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-accent-100 dark:hover:bg-accent-900 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors duration-300"
                aria-label="Close modal"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {modalType === "review" ? (
                <>
                  {reviewLoading ? (
                    <div className="flex justify-center items-center h-48">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-700"></div>
                    </div>
                  ) : reviewError ? (
                    <p className="text-lg text-red-600 dark:text-red-400">
                      {reviewError}
                    </p>
                  ) : selectedReviews.length > 0 ? (
                    <div className="space-y-6">
                      {selectedReviews.map((review) => (
                        <div
                          key={review.id}
                          className="border-l-4 border-accent-700 dark:border-accent-400 bg-accent-50 dark:bg-gray-700 p-5 rounded-lg"
                        >
                          <p className="text-lg font-bold text-accent-900 dark:text-accent-200 mb-2">
                            {review.reviewer_name}
                          </p>
                          <p className="text-base text-gray-700 dark:text-gray-300 mb-3">
                            {review.comments || "No comment provided"}
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
              ) : modalType === "details" && selectedAnalysis ? (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                    <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200 mb-4">
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Date
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {formatDateTime(selectedAnalysis.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Location
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {selectedAnalysis.location ?? "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Status
                        </p>
                        <span
                          className={`inline-block px-3 py-1 text-sm font-bold rounded-full ${getStatusBadgeClass(selectedAnalysis.status)}`}
                        >
                          {selectedAnalysis.status ?? "PENDING"}
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
                          {selectedAnalysis.total_weight
                            ? `${selectedAnalysis.total_weight.toFixed(2)} g`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Gravel Weight
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {selectedAnalysis.gravel_weight
                            ? `${selectedAnalysis.gravel_weight.toFixed(2)} g`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sand Weight
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {selectedAnalysis.sand_weight
                            ? `${selectedAnalysis.sand_weight.toFixed(2)} g`
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
                          {selectedAnalysis.gravel_percent
                            ? `${selectedAnalysis.gravel_percent.toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sand %
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {selectedAnalysis.sand_percent
                            ? `${selectedAnalysis.sand_percent.toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Fines %
                        </p>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {selectedAnalysis.fines_percent
                            ? `${selectedAnalysis.fines_percent.toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Soil Classification (ML + USCS Mapping style) */}
                  {(() => {
                    const g = selectedAnalysis?.gravel_percent ?? null;
                    const s = selectedAnalysis?.sand_percent ?? null;
                    const f = selectedAnalysis?.fines_percent ?? null;

                    // IMPORTANT: use the shape your util expects.
                    // In your current code, you pass gravel_percent/sand_percent/fines_percent,
                    // so keep that to avoid breaking.
                    const map =
                      g != null && s != null && f != null
                        ? getUscsMapping({
                            gravel_percent: g,
                            sand_percent: s,
                            fines_percent: f,
                          })
                        : null;

                    // Allow both util output styles:
                    // - your current util: { title, headline, symbol, path, notes }
                    // - the newer style: { summaryLine, badgeTitle, badgeSubtitle, decisionPath, notes }
                    const summaryLine =
                      map?.summaryLine ??
                      map?.headline ??
                      "USCS mapping not available";
                    const badgeTitle = map?.badgeTitle ?? map?.symbol ?? "—";
                    const badgeSubtitle = map?.badgeSubtitle ?? "";
                    const decisionPath = map?.decisionPath ?? map?.path ?? [];
                    const notes = map?.notes ?? [];

                    return (
                      <div className="space-y-5">
                        {/* ===== Soil Classification + USCS Mapping (ExpertDashboard-style) ===== */}
                        <div className="space-y-6">
                          {/* Card 1: Soil Classification (ML Prediction Result) */}
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
                                  {selectedAnalysis?.soil_type ?? "—"}
                                </p>
                              </div>

                              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-accent-300 dark:border-accent-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                  Predicted Soil Type
                                </p>
                                <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                                  {selectedAnalysis?.predicted_soil_type ??
                                    "Not provided"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Card 2: USCS Mapping (USCS Reference Mapping) */}
                          <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="text-xl">📊</div>
                              <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200">
                                USCS Reference Mapping
                              </h4>
                            </div>

                            {!map ? (
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                Mapping not available (missing gravel/sand/fines
                                %).
                              </p>
                            ) : (
                              <>
                                {/* headline + badge (same as ExpertDashboard style) */}
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                    {summaryLine}
                                  </p>

                                  <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-gray-900 text-white dark:bg-black/60 border border-gray-700">
                                    <span className="mr-2">{badgeTitle}</span>
                                    {!!badgeSubtitle && (
                                      <span className="text-xs text-gray-200 font-medium">
                                        {badgeSubtitle}
                                      </span>
                                    )}
                                  </span>
                                </div>

                                {/* Smaller Gravel/Sand/Fines boxes (pinaliit height/width feel) */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                  <div className="rounded-lg px-4 py-3 bg-white/70 dark:bg-gray-800/40 border border-accent-200 dark:border-accent-700">
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      Gravel
                                    </p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                      {Number(g ?? 0).toFixed(2)}%
                                    </p>
                                  </div>
                                  <div className="rounded-lg px-4 py-3 bg-white/70 dark:bg-gray-800/40 border border-accent-200 dark:border-accent-700">
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      Sand
                                    </p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                      {Number(s ?? 0).toFixed(2)}%
                                    </p>
                                  </div>
                                  <div className="rounded-lg px-4 py-3 bg-white/70 dark:bg-gray-800/40 border border-accent-200 dark:border-accent-700">
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      Fines
                                    </p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                      {Number(f ?? 0).toFixed(2)}%
                                    </p>
                                  </div>
                                </div>

                                {/* Decision path */}
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                  Decision path (USCS flow):
                                </p>
                                <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                  {decisionPath.map((line, idx) => (
                                    <li key={idx}>{line}</li>
                                  ))}
                                </ul>

                                {/* Notes */}
                                {notes?.length ? (
                                  <div className="mt-4 border border-accent-200 dark:border-accent-700 rounded-lg p-4 bg-white/70 dark:bg-gray-800/40">
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                                      Notes / What you need to finalize:
                                    </p>
                                    <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                      {notes.map((n, idx) => (
                                        <li key={idx}>{n}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Image */}
                  {selectedAnalysis.image_soil_type &&
                    (selectedAnalysis.image_soil_type.startsWith("http") ||
                      selectedAnalysis.image_soil_type.startsWith("https")) && (
                      <div className="bg-accent-50 dark:bg-gray-700 p-6 rounded-lg">
                        <h4 className="text-xl font-bold text-accent-900 dark:text-accent-200 mb-4">
                          Soil Sample Image
                        </h4>
                        <img
                          src={selectedAnalysis.image_soil_type}
                          alt={`Soil sample for ${selectedAnalysis.soil_type}`}
                          className="w-full max-w-md mx-auto rounded-lg border border-accent-400 cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() =>
                            window.open(
                              selectedAnalysis.image_soil_type,
                              "_blank",
                            )
                          }
                          title="Click to view full size"
                        />
                      </div>
                    )}
                </div>
              ) : modalType === "delete" ? (
                <>
                  {deleteError ? (
                    <p className="text-lg text-red-600 dark:text-red-400 mb-6">
                      {deleteError}
                    </p>
                  ) : (
                    <p className="text-lg text-gray-700 dark:text-gray-200 mb-6">
                      Are you sure you want to delete this{" "}
                      <span className="font-bold">
                        {analyses
                          .find((item) => item.id === selectedAnalysisId)
                          ?.status?.toUpperCase() || "PENDING"}
                      </span>{" "}
                      analysis? This action cannot be undone.
                    </p>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-8 py-6 border-t border-accent-200 dark:border-accent-700 bg-accent-50 dark:bg-gray-700">
              <button
                onClick={closeModal}
                className="px-6 py-3 text-base font-medium bg-accent-300 dark:bg-accent-700 text-accent-900 dark:text-accent-100 rounded-lg hover:bg-accent-400 dark:hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-all duration-300"
                aria-label={
                  modalType === "review"
                    ? "Close review modal"
                    : modalType === "details"
                      ? "Close details modal"
                      : "Cancel deletion"
                }
              >
                {modalType === "delete" ? "Cancel" : "Close"}
              </button>
              {modalType === "delete" && (
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
    </PageLayout>
  );
};

export default EngineerAnalysisHistory;
