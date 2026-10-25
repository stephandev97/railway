// PocketBase 0.22.x. Ejecutado exclusivamente en el servidor del POS.
module.exports = {
  credit: function (order) {
    if (order.getString("source") !== "app" || order.getBool("pointsClaimed")) return;
    if (["delivered", "pickedup"].indexOf(order.getString("progress")) < 0) return;
    var owner = /^test:([a-z0-9]{15}):\d+$/.exec(order.getString("clientCreatedAt"));
    var points = Math.floor(order.getInt("points"));
    if (!owner || points <= 0) return;
    var secret = $os.getenv("POINTS_BRIDGE_SECRET");
    var base = $os.getenv("PWA_POINTS_URL");
    if (!secret || !/^https:\/\//.test(base)) {
      throw new Error("Configurar POINTS_BRIDGE_SECRET y PWA_POINTS_URL (HTTPS)");
    }
    var response = $http.send({
      url: base.replace(/\/$/, "") + "/api/pixel/internal/test-order-points",
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Pixel-Points-Key": secret },
      body: JSON.stringify({ orderId: order.id, clientId: owner[1], points: points }),
      timeout: 15,
    });
    if (response.statusCode !== 200 || !response.json || response.json.success !== true) {
      // No registrar el secreto ni el cuerpo con datos del cliente.
      throw new Error("El backend de puntos rechazó el pedido " + order.id + " (HTTP " + response.statusCode + ")");
    }
    // Si esta escritura falla, el cron reintenta; el receptor no vuelve a sumar.
    var latest = $app.dao().findRecordById("orders_test", order.id);
    latest.set("pointsClaimed", true);
    $app.dao().saveRecord(latest);
  },
};
