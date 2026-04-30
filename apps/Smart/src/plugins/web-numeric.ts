/**
 * Web fallback for the NumericInputHelper plugin.
 *
 * Web has no native haptics or keyboard control, so methods are
 * mostly no-ops. We still implement the interface so the same
 * code path works in dev / preview.
 */

import { WebPlugin } from "@capacitor/core";
import type {
  NumericInputHelperPlugin,
  VerifyKeyboardModeOptions,
  VerifyKeyboardModeResult,
  TapHapticOptions,
  TapHapticResult,
  DismissKeyboardResult,
} from "./NumericInputHelper";

export class NumericInputHelperWeb extends WebPlugin implements NumericInputHelperPlugin {
  async verifyKeyboardMode({ expected }: VerifyKeyboardModeOptions): Promise<VerifyKeyboardModeResult> {
    return {
      expected,
      supported: ["decimal", "numeric", "tel", "default"],
    };
  }

  async tapHaptic(_options?: TapHapticOptions): Promise<TapHapticResult> {
    // Some Chromium builds expose the Vibration API on Android-Web.
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try { navigator.vibrate(8); } catch { /* no-op */ }
    }
    return { played: false };
  }

  async dismissKeyboard(): Promise<DismissKeyboardResult> {
    if (typeof document !== "undefined") {
      const el = document.activeElement as HTMLElement | null;
      el?.blur?.();
    }
    return { dismissed: true };
  }
}
