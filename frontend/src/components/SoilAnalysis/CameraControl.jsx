import { useRef } from 'react';
import { Camera } from 'lucide-react';

function CameraControl({ 
  isCameraActive,
  cameraDevices,
  selectedCamera,
  setSelectedCamera,
  onStartCamera,
  onCaptureImage,
  showStartButton,
  videoRef,
  canvasRef
}) {

  return (
    <div className="mb-6 p-4 bg-amber-50 dark:bg-gray-700/50 rounded-lg border border-amber-300 dark:border-amber-700">
      {cameraDevices.length > 1 && (
        <div className="mb-4">
          <label 
            htmlFor="cameraSelect" 
            className="block text-base font-semibold mb-2 text-gray-700 dark:text-gray-300"
          >
            Select Camera:
          </label>
          <select
            id="cameraSelect"
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full md:w-64 p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-400 dark:border-amber-600 text-base focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-300"
          >
            {cameraDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId}`}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <video
        ref={videoRef}
        autoPlay
        className={`w-full max-w-[600px] mx-auto rounded-lg shadow-lg border-2 border-amber-400 dark:border-amber-600 transition-all duration-300 ${
          isCameraActive ? '' : 'hidden'
        }`}
      />
      
      {isCameraActive ? (
        <button
          onClick={onCaptureImage}
          className="mt-4 w-full md:w-auto flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white px-6 py-3 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
          aria-label="Capture soil image"
        >
          <Camera className="w-5 h-5" />
          Capture Image
        </button>
      ) : (
        showStartButton && (
          <button
            onClick={onStartCamera}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-amber-700 hover:bg-amber-800 text-white px-6 py-3 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
            aria-label="Start camera"
          >
            <Camera className="w-5 h-5" />
            Start Camera
          </button>
        )
      )}
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default CameraControl;