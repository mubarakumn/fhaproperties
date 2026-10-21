import "dotenv/config";

const brevoApiKey = process.env.BREVO_API_KEY?.trim();
const emailFrom = process.env.EMAIL_FROM?.trim() || "";
const ownerEmail = process.env.OWNER_EMAIL?.trim() || "";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendMail({ to, subject, html, text }) {
  if (!to) return { ok: false, skipped: true };

  if (!brevoApiKey || !emailFrom) {
    console.warn(
      "Email delivery skipped because BREVO_API_KEY or EMAIL_FROM is not configured.",
    );
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "FHA Properties Management",
          email: emailFrom,
        },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const responseDetails = await response.text();
      throw new Error(
        `Brevo email request failed (${response.status}): ${responseDetails.slice(0, 500)}`,
      );
    }

    return { ok: true, skipped: false };
  } catch (error) {
    console.error("Email delivery failed:", error);
    return { ok: false, skipped: false, error };
  }
}

export async function sendPropertySubmissionConfirmation({
  to,
  propertyTitle,
  propertyId,
}) {
  if (!to) return { ok: false, skipped: true };

  const websiteUrl = process.env.PUBLIC_SITE_URL?.trim() || "https://www.fhaproperties.com";
  const subject = "Your property submission has been received";
  const text = [
    "Thank you for submitting your property to FHA Properties Management.",
    "",
    `Property: ${propertyTitle}`,
    `Reference: ${propertyId}`,
    "",
    "Our team will review it and contact you if anything else is needed.",
    "",
    `Website: ${websiteUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.7;">
      <h2 style="margin-bottom: 12px; color: #123b70;">Property submission received</h2>
      <p>Thank you for submitting your property to FHA Properties Management.</p>
      <p><strong>Property:</strong> ${escapeHtml(propertyTitle)}</p>
      <p><strong>Reference:</strong> ${escapeHtml(propertyId)}</p>
      <p>Our team will review it and contact you if anything else is needed.</p>
      <p><a href="${websiteUrl}" style="color: #123b70;">Visit our website</a></p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
  });
}

export async function sendPropertySubmissionOwnerNotice({
  propertyTitle,
  submitterName,
  submitterEmail,
  submitterPhone,
  propertyId,
}) {
  if (!ownerEmail) return { ok: false, skipped: true };

  const subject = `New property submission received: ${propertyTitle}`;
  const text = [
    "A new property submission has been received.",
    "",
    `Property: ${propertyTitle}`,
    `Reference: ${propertyId}`,
    `Submitted by: ${submitterName}`,
    `Email: ${submitterEmail || "Not provided"}`,
    `Phone: ${submitterPhone || "Not provided"}`,
    "",
    "Please review the submission in the admin dashboard.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.7;">
      <h2 style="margin-bottom: 12px; color: #123b70;">New property submission</h2>
      <p>A new property submission has been received.</p>
      <p><strong>Property:</strong> ${escapeHtml(propertyTitle)}</p>
      <p><strong>Reference:</strong> ${escapeHtml(propertyId)}</p>
      <p><strong>Submitted by:</strong> ${escapeHtml(submitterName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(submitterEmail || "Not provided")}</p>
      <p><strong>Phone:</strong> ${escapeHtml(submitterPhone || "Not provided")}</p>
      <p>Please review the submission in the admin dashboard.</p>
    </div>
  `;

  return sendMail({
    to: ownerEmail,
    subject,
    text,
    html,
  });
}

export async function sendPropertyApprovedNotice({
  to,
  propertyTitle,
  propertyUrl,
}) {
  if (!to) return { ok: false, skipped: true };

  const subject = "Your property has been approved";
  const text = [
    "Your property submission has been approved and is now live on our website.",
    "",
    `Property: ${propertyTitle}`,
    `Website: ${propertyUrl}`,
    "",
    "Thank you for choosing FHA Properties Management.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.7;">
      <h2 style="margin-bottom: 12px; color: #123b70;">Property approved</h2>
      <p>Your property submission has been approved and is now live on our website.</p>
      <p><strong>Property:</strong> ${escapeHtml(propertyTitle)}</p>
      <p><a href="${propertyUrl}" style="color: #123b70;">View your listing</a></p>
      <p>Thank you for choosing FHA Properties Management.</p>
    </div>
  `;

  return sendMail({
    to,
    subject,
    text,
    html,
  });
}

export async function sendDailyVisitSummary({
  date,
  pageViews,
  pages = {},
  pagePaths = {},
}) {
  if (!ownerEmail) {
    console.error("Daily visit summary skipped because OWNER_EMAIL is not configured.");
    return { ok: false, skipped: true };
  }

  const pageCounts = Object.entries(pages)
    .map(([key, count]) => ({
      path: pagePaths[key] || "/",
      views: Number(count) || 0,
    }))
    .filter((page) => page.views > 0)
    .sort((first, second) => second.views - first.views)
    .slice(0, 20);

  const pageLines = pageCounts.map((page) => `${page.path}: ${page.views}`);
  const pageRows = pageCounts
    .map(
      (page) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e4e9f0;">${escapeHtml(page.path)}</td><td style="padding:8px 12px;border-bottom:1px solid #e4e9f0;text-align:right;">${page.views}</td></tr>`,
    )
    .join("");
  const subject = `FHA website daily visits — ${date}`;
  const text = [
    `Anonymous website page views for ${date} (UTC): ${pageViews}`,
    "",
    "Page views by page:",
    ...(pageLines.length > 0 ? pageLines : ["No page breakdown available."]),
    "",
    "This summary contains aggregate page-view counts only. No visitor identities or IP addresses are collected.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;color:#182230;line-height:1.6;">
      <h2 style="color:#123b70;">Daily website visits</h2>
      <p>Anonymous page views for <strong>${escapeHtml(date)} (UTC)</strong>:</p>
      <p style="font-size:28px;font-weight:700;color:#123b70;">${Number(pageViews) || 0}</p>
      <h3>Page views by page</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th style="padding:8px 12px;text-align:left;">Page</th><th style="padding:8px 12px;text-align:right;">Views</th></tr></thead>
        <tbody>${pageRows || '<tr><td colspan="2" style="padding:8px 12px;">No page breakdown available.</td></tr>'}</tbody>
      </table>
      <p style="margin-top:20px;color:#64748b;font-size:13px;">Aggregate page-view counts only; no visitor identities or IP addresses are collected.</p>
    </div>
  `;

  return sendMail({
    to: ownerEmail,
    subject,
    text,
    html,
  });
}
