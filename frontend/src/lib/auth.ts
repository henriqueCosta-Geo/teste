import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('🔐 Auth attempt:', { email: credentials?.email, hasPassword: !!credentials?.password })
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials')
          return null
        }

        let user
        try {
          user = await prisma.users.findUnique({
            where: {
              email: credentials.email,
              is_active: true,
              deleted_at: null
            },
            include: {
              customer: true
            }
          })

          console.log('👤 User found:', { found: !!user, hasPassword: !!user?.password })

          if (!user || !user.password) {
            console.log('❌ User not found or no password')
            return null
          }

          console.log('🔍 Debug bcrypt:')
          console.log('  - Input password:', credentials.password)
          console.log('  - Stored hash:', user.password)
          console.log('  - Input length:', credentials.password?.length)
          console.log('  - Hash length:', user.password?.length)
          console.log('  - Hash starts with:', user.password?.substring(0, 10))
          
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          console.log('🔑 Password valid:', isPasswordValid)
          
          // Test manual hash generation for comparison
          const testHash = await bcrypt.hash(credentials.password, 10)
          console.log('🧪 Generated test hash:', testHash.substring(0, 20) + '...')
          const testCompare = await bcrypt.compare(credentials.password, testHash)
          console.log('🧪 Test hash works:', testCompare)

          if (!isPasswordValid) {
            console.log('❌ Invalid password')
            return null
          }

          // Atualizar último login
          await prisma.users.update({
            where: { id: user.id },
            data: { last_login: new Date() }
          })
        } catch (error) {
          console.error('💥 Auth error:', error)
          return null
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          customer_id: user.customer_id,
          customer_slug: user.customer.slug,
          customer_name: user.customer.name,
          customer_plan: 'CUSTOM' // Metadata-driven plan
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.customer_id = user.customer_id
        token.customer_slug = user.customer_slug
        token.customer_name = user.customer_name
        token.customer_plan = user.customer_plan
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.customer_id = token.customer_id as number
        session.user.customer_slug = token.customer_slug as string
        session.user.customer_name = token.customer_name as string
        session.user.customer_plan = token.customer_plan as string
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin"
  }
}
