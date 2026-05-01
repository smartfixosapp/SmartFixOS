import Foundation
import LocalAuthentication

final class BiometricService {
    static let shared = BiometricService()
    private init() {}

    var biometricType: LABiometryType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return context.biometryType
    }

    var isAvailable: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    var biometricLabel: String {
        switch biometricType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        default: return "Biometría"
        }
    }

    var biometricSystemImage: String {
        switch biometricType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        default: return "lock.shield.fill"
        }
    }

    func authenticate(reason: String = "Accede a SmartFixOS") async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Usar contraseña"
        do {
            let result = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            return result
        } catch {
            return false
        }
    }
}
