import Foundation

struct DeviceCategory: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var name: String
    var icon: String?
    var active: Bool?
    var sort_order: Int?
}

struct DeviceFamily: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var category_id: String?
    var name: String
    var brand: String?
    var active: Bool?
}

struct DeviceModel: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var family_id: String?
    var name: String
    var active: Bool?
    var release_year: Int?
    var specs: String?
}
