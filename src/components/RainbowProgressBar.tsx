import { useState, useEffect, useRef } from "react";

interface RainbowProgressBarProps {
  /** Whether an operation is currently active */
  active: boolean;
  /** Real progress value from backend (0-100), 0 means no real data */
  progress?: number;
  /** Called when the bar finishes its exit animation */
  onComplete?: () => void;
}

/**
 * A reusable rainbow progress bar that:
 * - Follows real download progress when available
 * - Simulates smooth progress when no real data is provided
 * - Fills to 100% and fades out when the operation completes
 */
export default function RainbowProgressBar({ active, progress = 0, onComplete }: RainbowProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevActive = useRef(false);

  useEffect(() => {
    if (active && !prevActive.current) {
      // Operation just started
      setDisplayProgress(0);
      setVisible(true);
    }

    if (!active && prevActive.current) {
      // Operation just finished → fill to 100% then fade
      setDisplayProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setDisplayProgress(0);
        onComplete?.();
      }, 800);
      return () => clearTimeout(timer);
    }

    prevActive.current = active;
  }, [active, onComplete]);

  useEffect(() => {
    // If we have real progress data, use it directly
    if (active && progress > 0) {
      setDisplayProgress(progress);
      // Clear any simulation interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // No real progress data → simulate
    if (active && progress === 0) {
      if (intervalRef.current) return; // already simulating
      intervalRef.current = setInterval(() => {
        setDisplayProgress(prev => {
          // Slow down as it approaches 90%, never reach 100% on its own
          if (prev < 30) return prev + 1.5;
          if (prev < 60) return prev + 0.8;
          if (prev < 80) return prev + 0.3;
          if (prev < 90) return prev + 0.1;
          return prev;
        });
      }, 200);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, progress]);

  if (!visible) return null;

  return (
    <div className="rainbow-progress" style={{ width: `${displayProgress}%` }} />
  );
}
