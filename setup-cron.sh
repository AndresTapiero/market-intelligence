#!/bin/bash
# setup-cron.sh
# Configura el cron job para correr el análisis cada lunes a las 7:00 AM

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PATH="$(which node)"
LOG_FILE="$SCRIPT_DIR/logs/cron.log"

# Crear carpeta de logs
mkdir -p "$SCRIPT_DIR/logs"

echo ""
echo "⚙️  Configurando Market Intelligence — Tarea Semanal"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar que existe la API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ Error: ANTHROPIC_API_KEY no está configurada."
  echo ""
  echo "Agrégala a tu shell añadiendo esta línea a ~/.zshrc o ~/.bash_profile:"
  echo ""
  echo "  export ANTHROPIC_API_KEY=\"sk-ant-tu-key-aqui\""
  echo ""
  echo "Luego ejecuta:  source ~/.zshrc  y vuelve a correr este script."
  exit 1
fi

echo "✅ ANTHROPIC_API_KEY detectada"
echo "✅ Node.js: $NODE_PATH"
echo "✅ Proyecto: $SCRIPT_DIR"
echo ""

# Crear el wrapper script que cron usará (con variables de entorno)
WRAPPER="$SCRIPT_DIR/run-weekly.sh"
cat > "$WRAPPER" << EOF
#!/bin/bash
# Auto-generado por setup-cron.sh — no editar manualmente
export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
export PATH="$(dirname $NODE_PATH):\$PATH"
cd "$SCRIPT_DIR"
$NODE_PATH analyze.js >> "$LOG_FILE" 2>&1
EOF
chmod +x "$WRAPPER"
echo "✅ Wrapper creado: run-weekly.sh"

# Definir la entrada cron: lunes a las 7:00 AM
CRON_ENTRY="0 7 * * 1 $WRAPPER"

# Verificar si ya existe para no duplicar
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

if echo "$CURRENT_CRON" | grep -q "market-intelligence"; then
  echo ""
  echo "⚠️  Ya existe una entrada de market-intelligence en crontab."
  echo "   Reemplazando con la nueva configuración..."
  NEW_CRON=$(echo "$CURRENT_CRON" | grep -v "market-intelligence")
  (echo "$NEW_CRON"; echo "$CRON_ENTRY # market-intelligence") | crontab -
else
  (echo "$CURRENT_CRON"; echo "$CRON_ENTRY # market-intelligence") | crontab -
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cron job configurado exitosamente"
echo ""
echo "  📅 Horario: Cada LUNES a las 7:00 AM"
echo "  📂 Reportes: $SCRIPT_DIR/reports/"
echo "  📋 Logs:     $LOG_FILE"
echo ""
echo "Para verificar que quedó bien:"
echo "  crontab -l | grep market-intelligence"
echo ""
echo "Para correr manualmente ahora:"
echo "  node analyze.js"
echo ""
echo "Para ver los logs del cron:"
echo "  tail -f $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
