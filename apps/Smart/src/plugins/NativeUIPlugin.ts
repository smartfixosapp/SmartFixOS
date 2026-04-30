/**
 * NativeUIPlugin proxy
 *
 * Exposes UIKit-native UI primitives to the WebView:
 *   - presentActionSheet
 *   - confirm (UIAlertController)
 *   - getSafeAreaInsets
 *   - enableLiquidGlass / disableLiquidGlass (iOS 26 background material)
 *   - setStatusBarStyle
 *
 * On the web, all methods fall back to sensible defaults
 * (window.confirm for confirm, no-op for the rest).
 */

import { registerPlugin } from "@capacitor/core";

export type ActionSheetButtonStyle = "default" | "cancel" | "destructive";

export interface ActionSheetButton {
  label: string;
  style?: ActionSheetButtonStyle;
}

export interface PresentActionSheetOptions {
  title: string;
  message?: string;
  buttons: ActionSheetButton[];
}

export interface PresentActionSheetResult {
  index: number;
  label: string;
}

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface ConfirmResult {
  confirmed: boolean;
}

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface EnableLiquidGlassOptions {
  /** 0..1 — how strong the blur material is. Default 0.6. */
  intensity?: number;
}

export interface EnableLiquidGlassResult {
  applied: boolean;
  supportsLiquidGlass: boolean;
}

export type StatusBarStyle = "light" | "dark" | "auto";

export interface SetStatusBarStyleOptions {
  style: StatusBarStyle;
}

export interface SetStatusBarStyleResult {
  style: StatusBarStyle;
}

export interface NativeUIPluginInterface {
  presentActionSheet(options: PresentActionSheetOptions): Promise<PresentActionSheetResult>;
  confirm(options: ConfirmOptions): Promise<ConfirmResult>;
  getSafeAreaInsets(): Promise<SafeAreaInsets>;
  enableLiquidGlass(options?: EnableLiquidGlassOptions): Promise<EnableLiquidGlassResult>;
  disableLiquidGlass(): Promise<{ disabled: boolean }>;
  setStatusBarStyle(options: SetStatusBarStyleOptions): Promise<SetStatusBarStyleResult>;
}

export const NativeUIPlugin = registerPlugin<NativeUIPluginInterface>("NativeUIPlugin", {
  web: () => import("./web").then((m) => new m.NativeUIPluginWeb()),
});
