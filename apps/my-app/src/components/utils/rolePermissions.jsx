/**
 * Sistema de Roles y Permisos - SmartFixOS
 * 
 * Define políticas de acceso por rol y proporciona helpers para validación.
 * Los permisos personalizados en User.permissions sobrescriben estos defaults.
 */

// ✅ DEFINICIÓN DE ROLES Y PERMISOS
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TECHNICIAN: 'technician',
  SERVICE: 'service',
  CASHIER: 'cashier',
  USER: 'user'
};

// ✅ PERMISOS POR ROL (defaults)
export const ROLE_PERMISSIONS = {
  // 🔴 ADMIN: Acceso total sin restricciones
  admin: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: true,
    can_delete_orders: true,
    can_view_all_orders: true,
    can_view_customers: true,
    can_edit_customers: true,
    can_delete_customers: true,
    can_access_pos: true,
    can_void_sales: true,
    can_apply_discounts: true,
    can_view_financial: true,
    can_open_close_drawer: true,
    can_view_inventory: true,
    can_manage_inventory: true,
    can_view_reports: true,
    can_export_data: true,
    can_manage_users: true,
    can_access_settings: true,
    can_manage_catalog: true
  },

  // 🟡 MANAGER: CRUD completo excepto seguridad crítica
  manager: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: true,
    can_delete_orders: true,
    can_view_all_orders: true,
    can_view_customers: true,
    can_edit_customers: true,
    can_delete_customers: true,
    can_access_pos: true,
    can_void_sales: true,
    can_apply_discounts: true,
    can_view_financial: true,
    can_open_close_drawer: true,
    can_view_inventory: true,
    can_manage_inventory: true,
    can_view_reports: true,
    can_export_data: true,
    can_manage_users: false,        // ❌ No puede gestionar usuarios
    can_access_settings: false,     // ❌ No puede cambiar configuración
    can_manage_catalog: true
  },

  // 🔵 TECHNICIAN: Solo sus órdenes + crear eventos
  technician: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: true,          // Solo sus órdenes asignadas
    can_delete_orders: false,
    can_view_all_orders: false,     // ❌ Solo ve órdenes asignadas
    can_view_customers: true,
    can_edit_customers: false,
    can_delete_customers: false,
    can_access_pos: false,
    can_void_sales: false,
    can_apply_discounts: false,
    can_view_financial: false,
    can_open_close_drawer: false,
    can_view_inventory: true,
    can_manage_inventory: false,
    can_view_reports: false,
    can_export_data: false,
    can_manage_users: false,
    can_access_settings: false,
    can_manage_catalog: false
  },

  // 🟢 SERVICE: POS + lectura limitada
  service: {
    can_view_orders: true,
    can_create_orders: true,
    can_edit_orders: false,
    can_delete_orders: false,
    can_view_all_orders: true,
    can_view_customers: true,
    can_edit_customers: true,
    can_delete_customers: false,
    can_access_pos: true,           // ✅ Acceso POS
    can_void_sales: false,
    can_apply_discounts: true,
    can_view_financial: false,
    can_open_close_drawer: false,
    can_view_inventory: true,
    can_manage_inventory: false,
    can_view_reports: false,
    can_export_data: false,
    can_manage_users: false,
    can_access_settings: false,
    can_manage_catalog: false
  },

  // 💰 CASHIER: POS completo + caja
  cashier: {
    can_view_orders: true,
    can_create_orders: false,
    can_edit_orders: false,
    can_delete_orders: false,
    can_view_all_orders: false,
    can_view_customers: true,
    can_edit_customers: false,
    can_delete_customers: false,
    can_access_pos: true,           // ✅ Acceso POS
    can_void_sales: false,
    can_apply_discounts: true,
    can_view_financial: true,       // ✅ Solo para cierre de caja
    can_open_close_drawer: true,    // ✅ Abrir/cerrar caja
    can_view_inventory: true,
    can_manage_inventory: false,
    can_view_reports: false,
    can_export_data: false,
    can_manage_users: false,
    can_access_settings: false,
    can_manage_catalog: false
  },

  // ⚪ USER: Solo lectura básica
  user: {
    can_view_orders: true,
    can_create_orders: false,
    can_edit_orders: false,
    can_delete_orders: false,
    can_view_all_orders: false,
    can_view_customers: true,
    can_edit_customers: false,
    can_delete_customers: false,
    can_access_pos: false,
    can_void_sales: false,
    can_apply_discounts: false,
    can_view_financial: false,
    can_open_close_drawer: false,
    can_view_inventory: false,
    can_manage_inventory: false,
    can_view_reports: false,
    can_export_data: false,
    can_manage_users: false,
    can_access_settings: false,
    can_manage_catalog: false
  }
};

// ✅ HELPER: Obtener permisos efectivos del usuario
export function getUserPermissions(user) {
  if (!user) return ROLE_PERMISSIONS.user;
  
  const role = user.role || 'user';
  const rolePerms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
  
  // Combinar permisos del rol con overrides personalizados
  return {
    ...rolePerms,
    ...(user.permissions || {})
  };
}

// ✅ HELPER: Validar permiso específico
export function hasPermission(user, permission) {
  const perms = getUserPermissions(user);
  return perms[permission] === true;
}

// ✅ HELPER: Validar múltiples permisos (requiere TODOS)
export function hasAllPermissions(user, permissions) {
  return permissions.every(perm => hasPermission(user, perm));
}

