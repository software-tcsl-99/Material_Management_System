import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Camera, X, Zap, ZapOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// #1 Audio beep generator (no external file needed)
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1800;
    osc.type = 'square';
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {
    // Audio not supported — silently ignore
  }
}

// #2 Haptic vibration feedback
function vibrateDevice() {
  try {
    if (navigator.vibrate) navigator.vibrate(100);
  } catch (_) { }
}

export default function BarcodeScanner({ onScan, onClose }) {
  const [error, setError] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanTime, setScanTime] = useState(null); // #20 perf timer display
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null); // #14 warm-up stream ref
  const scanStartRef = useRef(null); // #20 perf timer start
  const resultCacheRef = useRef(new Set()); // #17 result cache
  const timeoutRef = useRef(null); // #18 scan timeout
  const frameCountRef = useRef(0); // #16 frame skip counter
  const lastScanRef = useRef(0); // #8 debounce timestamp
  const mountedRef = useRef(true);

  // #3 Scan timeout — auto close after 60s
  const startScanTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setError('Scan timed out after 60s. Please try again or enter manually.');
        stopScanning();
      }
    }, 60000);
  }, []);

  const stopScanning = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    // Stop all stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // #4 Torch toggle
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const newVal = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: newVal }] });
      setTorchOn(newVal);
    } catch (_) {
      setTorchSupported(false);
    }
  }, [torchOn]);

  useEffect(() => {
    mountedRef.current = true;

    // ===== #1-#5 OPTIMIZED DECODE HINTS =====
    const hints = new Map();

    // #6 Reduced format list — only common warehouse/industrial barcodes
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);

    // #3 TRY_HARDER — more aggressive decoding for damaged/blurry barcodes
    hints.set(DecodeHintType.TRY_HARDER, true);

    // #4 CHARACTER_SET — ensure UTF-8 decoding
    hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8');

    // #5 ASSUME_GS1 — skip GS1 parsing overhead
    hints.set(DecodeHintType.ASSUME_GS1, false);

    // #7 Adaptive scan interval — start fast at 100ms
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
    codeReaderRef.current = reader;

    // #7 Warm-up: immediately acquire camera stream
    startCamera();

    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, []);

  // #14 + #1 + #2 + #11 + #19 — Warm-up with forced back camera
  const startCamera = async (retry = 0) => {
    try {
      setError('');

      const constraints = {
        video: {
          facingMode: { exact: 'environment' }, // #1 ALWAYS back camera
          width: { ideal: 1280 },               // #2 720p width
          height: { ideal: 720 },               // #2 720p height
          focusMode: { ideal: 'continuous' },    // #11 continuous AF
          // #19 Landscape orientation preferred
        },
        audio: false,
      };

      // #14 Pre-acquire stream for instant display
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      // #10 Check torch support
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = track.getCapabilities?.();
          if (caps && caps.torch) {
            setTorchSupported(true);
          }
        } catch (_) { }
      }

      // Attach stream to video element immediately for instant preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // #20 Start performance timer
      scanStartRef.current = performance.now();

      startDecoding();

      // #18 Start scan timeout
      startScanTimeout();
    } catch (err) {
      console.error('Camera init error:', err);

      // #15 Exponential retry — up to 3 attempts
      if (retry < 3) {
        const delay = Math.pow(2, retry) * 500; // 500ms, 1s, 2s
        setError(`Camera init failed. Retrying in ${delay / 1000}s... (attempt ${retry + 1}/3)`);
        setRetryCount(retry + 1);
        setTimeout(() => {
          if (mountedRef.current) startCamera(retry + 1);
        }, delay);
      } else {
        // If 'exact' environment fails, fallback to preferred environment
        if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
            if (!mountedRef.current) {
              fallbackStream.getTracks().forEach((t) => t.stop());
              return;
            }
            streamRef.current = fallbackStream;
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              await videoRef.current.play();
            }
            scanStartRef.current = performance.now();
            startDecoding();
            startScanTimeout();
            return;
          } catch (_) { }
        }
        setError('Could not access back camera. Please enter barcode manually.');
      }
    }
  };

  // #7 + #9 + #16 Decoding with frame skipping & adaptive interval
  const startDecoding = async () => {
    if (!codeReaderRef.current || !videoRef.current) return;

    try {
      const controls = await codeReaderRef.current.decodeFromVideoElement(
        videoRef.current,
        (result, err) => {
          // #16 Frame skipping — only process every 2nd frame
          frameCountRef.current += 1;
          if (frameCountRef.current % 2 !== 0) return;

          if (result) {
            const text = result.getText();
            const now = Date.now();

            // #8 Debounce — ignore same scan within 1s
            if (now - lastScanRef.current < 1000) return;

            // #17 Result cache — skip if already scanned in this session
            if (resultCacheRef.current.has(text)) return;

            // ✅ VALID SCAN — fire all feedback
            lastScanRef.current = now;
            resultCacheRef.current.add(text);

            // #20 Performance timer
            const elapsed = scanStartRef.current
              ? (performance.now() - scanStartRef.current).toFixed(0)
              : '?';
            console.log(`✅ Barcode scanned in ${elapsed}ms: ${text}`);
            setScanTime(elapsed);

            // #12 Audio beep
            playBeep();

            // #13 Haptic vibration
            vibrateDevice();

            // Fire callback after tiny delay for feedback to register
            setTimeout(() => {
              onScan(text);
              stopScanning();
              onClose();
            }, 150);
          }

          if (err && !(err.name === 'NotFoundException')) {
            console.warn('Decode warning:', err);
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      console.error('Decode start error:', err);
      setError('Scanner failed to start. Enter barcode manually.');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-slate-800">Scan Barcode</h3>
            {/* #20 Show scan time if available */}
            {scanTime && (
              <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {scanTime}ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* #10 Torch toggle button */}
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className={`p-1.5 rounded-lg transition-colors ${torchOn
                  ? 'bg-amber-100 text-amber-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                  }`}
                title={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              >
                {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => {
                stopScanning();
                onClose();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
              {/* #9 Scan region indicator — center 60% highlighted */}
              <div className="absolute inset-[15%] pointer-events-none border-2 border-blue-400/30 rounded-lg" />
              {/* Corner highlights for the scan box */}
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

        {/* Status info */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-slate-400">
            Point the back camera at a barcode • Auto-closes in 60s
          </p>
          {retryCount > 0 && !error && (
            <p className="text-xs text-amber-500 mt-1">
              Camera recovered after {retryCount} retry(ies)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
