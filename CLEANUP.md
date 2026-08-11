# Limpieza — Qué borrar del repo

## 🗑️ Archivos para BORRAR

### Test/Debug (No se usan en producción)

- [ ] **test-api-connection.js** → Testing conexión API (uso puntual, no recurrente)
- [ ] **test-dry-run.js** → Testing workflow (se usa en GitHub Actions, pero genera false positives; mejor remover y dejar lógica en analyze.js)
- [ ] **test-output.html** → Output de test (temporal, no necesario)

### Setup/Cron (Migrado a GitHub Actions)

- [ ] **setup-cron.sh** → Configuración cron local (ahora GitHub Actions maneja todo vía workflow)

### Helpers Obsoletos

- [ ] **reparse-cache.js** → Script antiguo, no se importa en nada

### Archivos Generados (No versionar)

- [ ] **latest-report.html** → Se regen cada semana, no vale la pena versionar
- [ ] **reports/*.html** (excepto últimos 3 meses) → Históricos puros, ocupan espacio

## ⚠️ Archivos para REVISAR

### .portfolio-snapshot.json
**Uso:** Backup mensual del total del portafolio
**Decisión:** Mantener (pequeño, útil para auditoría)

### reports/*.html (últimos 3 meses)
**Uso:** Histórico visual
**Decisión:** Mantener últimos 12 semanas, eliminar más viejos

## ✅ Archivos CRÍTICOS (Mantener siempre)

### Data
- portfolio.json → Fuente única de verdad
- history.json → Análisis semanal históricos
- dca-log.json → Bitácora DCA

### Code
- analyze.js → Lógica análisis (necesario para CI/CD)
- generate-report.js → HTML generator
- regenerate.js → Orquesta lectura + generación
- register-exit.js → Registro de ventas
- supabase-client.js → Cliente Supabase
- dca-log.js → Auto-bitácora

### Config
- package.json, package-lock.json
- .github/workflows/weekly-analysis.yml
- .gitignore

### Docs
- README.md, ARCHITECTURE.md, WORKFLOW.md, STACK.md

## 🔄 Plan de Limpieza

```bash
# 1. Borrar test/debug obsoletos
git rm test-api-connection.js test-dry-run.js test-output.html

# 2. Borrar setup-cron.sh (GitHub Actions es mejor)
git rm setup-cron.sh

# 3. Borrar helpers obsoletos
git rm reparse-cache.js

# 4. Borrar reportes muy viejos (mantener últimos 12 semanas)
git rm reports/report-2026-W24.html reports/report-2026-W26.html reports/report-2026-W27.html reports/report-2026-W29.html reports/report-2026-W30.html reports/report-2026-W31.html

# 5. Remover latest-report.html del versionado
# (seguirá siendo generado, pero no en git)
echo "latest-report.html" >> .gitignore
git rm --cached latest-report.html
git add .gitignore

# 6. Commit limpieza
git commit -m "chore: limpieza — remover test/setup scripts obsoletos"
git push
```

## 📊 Resultado

**Antes:**
```
34 archivos tracked
test-*.js (3 scripts obsoletos)
setup-cron.sh (1 script obsoleto)
reparse-cache.js (1 script obsoleto)
reports/*.html (8 reportes, muchos viejos)
latest-report.html versionado (innecesario)
```

**Después:**
```
25 archivos tracked (25% menos)
Cero scripts de test
Cero scripts de setup local
Solo últimos 3 reportes (12 semanas)
latest-report.html no versionado
```

## 🎯 Beneficios

✅ Repo más limpio y enfocado
✅ Claridad: solo lo que se usa en producción
✅ Menos ruido histórico
✅ Más fácil onboarding (menos archivos confusos)
