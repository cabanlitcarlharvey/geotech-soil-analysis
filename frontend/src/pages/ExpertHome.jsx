import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  BarChart2,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Label,
  LabelList,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import PageLayout from "../components/shared/PageLayout";
import StatCard from "../components/shared/StatCard";

const ExpertHome = () => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(
    localStorage.getItem("theme") === "dark",
  );
  const [statusData, setStatusData] = useState([]);
  const [soilTypeData, setSoilTypeData] = useState([]);
  const [showPercentage, setShowPercentage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expertName, setExpertName] = useState("");
  const [stats, setStats] = useState({
    totalPending: 0,
    totalApproved: 0,
    totalDisapproved: 0,
    approvalRate: 0,
    totalAnalyses: 0,
  });
  const [recentAnalyses, setRecentAnalyses] = useState([]);

  const statusColorMap = {
    APPROVED: "#16a34a",
    DECLINED: "#dc2626",
    DISAPPROVED: "#dc2626",
    PENDING: "#f59e0b",
    UNKNOWN: "#6b7280",
  };

  useEffect(() => {
    setIsDark(localStorage.getItem("theme") === "dark");
  }, []);

  useEffect(() => {
    const fetchExpertName = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && user.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          setExpertName(profile?.full_name || user.email || "Expert");
        } else {
          setExpertName("Expert");
        }
      } catch (err) {
        console.error("Error fetching expert name:", err);
        setExpertName("Expert");
      }
    };
    fetchExpertName();
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("soil_analysis_results")
        .select("status, soil_type, created_at, location, engineer_id, id")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      if (data && data.length > 0) {
        const totalAnalyses = data.length;
        const totalApproved = data.filter(
          (d) => d.status?.toUpperCase() === "APPROVED",
        ).length;
        const totalPending = data.filter(
          (d) => d.status?.toUpperCase() === "PENDING" || !d.status,
        ).length;
        const totalDisapproved = data.filter(
          (d) => d.status?.toUpperCase() === "DISAPPROVED",
        ).length;
        const approvalRate =
          totalAnalyses > 0
            ? ((totalApproved / totalAnalyses) * 100).toFixed(1)
            : 0;

        setStats({
          totalAnalyses,
          totalApproved,
          totalPending,
          totalDisapproved,
          approvalRate: parseFloat(approvalRate),
        });

        setRecentAnalyses(data.slice(0, 5));

        // Process status data
        const statusCounts = data.reduce((acc, { status }) => {
          const normalizedStatus = status?.toUpperCase() || "UNKNOWN";
          acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
          return acc;
        }, {});
        const totalStatus = Object.values(statusCounts).reduce(
          (sum, count) => sum + count,
          0,
        );
        const formattedStatus = Object.entries(statusCounts).map(
          ([status, count]) => ({
            status,
            count,
            percentage:
              totalStatus > 0
                ? parseFloat(((count / totalStatus) * 100).toFixed(1))
                : 0,
          }),
        );
        setStatusData(formattedStatus);

        // Process soil type data
        const soilTypeCounts = data.reduce((acc, { soil_type }) => {
          const normalizedSoilType = soil_type || "Unknown";
          acc[normalizedSoilType] = (acc[normalizedSoilType] || 0) + 1;
          return acc;
        }, {});
        const totalSoilType = Object.values(soilTypeCounts).reduce(
          (sum, count) => sum + count,
          0,
        );
        const formattedSoilType = Object.entries(soilTypeCounts).map(
          ([soil_type, count]) => ({
            soil_type,
            count,
            percentage:
              totalSoilType > 0
                ? parseFloat(((count / totalSoilType) * 100).toFixed(1))
                : 0,
          }),
        );
        setSoilTypeData(formattedSoilType);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-base">{label}</p>
          <p className="text-sm">Count: {payload[0].value}</p>
          <p className="text-sm">
            Percentage: {payload[0].payload.percentage}%
          </p>
        </div>
      );
    }
    return null;
  };

  const formatDateTime = (utcDate) => {
    const date = new Date(utcDate);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case "APPROVED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "DISAPPROVED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    }
  };

  const pieChartData = statusData.map((item) => ({
    name: item.status,
    value: item.count,
    fill: statusColorMap[item.status] || "#6b7280",
  }));

  return (
    <PageLayout currentPage="home" userType="expert">
      {/* Welcome Section */}
      <div
        className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 mb-12 border border-accent-700 transition-all duration-500 animate-in fade-in"
        style={{ backdropFilter: "blur(4px)" }}
      >
        <h2 className="text-4xl font-bold mb-4 text-accent-900 dark:text-accent-200 font-serif">
          Welcome, Engr. {expertName}!
        </h2>
        <p className="mb-8 text-lg text-gray-700 dark:text-gray-200">
          Review and validate soil analysis submitted by engineers to ensure
          accuracy and quality.
        </p>
        <button
          onClick={() => navigate("/expert-dashboard")}
          className="flex items-center justify-center gap-3 bg-green-700 text-white px-6 py-3 rounded-lg hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-semibold text-lg transition-all duration-300 transform hover:scale-105"
          aria-label="Go to validation dashboard"
        >
          <BarChart2 className="w-6 h-6" />
          Go to Validation Dashboard
        </button>
      </div>

      {/* Summary Statistics Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          <StatCard
            title="Total Analyses"
            value={stats.totalAnalyses}
            description="Under review"
            icon={BarChart2}
            color="blue"
          />
          <StatCard
            title="Pending Review"
            value={stats.totalPending}
            description="Awaiting decision"
            icon={Clock}
            color="yellow"
          />
          <StatCard
            title="Approved"
            value={stats.totalApproved}
            description="Verified valid"
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Disapproved"
            value={stats.totalDisapproved}
            description="Requires revision"
            icon={AlertCircle}
            color="red"
          />
          <StatCard
            title="Approval Rate"
            value={`${stats.approvalRate}%`}
            description="Overall acceptance"
            icon={TrendingUp}
            color="purple"
          />
        </div>
      )}

      {/* Recent Analyses Section */}
      {!loading && !error && recentAnalyses.length > 0 && (
        <div
          className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 mb-12 border border-accent-700 transition-all duration-500 animate-in fade-in"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <h3 className="text-3xl font-bold text-accent-900 dark:text-accent-200 mb-6">
            Recent Submissions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-accent-100 dark:bg-accent-900">
                  <th scope="col" className="px-6 py-4 text-left font-bold">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-4 text-left font-bold">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-4 text-left font-bold">
                    Soil Type
                  </th>
                  <th scope="col" className="px-6 py-4 text-left font-bold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-200 dark:divide-accent-800">
                {recentAnalyses.map((item) => (
                  <tr
                    key={item.id}
                    className="odd:bg-accent-50 even:bg-white dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-accent-100 dark:hover:bg-accent-800 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-accent-900 dark:text-accent-200">
                      {item.location ?? "—"}
                    </td>
                    <td className="px-6 py-4">{item.soil_type ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-2 text-sm font-bold rounded-full ${getStatusColor(item.status)}`}
                      >
                        {item.status ?? "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Visualization */}
      <div
        className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 border border-accent-700 transition-all duration-500 animate-in fade-in"
        style={{ backdropFilter: "blur(4px)" }}
      >
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <h3 className="text-3xl font-bold text-green-800 dark:text-green-200">
            Analysis Overview
          </h3>
          <div className="flex gap-3 w-full lg:w-auto flex-wrap">
            <button
              onClick={() => setShowPercentage(!showPercentage)}
              className="px-5 py-3 text-base font-medium bg-accent-300 dark:bg-accent-700 text-accent-900 dark:text-accent-100 rounded-lg hover:bg-accent-400 dark:hover:bg-accent-800 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-colors duration-300"
            >
              {showPercentage ? "Show Count" : "Show Percentage"}
            </button>
            <button
              onClick={fetchData}
              className="px-5 py-3 text-base font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-300"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-700"></div>
            <p className="mt-4 text-lg text-gray-700 dark:text-gray-200">
              Loading data...
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-lg text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={fetchData}
              className="text-accent-700 dark:text-accent-300 hover:underline mt-4"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Status Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Status Bar Chart */}
              <div className="lg:col-span-2">
                <h4 className="text-2xl font-bold mb-6 text-green-900 dark:text-green-200">
                  Status Distribution
                </h4>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={420}>
                    <BarChart
                      data={statusData}
                      margin={{ top: 30, right: 40, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="status"
                        tick={{
                          fill: isDark ? "#d1d5db" : "#374151",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        <Label
                          value="Status"
                          offset={20}
                          position="bottom"
                          fill={isDark ? "#d1d5db" : "#374151"}
                          fontSize={14}
                          fontWeight={700}
                        />
                      </XAxis>
                      <YAxis
                        tick={{
                          fill: isDark ? "#d1d5db" : "#374151",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        <Label
                          value={showPercentage ? "Percentage (%)" : "Count"}
                          angle={-90}
                          position="insideLeft"
                          fill={isDark ? "#d1d5db" : "#374151"}
                          fontSize={14}
                          fontWeight={700}
                        />
                      </YAxis>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 14, paddingTop: 20 }} />
                      <Bar
                        dataKey={showPercentage ? "percentage" : "count"}
                        radius={[8, 8, 0, 0]}
                        barSize={60}
                      >
                        {statusData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={statusColorMap[entry.status] || "#6b7280"}
                          />
                        ))}
                        <LabelList
                          dataKey={showPercentage ? "percentage" : "count"}
                          position="top"
                          formatter={(value) =>
                            showPercentage ? `${value}%` : value
                          }
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            fill: isDark ? "#e5e7eb" : "#111827",
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-12 text-gray-700 dark:text-gray-200">
                    No status data available.
                  </p>
                )}
              </div>

              {/* Status Pie Chart */}
              <div>
                <h4 className="text-2xl font-bold mb-6 text-accent-900 dark:text-accent-200">
                  Review Status
                </h4>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={420}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        label={({ name, value, percent }) =>
                          `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={120}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-12 text-gray-700 dark:text-gray-200">
                    No review data available.
                  </p>
                )}
              </div>
            </div>

            {/* Soil Type Chart */}
            <div>
              <h4 className="text-2xl font-bold mb-6 text-accent-900 dark:text-accent-200">
                Soil Type Distribution
              </h4>
              {soilTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={soilTypeData}
                    margin={{ top: 30, right: 40, left: 20, bottom: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="soil_type"
                      tick={{
                        fill: isDark ? "#d1d5db" : "#374151",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      <Label
                        value="Soil Type"
                        offset={50}
                        position="bottom"
                        fill={isDark ? "#d1d5db" : "#374151"}
                        fontSize={14}
                        fontWeight={700}
                      />
                    </XAxis>
                    <YAxis
                      tick={{
                        fill: isDark ? "#d1d5db" : "#374151",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      <Label
                        value={showPercentage ? "Percentage (%)" : "Count"}
                        angle={-90}
                        position="insideLeft"
                        fill={isDark ? "#d1d5db" : "#374151"}
                        fontSize={14}
                        fontWeight={700}
                      />
                    </YAxis>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 14, paddingTop: 20 }} />
                    <Bar
                      dataKey={showPercentage ? "percentage" : "count"}
                      className="fill-accent-700 dark:fill-accent-400"
                      radius={[8, 8, 0, 0]}
                      barSize={60}
                    >
                      <LabelList
                        dataKey={showPercentage ? "percentage" : "count"}
                        position="top"
                        formatter={(value) =>
                          showPercentage ? `${value}%` : value
                        }
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          fill: isDark ? "#e5e7eb" : "#111827",
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-12 text-gray-700 dark:text-gray-200">
                  No soil type data available.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default ExpertHome;
