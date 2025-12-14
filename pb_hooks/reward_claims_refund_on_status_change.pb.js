onRecordAfterUpdate(async (e) => {
  if (e.collection.name !== "reward_claims") return;

  const dao = $app.dao();

  // estado anterior vs nuevo
  const old = e.record.original();
  const oldStatus = old ? old.getString("status") || "" : "";
  const newStatus = e.record.getString("status") || "";

  // solo si pasó de pending -> expired/cancelled
  const becameRefundable =
    oldStatus === "pending" &&
    (newStatus === "expired" || newStatus === "cancelled");

  if (!becameRefundable) return;

  // idempotencia: si ya devolvimos, salimos
  const refundedAt = e.record.getDateTime("refundedAt");
  if (refundedAt) return;

  const clientId = e.record.getString("client");
  const refund = e.record.getInt("pointsCost") || 0;

  if (!clientId || refund <= 0) return;

  const client = await dao.findRecordById("clients", clientId);
  const balance = client.getInt("pointsBalance") || 0;

  // Devolver puntos (una sola vez)
  client.set("pointsBalance", balance + refund);
  await dao.saveRecord(client);

  // Marcar como ya reembolsado
  e.record.set("refundedAt", new Date().toISOString());
  await dao.saveRecord(e.record);
}, "reward_claims");
