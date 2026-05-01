import Foundation
import Observation
import Supabase

@Observable
final class PinAccessViewModel {
    var enteredPin = ""
    var isLoading = false
    var errorMessage: String?
    var employees: [Employee] = []
    var selectedEmployee: Employee?
    var isAuthenticated = false
    let maxPinLength = 4

    private let env: AppEnvironment

    init(env: AppEnvironment = .shared) {
        self.env = env
    }

    func loadEmployees() async {
        guard !env.tenantId.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            employees = try await supabase
                .from("app_employee")
                .select()
                .eq("tenant_id", value: env.tenantId)
                .eq("active", value: true)
                .order("full_name", ascending: true)
                .execute()
                .value
        } catch {
            errorMessage = "No se pudieron cargar los empleados."
        }
    }

    func append(digit: String) {
        guard enteredPin.count < maxPinLength else { return }
        enteredPin += digit
        if enteredPin.count == maxPinLength {
            Task { await validatePin() }
        }
    }

    func deleteLastDigit() {
        guard !enteredPin.isEmpty else { return }
        enteredPin.removeLast()
        errorMessage = nil
    }

    func clearPin() {
        enteredPin = ""
        errorMessage = nil
    }

    @MainActor
    private func validatePin() async {
        isLoading = true
        defer { isLoading = false }

        let targetEmployee: Employee?
        if let selected = selectedEmployee {
            targetEmployee = selected
        } else {
            targetEmployee = employees.first { $0.pin == enteredPin }
        }

        guard let employee = targetEmployee else {
            errorMessage = "PIN incorrecto."
            enteredPin = ""
            let impact = UIImpactFeedbackGenerator(style: .heavy)
            impact.impactOccurred()
            return
        }

        if employee.pin == enteredPin {
            let impact = UINotificationFeedbackGenerator()
            impact.notificationOccurred(.success)
            env.setSession(tenantId: env.tenantId, employee: employee)
            savePinSession(employeeId: employee.id.uuidString)
            isAuthenticated = true
        } else {
            errorMessage = "PIN incorrecto."
            enteredPin = ""
            let impact = UIImpactFeedbackGenerator(style: .heavy)
            impact.impactOccurred()
        }
    }

    private func savePinSession(employeeId: String) {
        let expiry = Date().addingTimeInterval(8 * 3600)
        KeychainService.shared.save(ISO8601DateFormatter().string(from: expiry), forKey: .pinSessionExpiry)
        KeychainService.shared.save(employeeId, forKey: .employeeId)
    }
}
