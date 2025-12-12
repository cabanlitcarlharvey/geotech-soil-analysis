// frontend/src/config.js

// Get API URL from environment variable
// Development: uses localhost
// Production: uses ngrok URL from Vercel env var
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Log the API URL for debugging (visible in browser console)
console.log('🔧 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_URL: API_URL,
  MODE: import.meta.env.MODE,
});
