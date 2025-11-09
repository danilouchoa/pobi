/**
 * mapBackendError.ts
 *
 * Este utilitário traduz códigos técnicos vindos do backend (ex.: erros de validação
 * lançados por Prisma ou regras de negócio na API Express) em mensagens legíveis para o usuário.
 * Centralizar o mapeamento permite manter consistência entre todos os toasts exibidos pelo hook
 * useToast e facilita ajustes futuros (por exemplo, internacionalização).
 */
const ERROR_MESSAGES: Record<string, string> = {
  /**
   * E_VALIDATION é devolvido quando algum payload viola regras do backend.
   * Orientamos o usuário a revisar os campos antes de reenviar.
   */
  E_VALIDATION: "Alguns campos precisam de atenção antes de continuar.",
  /**
   * E_DUPLICATE indica conflito de unicidade (ex.: origem já existente).
   */
  E_DUPLICATE: "Este registro já está cadastrado.",
  /**
   * E_NOT_FOUND cobre tentativas de editar/excluir itens removidos.
   */
  E_NOT_FOUND: "Registro não encontrado.",
  /**
   * E_FORBIDDEN aparece quando o usuário não tem permissão para a ação requisitada.
   */
  E_FORBIDDEN: "Você não tem permissão para executar esta ação.",
  /**
   * E_UNAUTHORIZED é usado quando o token expira ou é inválido.
   */
  E_UNAUTHORIZED: "Sua sessão expirou. Faça login novamente.",
  /**
   * E_CONFLICT trata disputas de estado (ex.: job já processado).
   */
  E_CONFLICT: "Os dados foram alterados por outro processo. Atualize a página.",
  /**
   * E_RATE_LIMIT previne uso abusivo e orienta a aguardar.
   */
  E_RATE_LIMIT: "Muitas requisições em sequência. Aguarde alguns segundos.",
  /**
   * E_INTERNAL é um fallback explícito para erros inesperados no backend.
   */
  E_INTERNAL: "Não foi possível concluir a operação. Tente novamente.",
};

const DEFAULT_ERROR_MESSAGE = ERROR_MESSAGES.E_INTERNAL;

export const mapBackendError = (code?: string, fallbackMessage = DEFAULT_ERROR_MESSAGE) => {
  if (!code) return fallbackMessage;
  const normalized = code.toUpperCase();
  return ERROR_MESSAGES[normalized] ?? fallbackMessage;
};

export const backendErrorDictionary = ERROR_MESSAGES;
