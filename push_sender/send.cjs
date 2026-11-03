const webpush = require("web-push");

function result(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function main() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@pixelhelados.com";
  const rawRequest = process.env.PIXEL_PUSH_REQUEST || "";

  if (!publicKey || !privateKey || !rawRequest) {
    result({ ok: false, statusCode: 0, error: "missing-web-push-config" });
    return;
  }

  const request = JSON.parse(rawRequest);
  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    const response = await webpush.sendNotification(
      {
        endpoint: request.endpoint,
        keys: { p256dh: request.p256dh, auth: request.auth },
      },
      JSON.stringify(request.payload || {}),
      {
        TTL: Number(request.ttl) || 300,
        urgency: request.urgency || "high",
      },
    );

    result({ ok: true, statusCode: response.statusCode || 201 });
  } catch (error) {
    result({
      ok: false,
      statusCode: Number(error?.statusCode) || 0,
      error: String(error?.body || error?.message || "push-send-failed").slice(0, 500),
    });
  }
}

main().catch((error) => {
  result({ ok: false, statusCode: 0, error: String(error?.message || error) });
});
