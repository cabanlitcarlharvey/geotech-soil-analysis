import { CheckCircle, AlertCircle } from 'lucide-react';

function PredictionCard({ 
  imagePrediction,
  predictionConfidence,
  predictionStatus,
  predictionProbabilities
}) {

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBarColor = (confidence) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!imagePrediction) return null;

  return (
    <div className={`border-l-4 rounded-lg p-6 mb-6 transition-all duration-300 ${
      predictionStatus === 'confident'
        ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600'
        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-600'
    }`}>
      <div className="flex items-start gap-4">
        {predictionStatus === 'confident' ? (
          <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
        ) : (
          <AlertCircle className="w-7 h-7 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
        )}
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="font-semibold text-lg text-amber-900 dark:text-amber-200">
              Soil Type Prediction:
            </span>
            <span className={`text-2xl font-bold ${
              predictionStatus === 'confident'
                ? 'text-green-700 dark:text-green-300'
                : 'text-yellow-700 dark:text-yellow-300'
            }`}>
              {imagePrediction}
            </span>
          </div>

          {predictionConfidence !== null && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-base font-medium text-gray-700 dark:text-gray-300">
                  Confidence Score:
                </span>
                <span className={`text-lg font-bold ${getConfidenceColor(predictionConfidence)}`}>
                  {(predictionConfidence * 100).toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${getConfidenceBarColor(predictionConfidence)}`}
                  style={{ width: `${predictionConfidence * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {predictionStatus && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-medium text-gray-700 dark:text-gray-300">
                Status:
              </span>
              <span className={`text-base font-semibold px-3 py-1 rounded-full transition-all duration-300 ${
                predictionStatus === 'confident'
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
              }`}>
                {predictionStatus === 'confident' ? '✓ Confident' : '⚠ Uncertain'}
              </span>
            </div>
          )}

          {predictionProbabilities && (
            <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Class Probabilities:
              </p>
              <div className="space-y-3">
                {Object.entries(predictionProbabilities).map(([className, probability]) => (
                  <div key={className} className="flex items-center justify-between gap-2">
                    <span className="text-base text-gray-600 dark:text-gray-400 min-w-32">
                      {className}:
                    </span>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1 bg-gray-300 dark:bg-gray-700 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            className === imagePrediction
                              ? 'bg-amber-600 dark:bg-amber-400'
                              : 'bg-gray-500 dark:bg-gray-600'
                          }`}
                          style={{ width: `${probability * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-base font-semibold text-gray-700 dark:text-gray-300 w-14 text-right">
                        {(probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {predictionStatus === 'uncertain' && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg text-base text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700">
              ⚠️ Low confidence detected. Consider recapturing the image or manual verification.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PredictionCard;