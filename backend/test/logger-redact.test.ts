import { describe, it, expect } from "vitest";
import pino from "pino";
import { Writable } from "stream";

describe("§5.9 — Redact de senha nos logs do pino", () => {
  it("campo senha é redacted no log estruturado", async () => {
    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });

    const logger = pino(
      {
        level: "info",
        redact: {
          paths: ["body.senha", "body.password", "body.novaSenha", "headers.cookie"],
          censor: "[REDACTED]",
        },
      },
      sink
    );

    logger.info(
      {
        body: { email: "x@x.com", senha: "SENHA_SECRETA_XYZ123" },
        headers: { cookie: "almox_sid=abc" },
      },
      "login attempt"
    );

    // flush
    await new Promise((r) => setTimeout(r, 50));
    const out = chunks.join("");
    expect(out).not.toContain("SENHA_SECRETA_XYZ123");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("almox_sid=abc");
  });
});
