import Foundation
import Supabase

final class CustomerRepository {
    private let client: SupabaseClient

    init(client: SupabaseClient = supabase) {
        self.client = client
    }

    func fetchCustomers(tenantId: String, limit: Int = 200) async throws -> [Customer] {
        try await client
            .from("customer")
            .select()
            .eq("tenant_id", value: tenantId)
            .order("name", ascending: true)
            .limit(limit)
            .execute()
            .value
    }

    func fetchCustomer(id: UUID) async throws -> Customer {
        try await client
            .from("customer")
            .select()
            .eq("id", value: id)
            .single()
            .execute()
            .value
    }

    func searchCustomers(tenantId: String, query: String) async throws -> [Customer] {
        try await client
            .from("customer")
            .select()
            .eq("tenant_id", value: tenantId)
            .or("name.ilike.%\(query)%,phone.ilike.%\(query)%,email.ilike.%\(query)%")
            .order("name", ascending: true)
            .limit(30)
            .execute()
            .value
    }

    func createCustomer(_ fields: [String: AnyJSON]) async throws -> Customer {
        try await client
            .from("customer")
            .insert(fields)
            .select()
            .single()
            .execute()
            .value
    }

    func updateCustomer(id: UUID, fields: [String: AnyJSON]) async throws {
        try await client
            .from("customer")
            .update(fields)
            .eq("id", value: id)
            .execute()
    }
}
