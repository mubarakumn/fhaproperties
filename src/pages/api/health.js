
import { connectDB } from "../../lib/db.js";

export const GET = async () => {
  try {
    await connectDB();

    return new Response(
      JSON.stringify({
        ok: true,
        database: "connected",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Database health check failed:", error.message);

    return new Response(
      JSON.stringify({
        ok: false,
        message: "Database connection failed.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }
};
