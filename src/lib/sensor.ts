import type { SensorSample } from '@/types';

type PermissionResult = 'granted' | 'denied' | 'not-needed';

export async function requestSensorPermission(): Promise<PermissionResult> {
  // iOS Safari requires explicit permission request
  const DME = DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DME.requestPermission === 'function') {
    try {
      const result = await DME.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  // Android / desktop — no permission needed
  return 'not-needed';
}

export async function startSensorCollection(
  onSample: (sample: SensorSample) => void,
): Promise<() => void> {
  const startTime = performance.now();
  let wakeLock: WakeLockSentinel | null = null;

  // Prevent screen from sleeping during measurement
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    // Wake Lock not supported or denied — continue without it
  }

  const handler = (event: DeviceMotionEvent) => {
    const rr = event.rotationRate;
    const acc = event.accelerationIncludingGravity;
    if (!rr || !acc) return;

    onSample({
      timestamp: performance.now() - startTime,
      alpha: rr.alpha ?? 0,
      beta: rr.beta ?? 0,
      gamma: rr.gamma ?? 0,
      accX: acc.x ?? 0,
      accY: acc.y ?? 0,
      accZ: acc.z ?? 0,
    });
  };

  window.addEventListener('devicemotion', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('devicemotion', handler);
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  };
}
