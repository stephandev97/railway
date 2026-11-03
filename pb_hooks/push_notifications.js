var ALLOWED_COLLECTIONS = { orders: true, orders_test: true };
var ALLOWED_PERMISSIONS = {
  granted: true,
  default: true,
  denied: true,
  unsupported: true,
  needs_ios_install: true,
};

function now() {
  return new Date().toISOString();
}

function outputToString(output) {
  if (typeof output === "string") return output;
  return String.fromCharCode.apply(null, output || []);
}

function firstRecord(collection, filter, params) {
  var rows = $app.dao().findRecordsByFilter(collection, filter, "", 1, 0, params || {});
  return rows.length ? rows[0] : null;
}

function watchersCollection() {
  try {
    $app.dao().findCollectionByNameOrId("order_watchers");
    return "order_watchers";
  } catch (_) {
    $app.dao().findCollectionByNameOrId("order_watches");
    return "order_watches";
  }
}

function validDeviceId(value) {
  return /^[a-zA-Z0-9_-]{8,100}$/.test(String(value || ""));
}

function validRecordId(value) {
  return /^[a-z0-9]{15}$/.test(String(value || ""));
}

function saveDevice(data) {
  var deviceId = String(data.deviceId || data.device_id || "");
  if (!validDeviceId(deviceId)) throw new Error("invalid-device-id");

  var permission = String(data.permission || "default");
  if (!ALLOWED_PERMISSIONS[permission]) permission = "default";

  var subscription = data.subscription || {};
  var keys = subscription.keys || {};
  var endpoint = String(subscription.endpoint || data.endpoint || "");
  var p256dh = String(keys.p256dh || data.p256dh || "");
  var authKey = String(keys.auth || data.authKey || data.auth_key || "");
  if (endpoint && endpoint.indexOf("https://") !== 0) throw new Error("invalid-endpoint");

  var device = firstRecord("push_devices", "device_id = {:deviceId}", { deviceId: deviceId });
  if (!device) device = new Record($app.dao().findCollectionByNameOrId("push_devices"));

  device.set("device_id", deviceId);
  device.set("client_id", String(data.clientId || data.client_id || ""));
  device.set("permission", permission);
  device.set("platform", String(data.platform || "unknown"));
  device.set("standalone", Boolean(data.standalone));
  device.set("last_seen", now());

  if (endpoint) {
    device.set("endpoint", endpoint);
    device.set("p256dh", p256dh);
    device.set("auth_key", authKey);
  }

  var usable = permission === "granted" && Boolean(endpoint && p256dh && authKey);
  device.set("active", usable);
  if (usable) {
    device.set("last_error", "");
    device.set("failure_count", 0);
  }
  $app.dao().saveRecord(device);
  return device;
}

function watchOrder(data) {
  var collectionName = String(data.orderCollection || data.order_collection || "");
  var orderId = String(data.orderId || data.order_id || "");
  var deviceId = String(data.deviceId || data.device_id || "");
  if (!ALLOWED_COLLECTIONS[collectionName] || !validRecordId(orderId)) throw new Error("invalid-order");

  // Los IDs de PocketBase son aleatorios; el ID funciona como capacidad para invitados.
  $app.dao().findRecordById(collectionName, orderId);
  var device = firstRecord("push_devices", "device_id = {:deviceId}", { deviceId: deviceId });
  if (!device) throw new Error("device-not-registered");

  var watcher = firstRecord(
    watchersCollection(),
    "order_collection = {:collection} && order_id = {:orderId} && device = {:deviceId}",
    { collection: collectionName, orderId: orderId, deviceId: device.id },
  );
  if (!watcher) watcher = new Record($app.dao().findCollectionByNameOrId(watchersCollection()));

  watcher.set("order_collection", collectionName);
  watcher.set("order_id", orderId);
  watcher.set("device", device.id);
  watcher.set("notifications_enabled", data.notificationsEnabled !== false);
  watcher.set("active", true);
  watcher.set("last_seen", now());
  $app.dao().saveRecord(watcher);

  device.set("last_seen", now());
  $app.dao().saveRecord(device);
  return watcher;
}

function heartbeat(data) {
  var collectionName = String(data.orderCollection || data.order_collection || "");
  var orderId = String(data.orderId || data.order_id || "");
  var deviceId = String(data.deviceId || data.device_id || "");
  if (!ALLOWED_COLLECTIONS[collectionName] || !validRecordId(orderId)) throw new Error("invalid-order");
  var device = firstRecord("push_devices", "device_id = {:deviceId}", { deviceId: deviceId });
  if (!device) throw new Error("device-not-registered");
  var watcher = firstRecord(
    watchersCollection(),
    "order_collection = {:collection} && order_id = {:orderId} && device = {:deviceId}",
    { collection: collectionName, orderId: orderId, deviceId: device.id },
  );
  if (!watcher) throw new Error("watcher-not-found");
  watcher.set("last_seen", now());
  $app.dao().saveRecord(watcher);
  device.set("last_seen", now());
  $app.dao().saveRecord(device);
  return watcher;
}

function markOpened(data) {
  var watcherId = String(data.watcherId || data.watcher_id || "");
  var deviceId = String(data.deviceId || data.device_id || "");
  if (!validRecordId(watcherId) || !validDeviceId(deviceId)) throw new Error("invalid-open-event");

  var watcher = $app.dao().findRecordById(watchersCollection(), watcherId);
  var device = $app.dao().findRecordById("push_devices", watcher.getString("device"));
  if (device.getString("device_id") !== deviceId) throw new Error("device-mismatch");

  watcher.set("last_opened_notification", now());
  watcher.set("last_seen", now());
  $app.dao().saveRecord(watcher);
  device.set("last_seen", now());
  $app.dao().saveRecord(device);
  return watcher;
}

