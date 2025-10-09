import { SessionOptions } from "iron-session";
import { getSamlEnv } from "@/validations/saml";

declare module "iron-session" {
  interface IronSessionData {
    user?: { id: string; email?: string | null; name?: string | null };
  }
}

const { SESSION_SECRET } = getSamlEnv();

export const sessionOptions: SessionOptions = {
  cookieName: "app_saml_session",
  password: SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};