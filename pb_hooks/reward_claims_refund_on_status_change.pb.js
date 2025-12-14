console.log("[PB HOOK] refund hook loaded");

onRecordAfterUpdateRequest(async (e) => {
  if (e.collection.name !== "reward_claims") return;

  const dao = $app.dao();

  try {
    const id = e.record.id;
    const newStatus = e.record.getString("status") || "";
    const clientId = e.record.getString("client") || "";
    const refund = e.record.getInt("pointsCost") || 0;

    const refundApplied = !!e.record.getBool("refundApplied");

    console.log(
      "[HOOK refund] fired " +
        JSON.stringify({ id, newStatus, clientId, refund, refundApplied })
    );

    // Solo si termina en cancelled/expired
    if (newStatus !== "cancelled" && newStatus !== "expired") {
      console.log("[HOOK refund] skip: status not refundable");
      return;
    }

    if (!clientId) {
      console.log("[HOOK refund] skip: missing clientId");
      return;
    }
    if (refund <= 0) {
      console.log("[HOOK refund] skip: refund <= 0");
      return;
    }
    if (refundApplied) {
      console.log("[HOOK refund] skip: already applied");
      return;
    }

    // 1) Devolver puntos al cliente
    const client = await dao.findRecordById("clients", clientId);
    const balance = client.getInt("pointsBalance") || 0;
    client.set("pointsBalance", balance + refund);
    await dao.saveRecord(client);

    // 2) Marcar el claim como reembolsado (refetch del record)
    const claim = await dao.findRecordById("reward_claims", id);
    claim.set("refundApplied", true);
    claim.set("refundedAt", new Date().toISOString()); // opcional
    await dao.saveRecord(claim);

    console.log("[HOOK refund] OK: refunded " + refund);
  } catch (err) {
    console.log("[HOOK refund] ERROR " + err);
  }
}, "reward_claims");
