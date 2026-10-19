import { createHash, randomBytes } from "node:crypto";
import AdminAccount from "../models/AdminAccount.js";
import AdminSession from "../models/AdminSession.js";
import { connectDB } from "./db.js";

const SESSION_COOKIE = "fha_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function findAdminAccount(username) {
  if (typeof username !== "string" || !username) return null;
  await connectDB();
  return AdminAccount.findOne({ username }).exec();
}

export async function createAdminSession(username, sessionVersion) {
  await connectDB();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);

  await AdminSession.create({
    username,
    sessionVersion,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return token;
}

async function getVerifiedAdminSession(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }

  try {
    await connectDB();
    const session = await AdminSession.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    })
      .select("username sessionVersion")
      .lean();

    if (!session) return null;

    const account = await AdminAccount.findOne({ username: session.username })
      .select("sessionVersion")
      .lean();

    return account?.sessionVersion === session.sessionVersion ? session : null;
  } catch {
    return null;
  }
}

export async function verifyAdminSession(token) {
  return Boolean(await getVerifiedAdminSession(token));
}

export function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");

  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function setAdminCookie(cookies, token, secure = false) {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearAdminCookie(cookies, secure = false) {
  cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function revokeAdminSession(token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await connectDB();
  await AdminSession.deleteOne({ tokenHash: hashToken(token) });
}

export async function getAdminFromCookies(cookies) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const session = await getVerifiedAdminSession(token);
  return session?.username ?? null;
}