// ✅ HELPER: Validar múltiples permisos (requiere AL MENOS UNO)
export function hasAnyPermission(user, permissions) {
  return permissions.some(perm => hasPermission(user, perm));
}

// ✅ HELPER: Validar si el usuario puede ver una orden específica
export function canViewOrder(user, order) {
  if (!user || !order) return false;
  
  const perms = getUserPermissions(user);
  
  // Admin y manager ven todo
  if (perms.can_view_all_orders) return true;
  
  // Técnicos solo ven sus órdenes asignadas
  if (user.role === ROLES.TECHNICIAN) {
    return order.assigned_to === user.id || order.assigned_to === user.email;
  }
  
  // Service puede ver todas
  if (user.role === ROLES.SERVICE) return true;
  
  return false;
}

// ✅ HELPER: Validar si el usuario puede editar una orden específica
export function canEditOrder(user, order) {
  if (!user || !order) return false;
  
  const perms = getUserPermissions(user);
  
  // Si no tiene permiso general, no puede editar
  if (!perms.can_edit_orders) return false;
  
  // Admin y manager editan todo
  if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) return true;
  
  // Técnicos solo editan sus órdenes
  if (user.role === ROLES.TECHNICIAN) {
    return order.assigned_to === user.id || order.assigned_to === user.email;
  }
  
  return false;
}

// ✅ HELPER: Validar acceso a módulo financiero
export function canAccessFinancial(user) {
  if (!user) return false;
  return hasPermission(user, 'can_view_financial');
}

// ✅ HELPER: Validar acceso a gestión de usuarios
export function canManageUsers(user) {
  if (!user) return false;
  return hasPermission(user, 'can_manage_users');
}

// ✅ HELPER: Validar acceso a configuración
export function canAccessSettings(user) {
  if (!user) return false;
  return hasPermission(user, 'can_access_settings');
}

// ✅ HELPER: Obtener label del rol
export function getRoleLabel(role) {
  const labels = {
    admin: '👑 Administrador',
    manager: '📊 Gerente',
    technician: '🔧 Técnico',
    service: '👤 Servicio al Cliente',
    cashier: '💰 Cajero',
    user: '👥 Usuario'
  };
  return labels[role] || '👥 Usuario';
}

// ✅ HELPER: Filtrar órdenes según permisos
export function filterOrdersByPermissions(user, orders) {
  if (!user || !orders) return [];
  
  const perms = getUserPermissions(user);
  
  // Admin y manager ven todo
  if (perms.can_view_all_orders) return orders;
  
  // Técnicos solo sus órdenes
  if (user.role === ROLES.TECHNICIAN) {
    return orders.filter(o => 
      o.assigned_to === user.id || o.assigned_to === user.email
    );
  }
  
  // Service ve todo
  if (user.role === ROLES.SERVICE) return orders;
  
  return [];
}

// ✅ POLÍTICAS DE ENTIDADES (documentación)
export const ENTITY_POLICIES = {
  Order: {
    read: ['admin', 'manager', 'technician', 'service', 'cashier', 'user'],
    create: ['admin', 'manager', 'technician', 'service'],
    update: ['admin', 'manager', 'technician'], // technician solo sus órdenes
    delete: ['admin', 'manager']
  },
  
  WorkOrderEvent: {
    read: ['admin', 'manager', 'technician', 'service', 'user'],
    create: ['admin', 'manager', 'technician'], // técnicos crean eventos en sus órdenes
    update: ['admin', 'manager'],
    delete: ['admin', 'manager']
  },
  
  Customer: {
    read: ['admin', 'manager', 'technician', 'service', 'cashier', 'user'],
    create: ['admin', 'manager', 'service'],
    update: ['admin', 'manager', 'service'],
    delete: ['admin', 'manager']
  },
  
  Sale: {
    read: ['admin', 'manager', 'service', 'cashier'],
    create: ['admin', 'manager', 'service', 'cashier'],
    update: ['admin', 'manager'],
    delete: ['admin'] // void requiere admin
  },
  
  CashRegister: {
    read: ['admin', 'manager', 'cashier'],
    create: ['admin', 'manager', 'cashier'],
    update: ['admin', 'manager', 'cashier'],
    delete: ['admin']
  },
  
  CashDrawerMovement: {
    read: ['admin', 'manager', 'cashier'],
    create: ['admin', 'manager', 'cashier'],
    update: ['admin', 'manager'],
    delete: ['admin']
  },
  
  Transaction: {
    read: ['admin', 'manager'],
    create: ['admin', 'manager', 'cashier'],
    update: ['admin', 'manager'],
    delete: ['admin']
  },
  
  Product: {
    read: ['admin', 'manager', 'technician', 'service', 'cashier'],
    create: ['admin', 'manager'],
    update: ['admin', 'manager'],
    delete: ['admin', 'manager']
  },
  
  InventoryMovement: {
    read: ['admin', 'manager'],
    create: ['admin', 'manager'],
    update: ['admin'],
    delete: ['admin']
  },
  
  User: {
    read: ['admin', 'manager'],
    create: ['admin'],
    update: ['admin'],
    delete: ['admin']
  },
  
  SystemConfig: {
    read: ['admin', 'manager'],
    create: ['admin'],
    update: ['admin'],
    delete: ['admin']
  }
};

export default {
  ROLES,
  ROLE_PERMISSIONS,
  getUserPermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canViewOrder,
  canEditOrder,
  canAccessFinancial,
  canManageUsers,
  canAccessSettings,
  getRoleLabel,
  filterOrdersByPermissions,
  ENTITY_POLICIES
};
