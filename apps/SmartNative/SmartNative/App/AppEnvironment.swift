import Foundation
import Observation
import Supabase

// MARK: - App Environment (Dependency Injection)

@Observable
final class AppEnvironment {
    static let shared = AppEnvironment()

    // Auth state
    var isAuthenticated = false
    var currentEmployee: Employee?
    var tenantId: String = ""
    var tenantName: String = ""

    // Repositories (lazily initialized)
    lazy var orderRepo = OrderRepository()
    lazy var customerRepo = CustomerRepository()
    lazy var productRepo = ProductRepository()
    lazy var dashboardRepo = DashboardRepository()

    // API clients
    let vercelAPI = VercelAPI.shared
    let denoAPI = DenoAPI.shared

    private init() {
        restoreSession()
    }

    // MARK: - Session Management

    func restoreSession() {
        if let tid = KeychainService.shared.load(forKey: .tenantId), !tid.isEmpty {
            tenantId = tid
        }
    }

    func setSession(tenantId: String, employee: Employee?) {
        self.tenantId = tenantId
        self.currentEmployee = employee
        self.isAuthenticated = true
        KeychainService.shared.save(tenantId, forKey: .tenantId)
        if let emp = employee {
            KeychainService.shared.save(emp.id.uuidString, forKey: .employeeId)
        }
    }

    func signOut() async {
        try? await supabase.auth.signOut()
        isAuthenticated = false
        currentEmployee = nil
        tenantId = ""
        KeychainService.shared.deleteAll()
    }

    var employeeDisplayName: String {
        currentEmployee?.full_name ?? "Usuario"
    }

    var canAccessFinancials: Bool {
        currentEmployee?.permissions?.view_financials == true ||
        currentEmployee?.employeeRole == .admin ||
        currentEmployee?.employeeRole == .manager
    }
}
