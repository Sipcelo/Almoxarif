import type { FastifyInstance } from "fastify";
import { prisma } from "./prisma";

type Disconnect = () => Promise<void>;
type Exit = (code: number) => void;

export function createShutdownHandler(
  app: FastifyInstance,
  disconnect: Disconnect = () => prisma.$disconnect(),
  exit: Exit = (code) => process.exit(code)
) {
  let closing = false;

  return async function shutdown(signal: NodeJS.Signals) {
    if (closing) return;
    closing = true;

    app.log.info({ signal }, "shutdown iniciado");

    try {
      await app.close();
      await disconnect();
      app.log.info({ signal }, "shutdown concluido");
      exit(0);
    } catch (err) {
      app.log.error({ err, signal }, "shutdown falhou");
      exit(1);
    }
  };
}

export function registerShutdown(app: FastifyInstance) {
  const shutdown = createShutdownHandler(app);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
