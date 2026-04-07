import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        // 1. Check Admin
        if (
          credentials.email === adminEmail &&
          credentials.password === adminPassword
        ) {
          return {
            id: "admin",
            name: "Administrador",
            email: adminEmail,
            role: "admin",
            permissions: JSON.stringify({
              DASHBOARD: { enabled: true, scope: "all" },
              GESTAO_VENDAS: { enabled: true, scope: "all" },
              VALIDACAO_VENDA: { enabled: true, scope: "all" },
              CONFIGURACAO: { enabled: true, scope: "all" },
            })
          };
        }

        // 2. Check Database Users
        try {
          const user: any = await prisma.vendedor.findUnique({
             where: { email: credentials.email }
          });

          if (user && user.password && await bcrypt.compare(credentials.password, user.password)) {
             return {
               id: user.id,
               name: user.nome,
               email: user.email,
               role: user.role,
               permissions: user.permissions
             };
          }
        } catch (e) {
          console.error("AUTH_ERROR:", e);
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
