import Foundation

struct SaleItem: Codable, Sendable {
    var product_id: String?
    var name: String
    var quantity: Int
    var unit_price: Double
    var discount: Double?
    var total: Double

    var discountedPrice: Double {
        unit_price * Double(quantity) * (1 - (discount ?? 0) / 100)
    }
}

struct Sale: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var sale_number: String?
    var items: [SaleItem]?
    var subtotal: Double
    var tax_amount: Double?
    var tax_rate: Double?
    var discount_amount: Double?
    var total: Double
    var payment_method: String?
    var amount_received: Double?
    var change_due: Double?
    var order_id: String?
    var customer_id: String?
    var customer_name: String?
    var employee_id: String?
    var employee_name: String?
    var cash_register_id: String?
    var created_date: Date?
    var notes: String?
    var status: String?
}

// MARK: - POS Cart State

struct POSCart {
    var items: [CartItem] = []
    var discountPercent: Double = 0
    var paymentMethod: PaymentMethod = .cash
    var cashReceived: Double = 0
    var linkedOrderId: String?

    static let taxRate: Double = 0.115 // IVU Puerto Rico 11.5%

    var subtotal: Double {
        items.reduce(0) { $0 + $1.subtotal }
    }

    var discountAmount: Double {
        subtotal * (discountPercent / 100)
    }

    var taxableAmount: Double {
        subtotal - discountAmount
    }

    var taxAmount: Double {
        taxableAmount * Self.taxRate
    }

    var total: Double {
        taxableAmount + taxAmount
    }

    var changeDue: Double {
        max(0, cashReceived - total)
    }

    var requiresConfirmation: Bool {
        total >= 500
    }
}
