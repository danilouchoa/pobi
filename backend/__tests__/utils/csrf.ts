/**
 * Dummy helper mantido por compatibilidade com testes anteriores.
 * CSRF foi removido; retorna valores vazios para headers/cookies.
 */
export async function getCsrfToken() {
  return { csrfToken: '', csrfCookie: '' };
}
