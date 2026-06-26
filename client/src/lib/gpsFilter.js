const EARTH_RADIUS_M = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;

const haversineDistance = (p1, p2) => {
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const DEFAULT_OPTIONS = {
  maxAccuracyMeters: 50,
  maxSpeedMps: 30,
  minPoints: 2,
};

export const filterGlitchPoints = (points, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!points || points.length < opts.minPoints) return [];

  const cleaned = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];

    const accuracy = pt.accuracy ?? pt.metadata?.accuracy ?? Infinity;
    if (accuracy > opts.maxAccuracyMeters) continue;

    if (cleaned.length > 0) {
      const prev = cleaned[cleaned.length - 1];
      const dist = haversineDistance(prev, pt);
      const timeDiff = calcTimeDiff(prev, pt);
      const speed = timeDiff > 0 ? dist / timeDiff : 0;
      if (speed > opts.maxSpeedMps) continue;
    }

    cleaned.push(pt);
  }

  return cleaned;
};

const calcTimeDiff = (a, b) => {
  const t1 = a.timestamp ?? a.metadata?.capturedAt ?? 0;
  const t2 = b.timestamp ?? b.metadata?.capturedAt ?? 0;
  if (!t1 || !t2) return 1;
  return Math.abs(new Date(t2) - new Date(t1)) / 1000;
};

export const smoothPoints = (points, windowSize = 3) => {
  if (points.length < windowSize) return points;
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, i + Math.ceil(windowSize / 2));
    const window = points.slice(start, end);
    const avgLat = window.reduce((s, p) => s + p.lat, 0) / window.length;
    const avgLng = window.reduce((s, p) => s + p.lng, 0) / window.length;
    result.push({ ...points[i], lat: avgLat, lng: avgLng });
  }
  return result;
};

export const validatePoint = (point) => {
  const accuracy = point.accuracy ?? point.metadata?.accuracy ?? Infinity;
  if (typeof point.lat !== 'number' || typeof point.lng !== 'number') return false;
  if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return false;
  if (accuracy > DEFAULT_OPTIONS.maxAccuracyMeters) return false;
  return true;
};
