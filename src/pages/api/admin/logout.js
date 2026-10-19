import {
  clearAdminCookie,
  isSameOriginRequest,
  revokeAdminSession,
} from "../../../lib/adminAuth.js";

export const prerender = false;

export async function POST({ request, cookies }) {
  if (!isSameOriginRequest(request)) {
    return new Response(
      JSON.stringify({ message: "Invalid request origin." }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const token = cookies.get("fha_admin_session")?.value;

  try {
    await revokeAdminSession(token);
  } catch (error) {
    console.error("Could not revoke admin session:", error);
  }

  clearAdminCookie(cookies, import.meta.env.PROD);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
