import { access, readFile, stat } from "fs/promises";
import path from "path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const DEFAULT_PUBLIC_DIR = path.resolve(process.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function publicRoot() {
  return path.resolve(process.env.FRONTEND_STATIC_DIR || DEFAULT_PUBLIC_DIR);
}

function decodePathname(url: string): string | null {
  let pathname = url.split("?")[0] || "/";

  try {
    for (let i = 0; i < 2; i += 1) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) return decoded;
      pathname = decoded;
    }
    return pathname;
  } catch {
    return null;
  }
}

function hasParentSegment(url: string): boolean {
  const pathname = decodePathname(url);
  if (!pathname) return false;
  return pathname.split(/[\\/]+/).includes("..");
}

function resolvePublicFile(root: string, pathname: string): string | null {
  const normalizedPath = pathname === "/" ? "/index.html" : pathname;

  if (normalizedPath.includes("\0")) {
    return null;
  }

  const relativePath = normalizedPath.replace(/^\/+/, "");
  const segments = relativePath.split(/[\\/]+/);
  if (segments.includes("..")) {
    return null;
  }
  const candidate = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, candidate);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return candidate;
}

async function sendStaticFile(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const pathname = decodePathname(request.url);
  if (!pathname) {
    return reply.callNotFound();
  }

  const filePath = resolvePublicFile(publicRoot(), pathname);
  if (!filePath) {
    return reply.callNotFound();
  }

  try {
    await access(filePath);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return reply.callNotFound();
    }
  } catch {
    return reply.callNotFound();
  }

  const ext = path.extname(filePath).toLowerCase();
  reply.header("content-type", MIME_TYPES[ext] || "application/octet-stream");
  reply.header("cache-control", "no-store");

  if (request.method === "HEAD") {
    return reply.send();
  }

  return reply.send(await readFile(filePath));
}

export async function registerStaticFrontend(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const rawUrl = request.raw.url || request.url;
    if (hasParentSegment(rawUrl)) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Rota nao encontrada",
          details: [],
        },
      });
    }
  });

  app.route({
    method: ["GET", "HEAD"],
    url: "/",
    handler: sendStaticFile,
  });

  for (const url of ["/apiClient.js", "/almox_logo.png", "/auralynne.png"]) {
    app.route({
      method: ["GET", "HEAD"],
      url,
      handler: sendStaticFile,
    });
  }

  app.route({
    method: ["GET", "HEAD"],
    url: "/front/*",
    handler: sendStaticFile,
  });
}
