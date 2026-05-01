import Foundation
import Supabase

struct DashboardKPIs {
    var totalOrdersToday: Int = 0
    var activeOrders: Int = 0
    var readyForPickup: Int = 0
    var totalRevenueToday: Double = 0
    var totalRevenueMonth: Double = 0
    var pendingBalance: Double = 0
    var newCustomersThisMonth: Int = 0
    var lowStockItems: Int = 0
}

final class DashboardRepository {
    private let client: SupabaseClient

    init(client: SupabaseClient = supabase) {
        self.client = client
    }

    func fetchKPIs(tenantId: String) async throws -> DashboardKPIs {
        async let ordersToday = fetchOrdersCreatedToday(tenantId: tenantId)
        async let activeOrders = fetchActiveOrderCount(tenantId: tenantId)
        async let readyOrders = fetchReadyOrderCount(tenantId: tenantId)
        async let revenueToday = fetchRevenueToday(tenantId: tenantId)
        async let revenueMonth = fetchRevenueMonth(tenantId: tenantId)

        let (today, active, ready, revToday, revMonth) = try await (ordersToday, activeOrders, readyOrders, revenueToday, revenueMonth)

        return DashboardKPIs(
            totalOrdersToday: today,
            activeOrders: active,
            readyForPickup: ready,
            totalRevenueToday: revToday,
            totalRevenueMonth: revMonth
        )
    }

    private func fetchOrdersCreatedToday(tenantId: String) async throws -> Int {
        let startOfDay = Calendar.current.startOfDay(for: Date())
        let result: [Order] = try await client
            .from("order")
            .select("id")
            .eq("tenant_id", value: tenantId)
            .eq("is_deleted", value: false)
            .gte("created_date", value: AppDateFormatter.isoFull.string(from: startOfDay))
            .execute()
            .value
        return result.count
    }

    private func fetchActiveOrderCount(tenantId: String) async throws -> Int {
        let statuses = OrderStatus.allCases.filter { $0.isActive }.map { $0.rawValue }
        let result: [Order] = try await client
            .from("order")
            .select("id")
            .eq("tenant_id", value: tenantId)
            .eq("is_deleted", value: false)
            .in("status", values: statuses)
            .execute()
            .value
        return result.count
    }

    private func fetchReadyOrderCount(tenantId: String) async throws -> Int {
        let result: [Order] = try await client
            .from("order")
            .select("id")
            .eq("tenant_id", value: tenantId)
            .eq("status", value: "ready_for_pickup")
            .execute()
            .value
        return result.count
    }

    private func fetchRevenueToday(tenantId: String) async throws -> Double {
        let startOfDay = Calendar.current.startOfDay(for: Date())
        let transactions: [Transaction] = try await client
            .from("transaction")
            .select()
            .eq("tenant_id", value: tenantId)
            .eq("type", value: "income")
            .gte("created_date", value: AppDateFormatter.isoFull.string(from: startOfDay))
            .execute()
            .value
        return transactions.reduce(0) { $0 + $1.amount }
    }

    private func fetchRevenueMonth(tenantId: String) async throws -> Double {
        let calendar = Calendar.current
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: Date()))!
        let transactions: [Transaction] = try await client
            .from("transaction")
            .select()
            .eq("tenant_id", value: tenantId)
            .eq("type", value: "income")
            .gte("created_date", value: AppDateFormatter.isoFull.string(from: startOfMonth))
            .execute()
            .value
        return transactions.reduce(0) { $0 + $1.amount }
    }

    func fetchRecentTransactions(tenantId: String, limit: Int = 20) async throws -> [Transaction] {
        try await client
            .from("transaction")
            .select()
            .eq("tenant_id", value: tenantId)
            .order("created_date", ascending: false)
            .limit(limit)
            .execute()
            .value
    }
}
