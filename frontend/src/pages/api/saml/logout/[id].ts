// pages/saml/logout/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

/**
 * SAML Single Logout (SLO) - Dynamic Route
 * URL: /saml/logout/17 (17 is a fixed identifier)
 * Uses Pages Router with dynamic route to avoid Server Actions validation
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { id } = req.query;
    console.log("[SAML Logout] Received logout with ID:", id);

    // Destroy iron-session
    const session = await getIronSession<{
      user?: { id: string; email?: string | null; name?: string | null };
    }>(req, res, sessionOptions);

    session.destroy();

    // Redirect to login page
    return res.redirect(302, "/login");
  } catch (err) {
    console.error("[SAML Logout] error:", err);
    return res.status(500).json({ error: "Logout error" });
  }
}
