import Foundation
import Supabase

final class OrderRepository {
    private let client: SupabaseClient

    init(client: SupabaseClient = supabase) {
        self.client = client
    }

    func fetchOrders(tenantId: String, limit: Int = 200) async throws -> [Order] {
        try await client
            .from("order")
            .select()
            .eq("tenant_id", value: tenantId)
            .eq("is_deleted", value: false)
            .order("created_date", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func fetchOrder(id: UUID) async throws -> Order {
        try await client
            .from("order")
            .select()
            .eq("id", value: id)
            .single()
            .execute()
            .value
    }

    func fetchActiveOrders(tenantId: String) async throws -> [Order] {
        let activeStatuses = OrderStatus.allCases
            .filter { $0.isActive }
            .map { $0.rawValue }
        return try await client
            .from("order")
            .select()
            .eq("tenant_id", value: tenantId)
            .eq("is_deleted", value: false)
            .in("status", values: activeStatuses)
            .order("order_number", ascending: true)
            .execute()
            .value
    }

    func updateStatus(orderId: UUID, status: OrderStatus, note: String? = nil) async throws {
        var params: [String: AnyJSON] = [
            "status": .string(status.rawValue),
            "updated_date": .string(AppDateFormatter.isoFull.string(from: Date()))
        ]
        if let note = note {
            params["status_note"] = .string(note)
        }
        try await client
            .from("order")
            .update(params)
            .eq("id", value: orderId)
            .execute()
    }

    func createOrder(_ order: [String: AnyJSON]) async throws -> Order {
        try await client
            .from("order")
            .insert(order)
            .select()
            .single()
            .execute()
            .value
    }

    func updateOrder(id: UUID, fields: [String: AnyJSON]) async throws {
        try await client
            .from("order")
            .update(fields)
            .eq("id", value: id)
            .execute()
    }

    func searchOrders(tenantId: String, query: String) async throws -> [Order] {
        try await client
            .from("order")
            .select()
            .eq("tenant_id", value: tenantId)
            .eq("is_deleted", value: false)
            .or("order_number.ilike.%\(query)%,customer_name.ilike.%\(query)%,device_model.ilike.%\(query)%,customer_phone.ilike.%\(query)%")
            .order("created_date", ascending: false)
            .limit(50)
            .execute()
            .value
    }
}
