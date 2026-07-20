import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function BarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    // Initialize Reader with optimal format hints
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.ITF,
    ]);

    const reader = new BrowserMultiFormatReader(hints);
    codeReaderRef.current = reader;

    // Get Cameras
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((videoDevices) => {
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDevice(videoDevices[0].deviceId);
        } else {
          setError('No camera devices found. Using manual entry fallback.');
        }
      })
      .catch((err) => {
        console.error('Camera listing error:', err);
        setError('Error accessing cameras. Enter barcode manually.');
      });

    return () => {
      stopScanning();
    };
  }, []);

  useEffect(() => {
    if (selectedDevice && videoRef.current) {
      startScanning();
    }
  }, [selectedDevice]);

  const startScanning = async () => {
    try {
      if (!codeReaderRef.current) return;
      setError('');
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }

      const constraints = {
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'environment'
        }
      };

      const controls = await codeReaderRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, err) => {
          if (result) {
            onScan(result.getText());
            stopScanning();
            onClose();
          }
          if (err && !(err.name === 'NotFoundException')) {
            console.warn(err);
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      console.error('Start scan error:', err);
      setError('Could not start scanner on this camera. Try another or enter manually.');
    }
  };

  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-slate-800">Scan Barcode</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="relative w-[300px] h-[300px] bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center mx-auto my-4 border border-slate-100 dark:border-slate-800">
          {error ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              {error}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              {/* Corner highlights for the 300x300 scan box */}
              <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
                <div className="flex justify-between w-full">
                  <div className="w-5 h-5 border-t-4 border-l-4 border-blue-500 rounded-tl-md" />
                  <div className="w-5 h-5 border-t-4 border-r-4 border-blue-500 rounded-tr-md" />
                </div>
                {/* Laser line overlay inside the box */}
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
                <div className="flex justify-between w-full">
                  <div className="w-5 h-5 border-b-4 border-l-4 border-blue-500 rounded-bl-md" />
                  <div className="w-5 h-5 border-b-4 border-r-4 border-blue-500 rounded-br-md" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controls & Manual Entry */}
        <div className="p-6 space-y-4">
          {devices.length > 1 && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full text-sm bg-transparent border-none outline-none font-medium text-slate-700 cursor-pointer"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
