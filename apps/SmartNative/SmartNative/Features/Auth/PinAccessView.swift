import SwiftUI

struct PinAccessView: View {
    @State private var vm = PinAccessViewModel()
    @Environment(\.dismiss) private var dismiss
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        NavigationStack {
            VStack(spacing: Spacing.xxl) {
                employeeSelector
                pinDisplay
                numericKeypad
            }
            .padding(.horizontal, Spacing.xl)
            .padding(.bottom, Spacing.xxl)
            .navigationTitle("Acceso Rápido")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
        .task { await vm.loadEmployees() }
        .onChange(of: vm.isAuthenticated) { _, authenticated in
            if authenticated { dismiss() }
        }
    }

    private var employeeSelector: some View {
        VStack(spacing: Spacing.sm) {
            if !vm.employees.isEmpty {
                Picker("Empleado", selection: $vm.selectedEmployee) {
                    Text("Seleccionar empleado").tag(Optional<Employee>.none)
                    ForEach(vm.employees) { emp in
                        Text(emp.full_name).tag(Optional(emp))
                    }
                }
                .pickerStyle(.menu)
                .padding(Spacing.md)
                .background(Color.appSecondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
            }
        }
    }

    private var pinDisplay: some View {
        VStack(spacing: Spacing.md) {
            if let employee = vm.selectedEmployee {
                Text("Hola, \(employee.full_name.components(separatedBy: " ").first ?? "")")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            } else {
                Text("Ingresa tu PIN")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: Spacing.lg) {
                ForEach(0..<vm.maxPinLength, id: \.self) { index in
                    Circle()
                        .fill(index < vm.enteredPin.count ? Color.accentColor : Color(.systemGray4))
                        .frame(width: 16, height: 16)
                        .animation(.spring(response: 0.2), value: vm.enteredPin.count)
                }
            }

            if let error = vm.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .transition(.opacity)
            }
        }
        .frame(height: 80)
    }

    private var numericKeypad: some View {
        VStack(spacing: Spacing.md) {
            ForEach([["1","2","3"], ["4","5","6"], ["7","8","9"]], id: \.self) { row in
                HStack(spacing: Spacing.md) {
                    ForEach(row, id: \.self) { digit in
                        PinButton(label: digit) {
                            vm.append(digit: digit)
                        }
                    }
                }
            }
            HStack(spacing: Spacing.md) {
                if BiometricService.shared.isAvailable {
                    PinButton(systemImage: BiometricService.shared.biometricSystemImage) {
                        Task {
                            let success = await BiometricService.shared.authenticate()
                            if success {
                                // Match biometric to first employee (owner)
                                if let first = vm.employees.first(where: { $0.employeeRole == .admin }) {
                                    vm.selectedEmployee = first
                                    env.setSession(tenantId: env.tenantId, employee: first)
                                    vm.isAuthenticated = true
                                }
                            }
                        }
                    }
                } else {
                    Spacer().frame(width: pinButtonSize)
                }

                PinButton(label: "0") { vm.append(digit: "0") }

                PinButton(systemImage: "delete.left.fill", isDestructive: true) {
                    vm.deleteLastDigit()
                }
            }
        }
    }

    private let pinButtonSize: CGFloat = 80
}

private struct PinButton: View {
    var label: String?
    var systemImage: String?
    var isDestructive: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if let label = label {
                    Text(label)
                        .font(.system(.title, design: .rounded))
                        .fontWeight(.medium)
                } else if let image = systemImage {
                    Image(systemName: image)
                        .font(.title2)
                }
            }
            .frame(width: 80, height: 80)
            .background(isDestructive ? Color.red.opacity(0.1) : Color.appSecondaryBackground)
            .clipShape(Circle())
            .foregroundStyle(isDestructive ? .red : .primary)
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: label)
    }
}
