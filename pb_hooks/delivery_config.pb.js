routerAdd("GET", "/api/pixel/delivery-config", function (c) {
  try {
    var service = require(__hooks + "/delivery_config.js");
    return c.json(200, { config: service.toResponse(service.latestPublished()) });
  } catch (error) {
    return c.json(500, { error: String(error) });
  }
});

routerAdd("PUT", "/api/pixel/delivery-config", function (c) {
  try {
    var data = $apis.requestInfo(c).data || {};
    var expectedKey = String($os.getenv("DELIVERY_CONFIG_WRITE_KEY") || "");
    var suppliedKey = String(data.writeKey || "");
    var authenticated = Boolean(c.get("admin") || c.get("authRecord"));
    if (!authenticated && (!expectedKey || suppliedKey !== expectedKey)) {
      return c.json(403, { error: "forbidden" });
    }
    delete data.writeKey;
    var service = require(__hooks + "/delivery_config.js");
    return c.json(200, { config: service.publish(data) });
  } catch (error) {
    return c.json(400, { error: String(error) });
  }
});
