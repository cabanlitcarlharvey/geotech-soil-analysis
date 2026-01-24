import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Beaker, Users, Shield, BarChart3, ArrowRight, Sun, Moon, Scale, Cpu } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    setIsDark(theme === 'dark');
    
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', session.user.id)
          .single();

        if (profile?.status === 'APPROVED') {
          if (profile.role === 'admin') {
            navigate('/admin-dashboard', { replace: true });
          } else if (profile.role === 'engineer') {
            navigate('/engineer-home', { replace: true });
          } else if (profile.role === 'expert') {
            navigate('/expert-home', { replace: true });
          }
        }
      }
    };
    
    checkSession();
  }, [navigate]);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    setIsDark(!isDark);
  };

  const features = [
    {
      icon: Beaker,
      title: 'AI-Powered Soil Analysis',
      description: 'Advanced CNN model for accurate soil classification and prediction'
    },
    {
      icon: Scale,
      title: 'Precision Weight Measurement',
      description: 'Loadcell sensor integration via ESP32 for accurate soil sample weight measurement'
    },
    {
      icon: BarChart3,
      title: 'Real-time Data Processing',
      description: 'Instant analysis results with comprehensive soil composition breakdown'
    },
    {
      icon: Users,
      title: 'Multi-Role System',
      description: 'Separate portals for Engineers, Experts, and Administrators'
    },
    {
      icon: Cpu,
      title: 'IoT Integration',
      description: 'Seamless ESP32 connectivity for automated weight data collection'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security with role-based access control'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Theme Toggle Button - Fixed Position */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400"
        aria-label="Toggle theme"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-2xl">
                <svg width="64" height="64" fill="none" viewBox="0 0 48 48" aria-hidden>
                  <ellipse cx="24" cy="40" rx="18" ry="6" fill="#ffffff" opacity="0.9" />
                  <ellipse cx="24" cy="34" rx="14" ry="5" fill="#ffffff" opacity="0.7" />
                  <ellipse cx="24" cy="28" rx="10" ry="4" fill="#ffffff" opacity="0.5" />
                </svg>
              </div>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-slate-900 dark:text-slate-100">
              GeoTech Soil Analysis
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-4 max-w-3xl mx-auto">
              Empowering soil experts and engineers for a sustainable future
            </p>
            <p className="text-lg text-slate-500 dark:text-slate-500 mb-12 max-w-2xl mx-auto">
              Advanced AI-powered platform with IoT integration for accurate soil classification, weight measurement, and comprehensive analysis
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:scale-105 flex items-center gap-2"
              >
                Sign In
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400 border-2 border-primary-600 dark:border-primary-500 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Powerful Features
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Everything you need for comprehensive soil analysis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-slate-200/50 dark:border-slate-700/50"
                >
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-6">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology Section - New Section about Loadcell & ESP32 */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Advanced Technology Integration
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Cutting-edge hardware and software working together
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Loadcell Sensor Card */}
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-6">
                <Scale className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                Loadcell Sensor
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                High-precision loadcell sensors provide accurate weight measurements for soil samples. 
                The system measures total weight, gravel weight, and sand weight with exceptional accuracy.
              </p>
              <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
                <li>Precise weight measurement in grams</li>
                <li>Real-time data transmission</li>
                <li>Automatic calibration support</li>
                <li>High accuracy and reliability</li>
              </ul>
            </div>

            {/* ESP32 Integration Card */}
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center mb-6">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                ESP32 Microcontroller
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                ESP32 microcontroller acts as the bridge between the loadcell sensor and the web application. 
                It processes weight data and communicates wirelessly with the backend system.
              </p>
              <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
                <li>Wi-Fi connectivity for data transmission</li>
                <li>Real-time command processing</li>
                <li>Automated weight data collection</li>
                <li>Seamless integration with web platform</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              How It Works
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              Simple, efficient, and accurate soil analysis process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Capture Image',
                description: 'Capture soil sample images using your device camera for AI-powered classification'
              },
              {
                step: '2',
                title: 'AI Analysis',
                description: 'Our advanced CNN model analyzes the soil composition and classifies the type'
              },
              {
                step: '3',
                title: 'Measure Weight',
                description: 'Place soil samples on loadcell sensor connected to ESP32 for precise weight measurement'
              },
              {
                step: '4',
                title: 'Get Results',
                description: 'Receive detailed analysis reports with composition percentages and USCS classification'
              }
            ].map((item, index) => (
              <div
                key={index}
                className="text-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50"
              >
                <div className="w-16 h-16 rounded-full bg-primary-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                  {item.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6 text-white">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join our platform and experience the future of soil analysis
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-primary-600 rounded-lg font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg"
            >
              Create Free Account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg font-semibold text-lg transition-all duration-200 hover:bg-white/10"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            © {new Date().getFullYear()} GeoTech Soil Analysis. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;