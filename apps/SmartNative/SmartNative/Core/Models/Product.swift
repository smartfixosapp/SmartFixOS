import Foundation

enum ProductType: String, Codable, CaseIterable {
    case product = "product"
    case service = "service"
    case part = "part"

    var label: String {
        switch self {
        case .product: return "Producto"
        case .service: return "Servicio"
        case .part: return "Pieza"
        }
    }
}

struct Product: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var name: String
    var description: String?
    var sku: String?
    var barcode: String?
    var type: String?
    var category: String?
    var price: Double
    var cost: Double?
    var stock: Int?
    var min_stock: Int?
    var max_stock: Int?
    var unit: String?
    var active: Bool?
    var created_date: Date?
    var updated_date: Date?
    var image_url: String?
    var brand: String?
    var model_compatible: String?
    var supplier_id: String?

    var productType: ProductType {
        ProductType(rawValue: type ?? "product") ?? .product
    }

    var isLowStock: Bool {
        guard let stock = stock, let min = min_stock else { return false }
        return stock <= min
    }

    var stockStatus: StockStatus {
        guard let stock = stock else { return .unknown }
        if stock <= 0 { return .outOfStock }
        if isLowStock { return .low }
        return .inStock
    }
}

enum StockStatus {
    case inStock, low, outOfStock, unknown

    var label: String {
        switch self {
        case .inStock: return "En Stock"
        case .low: return "Stock Bajo"
        case .outOfStock: return "Sin Stock"
        case .unknown: return "N/A"
        }
    }
}

// Cart item for POS
struct CartItem: Identifiable {
    let id = UUID()
    var product: Product
    var quantity: Int
    var discount: Double

    var subtotal: Double {
        product.price * Double(quantity) * (1 - discount / 100)
    }
}
