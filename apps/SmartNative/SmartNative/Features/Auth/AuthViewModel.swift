import Foundation
import Observation
import Supabase

@Observable
final class AuthViewModel {
    var email = ""
    var password = ""
    var isLoading = false
    var errorMessage: String?
    var biometricEnabled = false

    private let env: AppEnvironment

    init(env: AppEnvironment = .shared) {
        self.env = env
        biometricEnabled = KeychainService.shared.load(forKey: .biometricEnabled) == "true"
        checkExistingSession()
    }

    // MARK: - Session Check

    private func checkExistingSession() {
        Task {
            do {
                let session = try await supabase.auth.session
                let tenantId = extractTenantId(from: session)
                if !tenantId.isEmpty {
                    await loadEmployeeAndSetSession(userId: session.user.id.uuidString, tenantId: tenantId)
                }
            } catch {
                // No active session
            }
        }
    }

    // MARK: - Email Login

    func loginWithEmail() async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Ingresa tu email y contraseña."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let session = try await supabase.auth.signIn(email: email, password: password)
            let tenantId = extractTenantId(from: session)
            KeychainService.shared.save(email, forKey: .lastLoggedEmail)
            await loadEmployeeAndSetSession(userId: session.user.id.uuidString, tenantId: tenantId)
        } catch {
            errorMessage = "Email o contraseña incorrectos."
        }
    }

    // MARK: - Biometric Login

    func loginWithBiometric() async {
        guard BiometricService.shared.isAvailable,
              let tenantId = KeychainService.shared.load(forKey: .tenantId),
              !tenantId.isEmpty else {
            errorMessage = "Biometría no disponible. Inicia sesión con email."
            return
        }
        let success = await BiometricService.shared.authenticate()
        guard success else { return }
        // Restore session from existing token
        do {
            let session = try await supabase.auth.session
            await loadEmployeeAndSetSession(userId: session.user.id.uuidString, tenantId: tenantId)
        } catch {
            errorMessage = "Sesión expirada. Inicia sesión con email."
        }
    }

    func enableBiometric() {
        biometricEnabled = true
        KeychainService.shared.save("true", forKey: .biometricEnabled)
    }

    // MARK: - Helper

    private func extractTenantId(from session: Session) -> String {
        let metadata = session.user.userMetadata
        if case .string(let id) = metadata["tenant_id"] { return id }
        if case .string(let id) = metadata["app_id"] { return id }
        return KeychainService.shared.load(forKey: .tenantId) ?? ""
    }

    @MainActor
    private func loadEmployeeAndSetSession(userId: String, tenantId: String) async {
        do {
            let employees: [Employee] = try await supabase
                .from("app_employee")
                .select()
                .eq("tenant_id", value: tenantId)
                .eq("active", value: true)
                .limit(1)
                .execute()
                .value
            env.setSession(tenantId: tenantId, employee: employees.first)
        } catch {
            env.setSession(tenantId: tenantId, employee: nil)
        }
    }
}
