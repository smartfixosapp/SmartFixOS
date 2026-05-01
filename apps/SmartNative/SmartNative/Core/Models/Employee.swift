import Foundation

enum EmployeeRole: String, Codable, CaseIterable {
    case admin, manager, technician, cashier

    var label: String {
        switch self {
        case .admin: return "Administrador"
        case .manager: return "Gerente"
        case .technician: return "Técnico"
        case .cashier: return "Cajero"
        }
    }
}

struct EmployeePermissions: Codable, Sendable {
    var create_orders: Bool?
    var process_sales: Bool?
    var view_reports: Bool?
    var view_financials: Bool?
    var manage_inventory: Bool?
    var manage_employees: Bool?
    var manage_cash_drawer: Bool?
    var apply_discounts: Bool?
    var process_refunds: Bool?
}

struct Employee: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var full_name: String
    var email: String
    var phone: String?
    var employee_code: String?
    var pin: String?
    var position: String?
    var role: String?
    var active: Bool?
    var status: String?
    var permissions: EmployeePermissions?
    var hire_date: String?
    var hourly_rate: Double?
    var session_timeout_ms: Int?
    var created_date: Date?

    var employeeRole: EmployeeRole {
        EmployeeRole(rawValue: role ?? "technician") ?? .technician
    }

    var initials: String {
        let parts = full_name.components(separatedBy: " ")
        let first = parts.first?.prefix(1) ?? ""
        let last = parts.count > 1 ? parts.last?.prefix(1) ?? "" : ""
        return (first + last).uppercased()
    }
}
