#!/usr/bin/env node
/**
 * dev-server.js
 * Servidor local para transacciones (compra/venta)
 * Actualiza portfolio.json + Supabase automáticamente
 *
 * Uso:
 *   node dev-server.js
 *   # Luego: http://localhost:3000/reports/report-YYYY-WXX.html
 */

import http from "http";
import fs from "fs";
import path from "path";
import url from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = 3000;

let insertExitEntry = null;

// Cargar Supabase si está disponible
try {
  const supabase = await import("./supabase-client.js");
  insertExitEntry = supabase.insertExitEntry;
  console.log("✅ Supabase integrado");
} catch (err) {
  console.warn("⚠️  Supabase no disponible — solo portfolio.json será actualizado");
  insertExitEntry = async () => ({ id: "local-" + Date.now() });
}

function loadPortfolio() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "portfolio.json"), "utf8"));
}

function savePortfolio(data) {
  fs.writeFileSync(path.join(__dirname, "portfolio.json"), JSON.stringify(data, null, 2));
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }

    let contentType = "text/html";
    if (filePath.endsWith(".css")) contentType = "text/css";
    if (filePath.endsWith(".js")) contentType = "application/javascript";
    if (filePath.endsWith(".json")) contentType = "application/json";
    if (filePath.endsWith(".svg")) contentType = "image/svg+xml";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: Registrar venta
  if (req.method === "POST" && req.url === "/api/register-exit") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { ticker, quantity, price, reason, observations } = JSON.parse(body);

        if (!ticker || !quantity || !price) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Faltan datos requeridos" }));
          return;
        }

        const portfolio = loadPortfolio();
        const tickerLower = ticker.toLowerCase();
        const stock = portfolio.stocks?.[tickerLower];
        const crypto = portfolio.crypto?.[tickerLower];
        const asset = stock || crypto;

        if (!asset) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `No encontré ${ticker} en portafolio` }));
          return;
        }

        const isCrypto = !!crypto;
        const currentQty = isCrypto ? asset.qty : asset.shares;
        const costAvg = asset.costAvg;

        if (quantity <= 0 || quantity > currentQty) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Cantidad inválida (tienes ${currentQty})` }));
          return;
        }

        // Calcular P&L
        const montoBruto = quantity * price;
        const costoBase = quantity * costAvg;
        const gananciaBruta = montoBruto - costoBase;
        const gananciaPct = costAvg > 0 ? ((gananciaBruta / costoBase) * 100).toFixed(2) : "0";

        // Registrar en Supabase
        const exitEntry = {
          user_id: "56272fef-8fd2-4adf-af86-ff9ed10cbed1",
          fecha_salida: new Date().toISOString().split("T")[0],
          ticker: ticker.toUpperCase(),
          numero_acciones_vendidas: quantity,
          precio_salida: price,
          monto_bruto: montoBruto,
          costo_base: costoBase,
          ganancia_bruta: gananciaBruta,
          ganancia_pct: parseFloat(gananciaPct),
          razon_venta: reason || "Otro",
          observaciones: observations || null,
        };

        try {
          const inserted = await insertExitEntry(exitEntry);
          console.log(`✅ Venta ${ticker}: ${quantity} a $${price} (${gananciaPct}%)`);
        } catch (err) {
          console.warn("⚠️  No se registró en Supabase:", err.message);
        }

        // Actualizar portfolio.json
        const newQty = currentQty - quantity;
        if (isCrypto) {
          portfolio.crypto[tickerLower].qty = parseFloat(newQty.toFixed(8));
        } else {
          portfolio.stocks[tickerLower].shares = parseFloat(newQty.toFixed(8));
        }

        portfolio._updated = new Date().toISOString().split("T")[0];
        savePortfolio(portfolio);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          message: `Venta registrada: ${quantity} ${ticker} a $${price}`,
          ganancia_pct: gananciaPct,
          nuevo_saldo: newQty,
        }));
      } catch (err) {
        console.error("Error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Registrar compra
  if (req.method === "POST" && req.url === "/api/register-entry") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const { ticker, quantity, price, type, fundamento } = JSON.parse(body);
        const portfolio = loadPortfolio();
        const tickerLower = ticker.toLowerCase();
        const isCrypto = type === "crypto";
        const key = tickerLower;
        const qtyField = isCrypto ? "qty" : "shares";
        const section = isCrypto ? "crypto" : "stocks";

        const existing = portfolio[section][key];
        const oldQty = existing ? existing[qtyField] : 0;
        const oldCostAvg = existing ? existing.costAvg : 0;

        const newQty = parseFloat((oldQty + quantity).toFixed(8));
        const newCostAvg = oldQty > 0 ? parseFloat((((oldQty * oldCostAvg) + (quantity * price)) / newQty).toFixed(6)) : price;

        if (!portfolio[section][key]) {
          portfolio[section][key] = {};
        }

        portfolio[section][key][qtyField] = newQty;
        portfolio[section][key].costAvg = newCostAvg;
        if (fundamento) portfolio[section][key].fundamento = fundamento;

        portfolio._updated = new Date().toISOString().split("T")[0];
        savePortfolio(portfolio);

        console.log(`✅ Compra ${ticker}: ${quantity} a $${price}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          message: `Compra registrada: ${quantity} ${ticker} a $${price}`,
          nuevo_saldo: newQty,
          nuevo_costAvg: newCostAvg,
        }));
      } catch (err) {
        console.error("Error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Servir archivos estáticos
  const reqPath = req.url.split("?")[0];
  let filePath = path.join(__dirname, reqPath === "/" ? "latest-report.html" : reqPath);

  if (!filePath.includes(".")) {
    filePath += ".html";
  }

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`\n✅ Dev server corriendo en http://localhost:${PORT}`);
  console.log(`\n📊 Abre en navegador:`);
  console.log(`   http://localhost:${PORT}\n`);
});
