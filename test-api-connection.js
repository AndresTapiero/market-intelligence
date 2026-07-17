#!/usr/bin/env node
/**
 * test-api-connection.js
 * Prueba MINIMA de conectividad real con la API de Anthropic.
 * Llamada muy pequeña (sin web search, sin analisis completo) solo para
 * confirmar que el modelo y la autenticacion funcionan.
 * Costo estimado: < $0.001 USD (fraccion de centavo).
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

async function main() {
  console.log("\n🔌 Probando conexión real con la API de Anthropic...");
  console.log(`   Modelo: ${MODEL}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("\n❌ ANTHROPIC_API_KEY no está configurada en esta terminal.");
    console.log("   Ejecuta: export ANTHROPIC_API_KEY=sk-ant-...");
    process.exit(1);
  }

  try {
    const client = new Anthropic();
    const start = Date.now();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 20,
      messages: [{ role: "user", content: "Responde unicamente con la palabra OK." }],
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();

    console.log(`\n✅ Conexión exitosa en ${elapsed}s`);
    console.log(`   Modelo confirmado: ${response.model}`);
    console.log(`   Respuesta: "${text}"`);
    console.log(`   Tokens usados: ${response.usage.input_tokens} entrada / ${response.usage.output_tokens} salida`);
    console.log(`   Costo estimado: < $0.001 USD\n`);
    console.log("El modelo claude-sonnet-5 esta funcionando correctamente.");
    console.log("Ya puedes correr node analyze.js con confianza.\n");
  } catch (err) {
    console.log(`\n❌ Error de conexión: ${err.message}`);
    if (err.status) console.log(`   Status HTTP: ${err.status}`);
    if (err.message.includes("model")) {
      console.log("\n⚠️  Posible causa: el nombre del modelo no es válido o no tienes acceso a él.");
    }
    if (err.message.includes("authentication") || err.status === 401) {
      console.log("\n⚠️  Posible causa: la API key es inválida o expiró.");
    }
    process.exit(1);
  }
}

main();
