/**
 * Web fallback for NativeUIPlugin.
 *
 * Uses DOM-native equivalents:
 *   - confirm  → window.confirm
 *   - actionSheet → naive prompt-based fallback (only used in dev)
 *   - safe-area → reads `env(safe-area-inset-*)` from CSS
 */

import { WebPlugin } from "@capacitor/core";
import type {
  NativeUIPluginInterface,
  PresentActionSheetOptions,
  PresentActionSheetResult,
  ConfirmOptions,
  ConfirmResult,
  SafeAreaInsets,
  EnableLiquidGlassOptions,
  EnableLiquidGlassResult,
  SetStatusBarStyleOptions,
  SetStatusBarStyleResult,
} from "./NativeUIPlugin";

function readCssEnv(name: string): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.height = `env(${name}, 0px)`;
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.round(measured);
}

export class NativeUIPluginWeb extends WebPlugin implements NativeUIPluginInterface {
  async presentActionSheet(options: PresentActionSheetOptions): Promise<PresentActionSheetResult> {
    if (typeof window === "undefined") return { index: -1, label: "cancel" };
    const labels = options.buttons.map((b, i) => `${i + 1}. ${b.label}`).join("\n");
    const choice = window.prompt(`${options.title}\n${options.message ?? ""}\n\n${labels}\n\nChoose 1..${options.buttons.length} or 0 to cancel`, "0");
    const idx = parseInt(choice ?? "0", 10);
    if (Number.isNaN(idx) || idx <= 0 || idx > options.buttons.length) {
      return { index: -1, label: "cancel" };
    }
    return { index: idx - 1, label: options.buttons[idx - 1]?.label ?? "" };
  }

  async confirm(options: ConfirmOptions): Promise<ConfirmResult> {
    if (typeof window === "undefined") return { confirmed: false };
    const text = [options.title, options.message].filter(Boolean).join("\n\n");
    return { confirmed: window.confirm(text) };
  }

  async getSafeAreaInsets(): Promise<SafeAreaInsets> {
    return {
      top: readCssEnv("safe-area-inset-top"),
      right: readCssEnv("safe-area-inset-right"),
      bottom: readCssEnv("safe-area-inset-bottom"),
      left: readCssEnv("safe-area-inset-left"),
    };
  }

  async enableLiquidGlass(_options?: EnableLiquidGlassOptions): Promise<EnableLiquidGlassResult> {
    // Web has no Liquid Glass — apply a soft `backdrop-filter` on :root
    // for a crude approximation, opt-in via a class hook.
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("sfx-liquid-glass-emulated");
    }
    return { applied: false, supportsLiquidGlass: false };
  }

  async disableLiquidGlass(): Promise<{ disabled: boolean }> {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("sfx-liquid-glass-emulated");
    }
    return { disabled: true };
  }

  async setStatusBarStyle({ style }: SetStatusBarStyleOptions): Promise<SetStatusBarStyleResult> {
    // No analog on web; we simply update <meta name="theme-color"> for PWAs.
    if (typeof document !== "undefined") {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (meta) {
        meta.content = style === "light" ? "#000000" : style === "dark" ? "#ffffff" : "#000000";
      }
    }
    return { style };
  }
}
