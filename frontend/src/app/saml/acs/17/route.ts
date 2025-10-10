import { NextRequest, NextResponse } from "next/server";
import { sp, idp } from "@/lib/saml/sp";
import { getSamlEnv } from "@/validations/saml";
import { createUserIfNotExistsStrict } from "@/lib/utils/create-user";
import { SignJWT } from "jose";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const SAMLResponse = params.get("SAMLResponse");
    const RelayState = params.get("RelayState");

    if (!SAMLResponse) {
      return NextResponse.json({ error: "Missing SAMLResponse" }, { status: 400 });
    }

    const { extract } = await sp.parseLoginResponse(idp, "post", { body: { SAMLResponse } });

    const nameId = extract?.user?.nameID as string | undefined;
    const attrs = extract?.attributes ?? {};

    console.log('[SAML ACS] Received attributes:', JSON.stringify(attrs, null, 2));

    // Claims comuns do Azure/ADFS
    const email =
      (attrs.email ||
        attrs.mail ||
        attrs.upn ||
        attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"])?.[0] ?? null;

    const name =
      (attrs.displayName ||
        attrs.name ||
        attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"])?.[0] ?? null;

    console.log('[SAML ACS] Extracted claims:', { email, name, nameId });

    // ✅ Segurança/consistência: exigimos email porque o createUserStrict valida isso
    if (!email) {
      console.error("[SAML ACS] missing email claim; nameId:", nameId);
      return NextResponse.json({ error: "Email claim obrigatório não encontrado" }, { status: 401 });
    }

    // 🔐 Centraliza criação/recuperação do usuário
    let user;
    try {
      user = await createUserIfNotExistsStrict({ email, name: name ?? null });
      console.log('✅ [SAML ACS] User created/found:', { id: user.id, email: user.email });
    } catch (err) {
      console.error('❌ [SAML ACS] Error creating user:', err);
      throw err;
    }

    // 🌉 Ponte para NextAuth: cria token JWT temporário (válido por 5 min)
    const { APP_BASE_URL } = getSamlEnv();
    const redirectPath = RelayState && RelayState.startsWith("/") ? RelayState : "/";

    // Gera um token JWT com os dados do usuário
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production'
    );

    const token = await new SignJWT({
      userId: user.id.toString(),
      email: user.email,
      returnTo: redirectPath,
      type: 'saml-bridge'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m') // Token válido por 5 minutos
      .sign(secret);

    // Redireciona com token ao invés de dados sensíveis na URL
    const autoLoginUrl = `${APP_BASE_URL}/api/auth/saml-callback?token=${token}`;

    console.log('🔄 [SAML ACS] Redirecting to auto-login with secure token');

    return NextResponse.redirect(autoLoginUrl);
  } catch (err) {
    console.error("[SAML ACS] error:", err);
    return NextResponse.json({ error: "ACS error", details: String(err) }, { status: 500 });
  }
}
