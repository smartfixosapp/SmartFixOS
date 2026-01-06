import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Bell, UserCheck, CheckCircle, Package, AlertTriangle } from 'lucide-react';

// ============================================
// SERVICIO DE NOTIFICACIONES EN TIEMPO REAL
// Polling inteligente cada 10 segundos
// ============================================

const POLL_INTERVAL = 10000; // 10 segundos
const NOTIFICATION_TYPES = {
  EMPLOYEE_LOGIN: 'employee_login',
  ORDER_COMPLETED: 'order_completed',
  LOW_STOCK: 'low_stock',
  ORDER_READY: 'order_ready',
  PAYMENT_RECEIVED: 'payment_received'
};

export function useRealtimeNotifications() {
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [isActive, setIsActive] = useState(true);
  const intervalRef = useRef(null);
  const processedIds = useRef(new Set());

  useEffect(() => {
    checkNotifications();
    
    intervalRef.current = setInterval(() => {
      if (isActive && document.visibilityState === 'visible') {
        checkNotifications();
      }
    }, POLL_INTERVAL);

    // Pausar cuando la pestaña no está visible
    const handleVisibilityChange = () => {
      setIsActive(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  const checkNotifications = async () => {
    try {
      const now = Date.now();
      const oneMinuteAgo = new Date(now - 60000).toISOString();

      // 1. Verificar logins recientes de empleados
      const recentLogins = await base44.entities.AuditLog.filter({
        action: 'login',
        entity_type: 'user',
      }, '-created_date', 5);

      recentLogins?.forEach(log => {
        const logTime = new Date(log.created_date).getTime();
        if (logTime > lastCheck && !processedIds.current.has(log.id)) {
          showEmployeeLoginNotification(log);
          processedIds.current.add(log.id);
        }
      });

      // 2. Verificar órdenes completadas recientemente
      const recentCompletions = await base44.entities.WorkOrderEvent.filter({
        event_type: 'status_change',
      }, '-created_date', 10);

      recentCompletions?.forEach(event => {
        const eventTime = new Date(event.created_date).getTime();
        if (eventTime > lastCheck && 
            event.new_value === 'picked_up' && 
            !processedIds.current.has(event.id)) {
          showOrderCompletedNotification(event);
          processedIds.current.add(event.id);
        }
      });

      // 3. Verificar órdenes listas para recoger
      const readyOrders = await base44.entities.WorkOrderEvent.filter({
        event_type: 'status_change',
      }, '-created_date', 10);

      readyOrders?.forEach(event => {
        const eventTime = new Date(event.created_date).getTime();
        if (eventTime > lastCheck && 
            event.new_value === 'ready_for_pickup' && 
            !processedIds.current.has(event.id + '_ready')) {
          showOrderReadyNotification(event);
          processedIds.current.add(event.id + '_ready');
        }
      });

      setLastCheck(now);

      // Limpiar IDs procesados antiguos (mantener solo últimas 100)
      if (processedIds.current.size > 100) {
        const arr = Array.from(processedIds.current);
        processedIds.current = new Set(arr.slice(-50));
      }

    } catch (error) {
      console.error('Error checking notifications:', error);
    }
  };

  const showEmployeeLoginNotification = (log) => {
    toast.success(
      <div className="flex items-center gap-3">
        <UserCheck className="w-5 h-5 text-emerald-400" />
        <div>
          <p className="font-semibold">Empleado conectado</p>
          <p className="text-sm text-gray-400">{log.user_name} ha iniciado sesión</p>
        </div>
      </div>,
      {
        duration: 5000,
        position: 'top-right'
      }
    );

    // Reproducir sonido
    playNotificationSound();
  };

  const showOrderCompletedNotification = (event) => {
    toast.success(
      <div className="flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <div>
          <p className="font-semibold">Orden completada</p>
          <p className="text-sm text-gray-400">Orden #{event.order_number} entregada</p>
        </div>
      </div>,
      {
        duration: 6000,
        position: 'top-right'
      }
    );

    playNotificationSound();
  };

  const showOrderReadyNotification = (event) => {
    toast.info(
      <div className="flex items-center gap-3">
        <Package className="w-5 h-5 text-cyan-400" />
        <div>
          <p className="font-semibold">Orden lista para recoger</p>
          <p className="text-sm text-gray-400">Orden #{event.order_number}</p>
        </div>
      </div>,
      {
        duration: 8000,
        position: 'top-right'
      }
    );

    playNotificationSound();
  };

  const playNotificationSound = () => {
    try {
      // Crear un beep corto usando Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Silenciosamente fallar si el audio no está disponible
    }
  };

  return {
    isActive,
    lastCheck
  };
}

// ============================================
// TRIGGER MANUAL PARA EVENTOS ESPECÍFICOS
// ============================================

export const triggerRealtimeNotification = async (type, data) => {
  try {
    switch (type) {
      case NOTIFICATION_TYPES.EMPLOYEE_LOGIN:
        await base44.entities.AuditLog.create({
          action: 'login',
          entity_type: 'user',
          user_id: data.userId,
          user_name: data.userName,
          user_role: data.userRole,
          ip_address: data.ipAddress || 'unknown',
          severity: 'info'
        });
        break;

      case NOTIFICATION_TYPES.ORDER_COMPLETED:
        await base44.entities.WorkOrderEvent.create({
          order_id: data.orderId,
          order_number: data.orderNumber,
          event_type: 'status_change',
          old_value: data.oldStatus,
          new_value: 'picked_up',
          user_name: data.userName,
          notes: data.notes || 'Orden entregada al cliente'
        });
        break;

      case NOTIFICATION_TYPES.ORDER_READY:
        await base44.entities.WorkOrderEvent.create({
          order_id: data.orderId,
          order_number: data.orderNumber,
          event_type: 'status_change',
          old_value: data.oldStatus,
          new_value: 'ready_for_pickup',
          user_name: data.userName,
          notes: data.notes || 'Orden lista para recoger'
        });
        break;

      case NOTIFICATION_TYPES.LOW_STOCK:
        toast.warning(
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="font-semibold">Inventario bajo</p>
              <p className="text-sm text-gray-400">{data.productName}: {data.stock} unidades</p>
            </div>
          </div>,
          {
            duration: 10000,
            position: 'top-right'
          }
        );
        break;
    }
  } catch (error) {
    console.error('Error triggering notification:', error);
  }
};

export { NOTIFICATION_TYPES };
