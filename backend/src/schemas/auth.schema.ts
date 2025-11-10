/**
 * Schemas de Validação - Auth (Autenticação)
 * 
 * Propósito:
 * - Validar credenciais de login e registro
 * - Garantir segurança de senhas (comprimento mínimo)
 * - Validar formato de e-mail
 * - Prevenir ataques de enumeração de usuários
 * - Rejeitar campos extras para evitar mass assignment
 * 
 * Uso:
 * - POST /api/auth/register (registerSchema)
 * - POST /api/auth/login (loginSchema)
 * 
 * Regras de Negócio:
 * - E-mail: formato válido, case-insensitive
 * - Senha: mínimo 8 caracteres (sem requisitos complexos para simplificar UX)
 * - Nome: opcional no registro, mínimo 2 caracteres se fornecido
 * 
 * Decisões de Design:
 * - Senha mínima de 8 caracteres (OWASP recomenda 8-64)
 * - Sem validação de complexidade (maiúsculas, números, símbolos) para não frustrar usuário
 * - E-mail normalizado para lowercase no backend
 * - .strict() para evitar campos extras (ex: isAdmin, role)
 * - Mensagens de erro genéricas para prevenir enumeração de usuários
 * 
 * Segurança:
 * - Não vazar informações sobre existência de e-mails
 * - Não logar senhas em plaintext
 * - Rejeitar campos desconhecidos (ex: role, permissions)
 */

import { z } from 'zod';

// ============================================================================
// Helpers de Validação
// ============================================================================

/**
 * Validador de e-mail
 * Usa validação nativa do Zod (RFC 5322)
 */
const emailSchema = z.string()
  .email('E-mail inválido')
  .toLowerCase() // Normaliza para lowercase
  .max(254, 'E-mail muito longo'); // RFC 5321

/**
 * Validador de senha
 * Mínimo 8 caracteres (OWASP)
 * Sem requisitos de complexidade para melhor UX
 */
const passwordSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha muito longa (máximo 128 caracteres)'); // Prevenir DoS

/**
 * Validador de nome
 */
const nameSchema = z.string()
  .min(2, 'Nome deve ter no mínimo 2 caracteres')
  .max(100, 'Nome muito longo (máximo 100 caracteres)')
  .trim(); // Remove espaços nas pontas

// ============================================================================
// Schema de Registro (POST /api/auth/register)
// ============================================================================

export const registerSchema = z.object({
  email: emailSchema,
  
  password: passwordSchema,
  
  name: nameSchema.optional(),
})
.strict(); // Rejeita campos extras (ex: isAdmin, role, permissions)

// ============================================================================
// Schema de Login (POST /api/auth/login)
// ============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  
  password: z.string()
    .min(1, 'Senha é obrigatória')
    // Não validamos comprimento no login para não revelar requisitos
    // Isso previne enumeração baseada em mensagens de erro
})
.strict();

// ============================================================================
// Tipos TypeScript Inferidos
// ============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
