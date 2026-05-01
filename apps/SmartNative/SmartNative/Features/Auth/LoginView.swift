import SwiftUI

struct LoginView: View {
    @State private var vm = AuthViewModel()
    @State private var showingPinAccess = false
    @FocusState private var focusedField: LoginField?

    enum LoginField { case email, password }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xxl) {
                    headerSection
                    formSection
                    alternativeLoginSection
                }
                .padding(Spacing.xl)
            }
            .background(Color.appBackground)
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $showingPinAccess) {
            PinAccessView()
        }
    }

    private var headerSection: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "wrench.and.screwdriver.fill")
                .font(.system(size: 56))
                .foregroundStyle(.accent)
                .padding(.top, Spacing.xxxl)

            VStack(spacing: Spacing.xs) {
                Text("SmartFixOS")
                    .font(.system(.largeTitle, design: .rounded))
                    .fontWeight(.bold)
                Text("Sistema de Gestión de Taller")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var formSection: some View {
        VStack(spacing: Spacing.md) {
            if let error = vm.errorMessage {
                ErrorBanner(message: error)
            }

            VStack(spacing: Spacing.sm) {
                TextField("Email", text: $vm.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .focused($focusedField, equals: .email)
                    .padding(Spacing.md)
                    .background(Color.appSecondaryBackground)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }

                SecureField("Contraseña", text: $vm.password)
                    .textContentType(.password)
                    .focused($focusedField, equals: .password)
                    .padding(Spacing.md)
                    .background(Color.appSecondaryBackground)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                    .submitLabel(.done)
                    .onSubmit {
                        Task { await vm.loginWithEmail() }
                    }
            }

            PrimaryButton("Iniciar Sesión", systemImage: "person.fill.checkmark", isLoading: vm.isLoading) {
                Task { await vm.loginWithEmail() }
            }
        }
    }

    private var alternativeLoginSection: some View {
        VStack(spacing: Spacing.md) {
            HStack {
                Rectangle().frame(height: 1).foregroundStyle(.separator)
                Text("o").font(.caption).foregroundStyle(.secondary)
                Rectangle().frame(height: 1).foregroundStyle(.separator)
            }

            HStack(spacing: Spacing.md) {
                Button {
                    showingPinAccess = true
                } label: {
                    Label("Acceso PIN", systemImage: "number.square.fill")
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.bordered)

                if vm.biometricEnabled && BiometricService.shared.isAvailable {
                    Button {
                        Task { await vm.loginWithBiometric() }
                    } label: {
                        Label(BiometricService.shared.biometricLabel,
                              systemImage: BiometricService.shared.biometricSystemImage)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }
}
