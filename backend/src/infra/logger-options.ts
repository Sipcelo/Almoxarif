export const LOG_REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "req.body.senha",
  "req.body.password",
  "req.body.novaSenha",
  "res.headers['set-cookie']",
];

export function loggerOptions() {
  return {
    level: process.env.LOG_LEVEL || "info",
    redact: {
      paths: LOG_REDACT_PATHS,
      censor: "[REDACTED]",
    },
  };
}
