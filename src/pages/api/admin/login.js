import bcrypt from "bcryptjs";
import {
  createAdminSession,
  findAdminAccount,
  isSameOriginRequest,
  setAdminCookie,
} from "../../../lib/adminAuth.js";

export const prerender = false;

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isRateLimited(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = attempts.get(ip);

  if (!current || now - current.start >= WINDOW_MS) {
    attempts.set(ip, { start: now, count: 1 });
    return false;
  }

  if (current.count >= MAX_ATTEMPTS) return true;

  current.count += 1;
  return false;
}

export async function POST({ request, cookies }) {
  if (!isSameOriginRequest(request)) {
    return json({ message: "Invalid request origin." }, 403);
  }

  if (isRateLimited(request)) {
    return json(
      { message: "Too many login attempts. Try again in 15 minutes." },
      429,
    );
  }

  let form;

  try {
    form = await request.formData();
  } catch {
    return json({ message: "Invalid login request." }, 400);
  }

  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!username || !password || password.length > 1024) {
    return json({ message: "Enter your username and password." }, 400);
  }

  let account;

  try {
    account = await findAdminAccount(username);
  } catch (error) {
    console.error("Could not load admin account:", error);
    return json({ message: "Admin login is temporarily unavailable." }, 503);
  }

  if (!account) {
    return json({ message: "Incorrect username or password." }, 401);
  }

  let passwordMatches = false;

  try {
    if (bcrypt.getRounds(account.passwordHash) < 12) {
      console.error("Admin password hash uses an insecure work factor.");
      return json({ message: "Admin login is incorrectly configured." }, 500);
    }
    passwordMatches = await bcrypt.compare(password, account.passwordHash);
  } catch (error) {
    console.error("Admin password hash could not be checked:", error);
    return json({ message: "Admin login is incorrectly configured." }, 500);
  }

  if (!passwordMatches) {
    return json({ message: "Incorrect username or password." }, 401);
  }

  try {
    const token = await createAdminSession(username, account.sessionVersion);

    setAdminCookie(cookies, token, import.meta.env.PROD);

    return json({
      success: true,
      redirect: "/admin/",
    });
  } catch (error) {
    console.error("Could not create admin session:", error);

    return json({ message: "Could not create an admin session." }, 500);
  }
}
