import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_ACCURACY_M = 50;

const useGeoLocation = ({ watch = false, maxAccuracy = MAX_ACCURACY_M } = {}) => {
  const [loading, setLoading] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [address, setAddress] = useState('');
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [track, setTrack] = useState([]);
  const watchIdRef = useRef(null);

  const getAddressFromCoords = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'en' },
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.display_name || 'Address not found';
      }
      return 'Failed to resolve address';
    } catch (err) {
      return 'Address translation offline';
    }
  };

  const processPosition = useCallback(async (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const acc = position.coords.accuracy;

    // If accuracy is worse than desired, don't throw — return the coordinates
    // along with a warning flag so callers can decide how to proceed.
    if (acc > maxAccuracy) {
      console.warn(`GPS accuracy low: ±${Math.round(acc)}m (max: ${maxAccuracy}m)`);
    }

    const resolvedAddress = await getAddressFromCoords(lat, lng);

    return { lat, lng, accuracy: acc, address: resolvedAddress, lowAccuracy: acc > maxAccuracy };
  }, [maxAccuracy]);

  const getPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = new Error('Geolocation is not supported by your browser');
        setError(err.message);
        reject(err);
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const result = await processPosition(position);
            setCoordinates({ lat: result.lat, lng: result.lng });
            setAccuracy(result.accuracy);
            setAddress(result.address);
            setLoading(false);
            setTrack(prev => [...prev, { ...result, timestamp: new Date().toISOString() }]);
            resolve(result);
          } catch (err) {
            setError(err.message);
            setLoading(false);
            reject(err);
          }
        },
        (err) => {
          let msg = 'Failed to retrieve location';
          if (err.code === 1) msg = 'Location access denied. Please enable GPS/location permissions.';
          else if (err.code === 2) msg = 'Location unavailable';
          else if (err.code === 3) msg = 'Location request timed out';

          setError(msg);
          setLoading(false);
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, [processPosition]);

  useEffect(() => {
    if (!watch || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const result = await processPosition(position);
          setCoordinates({ lat: result.lat, lng: result.lng });
          setAccuracy(result.accuracy);
          setAddress(result.address);
          setTrack(prev => [...prev, { ...result, timestamp: new Date().toISOString() }]);
          setError(null);
        } catch (err) {
          console.warn('Watch position filtered:', err.message);
        }
      },
      (err) => {
        console.error('Watch position error:', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [watch, processPosition]);

  const clearTrack = useCallback(() => setTrack([]), []);

  return {
    loading,
    coordinates,
    address,
    accuracy,
    error,
    track,
    getPosition,
    clearTrack,
  };
};

export default useGeoLocation;
