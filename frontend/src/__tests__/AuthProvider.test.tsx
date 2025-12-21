// @ts-nocheck

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthProvider';
import { useAuth } from '../context/useAuth';
import React from 'react';

const createLocalStorageMock = () => {
	let store = new Map<string, string>();

	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, String(value));
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		get length() {
			return store.size;
		},
	};
};

// Mock do serviço de API usado no AuthProvider
vi.mock('../services/api', () => ({
	__esModule: true,
	default: {
				post: vi.fn((url, data) => {
					if (url === '/api/bff/auth/login') {
						return Promise.resolve({ data: { accessToken: 'token', user: { email: data.email } } });
					}
					if (url === '/api/bff/auth/logout') {
						return Promise.resolve({});
					}
					if (url === '/api/bff/auth/refresh') {
						return Promise.resolve({ data: { accessToken: 'token' } });
					}
					// Valor padrão para qualquer rota não tratada
					return Promise.resolve({ data: {} });
				}),
				get: vi.fn((url) => {
					if (url === '/api/bff/auth/me') {
						return Promise.resolve({ data: { user: { email: 'a@b.com' } } });
					}
					// Valor padrão para qualquer rota não tratada
					return Promise.resolve({ data: {} });
				}),
	},
	setAuthToken: vi.fn(),
	registerUnauthorizedHandler: vi.fn(),
}));

function TestComponent() {
	const { user, login, logout, isAuthenticated, authError, loading } = useAuth();
	return (
		<div>
			<span data-testid="user">{user ? user.email : 'none'}</span>
			<span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
			<span data-testid="error">{authError || ''}</span>
			<span data-testid="loading">{loading ? 'yes' : 'no'}</span>
			<button
				onClick={() => {
					login({ email: 'a@b.com', password: '123' }).catch(() => {});
				}}
			>
				login
			</button>
			<button onClick={logout}>logout</button>
		</div>
	);
}

describe('AuthProvider', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createLocalStorageMock());
	});
	const renderWithClient = () =>
		render(
			<QueryClientProvider client={new QueryClient()}>
				<AuthProvider>
					<TestComponent />
				</AuthProvider>
			</QueryClientProvider>
		);
	it('deve iniciar deslogado', () => {
		renderWithClient();
		expect(screen.getByTestId('auth').textContent).toBe('no');
		expect(screen.getByTestId('user').textContent).toBe('none');
	});

		it('deve logar e deslogar', async () => {
		renderWithClient();
			await act(async () => {
				fireEvent.click(screen.getByText('login'));
			});
			// Aguarda o estado de loading
			await waitFor(() => screen.getByTestId('loading').textContent === 'yes' || screen.getByTestId('loading').textContent === 'no');
			// Aguarda autenticação
			await waitFor(() => screen.getByTestId('auth').textContent === 'yes', { timeout: 1500 });
			await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@b.com'));

			await act(async () => {
				fireEvent.click(screen.getByText('logout'));
			});
			await waitFor(() => screen.getByTestId('auth').textContent === 'no', { timeout: 1500 });
			await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
		});
			it('deve exibir erro ao falhar login', async () => {
				// Mocka erro de login
				const api = (await import('../services/api')).default;
				vi.mocked(api.post).mockImplementationOnce((url: string) => {
					if (url === '/api/bff/auth/login') {
						const error = new Error('Credenciais inválidas.');
						(error as any).response = { data: { message: 'Credenciais inválidas.' } };
						return Promise.reject(error);
					}
					return Promise.resolve({ data: {} });
				});
				renderWithClient();
				await act(async () => {
					fireEvent.click(screen.getByText('login'));
				});
				await waitFor(() => screen.getByTestId('error').textContent !== '');
				expect(screen.getByTestId('error').textContent).toBe('Credenciais inválidas.');
				expect(screen.getByTestId('auth').textContent).toBe('no');
			});

			it('deve lidar com refresh expirado e limpar sessão', async () => {
				// Mocka refresh expirado
				const api = (await import('../services/api')).default;
				vi.mocked(api.post).mockImplementationOnce((url: string) => {
					if (url === '/api/bff/auth/refresh') {
						const error = new Error('Sessão expirada.');
						(error as any).response = { data: { message: 'Sessão expirada.' } };
						return Promise.reject(error);
					}
					return Promise.resolve({ data: {} });
				});
				// Força user em cache para disparar refresh
				localStorage.setItem('finance_user', JSON.stringify({ email: 'a@b.com' }));
				renderWithClient();
				// Aguarda erro de sessão expirada
				await waitFor(() => screen.getByTestId('error').textContent !== '');
				expect(screen.getByTestId('error').textContent).toBe('Sessão expirada. Faça login novamente.');
				expect(screen.getByTestId('auth').textContent).toBe('no');
				expect(screen.getByTestId('user').textContent).toBe('none');
			});
});
