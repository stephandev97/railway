console.log("[PB HOOK] reward_claims hook LOADED");

onRecordBeforeCreateRequest(async (e) => {
  console.log("[HOOK deduct] fired");

  if (e.collection.name !== "reward_claims") return;

  // Esperamos status "pending" al crear
  const status = e.record.getString("status") || "pending";
  if (status !== "pending") e.record.set("status", "pending");

  const clientId = e.record.getString("client");
  const cost = e.record.getInt("pointsCost") || 0;

  if (!clientId) throw new Error("Falta client");
  if (cost <= 0) throw new Error("pointsCost inválido");

  const dao = $app.dao();
  const client = await dao.findRecordById("clients", clientId);

  const balance = client.getInt("pointsBalance") || 0;
  if (balance < cost) {
    throw new Error("Puntos insuficientes");
  }

  // Descontar una sola vez en el backend
  client.set("pointsBalance", balance - cost);
  await dao.saveRecord(client);

  // Aseguramos refundedAt vacío al crear
  e.record.set("refundedAt", null);
}, "reward_claims");
