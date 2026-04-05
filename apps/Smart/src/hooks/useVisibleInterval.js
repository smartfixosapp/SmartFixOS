import { useEffect, useRef } from "react";

/**
 * Like setInterval, but automatically pauses when the tab is hidden.
 * This prevents Safari's "significant energy" warning caused by
 * multiple intervals making network requests in background tabs.
 *
 * @param {Function} callback - Function to call on each tick
 * @param {number} delay - Interval in ms (null to disable)
 * @param {Array} deps - Additional dependencies
 */
export function useVisibleInterval(callback, delay, deps = []) {
  const savedCallback = useRef(callback);
  const intervalRef = useRef(null);

  // Update callback ref
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null || delay === undefined) return;

    const start = () => {
      if (intervalRef.current) return; // already running
      intervalRef.current = setInterval(() => savedCallback.current(), delay);
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
        // Run immediately when tab becomes visible again
        savedCallback.current();
      }
    };

    // Start only if visible
    if (!document.hidden) start();

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...deps]);
}
