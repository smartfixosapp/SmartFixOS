import Foundation

struct Tenant: Identifiable, Codable, Sendable {
    let id: UUID
    var name: String
    var email: String?
    var phone: String?
    var address: String?
    var logo_url: String?
    var status: String?
    var plan: String?
    var created_date: Date?
    var tax_rate: Double?
    var currency: String?
    var timezone: String?
    var business_hours: String?
}
