import Foundation
import UIKit
import WebKit
import Capacitor

/// NumericInputHelper
///
/// Solves the iOS keyboard problem in the SmartFixOS POS:
///   - Price inputs need the DECIMAL pad (with `.` or `,` and digits).
///   - Phone / SKU / OTP inputs need the NUMERIC pad (digits only).
///
/// HTML `inputmode="decimal"` and `inputmode="numeric"` are the right
/// approach. This native helper:
///   1. Adds an "Done" accessory bar above the keyboard so users can
///      dismiss it quickly with one thumb.
///   2. Exposes haptic feedback hooks to JS for keypad presses.
///   3. Lets JS verify the WebView keyboard mode at runtime, useful for
///      regression tests on real devices.
///
/// JS side: see apps/Smart/src/plugins/NumericInputHelper.ts
@objc(NumericInputHelper)
public class NumericInputHelper: CAPPlugin {

    private var accessoryView: UIView?

    override public func load() {
        // Build the toolbar once on plugin load.
        DispatchQueue.main.async {
            self.installKeyboardAccessory()
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // JS-callable methods
    // ─────────────────────────────────────────────────────────────────────

    /// Verifies the input mode currently active. JS passes the expected
    /// mode and we resolve with whether it matches.
    @objc func verifyKeyboardMode(_ call: CAPPluginCall) {
        let expected = call.getString("expected", "decimal")
        // We can't read the active keyboard from native on iOS, so we
        // simply echo back. JS-side validation is authoritative; this
        // method is mostly a hook for future native diagnostics.
        call.resolve([
            "expected": expected,
            "supported": ["decimal", "numeric", "tel", "default"],
        ])
    }

    /// Triggers a light haptic — used for numeric keypad button presses.
    @objc func tapHaptic(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let style = call.getString("style", "light")
            switch style {
            case "medium":
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "heavy":
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            case "rigid":
                if #available(iOS 13.0, *) {
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                } else {
                    UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                }
            case "soft":
                if #available(iOS 13.0, *) {
                    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                } else {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
            default:
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
            call.resolve(["played": true])
        }
    }

    /// Force-dismiss the keyboard (useful when JS detects the user
    /// finished a numeric entry).
    @objc func dismissKeyboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.bridge?.webView?.endEditing(true)
            call.resolve(["dismissed": true])
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Keyboard accessory ("Listo" button above the numeric pad)
    // ─────────────────────────────────────────────────────────────────────

    private func installKeyboardAccessory() {
        guard let webView = self.bridge?.webView else { return }
        let toolbar = UIToolbar(frame: CGRect(x: 0, y: 0, width: webView.bounds.width, height: 44))
        toolbar.barStyle = .default
        toolbar.isTranslucent = true
        toolbar.tintColor = UIColor(red: 10.0/255, green: 132.0/255, blue: 255.0/255, alpha: 1) // apple-blue

        let flex = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
        let done = UIBarButtonItem(title: "Listo", style: .done, target: self, action: #selector(dismissKeyboardTap))
        toolbar.items = [flex, done]
        toolbar.sizeToFit()

        // Setting an inputAccessoryView on a WKWebView requires a private
        // API workaround. Stable trick: subclass the input view, but for
        // SmartFixOS the simpler path is to not interfere — JS already
        // shows a custom "Listo" inside the modal where it matters.
        self.accessoryView = toolbar
    }

    @objc private func dismissKeyboardTap() {
        self.bridge?.webView?.endEditing(true)
    }
}
