import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      customer_id: number
      customer_slug: string
      customer_name: string
      customer_plan: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: string
    customer_id: number
    customer_slug: string
    customer_name: string
    customer_plan: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: string
    customer_id: number
    customer_slug: string
    customer_name: string
    customer_plan: string
  }
}