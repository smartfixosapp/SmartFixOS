import SwiftUI

extension Color {
    // System-based semantic colors (auto light/dark)
    static let appBackground = Color(.systemBackground)
    static let appSecondaryBackground = Color(.secondarySystemBackground)
    static let appTertiaryBackground = Color(.tertiarySystemBackground)
    static let appGroupedBackground = Color(.systemGroupedBackground)

    // Brand accent
    static let appAccent = Color.accentColor

    // Status colors (matching statusRegistry.jsx)
    static let statusIntake = Color(hex: "#3B82F6")
    static let statusDiagnosing = Color(hex: "#8B5CF6")
    static let statusWaitingCustomer = Color(hex: "#F43F5E")
    static let statusPendingOrder = Color(hex: "#DC2626")
    static let statusWaitingParts = Color(hex: "#F97316")
    static let statusPartArrived = Color(hex: "#FACC15")
    static let statusExternalRepair = Color(hex: "#EC4899")
    static let statusInProgress = Color(hex: "#06B6D4")
    static let statusReady = Color(hex: "#10B981")
    static let statusWarranty = Color(hex: "#F59E0B")
    static let statusDelivered = Color(hex: "#059669")
    static let statusCancelled = Color(hex: "#DC2626")
}
