import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CheckCircle, RotateCcw, ArrowLeft } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import '../App.css';
import { API_URL } from '../config';

// Import shared layout
import PageLayout from '../components/shared/PageLayout';

// Import separated components
import LocationInput from '../components/SoilAnalysis/LocationInput';
import CameraControl from '../components/SoilAnalysis/CameraControl';
import PredictionCard from '../components/SoilAnalysis/PredictionCard';
import AnalysisControls from '../components/SoilAnalysis/AnalysisControls';

ChartJS.register(ArcElement, Tooltip, Legend);

// ✅ Helper: mag-poll ng /command/{id}/result hanggang 'done' o mag-timeout
async function waitForCommandResult(commandId, timeoutMs = 30000) {
  const pollInterval = 1500; // mag-check every 1.5 seconds
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const res = await fetch(`${API_URL}/command/${commandId}/result`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });

    if (!res.ok) throw new Error(`Polling error: HTTP ${res.status}`);

    const data = await res.json();

    if (data.status === 'done') {
      return data.result; // ito na ang actual response ng ESP32
    }
    // kung 'pending' o 'processing' pa, mag-loop ulit
  }

  throw new Error('ESP32 did not respond in time. Check if it is connected and polling.');
}

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
  // ✅ Bagong state: para ipakita ang "Waiting for ESP32..." message
  const [isWaitingForESP32, setIsWaitingForESP32] = useState(false);

  const hasCapturedImage = !!capturedImageData;

  const steps = [
    { label: 'Location', status: 'Enter location for soil sample...' },
    { label: 'Capture Image', status: 'Capture soil image for prediction...' },
    { label: 'Total Weight', status: 'Place unwashed soil sample, press 1...' },
    { label: 'Gravel Weight', status: 'Place gravel fraction, press 2...' },
    { label: 'Sand Weight', status: 'Place sand fraction, press 3...' },
    { label: 'Results', status: 'Done. Press R to reset' },
  ];

  const handleBackStep = () => {
    const currentIndex = steps.findIndex((s) => s.status === step);
    if (currentIndex > 0) {
      if (steps[currentIndex].label === 'Capture Image') {
        stopCamera();
      }
      setStep(steps[currentIndex - 1].status);
    }
  };

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
    setIsDark(localStorage.getItem('theme') === 'dark');

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
  }, [navigate]);

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

      if (isUnclassifiedPrediction(data.soil_type)) {
        setStep('Capture soil image for prediction...');
        stopCamera();
        return;
      }

      setStep('Place unwashed soil sample, press 1...');
      stopCamera();
      setError('');
    } catch (err) {
      setError('Error capturing or predicting image: ' + err.message);
    }
  };

  const isUnclassifiedPrediction = (pred) =>
    (pred ?? '').toString().trim().toLowerCase() === 'unclassified';
  
  const canProceedToWeighing = imagePrediction && !isUnclassifiedPrediction(imagePrediction);
  
  const retakePrediction = () => {
    setImagePrediction(null);
    setPredictionConfidence(null);
    setPredictionStatus(null);
    setPredictionProbabilities(null);
    setCapturedImageData(null);
    setWeight(null);
    setTotalWeight(null);
    setGravelWeight(null);
    setResults(null);
    setSaveStatus('');
    setError('');
    setStep('Capture soil image for prediction...');
  };  

  // ============================================================
  // ✅ UPDATED sendCommand — gumagamit na ng polling para sa ESP32
  // ============================================================
  const sendCommand = async (cmd) => {
    try {
      if (!jwtToken && cmd === '3') {
        throw new Error('User not authenticated. Please log in.');
      }
      if (['1', '2', '3'].includes(cmd) && !canProceedToWeighing) {
        throw new Error('Cannot proceed: prediction is Unclassified. Please retake the image first.');
      }

      setError('');

      // --- COMMAND 3: POST with image data ---
      if (cmd === '3') {
        const requestBody = {
          input: cmd,
          image_soil_type: imagePrediction || null,
          image_data: capturedImageData || null,
          location: fullLocation || null,
        };

        // Command 3 sa backend ay nag-aantay na ng ESP32 result (backend ang mag-poll internally)
        // Kaya dito sa frontend, mag-show lang tayo ng loading tapos hintayin ang response
        setIsWaitingForESP32(true);

        const response = await fetch(`${API_URL}/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify(requestBody)
        });

        setIsWaitingForESP32(false);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error: ${response.status}`);
        }

        const data = await response.json();
        handleCommandResponse(data, cmd);

      // --- COMMANDS 1, 2, W, R: GET with polling ---
      } else {
        // Step 1: I-queue ang command
        const url = `${API_URL}/command?input=${cmd}`;
        const queueResponse = await fetch(url, {
          method: 'GET',
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        if (!queueResponse.ok) {
          const errorData = await queueResponse.json();
          throw new Error(errorData.detail || `HTTP error: ${queueResponse.status}`);
        }

        const queueData = await queueResponse.json();
        // queueData = { status: 'queued', command_id: '...', message: '...' }

        if (cmd === 'R') {
          // Para sa reset, hindi na kailangan hintayin — i-process na agad
          // (ang ESP32 lang ang magre-reset ng weights niya, hindi nakakaapekto sa UI flow)
          setIsWaitingForESP32(true);
        } else {
          setIsWaitingForESP32(true);
        }

        // Step 2: Hintayin ang ESP32 result sa pamamagitan ng polling
        const esp32Result = await waitForCommandResult(queueData.command_id);
        setIsWaitingForESP32(false);

        handleCommandResponse(esp32Result, cmd);
      }

    } catch (err) {
      setIsWaitingForESP32(false);
      setError(`Error: ${err.message}`);
      setSaveStatus('');
    }
  };

  // ✅ Inilipat ang response-handling logic sa sariling function para mas malinis
  const handleCommandResponse = (data, cmd) => {
    if (!data) {
      setError('No response received from ESP32.');
      return;
    }

    // Validate results data
    if (data.status === 'results') {
      const { total_weight, gravel_weight, sand_weight, gravel_percent, sand_percent, fines_percent } = data;
      if (
        total_weight <= 0 ||
        gravel_weight < 0 ||
        sand_weight < 0 ||
        gravel_weight + sand_weight > total_weight + 1 ||
        Math.abs(gravel_percent + sand_percent + fines_percent - 100) > 1
      ) {
        setError('Invalid weight or percentage data received.');
        return;
      }
    }

    if (cmd !== 'W') {
      setStep(data.message || 'Unknown status');
    }

    if (data.status === 'total_weight') {
      setTotalWeight(data.value ?? data.weight);
      setWeight(data.value ?? data.weight);
      setStep('Place gravel fraction, press 2...');

    } else if (data.status === 'gravel_weight') {
      setGravelWeight(data.value ?? data.weight);
      setWeight(data.value ?? data.weight);
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
      setWeight(data.value ?? data.weight);

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
      setFullLocation('');
      setIsCameraActive(false);
      setSaveStatus('');
      setStep('Enter location for soil sample...');

    } else if (data.status === 'error') {
      setError(data.message || 'An error occurred.');
    }
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

  const handleImageFile = async (file) => {
    try {
      if (!file || !file.type.startsWith('image/')) {
        throw new Error('Invalid file type. Please upload an image.');
      }
  
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result;
        setCapturedImageData(base64Image);
  
        const response = await fetch(`${API_URL}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ image: base64Image.split(',')[1] }),
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Prediction failed');
        }
  
        const data = await response.json();
        setImagePrediction(data.soil_type);
        setPredictionConfidence(data.confidence);
        setPredictionStatus(data.status);
        setPredictionProbabilities(data.probabilities);

        if (isUnclassifiedPrediction(data.soil_type)) {
          setStep('Capture soil image for prediction...');
          stopCamera();
          return;
        }

        setStep('Place unwashed soil sample, press 1...');
        stopCamera();
        setError('');
      };
  
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message);
    }
  };  

  return (
    <PageLayout currentPage="analysis">
      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
        {/* Progress Sidebar */}
        <aside className="w-full lg:w-1/4">
          <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl border border-accent-700 dark:border-accent-600 p-6 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
            <h3 className="text-xl font-bold mb-6 text-accent-900 dark:text-accent-200">Progress Tracker</h3>
            <ul className="space-y-4">
              {steps.map((s, index) => (
                <li key={index} className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${index === currentStepIndex ? 'font-bold text-accent-900 dark:text-accent-200 bg-accent-100 dark:bg-accent-900/30' : index < currentStepIndex ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  <CheckCircle className={`w-6 h-6 flex-shrink-0 transition-colors duration-300 ${index < currentStepIndex ? 'text-accent-700 dark:text-accent-300' : index === currentStepIndex ? 'text-accent-700 dark:text-accent-300' : 'text-gray-400 dark:text-gray-600'}`} />
                  <span className="text-base">Step {index + 1}: {s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="w-full lg:w-3/4">
          <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl shadow-xl border border-accent-700 dark:border-accent-600 p-8 transition-all duration-300" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-bold text-accent-900 dark:text-accent-200">
                Soil Classification Analysis
              </h2>
              
              {currentStepIndex > 0 && currentStepIndex < steps.length && (
                <button
                  type="button"
                  onClick={handleBackStep}
                  className="inline-flex items-center px-3 py-2 text-sm font-semibold rounded-lg border border-accent-600 text-accent-800 dark:text-accent-200 bg-white/80 dark:bg-gray-800 hover:bg-accent-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
              )}
            </div>

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
            {imagePrediction && isUnclassifiedPrediction(imagePrediction) && (
              <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border-l-4 border-yellow-600 dark:border-yellow-400 flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">
                    Prediction result is Unclassified — please retake.
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Please capture a clearer soil image (better lighting, closer focus, avoid blur).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retakePrediction}
                  className="px-4 py-2 rounded-lg bg-yellow-600 text-white font-semibold hover:bg-yellow-700 transition"
                >
                  Retake Image
                </button>
              </div>
            )}

            {/* Camera Control */}
            {currentStepIndex >= 1 && currentStepIndex < 5 && (
              <>
                {!hasCapturedImage ? (
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
                    onUploadImage={handleImageFile}
                  />
                ) : (
                  <div className="mb-6 border-2 border-accent-400 dark:border-accent-700 bg-accent-50/80 dark:bg-gray-900/50 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-accent-900 dark:text-accent-200">
                      Captured Soil Image
                    </h3>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                      <img
                        src={capturedImageData}
                        alt="Captured soil sample"
                        className="w-full max-w-2xl mx-auto rounded-lg border border-accent-300 dark:border-accent-700"
                      />
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                      If the image is blurry or unclear, tap <span className="font-semibold">Retake Image</span>.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ✅ ESP32 Waiting Indicator */}
            {isWaitingForESP32 && (
              <div className="mb-6 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-l-4 border-blue-600 dark:border-blue-400 flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <p className="text-base font-semibold text-blue-800 dark:text-blue-300">
                  Waiting for ESP32 to respond... Please place the sample on the scale.
                </p>
              </div>
            )}

            {/* Current Weight Display */}
            {weight !== null && (
              <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border-l-4 border-green-600 dark:border-green-400">
                <p className="text-lg">
                  <span className="font-semibold text-green-800 dark:text-green-300">Current Weight:</span>
                  <span className="ml-2 text-2xl font-bold text-green-700 dark:text-green-400">{weight.toFixed(2)} g</span>
                </p>
              </div>
            )}

            {/* Analysis Controls — disabled habang nag-aantay */}
            {canProceedToWeighing && (
              <AnalysisControls
                buttonStates={isWaitingForESP32
                  ? { step1: false, step2: false, step3: false } // i-disable lahat habang waiting
                  : getButtonStates()
                }
                onSendCommand={sendCommand}
              />
            )}

            {/* Results Card */}
            {(totalWeight || results) && (
              <div className="border-2 border-accent-400 dark:border-accent-700 bg-accent-50/80 dark:bg-gray-900/50 p-6 rounded-2xl shadow-lg mb-6">
                <h3 className="text-2xl font-bold mb-4 text-accent-900 dark:text-accent-200">Analysis Results</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {fullLocation && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Location</p>
                      <p className="text-lg font-bold text-accent-900 dark:text-accent-200">{fullLocation}</p>
                    </div>
                  )}
                  {totalWeight && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Weight</p>
                      <p className="text-2xl font-bold text-accent-900 dark:text-accent-200">{totalWeight.toFixed(2)} g</p>
                    </div>
                  )}
                  {gravelWeight && (
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gravel Weight</p>
                      <p className="text-2xl font-bold text-accent-900 dark:text-accent-200">{gravelWeight.toFixed(2)} g</p>
                    </div>
                  )}
                  {results && (
                    <>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sand Weight</p>
                        <p className="text-2xl font-bold text-accent-900 dark:text-accent-200">{results.sand_weight.toFixed(2)} g</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">USCS Soil Type</p>
                        <p className="text-2xl font-bold text-accent-900 dark:text-accent-200">{results.soil_type}</p>
                      </div>
                    </>
                  )}
                </div>

                {results && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gravel %</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{results.gravel_percent.toFixed(2)}%</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sand %</p>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{results.sand_percent.toFixed(2)}%</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fines %</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.fines_percent.toFixed(2)}%</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pie Chart */}
            {totalWeight && currentStepIndex >= 2 && (
              <div className="mb-6 border-2 border-accent-400 dark:border-accent-700 bg-accent-50/80 dark:bg-gray-900/50 p-6 rounded-2xl shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-accent-900 dark:text-accent-200">Composition Breakdown</h3>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-accent-300 dark:border-accent-700">
                  <div className="max-w-sm mx-auto">
                    <Pie data={pieChartData} options={pieChartOptions} />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {results && (
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => navigate('/engineer-history')} className="flex-1 px-6 py-3 text-base font-semibold bg-accent-700 hover:bg-accent-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105">
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
      </div>
    </PageLayout>
  );
}

export default SoilAnalysis;