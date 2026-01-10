import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Sun, Moon, LogOut, Home, History, CheckCircle, RotateCcw, Beaker } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import '../App.css';
import { API_URL } from '../config';

// Import separated components
import LocationInput from '../components/SoilAnalysis/LocationInput';
import CameraControl from '../components/SoilAnalysis/CameraControl';
import PredictionCard from '../components/SoilAnalysis/PredictionCard';
import AnalysisControls from '../components/SoilAnalysis/AnalysisControls';

ChartJS.register(ArcElement, Tooltip, Legend);

function SoilAnalysis() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // State management
  const [step, setStep] = useState('Enter location for soil sample...');
  const [fullLocation, setFullLocation] = useState('');
  const [imagePrediction, setImagePrediction] = useState(null);
  const [predictionConfidence, setPredictionConfidence] = useState(null);
  const [predictionStatus, setPredictionStatus] = useState(null);
  const [predictionProbabilities, setPredictionProbabilities] = useState(null);
  const [weight, setWeight] = useState(null);
  const [results, setResults] = useState(null);
  const [totalWeight, setTotalWeight] = useState(null);
  const [gravelWeight, setGravelWeight] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [jwtToken, setJwtToken] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImageData, setCapturedImageData] = useState(null);
  

  const steps = [
    { label: 'Location', status: 'Enter location for soil sample...' },
    { label: 'Capture Image', status: 'Capture soil image for prediction...' },
    { label: 'Total Weight', status: 'Place unwashed soil sample, press 1...' },
    { label: 'Gravel Weight', status: 'Place gravel fraction, press 2...' },
    { label: 'Sand Weight', status: 'Place sand fraction, press 3...' },
    { label: 'Results', status: 'Done. Press R to reset' },
  ];

  const getButtonStates = () => {
    const stepText = step.toLowerCase();
    if (stepText.includes('capture soil image') || stepText.includes('place unwashed soil sample')) {
      return { step1: true, step2: false, step3: false };
    } else if (stepText.includes('place gravel fraction')) {
      return { step1: false, step2: true, step3: false };
    } else if (stepText.includes('place sand fraction')) {
      return { step1: false, step2: false, step3: true };
    } else if (stepText.includes('done')) {
      return { step1: false, step2: false, step3: false };
    }
    return { step1: true, step2: false, step3: false };
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session) {
          setJwtToken(session.access_token);
        } else {
          setError('User not authenticated. Please log in.');
          navigate('/login');
        }
      } catch (err) {
        setError('Error fetching session: ' + err.message);
        navigate('/login');
      }
    };
    getSession();

    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        setError('Error enumerating cameras: ' + err.message);
      }
    };
    getCameras();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isDark, stream, navigate]);

  useEffect(() => {
    const index = steps.findIndex(s => s.status === step);
    setCurrentStepIndex(index !== -1 ? index : 0);
  }, [step]);

  const handleLocationSubmit = () => {
    if (!fullLocation.trim()) {
      setError('Please complete all location fields.');
      return;
    }
    setError('');
    setStep('Capture soil image for prediction...');
  };

  const startCamera = async () => {
    if (!videoRef.current) {
      setError('Video element not found. Please refresh the page.');
      return;
    }
    try {
      stopCamera();
      const constraints = {
        video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined },
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(err => {
          setError('Error playing video: ' + err.message);
        });
      };
      setStream(mediaStream);
      setIsCameraActive(true);
      setError('');
    } catch (err) {
      setError('Error accessing camera: ' + err.message);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  };

  const captureImage = async () => {
    try {
      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Video or canvas element not found');
      }
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg');
  
      setCapturedImageData(imageData);
      
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ image: imageData.split(',')[1] }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error: ${response.status}`);
      }
  
      const data = await response.json();
      
      setImagePrediction(data.soil_type);
      setPredictionConfidence(data.confidence);
      setPredictionStatus(data.status);
      setPredictionProbabilities(data.probabilities);
      
      setStep('Place unwashed soil sample, press 1...');
      stopCamera();
      setError('');
    } catch (err) {
      setError('Error capturing or predicting image: ' + err.message);
    }
  };

  const sendCommand = async (cmd) => {
    try {
      if (!jwtToken && cmd === '3') {
        throw new Error('User not authenticated. Please log in.');
      }

      let response;

      if (cmd === '3') {
        const requestBody = {
          input: cmd,
          image_soil_type: imagePrediction || null,
          image_data: capturedImageData || null,
          location: fullLocation || null,
        };

        response = await fetch(`${API_URL}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify(requestBody)
        });
      } else {
        const url = `${API_URL}/command?input=${cmd}`;
        response = await fetch(url, { 
          method: 'GET',
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'results') {
        const { total_weight, gravel_weight, sand_weight, gravel_percent, sand_percent, fines_percent } = data;
        if (
          total_weight <= 0 ||
          gravel_weight < 0 ||
          sand_weight < 0 ||
          gravel_weight + sand_weight > total_weight + 1 ||
          Math.abs(gravel_percent + sand_percent + fines_percent - 100) > 1
        ) {
          throw new Error('Invalid weight or percentage data received.');
        }
      }

      setError('');
      
      if (cmd !== 'W') {
        setStep(data.message || 'Unknown status');
      }
      
      if (data.status === 'total_weight') {
        setTotalWeight(data.weight);
        setWeight(data.weight);
        setStep('Place gravel fraction, press 2...');
      } else if (data.status === 'gravel_weight') {
        setGravelWeight(data.weight);
        setWeight(data.weight);
        setStep('Place sand fraction, press 3...');
      } else if (data.status === 'results') {
        setResults({
          total_weight: data.total_weight,
          gravel_weight: data.gravel_weight,
          sand_weight: data.sand_weight,
          gravel_percent: data.gravel_percent,
          sand_percent: data.sand_percent,
          fines_percent: data.fines_percent,
          soil_type: data.soil_type,
        });
        setSaveStatus(data.save_status || '');
        setWeight(null);
        setStep('Done. Press R to reset');
      } else if (data.status === 'weight_check') {
        setWeight(data.weight);
      } else if (data.status === 'reset') {
        setTotalWeight(null);
        setGravelWeight(null);
        setResults(null);
        setWeight(null);
        setImagePrediction(null);
        setPredictionConfidence(null);
        setPredictionStatus(null);
        setPredictionProbabilities(null);
        setCapturedImageData(null);
        setFullLocation('');  // ✅ Only this for location
        setIsCameraActive(false);
        setSaveStatus('');
        setStep('Enter location for soil sample...');
      }
    } catch (error) {
      setError(`Error: ${error.message}`);
      setSaveStatus('');
    }
  };

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setIsDark(!isDark);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
    stopCamera();
  };

  const pieChartData = {
    labels: totalWeight && !gravelWeight ? ['Total Weight'] : totalWeight && gravelWeight && !results ? ['Gravel', 'Remaining'] : results ? ['Gravel', 'Sand', 'Fines'] : ['No Data'],
    datasets: [{
      data: totalWeight && !gravelWeight ? [100] : totalWeight && gravelWeight && !results ? [parseFloat(((gravelWeight / totalWeight) * 100).toFixed(2)), parseFloat((100 - (gravelWeight / totalWeight) * 100).toFixed(2))] : results ? [parseFloat(results.gravel_percent.toFixed(2)), parseFloat(results.sand_percent.toFixed(2)), parseFloat(results.fines_percent.toFixed(2))] : [0],
      backgroundColor: totalWeight && !gravelWeight ? ['#4B5EAA'] : totalWeight && gravelWeight && !results ? ['#4B5EAA', '#D1D5DB'] : results ? ['#4B5EAA', '#F4A261', '#E76F51'] : ['#D1D5DB'],
      borderColor: ['#ffffff'],
      borderWidth: 2,
    }],
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 20, padding: 15, font: { size: 14 }, color: isDark ? '#F3F4F6' : '#1F2937' } },
      tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw}%` } },
      title: { display: true, text: 'Soil Composition (%)', font: { size: 16, weight: 'bold' }, color: isDark ? '#F3F4F6' : '#1F2937' },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-slate-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white/95 dark:bg-gray-800/95 shadow px-8 py-6 flex justify-between items-center border-b border-amber-700 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
        <div className="flex items-center gap-3 cursor-pointer group transition-transform duration-300 hover:scale-105" onClick={() => navigate('/engineer-home')}>
          <svg width="44" height="44" fill="none" viewBox="0 0 48 48">
            <ellipse cx="24" cy="40" rx="18" ry="6" fill="#A0522D" />
            <ellipse cx="24" cy="34" rx="14" ry="5" fill="#8B5E3C" />
            <ellipse cx="24" cy="28" rx="10" ry="4" fill="#C2B280" />
          </svg>
          <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-200 font-serif">Geotech Staff Portal</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="p-3 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-300">
            {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
          <button onClick={() => navigate('/engineer-home')} className="p-3 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors duration-300">
            <Home className="w-6 h-6" />
          </button>
          <button onClick={() => window.location.reload()} className="p-3 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-300">
            <Beaker className="w-6 h-6" />
          </button>
          <button onClick={() => navigate('/engineer-history')} className="p-3 rounded-full hover:bg-green-200 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-300">
            <History className="w-6 h-6" />
          </button>
          <button onClick={handleLogout} className="p-3 rounded-full hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-300">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto mt-12 px-4 pb-12">
        {/* Progress Sidebar */}
        <aside className="w-full lg:w-1/4">
          <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl border border-amber-700 dark:border-amber-600 p-6 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
            <h3 className="text-xl font-bold mb-6 text-amber-900 dark:text-amber-200">Progress Tracker</h3>
            <ul className="space-y-4">
              {steps.map((s, index) => (
                <li key={index} className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${index === currentStepIndex ? 'font-bold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/30' : index < currentStepIndex ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  <CheckCircle className={`w-6 h-6 flex-shrink-0 transition-colors duration-300 ${index < currentStepIndex ? 'text-green-600 dark:text-green-400' : index === currentStepIndex ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400 dark:text-gray-600'}`} />
                  <span className="text-base">Step {index + 1}: {s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main Content */}
        <section className="w-full lg:w-3/4">
          <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl border border-amber-700 dark:border-amber-600 p-8 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
            <h2 className="text-3xl font-bold mb-2 text-amber-900 dark:text-amber-200">Soil Classification Analysis</h2>
            <p className="text-lg mb-6 text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-green-800 dark:text-green-400">Current Step:</span> {step}
            </p>

            {/* Location Input */}
            {step === 'Enter location for soil sample...' && !weight && (
              <LocationInput
                fullLocation={fullLocation}
                setFullLocation={setFullLocation}
                onSubmit={handleLocationSubmit}
                error={error}
              />
            )}

            {/* Prediction Card */}
            <PredictionCard
              imagePrediction={imagePrediction}
              predictionConfidence={predictionConfidence}
              predictionStatus={predictionStatus}
              predictionProbabilities={predictionProbabilities}
            />

            {/* Current Weight Display */}
            {weight !== null && (
              <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border-l-4 border-green-600 dark:border-green-400">
                <p className="text-lg">
                  <span className="font-semibold text-green-800 dark:text-green-300">Current Weight:</span>
                  <span className="ml-2 text-2xl font-bold text-green-700 dark:text-green-400">{weight.toFixed(2)} g</span>
                </p>
              </div>
            )}

            {/* Camera Control */}
            {currentStepIndex >= 1 && currentStepIndex < 5 && (
              <CameraControl
                isCameraActive={isCameraActive}
                cameraDevices={cameraDevices}
                selectedCamera={selectedCamera}
                setSelectedCamera={setSelectedCamera}
                onStartCamera={startCamera}
                onCaptureImage={captureImage}
                showStartButton={step.includes('Capture soil image')}
                videoRef={videoRef}
                canvasRef={canvasRef}
              />
            )}

            {/* Analysis Controls */}
            {imagePrediction && (
              <AnalysisControls
                buttonStates={getButtonStates()}
                onSendCommand={sendCommand}
              />
            )}

            {/* Pie Chart */}
            {totalWeight && currentStepIndex >= 2 && (
              <div className="mb-6 border-2 border-amber-400 dark:border-amber-700 bg-amber-50/80 dark:bg-gray-900/50 p-6 rounded-2xl shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-amber-900 dark:text-amber-200">Composition Breakdown</h3>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                  <div className="max-w-sm mx-auto">
                    <Pie data={pieChartData} options={pieChartOptions} />
                  </div>
                </div>
              </div>
            )}

            {/* Results Card */}
            {(totalWeight || results) && (
              <div className="border-2 border-amber-400 dark:border-amber-700 bg-amber-50/80 dark:bg-gray-900/50 p-6 rounded-2xl shadow-lg mb-6">
                <h3 className="text-2xl font-bold mb-4 text-amber-900 dark:text-amber-200">Analysis Results</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {fullLocation && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Location</p>
                      <p className="text-lg font-bold text-amber-900 dark:text-amber-200">{fullLocation}</p>
                    </div>
                  )}
                  {totalWeight && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Weight</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{totalWeight.toFixed(2)} g</p>
                    </div>
                  )}
                  {gravelWeight && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gravel Weight</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{gravelWeight.toFixed(2)} g</p>
                    </div>
                  )}
                  {results && (
                    <>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sand Weight</p>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{results.sand_weight.toFixed(2)} g</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">USCS Soil Type</p>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-200">{results.soil_type}</p>
                      </div>
                    </>
                  )}
                </div>

                {results && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gravel %</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{results.gravel_percent.toFixed(2)}%</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sand %</p>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{results.sand_percent.toFixed(2)}%</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-amber-300 dark:border-amber-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fines %</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.fines_percent.toFixed(2)}%</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {results && (
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => navigate('/engineer-history')} className="flex-1 px-6 py-3 text-base font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105">
                  View Analysis History
                </button>
                <button onClick={() => sendCommand('R')} className="flex-1 px-6 py-3 text-base font-semibold bg-green-700 hover:bg-green-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2">
                  <RotateCcw className="w-5 h-5" />
                  Perform Another Analysis
                </button>
              </div>
            )}

            {/* Status Messages */}
            {saveStatus && (
              <div className="mt-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border-l-4 border-green-600 dark:border-green-400">
                <p className="text-lg font-semibold text-green-800 dark:text-green-300">{saveStatus}</p>
              </div>
            )}
            {error && (
              <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border-l-4 border-red-600 dark:border-red-400">
                <p className="text-lg font-semibold text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default SoilAnalysis;