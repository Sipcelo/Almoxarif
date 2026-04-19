import { FastifyReply } from "fastify";

export const COOKIE_NAME = "almox_sid";
export const CSRF_COOKIE_NAME = "almox_csrf";
export const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS) || 8;
export const TTL_MS = TTL_HOURS * 60 * 60 * 1000;

export function setSessionCookie(reply: FastifyReply, sid: string) {
  reply.setCookie(COOKIE_NAME, sid, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_HOURS * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export function setCsrfCookie(reply: FastifyReply, token: string) {
  reply.setCookie(CSRF_COOKIE_NAME, token, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_HOURS * 60 * 60,
  });
}

export function clearCsrfCookie(reply: FastifyReply) {
  reply.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
}
