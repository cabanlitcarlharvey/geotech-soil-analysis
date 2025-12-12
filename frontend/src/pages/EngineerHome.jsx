import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Sun, Moon, LogOut, Home, History, TestTube2, BarChart2, Beaker, TrendingUp, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  Label,
  LabelList,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

const EngineerHome = () => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [soilTypeData, setSoilTypeData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [showPercentage, setShowPercentage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [engineerName, setEngineerName] = useState('');
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    approvalRate: 0,
    pendingCount: 0,
    disapprovedCount: 0,
    approvedCount: 0,
  });
  const [recentAnalyses, setRecentAnalyses] = useState([]);

  const statusColorMap = {
    APPROVED: '#16a34a',
    DECLINED: '#dc2626',
    DISAPPROVED: '#dc2626',
    PENDING: '#f59e0b',
    UNKNOWN: '#6b7280',
  };

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setIsDark(!isDark);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          if (profile?.full_name) {
            setEngineerName(profile.full_name);
          } else if (user.email) {
            setEngineerName(user.email);
          } else {
            setEngineerName('Engineer');
          }
        } else {
          setEngineerName('Engineer');
        }
      } catch (err) {
        console.error('Error fetching user name:', err);
        setEngineerName('Engineer');
      }
    };
    fetchUserName();
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.id) {
        throw new Error('Authentication error');
      }

      const { data, error } = await supabase
        .from('soil_analysis_results')
        .select('soil_type, status, created_at, id, location, gravel_percent, sand_percent, fines_percent')
        .eq('engineer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Calculate statistics
        const totalAnalyses = data.length;
        const approvedCount = data.filter(d => d.status?.toUpperCase() === 'APPROVED').length;
        const pendingCount = data.filter(d => d.status?.toUpperCase() === 'PENDING' || !d.status).length;
        const disapprovedCount = data.filter(d => d.status?.toUpperCase() === 'DISAPPROVED').length;
        const approvalRate = totalAnalyses > 0 ? ((approvedCount / totalAnalyses) * 100).toFixed(1) : 0;

        setStats({
          totalAnalyses,
          approvalRate: parseFloat(approvalRate),
          pendingCount,
          disapprovedCount,
          approvedCount,
        });

        // Get recent 5 analyses
        setRecentAnalyses(data.slice(0, 5));

        // Process soil type data
        const soilTypeCounts = data.reduce((acc, { soil_type }) => {
          const normalizedSoilType = soil_type || 'Unknown';
          acc[normalizedSoilType] = (acc[normalizedSoilType] || 0) + 1;
          return acc;
        }, {});
        const totalSoilType = Object.values(soilTypeCounts).reduce((sum, count) => sum + count, 0);
        const formattedSoilType = Object.entries(soilTypeCounts).map(([soil_type, count]) => ({
          soil_type,
          count,
          percentage: totalSoilType > 0 ? parseFloat(((count / totalSoilType) * 100).toFixed(1)) : 0,
        }));
        setSoilTypeData(formattedSoilType);

        // Process status data
        const statusCounts = data.reduce((acc, { status }) => {
          const normalizedStatus = status?.toUpperCase() || 'UNKNOWN';
          acc[normalizedStatus] = (acc[normalizedStatus] || 0) + 1;
          return acc;
        }, {});
        const totalStatus = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
        const formattedStatus = Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count,
          percentage: totalStatus > 0 ? parseFloat(((count / totalStatus) * 100).toFixed(1)) : 0,
        }));
        setStatusData(formattedStatus);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err.message);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-base">{label}</p>
          <p className="text-sm">Count: {payload[0].value}</p>
          <p className="text-sm">Percentage: {payload[0].payload.percentage}%</p>
        </div>
      );
    }
    return null;
  };

  const formatDateTime = (utcDate) => {
    const date = new Date(utcDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'DISAPPROVED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
  };

  const pieChartData = statusData.map(item => ({
    name: item.status,
    value: item.count,
    fill: statusColorMap[item.status] || '#6b7280'
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      {/* Navbar */}
      <header className="bg-white/95 dark:bg-gray-800/95 shadow px-8 py-6 flex justify-between items-center border-b border-amber-700 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
        <div
          className="flex items-center gap-3 cursor-pointer group transition-transform duration-300 hover:scale-105"
          onClick={() => window.location.reload()}
          title="Refresh Staff Home"
          tabIndex={0}
          role="button"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') window.location.reload(); }}
          aria-label="Refresh Engineer Home"
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
        {/* Welcome Section */}
        <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 mb-12 border border-amber-700 transition-all duration-500 animate-in fade-in" style={{ backdropFilter: 'blur(4px)' }}>
          <h2 className="text-4xl font-bold mb-4 text-amber-900 dark:text-amber-200 font-serif">
            Welcome, {engineerName}!
          </h2>
          <p className="mb-8 text-lg text-gray-700 dark:text-gray-200">
            Choose an action below to get started with your soil analysis tasks.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => navigate('/soil-analysis')}
              className="flex items-center justify-center gap-3 bg-amber-700 text-white p-6 rounded-xl hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 font-semibold text-lg transition-all duration-300 transform hover:scale-105"
              aria-label="Perform soil analysis"
            >
              <TestTube2 className="w-6 h-6" />
              Perform Soil Analysis
            </button>
            <button
              onClick={() => navigate('/engineer-history')}
              className="flex items-center justify-center gap-3 bg-green-700 text-white p-6 rounded-xl hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-semibold text-lg transition-all duration-300 transform hover:scale-105"
              aria-label="View analysis history"
            >
              <BarChart2 className="w-6 h-6" />
              View Analysis History
            </button>
          </div>
        </div>

        {/* Summary Statistics Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
            {/* Total Analyses */}
            <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl p-6 border border-blue-400 dark:border-blue-600 transition-all duration-300 hover:shadow-2xl transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200">Total Analyses</h3>
                <TestTube2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-4xl font-bold text-blue-700 dark:text-blue-300">{stats.totalAnalyses}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">All submitted analyses</p>
            </div>

            {/* Pending */}
            <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl p-6 border border-yellow-400 dark:border-yellow-600 transition-all duration-300 hover:shadow-2xl transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-200">Pending</h3>
                <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-4xl font-bold text-yellow-700 dark:text-yellow-300">{stats.pendingCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Awaiting review</p>
            </div>

            {/* Approved */}
            <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl p-6 border border-emerald-400 dark:border-emerald-600 transition-all duration-300 hover:shadow-2xl transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">Approved</h3>
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-300">{stats.approvedCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Verified valid</p>
            </div>

            {/* Disapproved */}
            <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl p-6 border border-red-400 dark:border-red-600 transition-all duration-300 hover:shadow-2xl transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-red-900 dark:text-red-200">Disapproved</h3>
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-4xl font-bold text-red-700 dark:text-red-300">{stats.disapprovedCount}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Needs revision</p>
            </div>

            {/* Approval Rate */}
            <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl p-6 border border-purple-400 dark:border-purple-600 transition-all duration-300 hover:shadow-2xl transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-200">Approval Rate</h3>
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-4xl font-bold text-purple-700 dark:text-purple-300">{stats.approvalRate}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Overall acceptance</p>
            </div>
          </div>
        )}

        {/* Recent Analyses Section */}
        {!loading && !error && recentAnalyses.length > 0 && (
          <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 mb-12 border border-amber-700 transition-all duration-500 animate-in fade-in" style={{ backdropFilter: 'blur(4px)' }}>
            <h3 className="text-3xl font-bold text-amber-900 dark:text-amber-200 mb-6">Recent Analyses</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-amber-100 dark:bg-amber-900">
                    <th scope="col" className="px-6 py-4 text-left font-bold">Date</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Location</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Soil Type</th>
                    <th scope="col" className="px-6 py-4 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200 dark:divide-amber-800">
                  {recentAnalyses.map((item) => (
                    <tr key={item.id} className="odd:bg-amber-50 even:bg-white dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors">
                      <td className="px-6 py-4">{formatDateTime(item.created_at)}</td>
                      <td className="px-6 py-4 font-semibold text-amber-900 dark:text-amber-200">{item.location ?? '—'}</td>
                      <td className="px-6 py-4">{item.soil_type ?? '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-2 text-sm font-bold rounded-full ${getStatusColor(item.status)}`}>
                          {item.status ?? 'PENDING'}
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
        <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-2xl p-10 border border-amber-700 transition-all duration-500 animate-in fade-in" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
            <h3 className="text-3xl font-bold text-green-800 dark:text-green-200">Your Analysis Overview</h3>
            <div className="flex gap-3 w-full lg:w-auto flex-wrap">
              <button
                onClick={() => setShowPercentage(!showPercentage)}
                className="px-5 py-3 text-base font-medium bg-amber-300 dark:bg-amber-700 text-amber-900 dark:text-amber-100 rounded-lg hover:bg-amber-400 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-300"
                aria-label={showPercentage ? 'Show count' : 'Show percentage'}
              >
                {showPercentage ? 'Show Count' : 'Show Percentage'}
              </button>
              <button
                onClick={fetchChartData}
                className="px-5 py-3 text-base font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-300"
                aria-label="Refresh chart data"
              >
                Refresh
              </button>
            </div>
          </div>

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
                  onClick={fetchChartData}
                  className="text-amber-700 dark:text-amber-300 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 text-base font-medium"
                  aria-label="Retry loading data"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              {/* Charts Grid - Status and Pie side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Status Distribution Bar Chart */}
                <div className="lg:col-span-2 transition-all duration-500">
                  <h4 className="text-2xl font-bold mb-6 text-green-900 dark:text-green-200">Status Distribution</h4>
                  {statusData.length > 0 ? (
                    <ResponsiveContainer
                      width="100%"
                      height={420}
                      aria-label="Bar chart showing status distribution"
                    >
                      <BarChart
                        data={statusData}
                        margin={{ top: 30, right: 40, left: 20, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-600" />
                        <XAxis
                          dataKey="status"
                          tick={{ fill: isDark ? '#d1d5db' : '#374151', fontSize: 14, fontWeight: 700 }}
                        >
                          <Label value="Status" offset={20} position="bottom" fill={isDark ? '#d1d5db' : '#374151'} fontSize={14} fontWeight={700} />
                        </XAxis>
                        <YAxis
                          dataKey={showPercentage ? 'percentage' : 'count'}
                          allowDecimals={showPercentage}
                          tickFormatter={(value) => (showPercentage ? `${value}%` : value)}
                          domain={[0, (dataMax) => {
                            const top = Math.max(1, Math.ceil((dataMax || 0) * 1.1));
                            return showPercentage ? Math.min(100, top) : top;
                          }]}
                          tick={{ fill: isDark ? '#d1d5db' : '#374151', fontSize: 14, fontWeight: 700 }}
                        >
                          <Label value={showPercentage ? 'Percentage (%)' : 'Count'} angle={-90} position="insideLeft" fill={isDark ? '#d1d5db' : '#374151'} fontSize={14} fontWeight={700} />
                        </YAxis>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 14, paddingTop: 20 }} />
                        <Bar
                          dataKey={showPercentage ? 'percentage' : 'count'}
                          radius={[8, 8, 0, 0]}
                          barSize={60}
                          animationDuration={900}
                          animationEasing="ease-in-out"
                          name={showPercentage ? 'Percentage' : 'Count'}
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={statusColorMap[entry.status] || '#6b7280'} />
                          ))}
                          <LabelList
                            dataKey={showPercentage ? 'percentage' : 'count'}
                            position="top"
                            formatter={(value) => (showPercentage ? `${value}%` : value)}
                            style={{ fontSize: 14, fontWeight: 700, fill: isDark ? '#e5e7eb' : '#111827' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-lg text-gray-700 dark:text-gray-200">No status data available.</p>
                    </div>
                  )}
                </div>

                {/* Status Pie Chart */}
                <div className="transition-all duration-500">
                  <h4 className="text-2xl font-bold mb-6 text-amber-900 dark:text-amber-200">Status Overview</h4>
                  {statusData.length > 0 ? (
                    <ResponsiveContainer
                      width="100%"
                      height={420}
                      aria-label="Pie chart showing status overview"
                    >
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                          animationDuration={800}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-lg text-gray-700 dark:text-gray-200">No status data available.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Soil Type Distribution Chart - Full Width Below */}
              <div className="transition-all duration-500">
                <h4 className="text-2xl font-bold mb-6 text-amber-900 dark:text-amber-200">Soil Type Distribution</h4>
                {soilTypeData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={400}
                    aria-label="Bar chart showing soil type distribution"
                  >
                    <BarChart
                      data={soilTypeData}
                      margin={{ top: 30, right: 40, left: 20, bottom: 100 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-600" />
                      <XAxis
                        dataKey="soil_type"
                        angle={0}
                        textAnchor="middle"
                        height={100}
                        tick={{ fill: isDark ? '#d1d5db' : '#374151', fontSize: 14, fontWeight: 700 }}
                      >
                        <Label value="Soil Type" offset={50} position="bottom" fill={isDark ? '#d1d5db' : '#374151'} fontSize={14} fontWeight={700} />
                      </XAxis>
                      <YAxis
                        dataKey={showPercentage ? 'percentage' : 'count'}
                        allowDecimals={showPercentage}
                        tickFormatter={(value) => (showPercentage ? `${value}%` : value)}
                        domain={[0, (dataMax) => {
                          const top = Math.max(1, Math.ceil((dataMax || 0) * 1.1));
                          return showPercentage ? Math.min(100, top) : top;
                        }]}
                        tick={{ fill: isDark ? '#d1d5db' : '#374151', fontSize: 14, fontWeight: 700 }}
                      >
                        <Label value={showPercentage ? 'Percentage (%)' : 'Count'} angle={-90} position="insideLeft" fill={isDark ? '#d1d5db' : '#374151'} fontSize={14} fontWeight={700} />
                      </YAxis>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 14, paddingTop: 20 }} />
                      <Bar
                        dataKey={showPercentage ? 'percentage' : 'count'}
                        className="fill-amber-700 dark:fill-amber-400"
                        radius={[8, 8, 0, 0]}
                        barSize={60}
                        animationDuration={900}
                        animationEasing="ease-in-out"
                        name={showPercentage ? 'Percentage' : 'Count'}
                      >
                        <LabelList
                          dataKey={showPercentage ? 'percentage' : 'count'}
                          position="top"
                          formatter={(value) => (showPercentage ? `${value}%` : value)}
                          style={{ fontSize: 14, fontWeight: 700, fill: isDark ? '#e5e7eb' : '#111827' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-lg text-gray-700 dark:text-gray-200">No soil type data available.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default EngineerHome;