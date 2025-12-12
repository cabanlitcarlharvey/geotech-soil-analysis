import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogOut, Edit2, Sun, Moon, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const soilBg =
  "https://www.twi-global.com/image-library/hero/istock-875007530-geotechnical-engineering.jpg";

const AdminDashboard = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' });
  const [editId, setEditId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [deleteModal, setDeleteModal] = useState({ show: false, userId: null, userName: '', userRole: '' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingUsers();
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

  const fetchPendingUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, status');
    if (error) {
      showAlert('Error fetching users.', 'error');
      setPendingUsers([]);
    } else {
      setPendingUsers(data || []);
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
    await fetchPendingUsers();
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
    await fetchPendingUsers();
    setLoading(false);
  };

  // Delete user except admin accounts (call backend to remove auth user)
  const handleDeleteClick = (id, role, fullName) => {
    if (role === 'admin') {
      showAlert("You can't delete an admin account.", 'error');
      return;
    }
    // Show custom modal instead of browser confirm
    setDeleteModal({ show: true, userId: id, userName: fullName, userRole: role });
  };

  const confirmDelete = async () => {
    const { userId, userRole } = deleteModal;
    setDeleteModal({ show: false, userId: null, userName: '', userRole: '' });
    setLoading(true);

    try {
      // get current session token to prove requester identity
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
      await fetchPendingUsers();
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModal({ show: false, userId: null, userName: '', userRole: '' });
  };

  // Edit user status
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
    await fetchPendingUsers();
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

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-amber-200 to-green-100 dark:from-gray-900 dark:to-green-900 text-gray-900 dark:text-gray-100 transition-colors"
      style={{
        backgroundImage: `url(${soilBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'multiply'
      }}
    >
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
              aria-label="Close alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 dark:bg-gray-800/90 shadow px-6 py-4 flex justify-between items-center border-b border-amber-700" style={{ backdropFilter: 'blur(2px)' }}>
        <div className="flex items-center gap-2">
          <svg width="36" height="36" fill="none" viewBox="0 0 48 48">
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
          </svg>
          <span className="text-2xl font-bold text-amber-900 dark:text-amber-200 font-serif">
            Admin Portal
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Toggle theme"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto mt-16 p-8 bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl border border-amber-700" style={{ backdropFilter: 'blur(2px)' }}>
        <h2 className="text-3xl font-bold mb-6 text-amber-900 dark:text-amber-200 font-serif text-center">
          Admin Dashboard
        </h2>
        <h3 className="text-xl font-semibold mb-4 text-green-800 dark:text-green-200 text-center">
          Account Management
        </h3>
        
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-700"></div>
            <span className="ml-3 text-gray-700 dark:text-gray-200">Loading...</span>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400 py-8">
            <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2">No accounts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border border-amber-400 dark:border-amber-600 rounded-xl shadow divide-y divide-amber-200 dark:divide-amber-800">
              <thead>
                <tr className="bg-amber-100 dark:bg-amber-900">
                  <th className="px-5 py-3 border-b text-left">Full Name</th>
                  <th className="px-5 py-3 border-b text-left">Role</th>
                  <th className="px-5 py-3 border-b text-left">Status</th>
                  <th className="px-5 py-3 border-b text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(user => (
                  <tr key={user.id} className="odd:bg-amber-50 even:bg-white dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-amber-100 dark:hover:bg-amber-800 transition">
                    <td className="px-5 py-3">{user.full_name || <span className="italic text-gray-400">No name</span>}</td>
                    <td className="px-5 py-3 capitalize">{user.role}</td>
                    <td className="px-5 py-3">
                      {editId === user.id ? (
                        <select
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value)}
                          className="p-1 rounded border border-amber-400 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="DECLINED">DECLINED</option>
                        </select>
                      ) : (
                        <span className={
                          user.status === 'APPROVED'
                            ? 'text-green-700 font-semibold'
                            : user.status === 'DECLINED'
                            ? 'text-red-600 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }>
                          {user.status}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 flex gap-2">
                    {editId === user.id ? (
                        <>
                        <button
                            onClick={() => handleEditSave(user.id)}
                            className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                            disabled={loading}
                        >
                            Save
                        </button>
                        <button
                            onClick={handleEditCancel}
                            className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
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
                                className="px-4 py-1 bg-green-700 text-white rounded hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                                aria-label={`Approve ${user.full_name || user.id}`}
                                disabled={loading}
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => handleDecline(user.id)}
                                className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                aria-label={`Decline ${user.full_name || user.id}`}
                                disabled={loading}
                            >
                                Decline
                            </button>
                            </>
                        )}
                        {user.status !== 'PENDING' && user.role !== 'admin' && (
                            <>
                            <button
                                onClick={() => handleDeleteClick(user.id, user.role, user.full_name)}
                                className="px-4 py-1 bg-gray-500 text-white rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
                                aria-label={`Delete ${user.full_name || user.id}`}
                                disabled={loading}
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => handleEdit(user.id, user.status)}
                                className="px-4 py-1 bg-amber-500 text-white rounded hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 flex items-center gap-1"
                                aria-label={`Edit status of ${user.full_name || user.id}`}
                                disabled={loading}
                            >
                                <Edit2 className="w-4 h-4" /> Edit
                            </button>
                            </>
                        )}
                        {user.status !== 'PENDING' && user.role === 'admin' && (
                            <button
                            onClick={() => handleEdit(user.id, user.status)}
                            className="px-4 py-1 bg-amber-500 text-white rounded hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 flex items-center gap-1"
                            aria-label={`Edit status of ${user.full_name || user.id}`}
                            disabled={loading}
                            >
                            <Edit2 className="w-4 h-4" /> Edit
                            </button>
                        )}
                        </>
                    )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;