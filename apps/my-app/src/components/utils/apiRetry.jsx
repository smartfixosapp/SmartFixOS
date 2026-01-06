import { toast } from "sonner";

/**
 * Ejecuta una función con reintentos automáticos y backoff exponencial
 * @param {Function} fn - Función async a ejecutar
 * @param {Object} options - Opciones de configuración
 * @returns {Promise} - Resultado de la función
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 2000,
    maxDelay = 15000,
    backoffMultiplier = 2,
    showToasts = true,
    operationName = "operación"
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Intento de ejecución
      const result = await fn();
      
      // Si tuvimos reintentos previos, notificar éxito
      if (attempt > 0 && showToasts) {
        toast.success(`✅ ${operationName} completada después de ${attempt} ${attempt === 1 ? 'reintento' : 'reintentos'}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      const isRateLimit = error?.message?.includes('Rate limit') || 
                         error?.message?.includes('rate limit') ||
                         error?.message?.includes('Too many requests');
      
      // Si es el último intento o no es rate limit, lanzar error
      if (attempt === maxRetries || !isRateLimit) {
        if (showToasts) {
          if (isRateLimit) {
            toast.error("⏳ Límite de solicitudes excedido", {
              description: "El sistema está ocupado. Por favor espera 30 segundos e intenta de nuevo.",
              duration: 5000
            });
          } else {
            toast.error(`Error en ${operationName}`, {
              description: error.message || "Ocurrió un error inesperado",
              duration: 4000
            });
          }
        }
        throw error;
      }
      
      // Calcular delay con backoff exponencial
      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
      const delaySeconds = Math.ceil(delay / 1000);
      
      if (showToasts) {
        toast.warning(`⏳ Reintentando ${operationName}...`, {
          description: `Intento ${attempt + 1}/${maxRetries}. Esperando ${delaySeconds}s`,
          duration: delay
        });
      }
      
      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} for ${operationName}. Waiting ${delaySeconds}s...`);
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
