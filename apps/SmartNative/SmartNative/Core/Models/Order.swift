import SwiftUI

// MARK: - Order Status (matches statusRegistry.jsx exactly)

enum OrderStatus: String, CaseIterable, Identifiable, Codable {
    case intake
    case diagnosing
    case waitingCustomer = "waiting_customer"
    case pendingOrder = "pending_order"
    case waitingParts = "waiting_parts"
    case partArrivedWaitingDevice = "part_arrived_waiting_device"
    case reparacionExterna = "reparacion_externa"
    case inProgress = "in_progress"
    case readyForPickup = "ready_for_pickup"
    case warranty
    case delivered
    case cancelled

    var id: String { rawValue }

    var label: String {
        switch self {
        case .intake: return "Recepción"
        case .diagnosing: return "Diagnóstico"
        case .waitingCustomer: return "Esperando Cliente"
        case .pendingOrder: return "Pendiente a Ordenar"
        case .waitingParts: return "Esperando Piezas"
        case .partArrivedWaitingDevice: return "Pieza lista / Esperando cliente"
        case .reparacionExterna: return "Reparación Externa"
        case .inProgress: return "En Reparación"
        case .readyForPickup: return "Listo para Recoger"
        case .warranty: return "Garantía"
        case .delivered: return "Entregado"
        case .cancelled: return "Cancelado"
        }
    }

    var color: Color {
        switch self {
        case .intake: return Color(hex: "#3B82F6")
        case .diagnosing: return Color(hex: "#8B5CF6")
        case .waitingCustomer: return Color(hex: "#F43F5E")
        case .pendingOrder: return Color(hex: "#DC2626")
        case .waitingParts: return Color(hex: "#F97316")
        case .partArrivedWaitingDevice: return Color(hex: "#FACC15")
        case .reparacionExterna: return Color(hex: "#EC4899")
        case .inProgress: return Color(hex: "#06B6D4")
        case .readyForPickup: return Color(hex: "#10B981")
        case .warranty: return Color(hex: "#F59E0B")
        case .delivered: return Color(hex: "#059669")
        case .cancelled: return Color(hex: "#DC2626")
        }
    }

    var isTerminal: Bool {
        switch self {
        case .warranty, .delivered, .cancelled: return true
        default: return false
        }
    }

    var isActive: Bool {
        switch self {
        case .warranty, .delivered, .cancelled: return false
        default: return true
        }
    }

    var sortOrder: Int {
        switch self {
        case .intake: return 1
        case .diagnosing: return 2
        case .waitingCustomer: return 3
        case .pendingOrder: return 4
        case .waitingParts: return 5
        case .partArrivedWaitingDevice: return 6
        case .reparacionExterna: return 7
        case .inProgress: return 8
        case .readyForPickup: return 9
        case .warranty: return 10
        case .delivered: return 11
        case .cancelled: return 12
        }
    }
}

// MARK: - Order Priority

enum OrderPriority: String, Codable {
    case normal, high, urgent

    var label: String {
        switch self {
        case .normal: return "Normal"
        case .high: return "Alta"
        case .urgent: return "Urgente"
        }
    }

    var color: Color {
        switch self {
        case .normal: return .secondary
        case .high: return .orange
        case .urgent: return .red
        }
    }
}

// MARK: - Order Model

struct Order: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var order_number: String
    var created_date: Date?
    var updated_date: Date?
    var customer_id: String?
    var customer_name: String
    var customer_phone: String?
    var customer_email: String?
    var device_type: String
    var device_brand: String?
    var device_family: String?
    var device_model: String?
    var device_color: String?
    var device_serial: String?
    var initial_problem: String?
    var status: String
    var priority: String?
    var cost_estimate: Double?
    var labor_cost: Double?
    var amount_paid: Double?
    var balance_due: Double?
    var paid: Bool?
    var deposit_amount: Double?
    var tax_rate: Double?
    var assigned_to: String?
    var assigned_to_name: String?
    var created_by: String?
    var created_by_name: String?
    var status_note: String?
    var estimated_completion: String?
    var is_deleted: Bool?
    var customer_signature: String?
    var terms_accepted: Bool?

    var orderStatus: OrderStatus {
        OrderStatus(rawValue: status) ?? .intake
    }

    var displayAmount: Double {
        cost_estimate ?? 0
    }

    var isOverdue: Bool {
        guard let completion = estimated_completion,
              let date = ISO8601DateFormatter().date(from: completion) else { return false }
        return date < Date() && !orderStatus.isTerminal
    }
}

// MARK: - Order Filter

enum OrderFilter: String, CaseIterable, Identifiable {
    case all = "Todas"
    case active = "Activas"
    case readyForPickup = "Listas"
    case delivered = "Entregadas"

    var id: String { rawValue }

    func matches(_ order: Order) -> Bool {
        switch self {
        case .all: return true
        case .active: return order.orderStatus.isActive
        case .readyForPickup: return order.status == "ready_for_pickup"
        case .delivered: return order.status == "delivered"
        }
    }
}

// MARK: - Color Extension for hex

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
