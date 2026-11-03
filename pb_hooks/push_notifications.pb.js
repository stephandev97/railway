var push = require(__hooks + "/push_notifications.js");

routerAdd("GET", "/api/pixel/push/public-key", function (c) {
  var key = String($os.getenv("VAPID_PUBLIC_KEY") || "");
  if (!key) return c.json(503, { error: "push-not-configured" });
  return c.json(200, { publicKey: key });
});

routerAdd("POST", "/api/pixel/push/register", function (c) {
  try {
    var device = push.saveDevice($apis.requestInfo(c).data || {});
    return c.json(200, { id: device.id, active: device.getBool("active") });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/watch", function (c) {
  try {
    var watcher = push.watchOrder($apis.requestInfo(c).data || {});
    return c.json(200, { id: watcher.id, active: watcher.getBool("active") });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/heartbeat", function (c) {
  try {
    var watcher = push.heartbeat($apis.requestInfo(c).data || {});
    return c.json(200, { id: watcher.id });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/opened", function (c) {
  try {
    push.markOpened($apis.requestInfo(c).data || {});
    return c.json(200, { ok: true });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});

routerAdd("POST", "/api/pixel/push/status", function (c) {
  if (!c.get("admin") && !c.get("authRecord")) return c.json(403, { error: "forbidden" });
  try {
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
    var previous = e.record.originalCopy();
    var before = String(previous.getString("progress") || previous.getString("status") || "").toLowerCase();
    var after = String(e.record.getString("progress") || e.record.getString("status") || "").toLowerCase();
    if (!after || before === after) return;
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
