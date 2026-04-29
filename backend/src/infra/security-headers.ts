import type { FastifyInstance } from "fastify";

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

const FRONTEND_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

function isFrontendRequest(url: string): boolean {
  const pathname = url.split("?")[0] || "/";
  return (
    pathname === "/" ||
    pathname === "/apiClient.js" ||
    pathname === "/almox_logo.png" ||
    pathname === "/auralynne.png" ||
    pathname.startsWith("/front/")
  );
}

export async function securityHeaders(app: FastifyInstance) {
  app.addHook("onSend", async (req, reply, payload) => {
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      reply.header(header, value);
    }
    reply.header(
      "content-security-policy",
      isFrontendRequest(req.url) ? FRONTEND_CSP : API_CSP
    );

    if (req.user) {
      reply.header("cache-control", "no-store");
    }

    return payload;
  });
}
