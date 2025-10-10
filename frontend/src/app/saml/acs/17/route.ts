import { NextRequest, NextResponse } from "next/server";
import { sp, idp } from "@/lib/saml/sp";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";

// ✅ importe seu serviço centralizado
import { createUserIfNotExistsStrict } from "@/lib/utils/create-user"; // ajuste o path se for diferente

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const params = new URLSearchParams(raw);
    const SAMLResponse = params.get("SAMLResponse");
    if (!SAMLResponse) {
      return NextResponse.json({ error: "Missing SAMLResponse" }, { status: 400 });
    }

    const { extract } = await sp.parseLoginResponse(idp, "post", { body: { SAMLResponse } });

    const nameId = extract?.user?.nameID as string | undefined;
    const attrs = extract?.attributes ?? {};

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

    // ✅ Segurança/consistência: exigimos email porque o createUserStrict valida isso
    if (!email) {
      console.error("[SAML ACS] missing email claim; nameId:", nameId);
      return NextResponse.json({ error: "Email claim obrigatório não encontrado" }, { status: 401 });
    }

    // 🔐 Centraliza criação/recuperação do usuário
    let user;
    try {
      user = await createUserIfNotExistsStrict({ email, name: name ?? null });
    } catch (err) {
      throw err;
    }

    // ♻️ Cria sessão e redireciona
    const res = NextResponse.redirect(new URL("/", req.url));
    const session = await getIronSession<{ user?: { id: string; email?: string | null; name?: string | null } }>(req, res, sessionOptions);

    // Observação: seu serviço retorna { id: number; email: string; name: string | null }
    session.user = {
      id: String(user.id), // mantém id como string na sessão (evita colisões)
      email: user.email,
      name: user.name,
    };

    await session.save();
    return res;
  } catch (err) {
    console.error("[SAML ACS] error:", err);
    return NextResponse.json({ error: "ACS error" }, { status: 500 });
  }
}