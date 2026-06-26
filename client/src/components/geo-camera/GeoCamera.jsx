import { AlertCircle, Camera, CheckCircle2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import useGeoLocation from '../../hooks/useGeoLocation';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const GeoCamera = ({ onCapture, label = 'Evidence Photo' }) => {
  const { user } = useAuthStore();
  const { loading: geoLoading, error: geoError, coordinates, address, accuracy, getPosition } = useGeoLocation();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // Initialize camera and location
  const startCamera = async () => {
    try {
      setCameraError(null);
      setCapturedPhoto(null);

      // Request location in parallel
      getPosition().catch(err => console.warn('Pre-fetching location failed:', err));

      // Build constraints: prefer explicit deviceId when selected, otherwise prefer environment then user
      let videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (selectedDeviceId) {
        videoConstraints.deviceId = { exact: selectedDeviceId };
      } else {
        videoConstraints.facingMode = { ideal: 'environment' };
      }

      const constraints = { video: videoConstraints, audio: false };

      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // If facingMode failed (common on desktops), try a generic user-facing camera
        console.warn('Primary getUserMedia failed, trying fallback facingMode:user', err);
        const fallback = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
        mediaStream = await navigator.mediaDevices.getUserMedia(fallback);
      }
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Unable to access camera. Please check permissions.');
    }
  };

  // Enumerate available video input devices for selection (front/back/laptop)
  const discoverDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const list = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = list.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      // If no selection yet, pick the first device
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId || '');
      }
    } catch (err) {
      console.warn('Device discovery failed', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    // Discover devices when component mounts
    discoverDevices();
    return () => {
      stopCamera();
    };
  }, [stream]);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      // Ensure we have coordinates before capture
      let loc = { lat: 0, lng: 0, accuracy: 0, address: 'Unknown Location' };
      try {
        const fetched = await getPosition();
        loc = fetched;
      } catch (err) {
        console.warn('Could not get precise location, using fallbacks:', err);
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Match canvas dimensions to video feed
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Add semi-transparent overlay banner at the bottom (20% of canvas height)
      const bannerHeight = Math.floor(canvas.height * 0.22);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

      // Overlay text formatting
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';

      const fontSize = Math.max(12, Math.floor(canvas.height * 0.025));
      ctx.font = `600 ${fontSize}px sans-serif`;

      const paddingLeft = Math.floor(canvas.width * 0.04);
      let textTop = canvas.height - bannerHeight + Math.floor(bannerHeight * 0.1);
      const lineSpacing = Math.floor(fontSize * 1.3);

      const timestamp = new Date().toLocaleString();
      const employeeDetails = `Employee: ${user?.fullName || 'Unknown'} (${user?.employeeId || 'N/A'})`;
      const coordsText = `Lat: ${loc.lat.toFixed(6)}, Lng: ${loc.lng.toFixed(6)} (Acc: ${Math.round(loc.accuracy)}m)`;
      const addressText = `Addr: ${loc.address || 'Address not resolved'}`;

      // Write lines
      ctx.fillText(employeeDetails, paddingLeft, textTop);
      textTop += lineSpacing;
      ctx.fillText(timestamp, paddingLeft, textTop);
      textTop += lineSpacing;
      ctx.fillText(coordsText, paddingLeft, textTop);
      textTop += lineSpacing;

      // Wrap address text if it's too long
      const maxAddressWidth = canvas.width - (paddingLeft * 2);
      const words = addressText.split(' ');
      let currentLine = '';

      for (let n = 0; n < words.length; n++) {
        let testLine = currentLine + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxAddressWidth && n > 0) {
          ctx.fillText(currentLine, paddingLeft, textTop);
          currentLine = words[n] + ' ';
          textTop += lineSpacing;
        } else {
          currentLine = testLine;
        }
      }
      ctx.fillText(currentLine, paddingLeft, textTop);

      // Generate base64 string
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhoto(dataUrl);
      stopCamera();

      // Upload base64 image immediately to server
      setUploading(true);
      const response = await api.post('/upload/base64', {
        image: dataUrl,
        metadata: {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          address: loc.address,
          device: navigator.userAgent,
          capturedAt: new Date(),
        }
      });

      setUploading(false);

      const uploadData = {
        url: response.data.url,
        metadata: {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          address: loc.address,
          device: navigator.userAgent,
          capturedAt: new Date(),
        }
      };

      onCapture(uploadData);
    } catch (err) {
      console.error('Capture/Upload error:', err);
      setUploading(false);
      setCameraError('Capture or upload failed. Please try again.');
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-900/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </span>
        {capturedPhoto && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Captured & Uploaded
          </span>
        )}
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400">
        <canvas ref={canvasRef} className="hidden" />

        {/* Captured Preview */}
        {capturedPhoto && (
          <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover animate-in fade-in duration-200" />
        )}

        {/* Live Camera Feed */}
        {cameraActive && !capturedPhoto && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {/* Idle/Trigger State */}
        {!cameraActive && !capturedPhoto && (
          <div className="flex flex-col items-center gap-2">
            <Camera className="w-12 h-12 text-slate-500" />
            <p className="text-sm font-medium">No live feed active</p>
            <Button size="sm" onClick={startCamera} icon={Camera}>
              Start Camera
            </Button>
          </div>
        )}

        {/* Loader Screen */}
        {(uploading || geoLoading) && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white z-10">
            <Spinner size="md" />
            <p className="text-xs font-medium">
              {geoLoading ? 'Acquiring high-accuracy GPS coordinates...' : 'Uploading secure image with metadata overlays...'}
            </p>
          </div>
        )}
      </div>

      {/* Geolocation feedback in container */}
      {cameraActive && !capturedPhoto && (
        <div className="flex flex-col gap-2 p-3 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-800/10 rounded-lg text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-indigo-700 dark:text-indigo-400">
              On-Site GPS Tracking
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 py-0 px-2 text-[10px] text-indigo-600 cursor-pointer"
              onClick={getPosition}
              disabled={geoLoading}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${geoLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
          {coordinates ? (
            <div className="flex flex-col gap-1 text-slate-600 dark:text-slate-400">
              <p>Coordinates: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)} (+/- {Math.round(accuracy)}m)</p>
              <p className="truncate">Address: {address || 'Resolving address...'}</p>
            </div>
          ) : geoError ? (
            <p className="text-red-500 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {geoError}
            </p>
          ) : (
            <p className="text-slate-500 animate-pulse">Requesting current location...</p>
          )}
        </div>
      )}

      {/* Control Actions */}
      {/* Camera device selector */}
      {devices.length > 1 && (
        <div className="flex items-center gap-2 w-full">
          <label className="text-xs text-slate-500">Camera:</label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-lg border px-2 py-1 text-sm"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId}`}</option>
            ))}
          </select>
          <div className="flex-1" />
        </div>
      )}

      <div className="flex items-center gap-2.5">
        {cameraActive && !capturedPhoto && (
          <>
            <Button variant="outline" size="sm" onClick={stopCamera} className="flex-1">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={capturePhoto}
              disabled={geoLoading || uploading}
              icon={Camera}
              className="flex-1"
            >
              Capture Frame
            </Button>
          </>
        )}
        {capturedPhoto && (
          <Button variant="outline" size="sm" onClick={startCamera} icon={Camera} className="w-full">
            Recapture Photo
          </Button>
        )}
      </div>

      {cameraError && (
        <p className="text-xs text-red-500 font-semibold flex items-center gap-1.5 mt-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" /> {cameraError}
        </p>
      )}
    </div>
  );
};

export default GeoCamera;
