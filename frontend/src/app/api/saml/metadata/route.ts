// app/saml/metadata/route.ts
import { NextResponse } from "next/server";
import { getSamlEnv } from "@/validations/saml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const {
      APP_BASE_URL,
      SAML_SP_ENTITY_ID,
      SAML_IDP_SLO_URL, // pode não ser usado aqui, mas mantemos caso precise
      SAML_NAMEID_FORMAT,
    } = getSamlEnv();

    const sp_entity_id = SAML_SP_ENTITY_ID;
    const sp_acs_url = "https://geoassistantrailway-production.up.railway.app/saml/acs/17"                       //`${APP_BASE_URL}/api/saml/acs`;
    const sp_slo_url = "https://geoassistantrailway-production.up.railway.app/saml/logout/17" //`${APP_BASE_URL}/api/saml/logout`;
    const name_id_format =
      SAML_NAMEID_FORMAT ?? "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

    // validUntil +7 dias
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // XML no formato solicitado
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${sp_entity_id}" validUntil="${validUntil}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>${name_id_format}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${sp_acs_url}" index="1" isDefault="true"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${sp_slo_url}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/samlmetadata+xml; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[SAML Metadata] error:", err);
    return NextResponse.json({ error: "Unable to generate SAML metadata" }, { status: 500 });
  }
}
