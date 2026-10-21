import { connectDB } from "../../../lib/db.js";
import { sendDailyVisitSummary } from "../../../lib/email.js";
import SiteVisitDaily from "../../../models/SiteVisitDaily.js";

export const prerender = false;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET({ request }) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    console.error("Daily visit summary is disabled because CRON_SECRET is not configured.");
    return json({ error: "Cron authentication is not configured." }, 503);
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized." }, 401);
  }

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = yesterday.toISOString().slice(0, 10);
  const now = new Date();
  const staleClaim = new Date(now.getTime() - 10 * 60 * 1000);

  try {
    await connectDB();

    const dailyStats = await SiteVisitDaily.findOne({ date }).lean();
    if (!dailyStats?.pageViews) {
      return json({ success: true, message: `No page views recorded for ${date}.` });
    }

    const claimed = await SiteVisitDaily.findOneAndUpdate(
      {
        date,
        emailSentAt: null,
        $or: [
          { emailClaimedAt: null },
          { emailClaimedAt: { $lte: staleClaim } },
        ],
      },
      { $set: { emailClaimedAt: now } },
      { new: true },
    ).lean();

    if (!claimed) {
      return json({ success: true, message: "Summary already sent or currently being sent." });
    }

    const result = await sendDailyVisitSummary({
      date,
      pageViews: dailyStats.pageViews,
      pages: dailyStats.pages || {},
      pagePaths: dailyStats.pagePaths || {},
    });

    if (!result.ok) {
      await SiteVisitDaily.updateOne(
        { date, emailClaimedAt: now },
        { $set: { emailClaimedAt: null } },
      );
      return json({ error: "Could not send the daily visit summary email." }, 503);
    }

    await SiteVisitDaily.updateOne(
      { date, emailClaimedAt: now },
      { $set: { emailSentAt: new Date() } },
    );

    return json({ success: true, message: `Visit summary sent for ${date}.` });
  } catch (error) {
    console.error("Daily visit summary failed:", error);
    return json({ error: "Could not send the daily visit summary." }, 500);
  }
}
