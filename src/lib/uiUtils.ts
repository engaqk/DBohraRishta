
/**
 * Triggers a subtle haptic feedback vibration on supported mobile devices.
 * @param pattern - Vibration pattern (e.g., 50 for a short tap, [50, 30, 50] for a double tap)
 */
export const triggerHaptic = (pattern: number | number[] = 50) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration errors
    }
  }
};

/**
 * Common haptic patterns for the app
 */
export const HapticPatterns = {
  LIGHT: 30,
  MEDIUM: 60,
  SUCCESS: [50, 80, 50],
  ERROR: [100, 50, 100],
  MATCH: [100, 100, 100, 100, 100], // Stronger pattern for matches
};
