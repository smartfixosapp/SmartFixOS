#!/bin/bash
# =============================================================================
# SmartFixOS — Deploy Script
# Empuja cambios a GitHub Y actualiza el servidor de producción
#
# CONFIGURACIÓN: Edita las 3 variables de abajo antes de usar
# =============================================================================

SSH_HOST="app-6504.ownmy.app"     # IP o hostname del servidor
SSH_USER="ubuntu"                  # Usuario SSH (cambia si es diferente)
SSH_PATH="/opt/smartfixos"         # Ruta del proyecto en el servidor (ajusta si es diferente)
# SSH_KEY="~/.ssh/id_rsa"          # Descomenta y ajusta si usas una llave específica

# =============================================================================
# NO modificar debajo de esta línea
# =============================================================================

set -e

BRANCH="${1:-main}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()  { echo -e "${BLUE}[deploy]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# SSH options
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
# [ -n "$SSH_KEY" ] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  SmartFixOS — Deploy a producción${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Verificar que hay cambios para pushear
log "Verificando estado del repositorio..."
STATUS=$(git -C "$(dirname "$0")" status --porcelain)
if [ -n "$STATUS" ]; then
    warn "Hay cambios sin commitear. Haz commit primero."
    git -C "$(dirname "$0")" status --short
    echo ""
    read -p "¿Continuar de todas formas? (s/N): " CONFIRM
    [[ "$CONFIRM" =~ ^[sS]$ ]] || err "Deploy cancelado."
fi

# 2. Push a GitHub
log "Pusheando rama '${BRANCH}' a GitHub..."
git -C "$(dirname "$0")" push origin "$BRANCH" && ok "Push completado" || err "Falló el push a GitHub"

# 3. Conectar al servidor y actualizar
log "Conectando a ${SSH_USER}@${SSH_HOST}..."
ssh $SSH_OPTS "${SSH_USER}@${SSH_HOST}" bash <<REMOTE
  set -e
  echo ""
  echo "=== Servidor: actualizando código ==="

  # Ir al directorio del proyecto
  cd "${SSH_PATH}" || { echo "Error: no existe ${SSH_PATH}"; exit 1; }

  # Guardar qué había en package.json antes
  OLD_HASH=\$(md5sum apps/Smart/package.json 2>/dev/null | cut -d' ' -f1 || echo "none")

  # Pull del código nuevo
  echo "📥 git pull origin ${BRANCH}..."
  git pull origin "${BRANCH}"

  # Ver si cambió package.json
  NEW_HASH=\$(md5sum apps/Smart/package.json 2>/dev/null | cut -d' ' -f1 || echo "none")

  if [ "\$OLD_HASH" != "\$NEW_HASH" ]; then
    echo "📦 package.json cambió — instalando dependencias..."
    cd apps/Smart && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    cd - > /dev/null
    NEED_RESTART=true
  else
    echo "📦 No hay cambios en dependencias"
    NEED_RESTART=false
  fi

  # Reiniciar servicios si es necesario
  if [ "\$NEED_RESTART" = "true" ]; then
    echo "🔄 Reiniciando servicios..."

    # Matar Vite dev server
    pkill -f "vite" 2>/dev/null && echo "  Vite detenido" || echo "  Vite ya estaba detenido"
    # Matar Deno functions server
    pkill -f "deno.*8686" 2>/dev/null && echo "  Deno detenido" || echo "  Deno ya estaba detenido"

    sleep 2

    # Reiniciar con start.sh en background
    cd "${SSH_PATH}/apps/Smart"
    nohup bash start.sh > /tmp/smartfixos_start.log 2>&1 &
    echo "  Servicios reiniciados (PID: \$!)"
    sleep 3
    echo "  Log: tail -f /tmp/smartfixos_start.log"
  else
    echo "✅ Vite HMR detectará los cambios automáticamente"
  fi

  echo ""
  echo "✅ Servidor actualizado correctamente"
  echo "🌐 https://app-6504.ownmy.app"
REMOTE

echo ""
ok "Deploy completado 🚀"
echo ""
echo -e "  ${BLUE}🌐 https://app-6504.ownmy.app${NC}"
echo ""
