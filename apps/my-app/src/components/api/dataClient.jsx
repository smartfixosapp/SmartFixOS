// ============================================
// 👈 MIGRACIÓN: Data Client - Adapter Unificado
// Capa de abstracción sobre Base44 (hoy) y Neon (futuro)
// ============================================

import { base44 } from "@/api/base44Client";

// 👈 MIGRACIÓN: Adaptador Base44 (1:1 con API actual)
const base44Adapter = {
  entities: {
    Customer: {
      list: (order, limit) => base44.entities.Customer.list(order, limit),
      get: (id) => base44.entities.Customer.get(id),
      filter: (q, order) => base44.entities.Customer.filter(q, order),
      create: (data) => base44.entities.Customer.create(data),
      update: (id, data) => base44.entities.Customer.update(id, data),
      delete: (id) => base44.entities.Customer.delete(id),
    },
    Order: {
      list: (order, limit) => base44.entities.Order.list(order, limit),
      get: (id) => base44.entities.Order.get(id),
      filter: (q, order) => base44.entities.Order.filter(q, order),
      create: (data) => base44.entities.Order.create(data),
      update: (id, data) => base44.entities.Order.update(id, data),
      delete: (id) => base44.entities.Order.delete(id),
    },
    WorkOrderEvent: {
      list: (order, limit) => base44.entities.WorkOrderEvent.list(order, limit),
      get: (id) => base44.entities.WorkOrderEvent.get(id),
      filter: (q, order) => base44.entities.WorkOrderEvent.filter(q, order),
      create: (data) => base44.entities.WorkOrderEvent.create(data),
      update: (id, data) => base44.entities.WorkOrderEvent.update(id, data),
    },
    Sale: {
      list: (order, limit) => base44.entities.Sale.list(order, limit),
      get: (id) => base44.entities.Sale.get(id),
      filter: (q, order) => base44.entities.Sale.filter(q, order),
      create: (data) => base44.entities.Sale.create(data),
      update: (id, data) => base44.entities.Sale.update(id, data),
    },
    Transaction: {
      list: (order, limit) => base44.entities.Transaction.list(order, limit),
      get: (id) => base44.entities.Transaction.get(id),
      filter: (q, order) => base44.entities.Transaction.filter(q, order),
      create: (data) => base44.entities.Transaction.create(data),
      update: (id, data) => base44.entities.Transaction.update(id, data),
    },
    CashRegister: {
      list: (order, limit) => base44.entities.CashRegister.list(order, limit),
      get: (id) => base44.entities.CashRegister.get(id),
      filter: (q, order) => base44.entities.CashRegister.filter(q, order),
      create: (data) => base44.entities.CashRegister.create(data),
      update: (id, data) => base44.entities.CashRegister.update(id, data),
    },
    CashDrawerMovement: {
      list: (order, limit) => base44.entities.CashDrawerMovement.list(order, limit),
      get: (id) => base44.entities.CashDrawerMovement.get(id),
      filter: (q, order) => base44.entities.CashDrawerMovement.filter(q, order),
      create: (data) => base44.entities.CashDrawerMovement.create(data),
      update: (id, data) => base44.entities.CashDrawerMovement.update(id, data),
    },
    Product: {
      list: (order, limit) => base44.entities.Product.list(order, limit),
      get: (id) => base44.entities.Product.get(id),
      filter: (q, order) => base44.entities.Product.filter(q, order),
      create: (data) => base44.entities.Product.create(data),
      update: (id, data) => base44.entities.Product.update(id, data),
    },
    Service: {
      list: (order, limit) => base44.entities.Service.list(order, limit),
      get: (id) => base44.entities.Service.get(id),
      filter: (q, order) => base44.entities.Service.filter(q, order),
      create: (data) => base44.entities.Service.create(data),
      update: (id, data) => base44.entities.Service.update(id, data),
    },
    InventoryMovement: {
      list: (order, limit) => base44.entities.InventoryMovement.list(order, limit),
      filter: (q, order) => base44.entities.InventoryMovement.filter(q, order),
      create: (data) => base44.entities.InventoryMovement.create(data),
    },
    User: {
      list: (order, limit) => base44.entities.User.list(order, limit),
      get: (id) => base44.entities.User.get(id),
      filter: (q, order) => base44.entities.User.filter(q, order),
      create: (data) => base44.entities.User.create(data),
      update: (id, data) => base44.entities.User.update(id, data),
      delete: (id) => base44.entities.User.delete(id),
    },
    Notification: {
      list: (order, limit) => base44.entities.Notification.list(order, limit),
      filter: (q, order) => base44.entities.Notification.filter(q, order),
      create: (data) => base44.entities.Notification.create(data),
      update: (id, data) => base44.entities.Notification.update(id, data),
      delete: (id) => base44.entities.Notification.delete(id),
    },
    DeviceCategory: {
      list: (order, limit) => base44.entities.DeviceCategory.list(order, limit),
      filter: (q, order) => base44.entities.DeviceCategory.filter(q, order),
      create: (data) => base44.entities.DeviceCategory.create(data),
      update: (id, data) => base44.entities.DeviceCategory.update(id, data),
      delete: (id) => base44.entities.DeviceCategory.delete(id),
    },
    Brand: {
      list: (order, limit) => base44.entities.Brand.list(order, limit),
      filter: (q, order) => base44.entities.Brand.filter(q, order),
      create: (data) => base44.entities.Brand.create(data),
      update: (id, data) => base44.entities.Brand.update(id, data),
      delete: (id) => base44.entities.Brand.delete(id),
    },
    DeviceModel: {
      list: (order, limit) => base44.entities.DeviceModel.list(order, limit),
      filter: (q, order) => base44.entities.DeviceModel.filter(q, order),
      create: (data) => base44.entities.DeviceModel.create(data),
      update: (id, data) => base44.entities.DeviceModel.update(id, data),
      delete: (id) => base44.entities.DeviceModel.delete(id),
    },
    AppSettings: {
      list: (order, limit) => base44.entities.AppSettings.list(order, limit),
      filter: (q, order) => base44.entities.AppSettings.filter(q, order),
      create: (data) => base44.entities.AppSettings.create(data),
      update: (id, data) => base44.entities.AppSettings.update(id, data),
    },
    SystemConfig: {
      filter: (q, order) => base44.entities.SystemConfig.filter(q, order),
      create: (data) => base44.entities.SystemConfig.create(data),
      update: (id, data) => base44.entities.SystemConfig.update(id, data),
    },
    ExternalLink: {
      list: (order, limit) => base44.entities.ExternalLink.list(order, limit),
      filter: (q, order) => base44.entities.ExternalLink.filter(q, order),
      create: (data) => base44.entities.ExternalLink.create(data),
      update: (id, data) => base44.entities.ExternalLink.update(id, data),
      delete: (id) => base44.entities.ExternalLink.delete(id),
    },
    TimeEntry: {
      list: (order, limit) => base44.entities.TimeEntry.list(order, limit),
      filter: (q, order) => base44.entities.TimeEntry.filter(q, order),
      create: (data) => base44.entities.TimeEntry.create(data),
      update: (id, data) => base44.entities.TimeEntry.update(id, data),
    },
    AuditLog: {
      create: (data) => base44.entities.AuditLog.create(data),
      filter: (q, order) => base44.entities.AuditLog.filter(q, order),
    },
    WorkOrderWizardConfig: {
      list: (order, limit) => base44.entities.WorkOrderWizardConfig.list(order, limit),
      update: (id, data) => base44.entities.WorkOrderWizardConfig.update(id, data),
      create: (data) => base44.entities.WorkOrderWizardConfig.create(data),
    },
    DiscountCode: {
      filter: (q, order) => base44.entities.DiscountCode.filter(q, order),
      update: (id, data) => base44.entities.DiscountCode.update(id, data),
    },
    CustomerPortalToken: {
      filter: (q, order) => base44.entities.CustomerPortalToken.filter(q, order),
      create: (data) => base44.entities.CustomerPortalToken.create(data),
      update: (id, data) => base44.entities.CustomerPortalToken.update(id, data),
    },
    Announcement: {
      list: (order, limit) => base44.entities.Announcement.list(order, limit),
      create: (data) => base44.entities.Announcement.create(data),
      update: (id, data) => base44.entities.Announcement.update(id, data),
    },
    SequenceCounter: {
      filter: (q, order) => base44.entities.SequenceCounter.filter(q, order),
      create: (data) => base44.entities.SequenceCounter.create(data),
      update: (id, data) => base44.entities.SequenceCounter.update(id, data),
    },
    Invoice: {
      list: (order, limit) => base44.entities.Invoice.list(order, limit),
      filter: (q, order) => base44.entities.Invoice.filter(q, order),
      create: (data) => base44.entities.Invoice.create(data),
      update: (id, data) => base44.entities.Invoice.update(id, data),
      delete: (id) => base44.entities.Invoice.delete(id),
    },
    PersonalNote: {
      list: (order, limit) => base44.entities.PersonalNote.list(order, limit),
      filter: (q, order) => base44.entities.PersonalNote.filter(q, order),
      create: (data) => base44.entities.PersonalNote.create(data),
      update: (id, data) => base44.entities.PersonalNote.update(id, data),
      delete: (id) => base44.entities.PersonalNote.delete(id),
    },
    OneTimeExpense: {
      list: (order, limit) => base44.entities.OneTimeExpense.list(order, limit),
      filter: (q, order) => base44.entities.OneTimeExpense.filter(q, order),
      create: (data) => base44.entities.OneTimeExpense.create(data),
      update: (id, data) => base44.entities.OneTimeExpense.update(id, data),
      delete: (id) => base44.entities.OneTimeExpense.delete(id),
    },
    Recharge: {
      list: (order, limit) => base44.entities.Recharge.list(order, limit),
      filter: (q, order) => base44.entities.Recharge.filter(q, order),
      create: (data) => base44.entities.Recharge.create(data),
      update: (id, data) => base44.entities.Recharge.update(id, data),
      delete: (id) => base44.entities.Recharge.delete(id),
    },
    FixedExpense: {
      list: (order, limit) => base44.entities.FixedExpense.list(order, limit),
      filter: (q, order) => base44.entities.FixedExpense.filter(q, order),
      create: (data) => base44.entities.FixedExpense.create(data),
      update: (id, data) => base44.entities.FixedExpense.update(id, data),
      delete: (id) => base44.entities.FixedExpense.delete(id),
    },
    NotificationRule: {
      list: (order, limit) => base44.entities.NotificationRule.list(order, limit),
      filter: (q, order) => base44.entities.NotificationRule.filter(q, order),
      create: (data) => base44.entities.NotificationRule.create(data),
      update: (id, data) => base44.entities.NotificationRule.update(id, data),
      delete: (id) => base44.entities.NotificationRule.delete(id),
    },
    },
  auth: {
    me: () => base44.auth.me(),
    updateMe: (data) => base44.auth.updateMe(data),
    redirectToLogin: (nextUrl) => base44.auth.redirectToLogin?.(nextUrl),
    logout: (redirectUrl) => base44.auth.logout?.(redirectUrl),
  },
  mail: {
    send: (payload) => base44.integrations?.Core?.SendEmail
      ? base44.integrations.Core.SendEmail(payload)
      : Promise.reject(new Error("Email integration not available")),
  },
  files: {
    upload: (file) => base44.integrations?.Core?.UploadFile
      ? base44.integrations.Core.UploadFile({ file })
      : Promise.reject(new Error("Upload integration not available")),
  },
};

// 👈 MIGRACIÓN: Export único para toda la app
export const dataClient = base44Adapter;

// 👈 MIGRACIÓN: Helper para debugging
export const getActiveBackend = () => "base44";

// 👈 MIGRACIÓN: Log de inicialización
console.log(`
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: BASE44                      ║
║  Mode: Base44 (Actual)                ║
╚════════════════════════════════════════╝
`);
