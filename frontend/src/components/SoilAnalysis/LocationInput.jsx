import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

function LocationInput({ 
  fullLocation,
  setFullLocation,
  onSubmit,
  error 
}) {
  
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  
  const [apiError, setApiError] = useState('');

  // Fetch Regions on mount
  useEffect(() => {
    fetchRegions();
  }, []);

  // Build full location string whenever selections change
  useEffect(() => {
    if (selectedBarangay && selectedMunicipality && selectedProvince && selectedRegion) {
      const location = `${selectedBarangay.name}, ${selectedMunicipality.name}, ${selectedProvince.name}, ${selectedRegion.name}`;
      setFullLocation(location);
    } else {
      setFullLocation('');
    }
  }, [selectedBarangay, selectedMunicipality, selectedProvince, selectedRegion]);

  const fetchRegions = async () => {
    setLoadingRegions(true);
    setApiError('');
    try {
      const response = await fetch('https://psgc.gitlab.io/api/regions/');
      if (!response.ok) throw new Error('Failed to fetch regions');
      const data = await response.json();
      setRegions(data);
    } catch (err) {
      setApiError('Error loading regions. Please check your internet connection.');
      console.error('Regions fetch error:', err);
    } finally {
      setLoadingRegions(false);
    }
  };

  const fetchProvinces = async (regionCode) => {
    setLoadingProvinces(true);
    setApiError('');
    try {
      const response = await fetch(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces/`);
      if (!response.ok) throw new Error('Failed to fetch provinces');
      const data = await response.json();
      setProvinces(data);
    } catch (err) {
      setApiError('Error loading provinces.');
      console.error('Provinces fetch error:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  const fetchMunicipalities = async (provinceCode) => {
    setLoadingMunicipalities(true);
    setApiError('');
    try {
      const response = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`);
      if (!response.ok) throw new Error('Failed to fetch municipalities');
      const data = await response.json();
      setMunicipalities(data);
    } catch (err) {
      setApiError('Error loading cities/municipalities.');
      console.error('Municipalities fetch error:', err);
    } finally {
      setLoadingMunicipalities(false);
    }
  };

  const fetchBarangays = async (municipalityCode) => {
    setLoadingBarangays(true);
    setApiError('');
    try {
      const response = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${municipalityCode}/barangays/`);
      if (!response.ok) throw new Error('Failed to fetch barangays');
      const data = await response.json();
      setBarangays(data);
    } catch (err) {
      setApiError('Error loading barangays.');
      console.error('Barangays fetch error:', err);
    } finally {
      setLoadingBarangays(false);
    }
  };

  const handleRegionChange = (e) => {
    const regionCode = e.target.value;
    const region = regions.find(r => r.code === regionCode);
    
    setSelectedRegion(region);
    setSelectedProvince(null);
    setSelectedMunicipality(null);
    setSelectedBarangay(null);
    setProvinces([]);
    setMunicipalities([]);
    setBarangays([]);
    
    if (region) {
      fetchProvinces(region.code);
    }
  };

  const handleProvinceChange = (e) => {
    const provinceCode = e.target.value;
    const province = provinces.find(p => p.code === provinceCode);
    
    setSelectedProvince(province);
    setSelectedMunicipality(null);
    setSelectedBarangay(null);
    setMunicipalities([]);
    setBarangays([]);
    
    if (province) {
      fetchMunicipalities(province.code);
    }
  };

  const handleMunicipalityChange = (e) => {
    const municipalityCode = e.target.value;
    const municipality = municipalities.find(m => m.code === municipalityCode);
    
    setSelectedMunicipality(municipality);
    setSelectedBarangay(null);
    setBarangays([]);
    
    if (municipality) {
      fetchBarangays(municipality.code);
    }
  };

  const handleBarangayChange = (e) => {
    const barangayCode = e.target.value;
    const barangay = barangays.find(b => b.code === barangayCode);
    
    setSelectedBarangay(barangay);
  };

  return (
    <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
      <div className="flex items-center gap-3 mb-4">
        <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h3 className="text-xl font-bold text-blue-900 dark:text-blue-200">
          Enter Sample Location
        </h3>
      </div>
      
      <p className="text-base text-gray-700 dark:text-gray-300 mb-4">
        Please specify the complete location where the soil sample was collected.
        <span className="block text-sm text-blue-600 dark:text-blue-400 mt-1">
          📡 Using PSGC API - Live data from Philippine Statistics Authority
        </span>
      </p>
      
      {apiError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700">
          <p className="text-sm text-red-700 dark:text-red-300">⚠️ {apiError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Region Dropdown */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Region <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <select
              value={selectedRegion?.code || ''}
              onChange={handleRegionChange}
              disabled={loadingRegions}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingRegions ? 'Loading regions...' : 'Select Region'}
              </option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
            {loadingRegions && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
        </div>

        {/* Province Dropdown */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Province <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <select
              value={selectedProvince?.code || ''}
              onChange={handleProvinceChange}
              disabled={!selectedRegion || loadingProvinces}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingProvinces ? 'Loading provinces...' : 'Select Province'}
              </option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            {loadingProvinces && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
        </div>

        {/* Municipality Dropdown */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            City/Municipality <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <select
              value={selectedMunicipality?.code || ''}
              onChange={handleMunicipalityChange}
              disabled={!selectedProvince || loadingMunicipalities}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingMunicipalities ? 'Loading municipalities...' : 'Select City/Municipality'}
              </option>
              {municipalities.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
            {loadingMunicipalities && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
        </div>

        {/* Barangay Dropdown */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Barangay <span className="text-red-600">*</span>
          </label>
          <div className="relative">
            <select
              value={selectedBarangay?.code || ''}
              onChange={handleBarangayChange}
              disabled={!selectedMunicipality || loadingBarangays}
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingBarangays ? 'Loading barangays...' : 'Select Barangay'}
              </option>
              {barangays.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            {loadingBarangays && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
        </div>
      </div>

      {/* Display Full Location */}
      {fullLocation && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-300 dark:border-green-700">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Complete Location:
          </p>
          <p className="text-base font-bold text-green-700 dark:text-green-300">
            {fullLocation}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={!fullLocation}
        className="w-full px-6 py-3 text-base font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        aria-label="Submit location and proceed"
      >
        Proceed to Image Capture
      </button>
    </div>
  );
}

export default LocationInput;