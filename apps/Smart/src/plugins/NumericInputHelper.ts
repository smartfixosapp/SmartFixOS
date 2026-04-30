/**
 * NumericInputHelper plugin proxy
 *
 * Helps the SmartFixOS POS use the right keyboard for each numeric
 * input on iOS, plus haptic feedback for keypad presses.
 *
 * Usage:
 *   import { NumericInputHelper, KeyboardMode } from "@/plugins/NumericInputHelper";
 *   await NumericInputHelper.tapHaptic({ style: "light" });
 *   await NumericInputHelper.dismissKeyboard();
 */

import { registerPlugin } from "@capacitor/core";

export type KeyboardMode = "decimal" | "numeric" | "tel" | "default";

export type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

export interface VerifyKeyboardModeOptions {
  expected: KeyboardMode;
}

export interface VerifyKeyboardModeResult {
  expected: KeyboardMode;
  supported: KeyboardMode[];
}

export interface TapHapticOptions {
  style?: HapticStyle;
}

export interface TapHapticResult {
  played: boolean;
}

export interface DismissKeyboardResult {
  dismissed: boolean;
}

export interface NumericInputHelperPlugin {
  verifyKeyboardMode(options: VerifyKeyboardModeOptions): Promise<VerifyKeyboardModeResult>;
  tapHaptic(options?: TapHapticOptions): Promise<TapHapticResult>;
  dismissKeyboard(): Promise<DismissKeyboardResult>;
}

export const NumericInputHelper = registerPlugin<NumericInputHelperPlugin>(
  "NumericInputHelper",
  {
    web: () => import("./web-numeric").then((m) => new m.NumericInputHelperWeb()),
  }
);

/**
 * HTML attribute helpers — the right inputmode prevents iOS from
 * showing the wrong keyboard. Use these on every numeric input.
 *
 *   <input {...inputModeFor("price")} />
 *   <input {...inputModeFor("phone")} />
 */
export function inputModeFor(kind: "price" | "qty" | "phone" | "code" | "otp"): {
  inputMode: "decimal" | "numeric" | "tel";
  pattern?: string;
  autoComplete?: string;
} {
  switch (kind) {
    case "price":
      return { inputMode: "decimal", pattern: "[0-9]*[.,]?[0-9]*" };
    case "qty":
      return { inputMode: "numeric", pattern: "[0-9]*" };
    case "phone":
      return { inputMode: "tel", autoComplete: "tel" };
    case "code":
      return { inputMode: "numeric", pattern: "[0-9]*" };
    case "otp":
      return { inputMode: "numeric", pattern: "[0-9]*", autoComplete: "one-time-code" };
  }
}
