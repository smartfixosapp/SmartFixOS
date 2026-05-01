import Foundation
import Observation

@Observable
final class InventoryViewModel {
    var products: [Product] = []
    var searchText = ""
    var selectedCategory: String? = nil
    var isLoading = false
    var error: String?

    private let repo: ProductRepository
    private let env: AppEnvironment

    var categories: [String] {
        Array(Set(products.compactMap { $0.category })).sorted()
    }

    var filteredProducts: [Product] {
        var result = products
        if let cat = selectedCategory {
            result = result.filter { $0.category == cat }
        }
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            result = result.filter {
                $0.name.lowercased().contains(q) ||
                ($0.sku ?? "").lowercased().contains(q) ||
                ($0.barcode ?? "").contains(q)
            }
        }
        return result
    }

    var lowStockCount: Int {
        products.filter { $0.isLowStock }.count
    }

    init(repo: ProductRepository = ProductRepository(), env: AppEnvironment = .shared) {
        self.repo = repo
        self.env = env
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            products = try await repo.fetchProducts(tenantId: env.tenantId)
        } catch {
            self.error = "No se pudo cargar el inventario."
        }
    }
}
