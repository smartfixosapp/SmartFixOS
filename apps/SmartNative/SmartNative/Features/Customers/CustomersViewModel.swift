import Foundation
import Observation

@Observable
final class CustomersViewModel {
    var customers: [Customer] = []
    var searchText = ""
    var isLoading = false
    var error: String?

    private let repo: CustomerRepository
    private let env: AppEnvironment

    var filteredCustomers: [Customer] {
        guard !searchText.isEmpty else { return customers }
        let q = searchText.lowercased()
        return customers.filter {
            $0.name.lowercased().contains(q) ||
            ($0.phone ?? "").contains(q) ||
            ($0.email ?? "").lowercased().contains(q) ||
            ($0.company_name ?? "").lowercased().contains(q)
        }
    }

    init(repo: CustomerRepository = CustomerRepository(), env: AppEnvironment = .shared) {
        self.repo = repo
        self.env = env
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            customers = try await repo.fetchCustomers(tenantId: env.tenantId)
        } catch {
            self.error = "No se pudieron cargar los clientes."
        }
    }
}
