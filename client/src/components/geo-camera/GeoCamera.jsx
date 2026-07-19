import { AlertCircle, Camera, CheckCircle2, MapPin, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import useGeoLocation from '../../hooks/useGeoLocation';
import useAuthStore from '../../store/authStore';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const GeoCamera = ({
  value,
  onCapture,
  label = 'Evidence Photo',
  triggerOnly = false,
  onClose,
}) => {
  const { user } = useAuthStore();
  const { loading: geoLoading, getPosition } = useGeoLocation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [gpsData, setGpsData] = useState(null);
  const gpsPromiseRef = useRef(null);

  // Auto-start camera if triggerOnly is true
  useEffect(() => {
    if (triggerOnly) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [triggerOnly]);

  const startCamera = async () => {
    setError(null);
    setCameraActive(true);

    // 1. Start fetching GPS in parallel
    gpsPromiseRef.current = getPosition()
      .then((loc) => {
        setGpsData(loc);
        return loc;
      })
      .catch((err) => {
        console.warn('GPS retrieval error:', err);
        const fallbackLoc = { lat: 18.5204, lng: 73.8567, accuracy: 50, address: 'Fallback Location (Pune Plant)' };
        setGpsData(fallbackLoc);
        return fallbackLoc;
      });

    // 2. Start webcam stream
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('Primary getUserMedia failed, trying user camera', err);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(e => console.warn(e));
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please check permissions.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Match canvas dimensions to video feed
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw the video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Stop camera stream immediately
      stopCamera();

      // Get GPS info
      let loc = { lat: 18.5204, lng: 73.8567, accuracy: 50, address: 'Fallback Location (Pune Plant)' };
      if (gpsPromiseRef.current) {
        loc = await gpsPromiseRef.current;
      }

      // Draw metadata overlays
      const height = canvas.height;
      const width = canvas.width;
      const bannerHeight = Math.floor(height * 0.22);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, height - bannerHeight, width, bannerHeight);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';

      const fontSize = Math.max(12, Math.floor(height * 0.025));
      ctx.font = `600 ${fontSize}px sans-serif`;
      const paddingLeft = Math.floor(width * 0.04);
      let textTop = height - bannerHeight + Math.floor(bannerHeight * 0.1);
      const lineSpacing = Math.floor(fontSize * 1.3);

      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const employeeDetails = `Employee: ${user?.fullName || 'Unknown'} (${user?.employeeId || 'N/A'})`;
      const coordsText = `Lat: ${loc.lat.toFixed(6)}, Lng: ${loc.lng.toFixed(6)} (Acc: ${Math.round(loc.accuracy)}m)`;
      const addressText = `Addr: ${loc.address || 'Address not resolved'}`;

      ctx.fillText(employeeDetails, paddingLeft, textTop);
      textTop += lineSpacing;
      ctx.fillText(timestamp, paddingLeft, textTop);
      textTop += lineSpacing;
      ctx.fillText(coordsText, paddingLeft, textTop);
      textTop += lineSpacing;
      ctx.fillText(addressText, paddingLeft, textTop);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const uploadData = {
        url: dataUrl,
        metadata: {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          address: loc.address,
          capturedAt: new Date().toISOString(),
        },
      };

      onCapture(uploadData);
    } catch (err) {
      console.error('Capture failed:', err);
      setError('Capture failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = () => {
    stopCamera();
    onCapture(null);
    setGpsData(null);
    setError(null);
  };

  const handleClose = () => {
    stopCamera();
    if (onClose) onClose();
  };

  if (triggerOnly) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-4 text-white z-50 p-4 font-sans">
        <canvas ref={canvasRef} className="hidden" />

        <div className="relative w-full max-w-lg aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex flex-col items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`}
          />
          {!cameraActive && !processing && (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Camera className="w-10 h-10 animate-pulse text-indigo-500" />
              <p className="text-xs font-semibold">Initializing camera stream...</p>
            </div>
          )}
          {processing && (
            <div className="absolute inset-0 bg-slate-955/85 flex flex-col items-center justify-center gap-3">
              <Spinner size="md" />
              <p className="text-xs font-medium">Stamping metadata & coordinates...</p>
            </div>
          )}
        </div>

        {cameraActive && (
          <div className="flex gap-3 w-full max-w-lg">
            <Button type="button" variant="outline" className="flex-1 text-slate-300 border-slate-700 hover:bg-slate-850" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" className="flex-1" onClick={capturePhoto} icon={Camera}>
              Capture
            </Button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/30 p-3 rounded-xl border border-rose-900 max-w-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/40 font-sans">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        {value && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Captured Successfully
          </span>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* 1. Live stream container inline in the form */}
      {cameraActive && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {processing && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white">
              <Spinner size="md" />
              <p className="text-xs font-medium">Stamping metadata overlays...</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            <Button type="button" size="xs" variant="outline" className="flex-1 bg-black/60 border-black/10 hover:bg-black/85 text-white" onClick={stopCamera}>
              Cancel
            </Button>
            <Button type="button" size="xs" variant="primary" className="flex-1" onClick={capturePhoto} icon={Camera}>
              Capture Photo
            </Button>
          </div>
        </div>
      )}

      {/* 2. WhatsApp attachment preview style layout */}
      {value && !cameraActive && (
        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-850">
          <div className="relative aspect-video sm:w-48 overflow-hidden rounded-lg bg-slate-900 border border-slate-100 dark:border-slate-850 shrink-0">
            <img src={value} alt="Preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 flex flex-col justify-between text-xs text-slate-500 font-semibold min-w-0">
            <div className="space-y-1.5 py-1">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="font-bold text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">GPS Stamp</span>
              </div>
              {gpsData ? (
                <div className="space-y-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  <p>Latitude: {gpsData.lat.toFixed(6)}</p>
                  <p>Longitude: {gpsData.lng.toFixed(6)}</p>
                  <p>Accuracy: ±{Math.round(gpsData.accuracy)}m</p>
                  <p className="font-bold mt-1 text-slate-500">Addr: {gpsData.address}</p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">Coordinates attached to image</p>
              )}
            </div>
            <div className="pt-2 sm:pt-0 flex gap-2">
              <Button type="button" size="xs" variant="outline" onClick={startCamera} icon={Camera}>
                Retake
              </Button>
              <Button type="button" size="xs" variant="outline" className="text-rose-600 border-rose-100 hover:bg-rose-50" onClick={handleClear} icon={Trash2}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Idle action button */}
      {!value && !cameraActive && (
        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/20 dark:bg-slate-900/10">
          <Button
            type="button"
            onClick={startCamera}
            icon={Camera}
            variant="primary"
            size="sm"
          >
            Open Geo Camera
          </Button>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">Opens live capture stream, logs coordinates instantly</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-500 font-semibold flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
};

export default GeoCamera;
