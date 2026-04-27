import { describe, expect, it, vi } from "vitest";
import { createApp } from "./helpers";
import { createShutdownHandler } from "../src/infra/shutdown";

describe("SDD-006 graceful shutdown", () => {
  it("fecha app, desconecta banco e sai com codigo 0", async () => {
    const app = await createApp();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();
    const shutdown = createShutdownHandler(app, disconnect, exit);

    await shutdown("SIGTERM");

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("shutdown e idempotente", async () => {
    const app = await createApp();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();
    const shutdown = createShutdownHandler(app, disconnect, exit);

    await shutdown("SIGTERM");
    await shutdown("SIGTERM");

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
