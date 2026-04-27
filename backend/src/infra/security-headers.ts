import type { FastifyInstance } from "fastify";

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "content-security-policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

export async function securityHeaders(app: FastifyInstance) {
  app.addHook("onSend", async (req, reply, payload) => {
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      reply.header(header, value);
    }

    if (req.user) {
      reply.header("cache-control", "no-store");
    }

    return payload;
  });
}
