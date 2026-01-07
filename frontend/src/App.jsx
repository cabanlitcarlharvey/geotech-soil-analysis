import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import SoilAnalysis from './pages/SoilAnalysis';
import ExpertDashboard from './pages/ExpertDashboard';
import EngineerHome from './pages/EngineerHome';
import EngineerAnalysisHistory from './pages/EngineerAnalysisHistory';
import ExpertHome from './pages/ExpertHome';
import AdminDashboard from './pages/AdminDashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function App() {
  return (
    <Router>
      <Routes>
        {/* ============================================ */}
        {/* PUBLIC ROUTES (No authentication required) */}
        {/* ============================================ */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ============================================ */}
        {/* PROTECTED ENGINEER ROUTES */}
        {/* ============================================ */}
        <Route
          path="/engineer-home"
          element={
            <ProtectedRoute requiredRole="engineer">
              <EngineerHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/engineer-history"
          element={
            <ProtectedRoute requiredRole="engineer">
              <EngineerAnalysisHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/soil-analysis"
          element={
            <ProtectedRoute requiredRole="engineer">
              <SoilAnalysis />
            </ProtectedRoute>
          }
        />

        {/* ============================================ */}
        {/* PROTECTED EXPERT ROUTES */}
        {/* ============================================ */}
        <Route
          path="/expert-home"
          element={
            <ProtectedRoute requiredRole="expert">
              <ExpertHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expert-dashboard"
          element={
            <ProtectedRoute requiredRole="expert">
              <ExpertDashboard />
            </ProtectedRoute>
          }
        />

        {/* ============================================ */}
        {/* PROTECTED ADMIN ROUTES */}
        {/* ============================================ */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ============================================ */}
        {/* 404 - Redirect to login for unknown routes */}
        {/* ============================================ */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;