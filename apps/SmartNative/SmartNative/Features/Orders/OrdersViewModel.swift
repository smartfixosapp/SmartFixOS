import Foundation
import Observation
import Supabase

@Observable
final class OrdersViewModel {
    var orders: [Order] = []
    var filteredOrders: [Order] = []
    var searchText = ""
    var selectedFilter: OrderFilter = .all
    var isLoading = false
    var error: String?
    var selectedOrder: Order?

    private let repo: OrderRepository
    private let env: AppEnvironment

    init(repo: OrderRepository = OrderRepository(), env: AppEnvironment = .shared) {
        self.repo = repo
        self.env = env
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            orders = try await repo.fetchOrders(tenantId: env.tenantId)
            applyFilters()
        } catch {
            self.error = "No se pudieron cargar las órdenes."
        }
    }

    func applyFilters() {
        var result = orders
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter {
                $0.order_number.lowercased().contains(query) ||
                $0.customer_name.lowercased().contains(query) ||
                ($0.device_model ?? "").lowercased().contains(query) ||
                ($0.customer_phone ?? "").contains(query)
            }
        }
        result = result.filter { selectedFilter.matches($0) }
        filteredOrders = result
    }

    func updateStatus(order: Order, newStatus: OrderStatus) async {
        do {
            try await repo.updateStatus(orderId: order.id, status: newStatus)
            if let index = orders.firstIndex(where: { $0.id == order.id }) {
                orders[index].status = newStatus.rawValue
            }
            applyFilters()
            let feedback = UINotificationFeedbackGenerator()
            feedback.notificationOccurred(.success)
            // Notify Deno function for automation
            Task.detached {
                try? await DenoAPI.shared.handleOrderStatusChange(
                    orderId: order.id.uuidString,
                    newStatus: newStatus.rawValue,
                    tenantId: AppEnvironment.shared.tenantId
                )
            }
        } catch {
            self.error = "No se pudo actualizar el estado."
        }
    }

    func fetchQueueOrders() async -> [Order] {
        let queueStatuses = ["intake", "diagnosing", "in_progress", "warranty"]
        return orders.filter { queueStatuses.contains($0.status) }
            .sorted { ($0.order_number) < ($1.order_number) }
    }
}