function notificationFor(order, status) {
  var delivery = String(order.getString("mode") || "").toLowerCase() === "delivery";
  var messages = {
    revision: ["Pedido recibido", "Estamos revisando tu pedido y te avisaremos cuando comience la preparación."],
    received: ["Pedido confirmado", "Recibimos tu pedido. Te avisaremos cuando comience la preparación."],
    preparing: ["Pedido en preparación", "Ya estamos preparando tu pedido."],
    dispatched: ["¡Pedido en camino!", "El delivery ya tiene tu pedido y va hacia tu domicilio."],
    ready: ["¡Listo para retirar!", "Tu pedido ya está listo. Podés acercarte al local."],
    delivered: ["Pedido entregado", "¡Que lo disfrutes! Gracias por elegir Pixel."],
    pickedup: ["Pedido entregado", "¡Que lo disfrutes! Gracias por elegir Pixel."],
  };
  var selected = messages[status];
  if (!selected) return null;
  if (!delivery && status === "dispatched") selected = messages.ready;
  return { title: "Pixel · " + selected[0], body: selected[1] };
}

function publicBaseUrl() {
  var configured = String($os.getenv("PUSH_PUBLIC_URL") || "").replace(/\/$/, "");
  return configured || "https://railway-production-857d.up.railway.app";
}

function sendToDevice(device, watcher, order, collectionName, message) {
  var request = {
    endpoint: device.getString("endpoint"),
    p256dh: device.getString("p256dh"),
    auth: device.getString("auth_key"),
    ttl: 300,
    urgency: "high",
    payload: {
      title: message.title,
      body: message.body,
      icon: "/logonuevowine.png",
      badge: "/icon-192.svg",
      tag: "pixel-order-" + collectionName + "-" + order.id,
      url: "/pedir",
      watcherId: watcher.id,
      deviceId: device.getString("device_id"),
      callbackUrl: publicBaseUrl() + "/api/pixel/push/opened",
    },
  };

  var command = $os.cmd("node", "/srv/push_sender/send.cjs");
  command.env = command.environ().concat(["PIXEL_PUSH_REQUEST=" + JSON.stringify(request)]);
  var parsed;
  try {
    parsed = JSON.parse(outputToString(command.output()).trim());
  } catch (error) {
    parsed = { ok: false, statusCode: 0, error: String(error) };
  }

  if (parsed.ok) {
    device.set("last_success", now());
    device.set("last_error", "");
    device.set("failure_count", 0);
    device.set("active", true);
  } else {
    var failures = Number(device.getInt("failure_count") || 0) + 1;
    device.set("last_failure", now());
    device.set("last_error", String(parsed.error || "push-send-failed").slice(0, 500));
    device.set("failure_count", failures);
    if (parsed.statusCode === 404 || parsed.statusCode === 410 || failures >= 3) {
      device.set("active", false);
    }
  }
  $app.dao().saveRecord(device);
  return parsed;
}

function sendForOrder(order, collectionName) {
  var status = String(order.getString("progress") || order.getString("status") || "").toLowerCase();
  var message = notificationFor(order, status);
  if (!message) return { sent: 0, failed: 0 };

  var watchers = $app.dao().findRecordsByFilter(
    watchersCollection(),
    "order_collection = {:collection} && order_id = {:orderId} && active = true && notifications_enabled = true",
    "",
    100,
    0,
    { collection: collectionName, orderId: order.id },
  );
  var sent = 0;
  var failed = 0;
  for (var i = 0; i < watchers.length; i++) {
    try {
      var device = $app.dao().findRecordById("push_devices", watchers[i].getString("device"));
      if (!device.getBool("active") || device.getString("permission") !== "granted") continue;
      var response = sendToDevice(device, watchers[i], order, collectionName, message);
      if (response.ok) sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.log("[push] " + collectionName + "/" + order.id + ": " + error);
    }
  }
  return { sent: sent, failed: failed };
}

function statusForOrder(collectionName, orderId) {
  if (!ALLOWED_COLLECTIONS[collectionName] || !validRecordId(orderId)) throw new Error("invalid-order");
  var watchers = $app.dao().findRecordsByFilter(
    watchersCollection(),
    "order_collection = {:collection} && order_id = {:orderId} && active = true",
    "-last_seen",
    50,
    0,
    { collection: collectionName, orderId: orderId },
  );
  if (!watchers.length) return { status: "unavailable", watching: false, devices: 0 };

  var result = { status: "unavailable", watching: false, devices: watchers.length, lastSeen: "", lastSuccess: "" };
  var cutoff = Date.now() - 10 * 60 * 1000;
  for (var i = 0; i < watchers.length; i++) {
    var watcher = watchers[i];
    var lastSeen = watcher.getString("last_seen");
    if (lastSeen && (!result.lastSeen || lastSeen > result.lastSeen)) result.lastSeen = lastSeen;
    if (lastSeen && new Date(lastSeen).getTime() >= cutoff) result.watching = true;
    try {
      var device = $app.dao().findRecordById("push_devices", watcher.getString("device"));
      var success = device.getString("last_success");
      if (success && (!result.lastSuccess || success > result.lastSuccess)) result.lastSuccess = success;
      if (device.getString("permission") === "granted" && device.getBool("active")) {
        result.status = success ? "active" : "pending";
      } else if (device.getString("permission") === "granted" && result.status === "unavailable") {
        result.status = "error";
      }
    } catch (_) {}
  }
  return result;
}

module.exports = {
  saveDevice: saveDevice,
  watchOrder: watchOrder,
  heartbeat: heartbeat,
  markOpened: markOpened,
  sendForOrder: sendForOrder,
  statusForOrder: statusForOrder,
};
