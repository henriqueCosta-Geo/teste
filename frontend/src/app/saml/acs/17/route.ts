import { NextRequest, NextResponse } from "next/server";
import { sp, idp } from "@/lib/saml/sp";
import { getSamlEnv } from "@/validations/saml";
import { createUserIfNotExistsStrict } from "@/lib/utils/create-user";

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

    console.log('[SAML ACS] ==================== DEBUG ====================');
    console.log('[SAML ACS] Received ALL attributes:', JSON.stringify(attrs, null, 2));
    console.log('[SAML ACS] NameID:', nameId);

    // Helper para extrair valor (pode ser string ou array)
    const getValue = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val[0] || null;
      return String(val);
    };

    // Claims comuns do Azure/ADFS - TESTANDO TODAS AS POSSIBILIDADES
    const emailCandidates = [
      getValue(attrs.email),
      getValue(attrs.mail),
      getValue(attrs.upn),
      getValue(attrs.emailaddress),
      getValue(attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"]),
      getValue(attrs["http://schemas.xmlsoap.org/claims/EmailAddress"]),
      getValue(nameId) // Último resort: usar nameID se for email
    ].filter(Boolean);

    const nameCandidates = [
      getValue(attrs["http://schemas.microsoft.com/identity/claims/displayname"]),
      getValue(attrs.displayName),
      getValue(attrs.name),
      getValue(attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"]),
      getValue(attrs["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"]),
    ].filter(Boolean);

    console.log('[SAML ACS] Email candidates:', emailCandidates);
    console.log('[SAML ACS] Name candidates:', nameCandidates);

    const email = emailCandidates[0] || null;
    const name = nameCandidates[0] || null;

    console.log('[SAML ACS] FINAL Extracted claims:', { email, name });
    console.log('[SAML ACS] ================================================');

    // ✅ Segurança/consistência: exigimos email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.error("[SAML ACS] Invalid or missing email claim");
      return NextResponse.json({
        error: "Email claim inválido ou não encontrado",
        debug: { emailCandidates, attrs: Object.keys(attrs) }
      }, { status: 401 });
    }

    // 🔐 Centraliza criação/recuperação do usuário
    let user;
    try {
      user = await createUserIfNotExistsStrict({ email, name: name ?? null });
      console.log('✅ [SAML ACS] User created/found:', { id: user.id, email: user.email, name: user.name });
    } catch (err) {
      console.error('❌ [SAML ACS] Error creating user:', err);
      throw err;
    }

    // 🌉 Redireciona para página que fará signIn via NextAuth
    const { APP_BASE_URL } = getSamlEnv();
    const redirectPath = RelayState && RelayState.startsWith("/") ? RelayState : "/";

    // Encode dados em base64 para passar via query params de forma segura
    const authData = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      timestamp: Date.now()
    })).toString('base64');

    const callbackUrl = `${APP_BASE_URL}/auth/saml-complete?data=${authData}&returnTo=${encodeURIComponent(redirectPath)}`;

    console.log('✅ [SAML ACS] Redirecting to auth complete page');

    return NextResponse.redirect(callbackUrl);
  } catch (err) {
    console.error("[SAML ACS] error:", err);
    return NextResponse.json({
      error: "ACS error",
      details: String(err),
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
