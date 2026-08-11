# Arquitectura OOP/SOLID

## Estructura de Clases

```
src/
├── Portfolio.js              ← Modelo de datos
├── TransactionService.js     ← Comunicación Supabase
├── StorageService.js         ← Persistencia (JSON/API)
└── InvestmentManager.js      ← Orquestador (Facade)
```

---

## Principios SOLID Aplicados

### 1. **Single Responsibility Principle (SRP)**

Cada clase tiene UNA responsabilidad:

| Clase | Responsabilidad |
|-------|-----------------|
| **Portfolio** | Gestionar estado del portafolio (compra/venta) |
| **TransactionService** | Registrar transacciones en Supabase |
| **StorageService** | Guardar/cargar datos (JSON o API) |
| **InvestmentManager** | Coordinar las operaciones (orquestador) |

### 2. **Open/Closed Principle (OCP)**

- Las clases están **abiertas para extensión**, cerradas para **modificación**
- Ejemplo: `TransactionService` acepta un `supabaseClient` inyectado
  - Si Supabase no está disponible → funciona sin él
  - Si quieres cambiar a otra BD → solo reemplazas `TransactionService`

### 3. **Liskov Substitution Principle (LSP)**

- `StorageService` puede ser reemplazado por cualquier otra clase que tenga `loadPortfolio()` y `savePortfolio()`
- Los contratos están bien definidos

### 4. **Interface Segregation Principle (ISP)**

- Las clases exponen solo los métodos que necesitan
- Ejemplo: `Portfolio` no sabe sobre Supabase (no tiene métodos innecesarios)

### 5. **Dependency Inversion Principle (DIP)**

- `InvestmentManager` no depende de implementaciones concretas
- Depende de abstracciones: recibe `supabaseClient` inyectado
- Si quieres mockear en tests → pasas un mock

---

## Patrones Usados

### **Facade Pattern**
`InvestmentManager` es una fachada que simplifica la interfaz compleja:

```javascript
// Antes: sin Facade
portfolio.recordSell(...)
await supabase.insert(...)
await storage.save(...)

// Ahora: con Facade
manager.sellAsset(...) // todo coordinado adentro
```

### **Dependency Injection**
```javascript
// Los servicios reciben sus dependencias
const manager = new InvestmentManager(supabaseClient, apiBaseUrl);
```

### **Separation of Concerns**
- Datos: `Portfolio`
- Persistencia: `StorageService`
- Transacciones externas: `TransactionService`
- Coordinación: `InvestmentManager`

---

## Flujos Implementados

### Compra de Activo

```
UI (clickea "Registrar compra")
    ↓
InvestmentManager.buyAsset(ticker, qty, price, type)
    ├─ Portfolio.recordBuy(...) ← actualiza estado local
    ├─ TransactionService.recordPurchase(...) ← Supabase (si disponible)
    └─ StorageService.savePortfolio(...) ← persiste cambios
    ↓
Retorna: { nuevoSaldo, nuevoCostAvg }
    ↓
UI se recarga (ve cambios)
```

### Venta de Activo

```
UI (clickea "Registrar venta")
    ↓
InvestmentManager.sellAsset(ticker, qty, price, reason)
    ├─ Portfolio.recordSell(...) ← actualiza estado, calcula P&L
    ├─ TransactionService.recordSale(...) ← Supabase (si disponible)
    └─ StorageService.savePortfolio(...) ← persiste cambios
    ↓
Retorna: { montoBruto, gananciaBruta, gananciaPct, nuevoSaldo }
    ↓
UI muestra resultado + recarga
```

---

## Ventajas de esta Estructura

✅ **Fácil de testear**: Cada clase se prueba independientemente  
✅ **Fácil de mantener**: Cambios aislados en una clase  
✅ **Fácil de extender**: Agregar nuevas fuentes de datos sin tocar lógica  
✅ **Fácil de debuggear**: Responsabilidades claras  
✅ **Reutilizable**: Las clases pueden usarse en otros proyectos  

---

## Ejemplo de Uso

```javascript
import { InvestmentManager } from './src/InvestmentManager.js';

// Inicializar
const manager = new InvestmentManager(supabaseClient, 'http://localhost:3000');
await manager.initialize();

// Comprar
const buyResult = await manager.buyAsset('NVDA', 1.5, 130, 'stocks', 'IA dominance');
console.log(buyResult); // { nuevoSaldo: 2.60855, nuevoCostAvg: 125.5 }

// Vender
const sellResult = await manager.sellAsset('NVDA', 0.5, 150, 'Toma de ganancias', 'Ganancia buena');
console.log(sellResult); // { montoBruto: 75, gananciaBruta: 15.45, gananciaPct: 25.96, nuevoSaldo: 2.10855 }

// Exportar estado
const state = manager.export();
```

---

## Próximos Pasos

- [ ] Refactorizar `generate-report.js` para usar `InvestmentManager`
- [ ] Crear tests unitarios para cada clase
- [ ] Crear `ValidationService` para validar datos entrada
- [ ] Crear `CalculationService` para cálculos financieros complejos
