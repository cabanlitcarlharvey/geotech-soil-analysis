import { RotateCcw } from 'lucide-react';

function AnalysisControls({ buttonStates, onSendCommand }) {
  
  return (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-300 dark:border-blue-700">
      <p className="text-base font-semibold mb-4 text-gray-700 dark:text-gray-300">
        Analysis Controls:
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          className={`px-6 py-3 rounded-lg font-semibold text-base focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 transform ${
            buttonStates.step1 
              ? 'bg-green-700 hover:bg-green-800 text-white hover:scale-105 focus:ring-green-500' 
              : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
          }`}
          onClick={() => buttonStates.step1 && onSendCommand('1')}
          disabled={!buttonStates.step1}
          aria-label="Total Weight"
        >
          1: Total Weight
        </button>
        <button
          className={`px-6 py-3 rounded-lg font-semibold text-base focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 transform ${
            buttonStates.step2 
              ? 'bg-green-700 hover:bg-green-800 text-white hover:scale-105 focus:ring-green-500' 
              : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
          }`}
          onClick={() => buttonStates.step2 && onSendCommand('2')}
          disabled={!buttonStates.step2}
          aria-label="Gravel Weight"
        >
          2: Gravel Weight
        </button>
        <button
          className={`px-6 py-3 rounded-lg font-semibold text-base focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 transform ${
            buttonStates.step3 
              ? 'bg-green-700 hover:bg-green-800 text-white hover:scale-105 focus:ring-green-500' 
              : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
          }`}
          onClick={() => buttonStates.step3 && onSendCommand('3')}
          disabled={!buttonStates.step3}
          aria-label="Sand Weight"
        >
          3: Sand Weight
        </button>
        <button
          className="px-6 py-3 rounded-lg font-semibold text-base bg-amber-600 hover:bg-amber-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105"
          onClick={() => onSendCommand('W')}
          aria-label="Check Weight"
        >
          W: Check Weight
        </button>
        <button
          className="px-6 py-3 rounded-lg font-semibold text-base bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
          onClick={() => onSendCommand('R')}
          aria-label="Reset"
        >
          <RotateCcw className="w-5 h-5" />
          R: Reset
        </button>
      </div>
    </div>
  );
}

export default AnalysisControls;