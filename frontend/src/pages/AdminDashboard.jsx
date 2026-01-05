import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogOut, Edit2, Sun, Moon, CheckCircle, XCircle, AlertCircle, X, Users, UserCheck, UserX, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' });
  const [editId, setEditId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [deleteModal, setDeleteModal] = useState({ show: false, userId: null, userName: '', userRole: '' });
  const [activeTab, setActiveTab] = useState('all'); // all, pending, approved, declined, admins
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllUsers();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert({ show: false, message: '', type: 'info' });
    }, 4000);
  };

  const closeAlert = () => {
    setAlert({ show: false, message: '', type: 'info' });
  };

  const fetchAllUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, status')
      .order('created_at', { ascending: false });
    if (error) {
      showAlert('Error fetching users.', 'error');
      setAllUsers([]);
    } else {
      setAllUsers(data || []);
    }
    setLoading(false);
  };

  const handleApprove = async (id) => {
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ status: 'APPROVED' }).eq('id', id);
    if (error) {
      showAlert('Failed to approve account.', 'error');
    } else {
      showAlert('Account approved successfully!', 'success');
    }
    await fetchAllUsers();
    setLoading(false);
  };

  const handleDecline = async (id) => {
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ status: 'DECLINED' }).eq('id', id);
    if (error) {
      showAlert('Failed to decline account.', 'error');
    } else {
      showAlert('Account declined.', 'warning');
    }
    await fetchAllUsers();
    setLoading(false);
  };

  const handleDeleteClick = (id, role, fullName) => {
    if (role === 'admin') {
      showAlert("You can't delete an admin account.", 'error');
      return;
    }
    setDeleteModal({ show: true, userId: id, userName: fullName, userRole: role });
  };

  const confirmDelete = async () => {
    const { userId } = deleteModal;
    setDeleteModal({ show: false, userId: null, userName: '', userRole: '' });
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        showAlert('Not authenticated.', 'error');
        setLoading(false);
        return;
      }

      const resp = await fetch('http://localhost:8000/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: userId })
      });

      const result = await resp.json();

      if (!resp.ok) {
        showAlert(result?.detail || result?.message || 'Failed to delete account.', 'error');
      } else {
        showAlert('Account deleted successfully!', 'success');
      }
    } catch (err) {
      console.error(err);
      showAlert('Failed to delete account.', 'error');
    } finally {
      await fetchAllUsers();
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, userId: null, userName: '', userRole: '' });
  };

  const handleEdit = (id, currentStatus) => {
    setEditId(id);
    setEditStatus(currentStatus);
  };

  const handleEditSave = async (id) => {
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ status: editStatus }).eq('id', id);
    if (error) {
      showAlert('Failed to update status.', 'error');
    } else {
      showAlert('Status updated successfully!', 'success');
    }
    setEditId(null);
    await fetchAllUsers();
    setLoading(false);
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditStatus('');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getAlertStyles = () => {
    switch (alert.type) {
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-900/30 border-green-500',
          icon: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
          text: 'text-green-800 dark:text-green-200'
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-900/30 border-red-500',
          icon: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
          text: 'text-red-800 dark:text-red-200'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-500',
          icon: <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
          text: 'text-amber-800 dark:text-amber-200'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-500',
          icon: <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
          text: 'text-blue-800 dark:text-blue-200'
        };
    }
  };

  const alertStyles = getAlertStyles();

  // Filter users based on active tab
  const getFilteredUsers = () => {
    switch (activeTab) {
      case 'pending':
        return allUsers.filter(user => user.status === 'PENDING');
      case 'approved':
        return allUsers.filter(user => user.status === 'APPROVED' && user.role !== 'admin');
      case 'declined':
        return allUsers.filter(user => user.status === 'DECLINED');
      case 'admins':
        return allUsers.filter(user => user.role === 'admin');
      default:
        return allUsers;
    }
  };

  const filteredUsers = getFilteredUsers();

  // Count statistics
  const stats = {
    total: allUsers.length,
    pending: allUsers.filter(u => u.status === 'PENDING').length,
    approved: allUsers.filter(u => u.status === 'APPROVED' && u.role !== 'admin').length,
    declined: allUsers.filter(u => u.status === 'DECLINED').length,
    admins: allUsers.filter(u => u.role === 'admin').length,
  };

  const renderUserTable = (users) => {
    if (users.length === 0) {
      return (
        <div className="text-center text-gray-600 dark:text-gray-400 py-12">
          <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-lg font-medium">No users found</p>
          <p className="text-sm mt-1">Try selecting a different category</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full table-auto border border-amber-400 dark:border-amber-600 rounded-xl shadow-lg">
          <thead>
            <tr className="bg-amber-100 dark:bg-amber-900/50">
              <th className="px-5 py-4 border-b text-left font-semibold text-gray-700 dark:text-gray-200">Full Name</th>
              <th className="px-5 py-4 border-b text-left font-semibold text-gray-700 dark:text-gray-200">Role</th>
              <th className="px-5 py-4 border-b text-left font-semibold text-gray-700 dark:text-gray-200">Status</th>
              <th className="px-5 py-4 border-b text-left font-semibold text-gray-700 dark:text-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-200 dark:divide-amber-800">
            {users.map(user => (
              <tr key={user.id} className="bg-white dark:bg-gray-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                <td className="px-5 py-4 text-gray-800 dark:text-gray-200">
                  {user.full_name || <span className="italic text-gray-400">No name</span>}
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'admin'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}>
                    {user.role === 'admin' && <Shield className="w-3 h-3" />}
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {editId === user.id ? (
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      className="p-2 rounded-lg border border-amber-400 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="DECLINED">DECLINED</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                      user.status === 'APPROVED'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : user.status === 'DECLINED'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    }`}>
                      {user.status === 'APPROVED' && <CheckCircle className="w-3 h-3" />}
                      {user.status === 'DECLINED' && <XCircle className="w-3 h-3" />}
                      {user.status === 'PENDING' && <AlertCircle className="w-3 h-3" />}
                      {user.status}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2 flex-wrap">
                    {editId === user.id ? (
                      <>
                        <button
                          onClick={() => handleEditSave(user.id)}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors font-medium"
                          disabled={loading}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="px-3 py-1.5 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors font-medium"
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {user.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(user.id)}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors font-medium"
                              disabled={loading}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDecline(user.id)}
                              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors font-medium"
                              disabled={loading}
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {user.status !== 'PENDING' && user.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteClick(user.id, user.role, user.full_name)}
                            className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors font-medium"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(user.id, user.status)}
                          className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors font-medium flex items-center gap-1"
                          disabled={loading}
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 border-2 border-red-500 animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Delete Account</h3>
            </div>
            
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              Are you sure you want to delete the account of{' '}
              <span className="font-bold text-red-600 dark:text-red-400">
                {deleteModal.userName || 'this user'}
              </span>?
            </p>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This action cannot be undone. All data associated with this account will be permanently removed.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors font-medium"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Notification */}
      {alert.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          <div className={`${alertStyles.bg} ${alertStyles.text} border-l-4 rounded-lg shadow-lg px-6 py-4 flex items-center gap-3 min-w-[320px] max-w-md backdrop-blur-sm`}>
            {alertStyles.icon}
            <p className="flex-1 font-medium">{alert.message}</p>
            <button
              onClick={closeAlert}
              className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/95 dark:bg-gray-800/95 shadow px-8 py-6 flex justify-between items-center border-b border-amber-700 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
      <div
          className="flex items-center gap-3 cursor-pointer group transition-transform duration-300 hover:scale-105"
          onClick={() => window.location.reload()}
          title="Refresh Admin Dashboard"
          tabIndex={0}
          role="button"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') window.location.reload(); }}
          aria-label="Refresh Admin Dashboard"
        >
          <svg width="44" height="44" fill="none" viewBox="0 0 48 48" aria-hidden>
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
          </svg>
          <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-200 font-serif">
            Admin Portal
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-300"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
          <button
            onClick={handleLogout}
            className="p-3 rounded-full hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-300"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-12 px-4 pb-12">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`p-6 rounded-2xl shadow-xl transition-all duration-300 ${
              activeTab === 'all'
                ? 'bg-blue-600 dark:bg-blue-700 text-white scale-105'
                : 'bg-white/95 dark:bg-gray-800/95 hover:scale-105'
            }`}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <Users className="w-8 h-8 mb-2" />
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm font-medium opacity-90">Total Users</p>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`p-6 rounded-2xl shadow-xl transition-all duration-300 ${
              activeTab === 'pending'
                ? 'bg-yellow-600 dark:bg-yellow-700 text-white scale-105'
                : 'bg-white/95 dark:bg-gray-800/95 hover:scale-105'
            }`}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-3xl font-bold">{stats.pending}</p>
            <p className="text-sm font-medium opacity-90">Pending</p>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`p-6 rounded-2xl shadow-xl transition-all duration-300 ${
              activeTab === 'approved'
                ? 'bg-green-600 dark:bg-green-700 text-white scale-105'
                : 'bg-white/95 dark:bg-gray-800/95 hover:scale-105'
            }`}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <UserCheck className="w-8 h-8 mb-2" />
            <p className="text-3xl font-bold">{stats.approved}</p>
            <p className="text-sm font-medium opacity-90">Approved</p>
          </button>

          <button
            onClick={() => setActiveTab('declined')}
            className={`p-6 rounded-2xl shadow-xl transition-all duration-300 ${
              activeTab === 'declined'
                ? 'bg-red-600 dark:bg-red-700 text-white scale-105'
                : 'bg-white/95 dark:bg-gray-800/95 hover:scale-105'
            }`}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <UserX className="w-8 h-8 mb-2" />
            <p className="text-3xl font-bold">{stats.declined}</p>
            <p className="text-sm font-medium opacity-90">Declined</p>
          </button>

          <button
            onClick={() => setActiveTab('admins')}
            className={`p-6 rounded-2xl shadow-xl transition-all duration-300 ${
              activeTab === 'admins'
                ? 'bg-purple-600 dark:bg-purple-700 text-white scale-105'
                : 'bg-white/95 dark:bg-gray-800/95 hover:scale-105'
            }`}
            style={{ backdropFilter: 'blur(4px)' }}
          >
            <Shield className="w-8 h-8 mb-2" />
            <p className="text-3xl font-bold">{stats.admins}</p>
            <p className="text-sm font-medium opacity-90">Admins</p>
          </button>
        </div>

        {/* User Table */}
        <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl border border-amber-700 dark:border-amber-600 p-8 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-amber-900 dark:text-amber-200">
              {activeTab === 'all' && 'All Users'}
              {activeTab === 'pending' && 'Pending Accounts'}
              {activeTab === 'approved' && 'Approved Users'}
              {activeTab === 'declined' && 'Declined Accounts'}
              {activeTab === 'admins' && 'Administrator Accounts'}
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-amber-600"></div>
              <span className="mt-4 text-lg text-gray-700 dark:text-gray-200">Loading users...</span>
            </div>
          ) : (
            renderUserTable(filteredUsers)
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;