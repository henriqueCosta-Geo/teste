import { NextResponse } from "next/server";
import { sp, idp } from "@/lib/saml/sp";
// ⬇️ Se você usar sessão no logout local, use a versão Node:
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // (Opcional) limpar sessão local
    const res = NextResponse.redirect(new URL("/login", new URL(req.url).origin));
    const session = await getIronSession<{ user?: { id: string; email?: string | null; name?: string | null } }>(req as any, res as any, sessionOptions);
    session.destroy();

    // (Opcional) iniciar SLO no IdP
    // const { context } = await sp.createLogoutRequest(idp, "redirect");
    // return NextResponse.redirect(context, { status: 302 });

    return res;
  } catch (err) {
    console.error("[SAML Logout] error:", err);
    return NextResponse.json({ error: "Logout error" }, { status: 500 });
  }
}
