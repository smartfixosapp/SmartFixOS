import Foundation

enum TransactionType: String, Codable, CaseIterable {
    case income = "income"
    case expense = "expense"
    case refund = "refund"
    case adjustment = "adjustment"

    var label: String {
        switch self {
        case .income: return "Ingreso"
        case .expense: return "Gasto"
        case .refund: return "Reembolso"
        case .adjustment: return "Ajuste"
        }
    }
}

enum PaymentMethod: String, Codable, CaseIterable {
    case cash = "cash"
    case card = "card"
    case athMovil = "ath_movil"
    case split = "split"
    case other = "other"

    var label: String {
        switch self {
        case .cash: return "Efectivo"
        case .card: return "Tarjeta"
        case .athMovil: return "ATH Móvil"
        case .split: return "Dividido"
        case .other: return "Otro"
        }
    }

    var systemImage: String {
        switch self {
        case .cash: return "dollarsign.circle.fill"
        case .card: return "creditcard.fill"
        case .athMovil: return "iphone.circle.fill"
        case .split: return "arrow.triangle.branch"
        case .other: return "ellipsis.circle.fill"
        }
    }
}

struct Transaction: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var type: String
    var amount: Double
    var payment_method: String?
    var description: String?
    var category: String?
    var order_id: String?
    var sale_id: String?
    var employee_id: String?
    var employee_name: String?
    var created_date: Date?
    var reference_number: String?
    var notes: String?

    var transactionType: TransactionType {
        TransactionType(rawValue: type) ?? .income
    }

    var paymentMethodEnum: PaymentMethod {
        PaymentMethod(rawValue: payment_method ?? "cash") ?? .cash
    }

    var isIncome: Bool {
        transactionType == .income
    }
}
