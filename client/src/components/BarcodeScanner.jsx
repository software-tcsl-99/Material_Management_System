import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, X, RefreshCw } from 'lucide-react';

export default function BarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);

  useEffect(() => {
    // Initialize Reader
    const reader = new BrowserMultiFormatReader();
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
      // Reset reader
      codeReaderRef.current.reset();
      
      await codeReaderRef.current.decodeFromVideoDevice(
        selectedDevice,
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
    } catch (err) {
      console.error('Start scan error:', err);
      setError('Could not start scanner on this camera. Try another or enter manually.');
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
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
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              {error}
            </div>
          ) : (
            <video ref={videoRef} className="w-full h-full object-cover" />
          )}
          
          {/* Laser Guide overlay */}
          {!error && (
            <div className="absolute inset-x-8 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse pointer-events-none" />
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-slate-400">OR ENTER MANUALLY</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. PC120001, EN120031"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm"
              autoFocus
            />
            <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition">
              Apply
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
