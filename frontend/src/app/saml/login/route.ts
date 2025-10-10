// app/saml/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sp, idp } from "@/lib/saml/sp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inicia o fluxo SAML via Redirect Binding (AuthnRequest).
 * Suporta ?returnTo=/app (RelayState) para redirecionar pós-login.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // Aceite apenas paths internos (mitiga open redirect)
    const rawReturnTo = url.searchParams.get("returnTo") ?? "/app";
    const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/app";

    // Gera a URL do IdP com SAMLRequest + SigAlg + Signature
    const { context } = await sp.createLoginRequest(idp, "redirect");
    console.log("[SAML Login] Redirecting to IdP:", context);

    // Anexa o RelayState manualmente
    const redirectUrl = new URL(context);
    redirectUrl.searchParams.set("RelayState", returnTo);

    return NextResponse.redirect(redirectUrl.toString(), { status: 302 });
  } catch (error) {
    console.error("[SAML Login] Error:", error);
    return NextResponse.json({ error: "Failed to initiate SAML login", details: String(error) }, { status: 500 });
  }
}
