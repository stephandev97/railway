function latestPublished() {
  var rows = $app.dao().findRecordsByFilter(
    "delivery_configs",
    "published = true",
    "-version,-updated",
    1,
    0,
  );
  return rows.length ? rows[0] : null;
}

function toResponse(record) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.getString("name") || "main",
    version: Number(record.getInt("version") || 1),
    published: record.getBool("published"),
    zones: record.get("zones") || [],
    storeLocation: record.get("store_location") || {},
    specialLocations: record.get("special_locations") || [],
    updated: record.getString("updated"),
  };
}

function publish(data) {
  var zones = data.zones;
  if (!Array.isArray(zones) || !zones.length) throw new Error("invalid-zones");
  if (JSON.stringify(zones).length > 1900000) throw new Error("zones-too-large");

  var current = latestPublished();
  var record = current || new Record($app.dao().findCollectionByNameOrId("delivery_configs"));
  var requestedVersion = Number(data.version || 0);
  var nextVersion = Math.max(Number(current ? current.getInt("version") : 0) + 1, requestedVersion, 1);

  record.set("name", String(data.name || "main"));
  record.set("version", nextVersion);
  record.set("published", true);
  record.set("zones", zones);
  record.set("store_location", data.storeLocation || data.store_location || {});
  record.set("special_locations", data.specialLocations || data.special_locations || []);
  $app.dao().saveRecord(record);
  return toResponse(record);
}

module.exports = {
  latestPublished: latestPublished,
  publish: publish,
  toResponse: toResponse,
};
