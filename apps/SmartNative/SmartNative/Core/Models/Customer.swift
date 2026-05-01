import Foundation

struct Customer: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var customer_number: String?
    var name: String
    var phone: String?
    var email: String?
    var notes: String?
    var total_orders: Int?
    var total_spent: Double?
    var loyalty_points: Int?
    var loyalty_tier: String?
    var is_b2b: Bool?
    var company_name: String?
    var company_tax_id: String?
    var billing_address: String?
    var created_date: Date?
    var updated_date: Date?

    var displayPhone: String {
        phone ?? email ?? "Sin contacto"
    }

    var initials: String {
        let parts = name.components(separatedBy: " ")
        let first = parts.first?.prefix(1) ?? ""
        let last = parts.count > 1 ? parts.last?.prefix(1) ?? "" : ""
        return (first + last).uppercased()
    }

    var loyaltyTierColor: String {
        switch loyalty_tier {
        case "gold": return "#F59E0B"
        case "silver": return "#9CA3AF"
        case "platinum": return "#8B5CF6"
        default: return "#CD7C3E"
        }
    }
}
