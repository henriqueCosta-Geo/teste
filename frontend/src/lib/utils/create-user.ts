import { prisma } from "@/lib/prisma";

interface CreateUserParams {
  email: string;
  name: string | null;
  customerId?: number;
}

/**
 * Cria ou retorna usuário existente via SAML.
 * Lança erro se usuário estiver soft-deleted.
 */
export async function createUserIfNotExistsStrict(params: CreateUserParams) {
  const { email, name, customerId = 1 } = params; // Default customer_id = 1

  // Verifica se usuário existe
  const existing = await prisma.users.findUnique({
    where: { email },
  });

  // Se usuário existe e está ativo, retorna
  if (existing && !existing.deleted_at) {
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
    };
  }

  // Se usuário existe mas está soft-deleted, bloqueia
  if (existing && existing.deleted_at) {
    throw new Error("USER_SOFT_DELETED");
  }

  // Cria novo usuário
  const username = email.split("@")[0] + "_" + Date.now(); // Gera username único

  const newUser = await prisma.users.create({
    data: {
      email,
      name: name || email.split("@")[0],
      username,
      customer_id: customerId,
      role: "USER",
      is_active: true,
    },
  });

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
  };
}
