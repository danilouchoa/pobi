import request from 'supertest';
import app from '../../src/index';

/**
 * Busca o token CSRF e o cookie de sessão CSRF para uso em requisições protegidas.
 * Retorna { csrfToken, csrfCookie }
 */
export async function getCsrfToken() {
  const res = await request(app).get('/api/csrf-token');
  const csrfToken = res.body.csrfToken;
  // O cookie CSRF pode vir como array ou string
  let csrfCookie = '';
  const setCookie = res.headers['set-cookie'];
  if (Array.isArray(setCookie)) {
    csrfCookie = setCookie.find((c) => c.includes('csrf')) || '';
  } else if (typeof setCookie === 'string') {
    csrfCookie = setCookie;
  }
  return { csrfToken, csrfCookie };
}
