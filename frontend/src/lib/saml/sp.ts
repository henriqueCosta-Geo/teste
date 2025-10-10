import * as saml from "samlify";
import { getSamlEnv } from "@/validations/saml";

saml.setSchemaValidator({ validate: async () => Promise.resolve("OK") });

const {
  APP_BASE_URL,
  SAML_SP_ENTITY_ID,      // ✅ agora vem da env
  SAML_IDP_ENTITY_ID,
  SAML_IDP_SSO_URL,
  SAML_IDP_SLO_URL,
  SAML_IDP_CERT,
} = getSamlEnv();

export const idp = saml.IdentityProvider({
  entityID: SAML_IDP_ENTITY_ID,
  singleSignOnService: [{ Binding: saml.Constants.namespace.binding.redirect, Location: SAML_IDP_SSO_URL }],
  singleLogoutService: SAML_IDP_SLO_URL
    ? [{ Binding: saml.Constants.namespace.binding.redirect, Location: SAML_IDP_SLO_URL }]
    : undefined,
  signingCert: SAML_IDP_CERT.trim(),
});

export const sp = saml.ServiceProvider({
  // ✅ usar o identifier esperado pelo Azure
  entityID: SAML_SP_ENTITY_ID,
  assertionConsumerService: [
    // ✅ Pages Router Dynamic API: /pages/saml/acs/[id].ts → /saml/acs/17
    { Binding: saml.Constants.namespace.binding.post, Location: `${APP_BASE_URL}/saml/acs/17` },
  ],
  singleLogoutService: SAML_IDP_SLO_URL
    ? [{ Binding: saml.Constants.namespace.binding.redirect, Location: `${APP_BASE_URL}/saml/logout/17` }]
    : undefined,
});
