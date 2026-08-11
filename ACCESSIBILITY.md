# Accesibilidad — Mejoras Web Interface Guidelines

## ⚠️ Issues Encontrados

### 1. **Tab Buttons sin aria-label** (Moderate)
**Ubicación:** generate-report.js línea ~1100 (renderizado HTML línea ~418-421)

```html
<!-- ❌ Actual -->
<button class="tab-btn active" onclick="switchTab('tab-dashboard')">📊 Dashboard</button>
<button class="tab-btn" onclick="switchTab('tab-diario')">📓 Diario de Inversiones</button>

<!-- ✅ Mejora -->
<button class="tab-btn active" onclick="switchTab('tab-dashboard')" aria-label="Dashboard Ejecutivo" aria-selected="true">📊 Dashboard</button>
<button class="tab-btn" onclick="switchTab('tab-diario')" aria-label="Diario de Inversiones" aria-selected="false">📓 Diario</button>
```

**Por qué:** El emoji solo no es suficiente para screen readers. Usuarios ciegos necesitan saber qué hace cada tab.

---

### 2. **Buttons sin visible focus states** (Moderate)
**Ubicación:** generate-report.js CSS (línea ~850+)

```css
/* ❌ Actual */
.tab-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 14px 20px;
  /* ... sin focus-visible ... */
}

/* ✅ Mejora */
.tab-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 14px 20px;
  transition: color 0.2s, border-bottom-color 0.2s;
}

.tab-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
```

**Por qué:** Usuarios navegando con teclado (Tab) necesitan ver dónde está el foco. WCAG 2.4.7.

---

### 3. **Tab buttons sin keyboard navigation** (Moderate)
**Ubicación:** generate-report.js función switchTab() (línea ~1750+)

```javascript
/* ❌ Actual */
function switchTab(tabId) {
  document.querySelectorAll('.tabs-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  event.target.classList.add('active');
}

/* ✅ Mejora */
function switchTab(tabId, event) {
  if (event && event.type === 'keydown') {
    const key = event.key;
    const buttons = Array.from(document.querySelectorAll('.tab-btn'));
    const current = buttons.indexOf(event.target);
    
    let next = current;
    if (key === 'ArrowRight') next = (current + 1) % buttons.length;
    if (key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    
    if (next !== current) {
      buttons[next].focus();
      event.preventDefault();
      return;
    }
  }
  
  document.querySelectorAll('.tabs-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  event.target.classList.add('active');
}

// En HTML:
// <button class="tab-btn" onclick="switchTab('tab-dashboard', event)" onKeyDown="switchTab('tab-dashboard', event)">
```

**Por qué:** ARIA Authoring Practices recomienda Arrows para navegar tabs (ArrowLeft, ArrowRight).

---

### 4. **Modal sin role="dialog" o aria-modal** (Moderate)
**Ubicación:** generate-report.js línea ~1350+

```html
<!-- ❌ Actual -->
<div class="modal-overlay" id="buyModalOverlay" onclick="if(event.target===this)closeBuyModal()">
  <div class="modal-card">
    <div class="modal-header">...</div>

<!-- ✅ Mejora -->
<div class="modal-overlay" id="buyModalOverlay" onclick="if(event.target===this)closeBuyModal()" role="presentation" aria-hidden="false">
  <div class="modal-card" role="dialog" aria-labelledby="buyModalTitle" aria-modal="true">
    <div class="modal-header">
      <div class="modal-title" id="buyModalTitle">📥 Registrar nueva compra</div>
```

**Por qué:** Screen readers necesitan saber que es un modal (diálogo) para gestionar focus y anuncio.

---

### 5. **Buttons Action sin confirm/undo** (Low)
**Ubicación:** generate-report.js (todos los buttons)

```javascript
/* ✅ Mejor patrón (para futuro) */
// Para acciones destructivas (compra, venta), agregar:
const confirmAction = (actionName, callback) => {
  const confirmed = confirm(`¿Confirmar ${actionName}? Esta acción no se puede deshacer.`);
  if (confirmed) callback();
};

// Uso:
// <button onclick="confirmAction('venta de NVDA', () => register_exit('NVDA'))">
```

**Por qué:** Aunque tus modales ya tienen un paso de confirmación, es buena práctica explícita.

---

## ✅ Lo que ya está bien

| Aspecto | Estado | Razón |
|---------|--------|-------|
| **Semantic HTML** | ✅ OK | Usa `<button>` no `<div onClick>` |
| **Labels en Forms** | ✅ OK | Modal tiene `<label>` con `htmlFor` |
| **Color Contrast** | ✅ OK | Dark mode con suficiente contraste |
| **Autocomplete** | ✅ OK | Inputs tienen `autocomplete` |
| **Error Handling** | ✅ OK | Validación inline en modal |
| **No distracting animations** | ✅ OK | Transiciones suaves, respetuosas |
| **Copy clarity** | ✅ OK | Botones específicos: "Registrar compra", "PDF" |

---

## 🎯 Prioridad de Fixes

### P0 (Crítico)
- [ ] Agregar `aria-label` a tab buttons

### P1 (Alto)
- [ ] Agregar `:focus-visible` styles a buttons/interactive
- [ ] Agregar `onKeyDown` a tab navigation (arrows)
- [ ] Modal: agregar `role="dialog"` + `aria-modal="true"`

### P2 (Medio)
- [ ] Destructive actions: agregar confirm explícito
- [ ] Agregar `aria-live="polite"` para validación modal (opcional)

---

## 📋 Checklist WCAG 2.1 AA

| Level | Criterio | Status | Notes |
|-------|----------|--------|-------|
| A | 1.4.3 Contrast (Min) | ✅ | Dark mode OK |
| AA | 2.4.3 Focus Order | ⚠️ | Tab buttons OK, pero sin focus-visible |
| AA | 2.4.7 Focus Visible | ⚠️ | Agregar outline/border en :focus-visible |
| AA | 3.2.1 On Focus | ✅ | No hay cambios inesperados en focus |
| A | 4.1.2 Name, Role, Value | ⚠️ | Tab buttons necesitan aria-label |
| AA | 2.1.1 Keyboard | ⚠️ | Tabs no navegables con arrows |

---

## 📚 Referencias

- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
- [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices - Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [MDN: :focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible)
