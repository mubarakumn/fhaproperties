import mongoose from "mongoose";
import {
  getAdminFromCookies,
  isSameOriginRequest,
} from "../../../../../lib/adminAuth.js";
import { connectDB } from "../../../../../lib/db.js";
import Property from "../../../../../models/Property.js";

export const prerender = false;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST({ request, cookies, params }) {
  if (!(await getAdminFromCookies(cookies))) {
    return json({ error: "Admin authentication required." }, 401);
  }

  if (!isSameOriginRequest(request)) {
    return json({ error: "Invalid request origin." }, 403);
  }

  const id = params.id;

  if (!mongoose.isValidObjectId(id)) {
    return json({ error: "Invalid property reference." }, 400);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid review request." }, 400);
  }

  const action = body?.action;
  const notes =
    typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

  if (!["publish", "reject"].includes(action)) {
    return json({ error: "Choose a valid review action." }, 400);
  }

  try {
    await connectDB();

    const now = new Date();

    const update = {
      status: action === "publish" ? "published" : "rejected",
      reviewNotes: notes,
      reviewedAt: now,
      publishedAt: action === "publish" ? now : null,
    };

    const property = await Property.findOneAndUpdate(
      {
        _id: id,
        status: "pending_review",
      },
      { $set: update },
      { new: true, runValidators: true },
    )
      .select("_id title slug status")
      .lean();

    if (!property) {
      return json(
        {
          error:
            "This property is no longer awaiting review. Refresh the admin page.",
        },
        409,
      );
    }

    return json({
      success: true,
      property: {
        id: property._id.toString(),
        title: property.title,
        slug: property.slug,
        status: property.status,
      },
    });
  } catch (error) {
    console.error("Property review action failed:", error);
    return json({ error: "Could not update this property." }, 500);
  }
}
