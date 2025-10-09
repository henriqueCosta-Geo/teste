import { z } from "zod";

export const samlOnlySchema = z.object({
  APP_BASE_URL: z.url().nonempty(),
  SAML_SP_ENTITY_ID: z.string().nonempty(), // ✅ entityID do SP (igual ao cadastrado no Azure)
  SAML_IDP_ENTITY_ID: z.string().nonempty(),
  SAML_IDP_SSO_URL: z.url(),
  SAML_IDP_SLO_URL: z.url().optional(),
  SAML_IDP_CERT: z.string().nonempty(),
  SESSION_SECRET: z.string().min(32),
  // opcional: formato do NameID; default = emailAddress
  SAML_NAMEID_FORMAT: z
    .string()
    .default("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress")
    .optional(),
});


export type SamlEnv = z.infer<typeof samlOnlySchema>;

export function getSamlEnv(): SamlEnv {
  const parsed = samlOnlySchema.safeParse(process.env);
  if (!parsed.success) {

    const tree = z.treeifyError(parsed.error);

    throw new Error(`Variáveis de ambiente SAML inválidas: ${JSON.stringify(tree, null, 2)}`);
  }
  return parsed.data;
}