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
  const admin = await getAdminFromCookies(cookies);
  if (!admin) {
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
    return json({ error: "Invalid request payload." }, 400);
  }

  const action = body?.action; // "publish", "unpublish", "delete", "archive", "reject"
  const notes =
    typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

  const allowedActions = new Set([
    "publish",
    "unpublish",
    "delete",
    "archive",
    "reject",
  ]);

  if (!allowedActions.has(action)) {
    return json({ error: "Invalid property action." }, 400);
  }

  try {
    await connectDB();

    if (action === "delete") {
      const deleted = await Property.findByIdAndDelete(id);
      if (!deleted) {
        return json({ error: "Property not found or already deleted." }, 404);
      }
      return json({
        success: true,
        message: "Property deleted successfully.",
        action: "delete",
      });
    }

    const now = new Date();
    let newStatus = "published";

    if (action === "unpublish") {
      newStatus = "draft";
    } else if (action === "archive") {
      newStatus = "archived";
    } else if (action === "reject") {
      newStatus = "rejected";
    } else if (action === "publish") {
      newStatus = "published";
    }

    const update = {
      status: newStatus,
      reviewedAt: now,
    };

    if (notes) {
      update.reviewNotes = notes;
    }

    if (newStatus === "published") {
      update.publishedAt = now;
    }

    const updated = await Property.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .select("_id title slug status")
      .lean();

    if (!updated) {
      return json({ error: "Property not found." }, 404);
    }

    return json({
      success: true,
      message: `Property status updated to ${newStatus}.`,
      property: {
        id: updated._id.toString(),
        title: updated.title,
        slug: updated.slug,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error("Property action failed:", error);
    return json({ error: "Failed to update property." }, 500);
  }
}

