import Foundation
import Observation

@Observable
final class DashboardViewModel {
    var kpis = DashboardKPIs()
    var recentTransactions: [Transaction] = []
    var isLoading = false
    var error: String?

    private let repo: DashboardRepository
    private let env: AppEnvironment

    init(repo: DashboardRepository = DashboardRepository(), env: AppEnvironment = .shared) {
        self.repo = repo
        self.env = env
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            async let kpisTask = repo.fetchKPIs(tenantId: env.tenantId)
            async let transactionsTask = repo.fetchRecentTransactions(tenantId: env.tenantId)
            let (fetchedKPIs, fetchedTx) = try await (kpisTask, transactionsTask)
            kpis = fetchedKPIs
            recentTransactions = fetchedTx
        } catch {
            self.error = "No se pudo cargar el dashboard."
        }
    }
}
