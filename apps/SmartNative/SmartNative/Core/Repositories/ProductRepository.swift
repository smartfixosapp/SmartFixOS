import Foundation
import Supabase

final class ProductRepository {
    private let client: SupabaseClient

    init(client: SupabaseClient = supabase) {
        self.client = client
    }

    func fetchProducts(tenantId: String, limit: Int = 500) async throws -> [Product] {
        try await client
            .from("product")
            .select()
            .eq("tenant_id", value: tenantId)
            .eq("active", value: true)
            .order("name", ascending: true)
            .limit(limit)
            .execute()
            .value
    }

    func searchProducts(tenantId: String, query: String) async throws -> [Product] {
        try await client
            .from("product")
            .select()
            .eq("tenant_id", value: tenantId)
            .or("name.ilike.%\(query)%,sku.ilike.%\(query)%,barcode.ilike.%\(query)%")
            .eq("active", value: true)
            .limit(30)
            .execute()
            .value
    }

    func updateStock(productId: UUID, newStock: Int) async throws {
        try await client
            .from("product")
            .update(["stock": AnyJSON.integer(newStock)])
            .eq("id", value: productId)
            .execute()
    }

    func createProduct(_ fields: [String: AnyJSON]) async throws -> Product {
        try await client
            .from("product")
            .insert(fields)
            .select()
            .single()
            .execute()
            .value
    }

    func updateProduct(id: UUID, fields: [String: AnyJSON]) async throws {
        try await client
            .from("product")
            .update(fields)
            .eq("id", value: id)
            .execute()
    }

    func fetchLowStockProducts(tenantId: String) async throws -> [Product] {
        try await client
            .from("product")
            .select()
            .eq("tenant_id", value: tenantId)
            .filter("stock", operator: "lte", value: "min_stock")
            .execute()
            .value
    }
}
