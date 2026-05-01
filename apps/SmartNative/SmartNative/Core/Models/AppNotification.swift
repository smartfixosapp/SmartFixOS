import Foundation

enum NotificationType: String, Codable {
    case orderReady = "order_ready"
    case lowStock = "low_stock"
    case cashClose = "cash_close"
    case paymentDue = "payment_due"
    case general = "general"
    case system = "system"

    var systemImage: String {
        switch self {
        case .orderReady: return "checkmark.circle.fill"
        case .lowStock: return "exclamationmark.triangle.fill"
        case .cashClose: return "dollarsign.circle.fill"
        case .paymentDue: return "clock.fill"
        case .general: return "bell.fill"
        case .system: return "gear.circle.fill"
        }
    }
}

struct AppNotification: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var title: String
    var message: String?
    var type: String?
    var read: Bool?
    var employee_id: String?
    var order_id: String?
    var created_date: Date?
    var action_url: String?
    var metadata: [String: String]?

    var notificationType: NotificationType {
        NotificationType(rawValue: type ?? "general") ?? .general
    }

    var isRead: Bool { read ?? false }

    var timeAgo: String {
        guard let date = created_date else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "es")
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
