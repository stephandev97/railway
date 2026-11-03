routerAdd("GET", "/api/pixel/push/public-key", function (c) {
  var key = String($os.getenv("VAPID_PUBLIC_KEY") || "");
  if (!key) return c.json(503, { error: "push-not-configured" });
  return c.json(200, { publicKey: key });
});

routerAdd("POST", "/api/pixel/push/register", function (c) {
  try {
    var push = require(__hooks + "/push_notifications.js");
    var device = push.saveDevice($apis.requestInfo(c).data || {});
    return c.json(200, { id: device.id, active: device.getBool("active") });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/watch", function (c) {
  try {
    var push = require(__hooks + "/push_notifications.js");
    var watcher = push.watchOrder($apis.requestInfo(c).data || {});
    return c.json(200, { id: watcher.id, active: watcher.getBool("active") });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/heartbeat", function (c) {
  try {
    var push = require(__hooks + "/push_notifications.js");
    var watcher = push.heartbeat($apis.requestInfo(c).data || {});
    return c.json(200, { id: watcher.id });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/opened", function (c) {
  try {
    var push = require(__hooks + "/push_notifications.js");
    push.markOpened($apis.requestInfo(c).data || {});
    return c.json(200, { ok: true });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/status", function (c) {
  if (!c.get("admin") && !c.get("authRecord")) return c.json(403, { error: "forbidden" });
  try {
    var push = require(__hooks + "/push_notifications.js");
    var data = $apis.requestInfo(c).data || {};
    return c.json(200, push.statusForOrder(String(data.orderCollection || ""), String(data.orderId || "")));
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

onRecordBeforeCreateRequest(function (e) {
  e.record.set("active", true);
  if (!e.record.getString("permission")) e.record.set("permission", "default");
  if (!e.record.getString("platform")) e.record.set("platform", "unknown");
  if (!e.record.getInt("failure_count")) e.record.set("failure_count", 0);
}, "push_devices");

onRecordBeforeCreateRequest(function (e) {
  e.record.set("active", true);
  e.record.set("notifications_enabled", true);
}, "order_watchers", "order_watches");

function notifyChangedOrder(e, collectionName) {
  try {
    var push = require(__hooks + "/push_notifications.js");
    // En PocketBase 0.22 `originalCopy()` no conserva de forma fiable el
    // valor previo dentro de los hooks AfterUpdateRequest. Eso hacÃ­a que el
    // hook saliera antes (o lanzara una excepciÃ³n) y nunca intentara enviar.
    // El request del POS ya indica explÃ­citamente si modificÃ³ progress/status.
    var data = $apis.requestInfo(e.httpContext).data || {};
    var changedProgress = Object.prototype.hasOwnProperty.call(data, "progress");
    var changedStatus = Object.prototype.hasOwnProperty.call(data, "status");
    if (!changedProgress && !changedStatus) return;

    var after = String(e.record.getString("progress") || e.record.getString("status") || "").toLowerCase();
    if (!after) return;
    var result = push.sendForOrder(e.record, collectionName);
    console.log("[push] " + collectionName + "/" + e.record.id + " " + after + ": " + JSON.stringify(result));
  } catch (error) {
    console.log("[push] No se pudo notificar " + collectionName + "/" + e.record.id + ": " + error);
  }
}

onRecordAfterUpdateRequest(function (e) {
  notifyChangedOrder(e, "orders");
}, "orders");

onRecordAfterUpdateRequest(function (e) {
  notifyChangedOrder(e, "orders_test");
}, "orders_test");
