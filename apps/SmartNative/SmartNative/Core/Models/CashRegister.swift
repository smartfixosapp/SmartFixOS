import Foundation

enum CashRegisterStatus: String, Codable {
    case open, closed

    var label: String {
        switch self {
        case .open: return "Abierta"
        case .closed: return "Cerrada"
        }
    }
}

struct CashRegister: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var status: String
    var opened_by: String?
    var opened_by_name: String?
    var closed_by: String?
    var opened_at: Date?
    var closed_at: Date?
    var opening_amount: Double?
    var closing_amount: Double?
    var expected_amount: Double?
    var difference: Double?
    var total_sales: Double?
    var total_cash_in: Double?
    var total_cash_out: Double?
    var notes: String?
    var denominations: [String: Double]?

    var registerStatus: CashRegisterStatus {
        CashRegisterStatus(rawValue: status) ?? .closed
    }

    var isOpen: Bool { status == "open" }
}

struct CashDrawerMovement: Identifiable, Codable, Sendable {
    let id: UUID
    var tenant_id: String?
    var cash_register_id: String?
    var type: String
    var amount: Double
    var description: String?
    var payment_method: String?
    var performed_by: String?
    var performed_by_name: String?
    var created_date: Date?
    var reference_id: String?
}

// Denomination count for open/close cash
struct CashDenominations {
    var hundreds: Double = 0
    var fifties: Double = 0
    var twenties: Double = 0
    var tens: Double = 0
    var fives: Double = 0
    var ones: Double = 0
    var quarters: Double = 0
    var dimes: Double = 0
    var nickels: Double = 0
    var pennies: Double = 0

    var total: Double {
        hundreds * 100 + fifties * 50 + twenties * 20 + tens * 10 +
        fives * 5 + ones * 1 + quarters * 0.25 + dimes * 0.10 +
        nickels * 0.05 + pennies * 0.01
    }

    var asDictionary: [String: Double] {
        [
            "hundreds": hundreds,
            "fifties": fifties,
            "twenties": twenties,
            "tens": tens,
            "fives": fives,
            "ones": ones,
            "quarters": quarters,
            "dimes": dimes,
            "nickels": nickels,
            "pennies": pennies
        ]
    }
}
