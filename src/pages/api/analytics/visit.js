import { connectDB } from "../../../lib/db.js";
import { isSameOriginRequest } from "../../../lib/adminAuth.js";
import SiteVisitDaily from "../../../models/SiteVisitDaily.js";

export const prerender = false;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST({ request }) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Invalid request origin." }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid page view." }, 400);
  }

  const path = typeof body?.path === "string" ? body.path : "";
  if (
    path.length > 160 ||
    !/^\/[A-Za-z0-9/_%.-]*$/.test(path) ||
    path.startsWith("//") ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/") ||
    path.startsWith("/_astro/")
  ) {
    return json({ error: "Invalid page path." }, 400);
  }

  const date = new Date().toISOString().slice(0, 10);
  const pageKey = Buffer.from(path).toString("base64url");
  const increment = {
    pageViews: 1,
    [`pages.${pageKey}`]: 1,
  };

  try {
    await connectDB();

    try {
      await SiteVisitDaily.updateOne(
        { date },
        {
          $inc: increment,
          $set: { [`pagePaths.${pageKey}`]: path },
          $setOnInsert: { date },
        },
        { upsert: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;

      await SiteVisitDaily.updateOne(
        { date },
        {
          $inc: increment,
          $set: { [`pagePaths.${pageKey}`]: path },
        },
      );
    }

    return json({ success: true }, 202);
  } catch (error) {
    console.error("Could not record anonymous site page view:", error);
    return json({ error: "Could not record page view." }, 503);
  }
}
