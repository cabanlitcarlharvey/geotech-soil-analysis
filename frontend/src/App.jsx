import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register';
import SoilAnalysis from './pages/SoilAnalysis';
import ExpertDashboard from './pages/ExpertDashboard';
import EngineerHome from './pages/EngineerHome';
import EngineerAnalysisHistory from './pages/EngineerAnalysisHistory';
import ExpertHome from './pages/ExpertHome';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/engineer-home" element={<EngineerHome />} />
        <Route path="/engineer-history" element={<EngineerAnalysisHistory />} />
        <Route path="/soil-analysis" element={<SoilAnalysis />} />
        <Route path="/expert-home" element={<ExpertHome />} />
        <Route path="/expert-dashboard" element={<ExpertDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  )
}

export default App
