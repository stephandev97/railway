// API de hooks compatible con PocketBase 0.22.14.
onRecordAfterUpdateRequest(function (e) {
  try {
    require(__hooks + "/test_order_points.js").credit(e.record);
  } catch (error) {
    console.log("[test points] Pendiente de reintento: " + error);
  }
}, "orders_test");

// También cubre actualizaciones internas, caídas de red y reinicios del POS.
cronAdd("pixel_test_order_points", "* * * * *", function () {
  if (!$os.getenv("POINTS_BRIDGE_SECRET") || !$os.getenv("PWA_POINTS_URL")) return;
  try {
    var records = $app.dao().findRecordsByFilter("orders_test",
      'source = "app" && pointsClaimed = false && points > 0 && (progress = "delivered" || progress = "pickedup") && clientCreatedAt ~ "test:"',
      "created", 20, 0);
    for (var i = 0; i < records.length; i++) {
      try { require(__hooks + "/test_order_points.js").credit(records[i]); }
      catch (error) { console.log("[test points] " + records[i].id + ": " + error); }
    }
  } catch (error) { console.log("[test points] Error consultando pendientes: " + error); }
});
