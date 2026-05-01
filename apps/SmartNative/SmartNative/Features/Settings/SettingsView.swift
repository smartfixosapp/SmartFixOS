import SwiftUI

struct SettingsView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var showingSignOutConfirm = false
    @State private var biometricEnabled = false

    var body: some View {
        NavigationStack {
            Form {
                tenantSection
                employeeSection
                appSection
                dangerSection
            }
            .navigationTitle("Configuración")
            .onAppear {
                biometricEnabled = KeychainService.shared.load(forKey: .biometricEnabled) == "true"
            }
        }
        .confirmationDialog("¿Cerrar sesión?", isPresented: $showingSignOutConfirm, titleVisibility: .visible) {
            Button("Cerrar sesión", role: .destructive) {
                Task { await env.signOut() }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Tendrás que iniciar sesión nuevamente.")
        }
    }

    private var tenantSection: some View {
        Section("Negocio") {
            LabeledContent("ID del Tenant", value: String(env.tenantId.prefix(8)) + "...")
            if !env.tenantName.isEmpty {
                LabeledContent("Nombre", value: env.tenantName)
            }
        }
    }

    private var employeeSection: some View {
        Section("Tu cuenta") {
            if let employee = env.currentEmployee {
                LabeledContent("Nombre", value: employee.full_name)
                LabeledContent("Email", value: employee.email)
                LabeledContent("Rol", value: employee.employeeRole.label)
            }
        }
    }

    private var appSection: some View {
        Section("Aplicación") {
            if BiometricService.shared.isAvailable {
                Toggle(isOn: $biometricEnabled) {
                    Label(BiometricService.shared.biometricLabel,
                          systemImage: BiometricService.shared.biometricSystemImage)
                }
                .onChange(of: biometricEnabled) { _, enabled in
                    KeychainService.shared.save(enabled ? "true" : "false", forKey: .biometricEnabled)
                }
            }

            NavigationLink {
                AboutView()
            } label: {
                Label("Acerca de SmartFixOS", systemImage: "info.circle")
            }
        }
    }

    private var dangerSection: some View {
        Section {
            Button(role: .destructive) {
                showingSignOutConfirm = true
            } label: {
                Label("Cerrar sesión", systemImage: "rectangle.portrait.and.arrow.right")
            }
        }
    }
}

struct AboutView: View {
    var body: some View {
        List {
            Section {
                LabeledContent("Versión", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                LabeledContent("Build", value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1")
                LabeledContent("Plataforma", value: "iOS Nativo")
                LabeledContent("Backend", value: "Supabase + Vercel")
            }
            Section("Endpoints") {
                LabeledContent("Supabase", value: "idntuvtabecwubzswpwi")
                LabeledContent("API", value: "smart-fix-os-smart.vercel.app")
            }
        }
        .navigationTitle("Acerca de")
        .listStyle(.insetGrouped)
    }
}
