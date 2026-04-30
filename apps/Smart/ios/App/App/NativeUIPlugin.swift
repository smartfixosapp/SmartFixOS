import Foundation
import UIKit
import Capacitor

/// NativeUIPlugin
///
/// Bridge for "feels native" interactions inside the WebView:
///   - present a UIKit action sheet from a JS event
///   - present a confirm dialog using UIAlertController
///   - apply a Liquid Glass background container behind the WebView (iOS 26+)
///   - expose safe-area insets so JS can size things pixel-perfect
///
/// JS side: see apps/Smart/src/plugins/NativeUIPlugin.ts
@objc(NativeUIPlugin)
public class NativeUIPlugin: CAPPlugin {

    private weak var liquidContainer: LiquidGlassWebContainer?

    // ─────────────────────────────────────────────────────────────────────
    // Action Sheet
    // ─────────────────────────────────────────────────────────────────────

    @objc func presentActionSheet(_ call: CAPPluginCall) {
        guard let title = call.getString("title") else {
            call.reject("title is required")
            return
        }
        let message = call.getString("message")
        let buttons = call.getArray("buttons", JSObject.self) ?? []

        DispatchQueue.main.async {
            let alert = UIAlertController(title: title, message: message, preferredStyle: .actionSheet)

            for (index, btn) in buttons.enumerated() {
                let label = btn["label"] as? String ?? "Opción"
                let style = btn["style"] as? String ?? "default"
                let alertStyle: UIAlertAction.Style = {
                    switch style {
                    case "destructive": return .destructive
                    case "cancel": return .cancel
                    default: return .default
                    }
                }()
                let action = UIAlertAction(title: label, style: alertStyle) { _ in
                    call.resolve(["index": index, "label": label])
                }
                alert.addAction(action)
            }
            // Always provide an explicit Cancel on iPad to avoid popover issues.
            if !buttons.contains(where: { ($0["style"] as? String) == "cancel" }) {
                alert.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in
                    call.resolve(["index": -1, "label": "cancel"])
                })
            }

            // iPad popover anchor: present from the top of the WebView.
            if let popover = alert.popoverPresentationController, let webView = self.bridge?.webView {
                popover.sourceView = webView
                popover.sourceRect = CGRect(x: webView.bounds.midX, y: 60, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }

            self.bridge?.viewController?.present(alert, animated: true)
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Confirm Dialog
    // ─────────────────────────────────────────────────────────────────────

    @objc func confirm(_ call: CAPPluginCall) {
        let title = call.getString("title", "")
        let message = call.getString("message", "")
        let confirmLabel = call.getString("confirmLabel", "OK")
        let cancelLabel = call.getString("cancelLabel", "Cancelar")
        let destructive = call.getBool("destructive", false)

        DispatchQueue.main.async {
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: cancelLabel, style: .cancel) { _ in
                call.resolve(["confirmed": false])
            })
            alert.addAction(UIAlertAction(
                title: confirmLabel,
                style: destructive ? .destructive : .default
            ) { _ in
                call.resolve(["confirmed": true])
            })
            self.bridge?.viewController?.present(alert, animated: true)
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Safe-area insets (returned in CSS-pixel units)
    // ─────────────────────────────────────────────────────────────────────

    @objc func getSafeAreaInsets(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let insets = self.bridge?.viewController?.view.safeAreaInsets ?? .zero
            call.resolve([
                "top": insets.top,
                "right": insets.right,
                "bottom": insets.bottom,
                "left": insets.left,
            ])
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Liquid Glass container (iOS 26+)
    // ─────────────────────────────────────────────────────────────────────

    @objc func enableLiquidGlass(_ call: CAPPluginCall) {
        let intensity = call.getDouble("intensity", 0.6)
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("WebView not available")
                return
            }
            let container = LiquidGlassWebContainer(webView: webView, intensity: CGFloat(intensity))
            container.applyToWebView()
            self.liquidContainer = container
            call.resolve([
                "applied": true,
                "supportsLiquidGlass": LiquidGlassWebContainer.isSupported,
            ])
        }
    }

    @objc func disableLiquidGlass(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.liquidContainer?.removeFromWebView()
            self.liquidContainer = nil
            call.resolve(["disabled": true])
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Status bar style helper (light / dark / auto)
    // ─────────────────────────────────────────────────────────────────────

    @objc func setStatusBarStyle(_ call: CAPPluginCall) {
        let style = call.getString("style", "auto")
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController as? AdaptiveCapacitorViewController else {
                call.reject("Adaptive view controller not active")
                return
            }
            switch style {
            case "light": vc.overrideStatusBarStyle = .lightContent
            case "dark":
                if #available(iOS 13.0, *) {
                    vc.overrideStatusBarStyle = .darkContent
                } else {
                    vc.overrideStatusBarStyle = .default
                }
            default: vc.overrideStatusBarStyle = nil
            }
            vc.setNeedsStatusBarAppearanceUpdate()
            call.resolve(["style": style])
        }
    }
}
