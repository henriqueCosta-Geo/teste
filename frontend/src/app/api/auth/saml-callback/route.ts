import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

/**
 * Esta rota HTML faz auto-login via NextAuth após autenticação SAML
 * Recebe: token (JWT com userId, email, returnTo)
 * Faz: signIn("saml-sso") client-side
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Verifica e decodifica o JWT
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production'
    );

    const { payload } = await jwtVerify(token, secret);

    console.log('[SAML Callback] Token verified:', {
      userId: payload.userId,
      email: payload.email,
      type: payload.type
    });

    if (payload.type !== 'saml-bridge') {
      return NextResponse.json({ error: "Invalid token type" }, { status: 401 });
    }

    const userId = payload.userId as string;
    const email = payload.email as string;
    const returnTo = (payload.returnTo as string) || "/";

    // Retorna uma página HTML que faz auto-login via client-side NextAuth
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Autenticando...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 1rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h2 { color: #333; margin: 0 0 0.5rem 0; }
    p { color: #666; margin: 0; }
    .debug { margin-top: 1rem; font-size: 0.8rem; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Autenticando via SSO</h2>
    <p>Aguarde enquanto completamos seu login...</p>
    <div class="debug" id="debug"></div>
  </div>

  <script type="module">
    const debug = document.getElementById('debug');

    function log(msg) {
      console.log(msg);
      debug.textContent = msg;
    }

    (async function() {
      try {
        log('🔐 Starting SAML auto-login...');

        const userId = ${JSON.stringify(userId)};
        const email = ${JSON.stringify(email)};
        const returnTo = ${JSON.stringify(returnTo)};

        log('📧 Email: ' + email);

        // Importa signIn do next-auth
        const { signIn } = await import('next-auth/react');

        log('🔑 Calling signIn with saml-sso provider...');

        // Faz login usando o provider SAML SSO
        const result = await signIn('saml-sso', {
          email: email,
          userId: userId,
          redirect: false,
        });

        log('✅ SignIn result: ' + JSON.stringify(result));

        if (result?.error) {
          console.error('❌ NextAuth error:', result.error);
          log('❌ Error: ' + result.error);
          setTimeout(() => {
            window.location.href = '/auth/signin?error=' + encodeURIComponent(result.error);
          }, 2000);
        } else if (result?.ok) {
          log('✅ Login successful! Redirecting...');
          setTimeout(() => {
            window.location.href = returnTo;
          }, 500);
        } else {
          log('⚠️ Unknown result, redirecting to home...');
          setTimeout(() => {
            window.location.href = returnTo;
          }, 1000);
        }
      } catch (error) {
        console.error('💥 Auto-login error:', error);
        log('💥 Error: ' + error.message);
        setTimeout(() => {
          window.location.href = '/auth/signin?error=callback_error';
        }, 2000);
      }
    })();
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error('[SAML Callback] Token verification failed:', error);
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
