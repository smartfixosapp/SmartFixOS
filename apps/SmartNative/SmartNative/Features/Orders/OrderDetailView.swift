import SwiftUI

struct OrderDetailView: View {
    let order: Order
    @State private var vm = OrdersViewModel()
    @State private var showingStatusPicker = false
    @State private var currentStatus: OrderStatus
    @State private var showingDeleteConfirm = false

    init(order: Order) {
        self.order = order
        self._currentStatus = State(initialValue: order.orderStatus)
    }

    var body: some View {
        List {
            statusSection
            customerSection
            deviceSection
            financialSection
            datesSection
            if let note = order.status_note, !note.isEmpty {
                Section("Nota de Estado") {
                    Text(note)
                        .font(.body)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Orden \(order.order_number)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingStatusPicker = true
                } label: {
                    Label("Estado", systemImage: "arrow.triangle.2.circlepath")
                }
            }
        }
        .sheet(isPresented: $showingStatusPicker) {
            OrderStatusPicker(selectedStatus: $currentStatus) { newStatus in
                currentStatus = newStatus
                Task { await vm.updateStatus(order: order, newStatus: newStatus) }
            }
        }
    }

    private var statusSection: some View {
        Section {
            HStack {
                Text("Estado")
                Spacer()
                StatusBadge(status: currentStatus)
            }
            .contentShape(Rectangle())
            .onTapGesture { showingStatusPicker = true }

            if let priority = order.priority.flatMap({ OrderPriority(rawValue: $0) }), priority != .normal {
                HStack {
                    Text("Prioridad")
                    Spacer()
                    PriorityBadge(priority: priority)
                }
            }
        } header: {
            Text("Estado de la Orden")
        }
    }

    private var customerSection: some View {
        Section("Cliente") {
            LabeledContent("Nombre", value: order.customer_name)
            if let phone = order.customer_phone {
                Button {
                    if let url = URL(string: "tel:\(phone.filter { $0.isNumber })") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    LabeledContent("Teléfono") {
                        HStack {
                            Text(phone)
                            Image(systemName: "phone.fill")
                                .font(.caption)
                                .foregroundStyle(.accent)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            if let email = order.customer_email {
                LabeledContent("Email", value: email)
            }
        }
    }

    private var deviceSection: some View {
        Section("Dispositivo") {
            LabeledContent("Tipo", value: order.device_type)
            if let brand = order.device_brand {
                LabeledContent("Marca", value: brand)
            }
            if let model = order.device_model {
                LabeledContent("Modelo", value: model)
            }
            if let color = order.device_color {
                LabeledContent("Color", value: color)
            }
            if let serial = order.device_serial {
                LabeledContent("IMEI/Serial", value: serial)
            }
            if let problem = order.initial_problem {
                LabeledContent("Problema Reportado") {
                    Text(problem)
                        .multilineTextAlignment(.trailing)
                }
            }
        }
    }

    private var financialSection: some View {
        Section("Financiero") {
            if let estimate = order.cost_estimate {
                LabeledContent("Estimado", value: estimate.asCurrency)
            }
            if let labor = order.labor_cost {
                LabeledContent("Mano de Obra", value: labor.asCurrency)
            }
            if let paid = order.amount_paid, paid > 0 {
                LabeledContent("Pagado", value: paid.asCurrency)
            }
            if let balance = order.balance_due, balance > 0 {
                LabeledContent("Balance", value: balance.asCurrency)
                    .foregroundStyle(.orange)
            }
            LabeledContent("Pagada") {
                Image(systemName: order.paid == true ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(order.paid == true ? .green : .red)
            }
        }
    }

    private var datesSection: some View {
        Section("Fechas") {
            if let date = order.created_date {
                LabeledContent("Creada", value: date.displayString)
            }
            if let date = order.updated_date {
                LabeledContent("Actualizada", value: date.displayString)
            }
            if let completion = order.estimated_completion {
                LabeledContent("Est. Completada", value: completion)
                    .foregroundStyle(order.isOverdue ? .red : .primary)
            }
            if let employee = order.assigned_to_name {
                LabeledContent("Asignada a", value: employee)
            }
            if let createdBy = order.created_by_name {
                LabeledContent("Creada por", value: createdBy)
            }
        }
    }
}
