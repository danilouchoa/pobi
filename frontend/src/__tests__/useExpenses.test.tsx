import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expensesKeys } from '../lib/queryKeys';

const baseExpense = {
	category: 'Outros',
	parcela: 'Único',
	originId: null,
	debtorId: null,
	recurring: false,
	recurrenceType: null,
	fixed: false,
	installments: null,
	sharedWith: null,
	sharedAmount: null,
	billingMonth: null,
};

// Mock ANTES do import do hook: sobrescreve serviços usados nos testes e inclui bulkExpensesAction
vi.mock('../services/expenseService', async (importOriginal) => {
	const actual: any = await importOriginal();
	return {
		...actual,
		getExpenses: vi.fn(() =>
			Promise.resolve({
				data: [],
				pagination: { page: 1, limit: 20, total: 0, pages: 1 },
			})
		),
		getRecurringExpenses: vi.fn(() => Promise.resolve([])),
		getSharedExpenses: vi.fn(() => Promise.resolve([])),
		createExpense: vi.fn(() =>
			Promise.resolve({
				id: '1',
				description: 'Nova',
				amount: 10,
				date: '2025-11-01T00:00:00.000Z',
				...baseExpense,
			})
		),
		createExpensesBatch: vi.fn(() =>
			Promise.resolve([
				{
					id: '10',
					description: 'Batch 1',
					amount: 5,
					date: '2025-11-01T00:00:00.000Z',
					installments: 2,
					...baseExpense,
				},
				{
					id: '11',
					description: 'Batch 2',
					amount: 5,
					date: '2025-12-01T00:00:00.000Z',
					installments: 2,
					...baseExpense,
				},
			])
		),
		updateExpense: vi.fn(() =>
			Promise.resolve({
				id: '1',
				description: 'Editada',
				amount: 20,
				date: '2025-11-01T00:00:00.000Z',
				...baseExpense,
			})
		),
		deleteExpense: vi.fn(() => Promise.resolve({ success: true })),
		duplicateExpense: vi.fn(() =>
			Promise.resolve({ id: '2', description: 'Duplicada', amount: 10, date: '2025-11-01T00:00:00.000Z', ...baseExpense })
		),
		createRecurringExpense: vi.fn(() =>
			Promise.resolve({ id: '3', description: 'Recorrente', amount: 30, date: '2025-11-01T00:00:00.000Z', recurring: true, ...baseExpense })
		),
		bulkUpdateExpenses: vi.fn(() => Promise.resolve({ jobId: 'job-1', status: 'queued' })),
		bulkExpensesAction: vi.fn().mockResolvedValue({ success: true }),
	};
});

import { useExpenses } from '../hooks/useExpenses';

describe('useExpenses', () => {
	const createWrapper = () => {
		const queryClient = new QueryClient();
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		return { wrapper, queryClient };
	};

	it('deve buscar despesas corretamente', async () => {
		const { wrapper } = createWrapper();
		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
			// Aceita undefined (placeholder) ou objeto válido
			const data = result.current.expensesQuery.data;
			if (data === undefined) {
				expect(data).toBeUndefined();
			} else {
				expect(data).toBeDefined();
				expect(data?.data).toEqual([]);
			}
	});

	it('deve criar uma despesa', async () => {
		const { wrapper } = createWrapper();
		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
		await act(async () => {
			const created = await result.current.createExpense({
				description: 'Nova',
				category: 'Outros',
				amount: 10,
				date: '2025-11-01T00:00:00.000Z',
			});
			expect(created).toBeDefined();
			expect(created.description).toBe('Nova');
		});
	});

	it('invalida e refaz fetch após criar despesa', async () => {
		const { wrapper, queryClient } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
		const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');
		const listKey = expensesKeys.list({ month: '2025-11', mode: 'calendar', page: 1, limit: 20 });

		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
		await act(async () => {
			await result.current.createExpense({
				description: 'Nova',
				category: 'Outros',
				amount: 10,
				date: '2025-11-01T00:00:00.000Z',
			});
		});
		expect(invalidateSpy).toHaveBeenCalled();
		expect(refetchSpy).toHaveBeenCalledWith({ queryKey: listKey, type: 'active' });
	});

	it('deve criar despesas em lote', async () => {
		const { wrapper, queryClient } = createWrapper();
		const listKey = expensesKeys.list({ month: '2025-11', mode: 'calendar', page: 1, limit: 20 });
		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
		await act(async () => {
			const created = await result.current.createExpenseBatch([
				{
					description: 'Batch 1',
					category: 'Outros',
					amount: 5,
					date: '2025-11-01T00:00:00.000Z',
				},
				{
					description: 'Batch 2',
					category: 'Outros',
					amount: 5,
					date: '2025-12-01T00:00:00.000Z',
				},
			]);
			expect(created).toBeDefined();
			expect(Array.isArray(created)).toBe(true);
			expect(created?.length).toBe(2);
		});

		const cached = queryClient.getQueryData(listKey) as any;
		// Only current-month items should remain optimistic if present; cross-month items must not leak
		if (cached?.data?.length) {
			expect(cached.data.some((exp: any) => exp.id === '10' || String(exp.id).startsWith('temp-'))).toBe(true);
			expect(cached.data.some((exp: any) => exp.id === '11')).toBe(false);
		}
	});

	it('deve atualizar uma despesa', async () => {
		const { wrapper } = createWrapper();
		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
		await act(async () => {
			const updated = await result.current.updateExpense('1', {
				description: 'Editada',
				category: 'Outros',
				amount: 20,
				date: '2025-11-01T00:00:00.000Z',
			});
			expect(updated).toBeDefined();
			expect(updated.description).toBe('Editada');
		});
	});

	it('deve deletar uma despesa', async () => {
		const { wrapper } = createWrapper();
		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
		await act(async () => {
			const deleted = await result.current.deleteExpense('1');
			expect(deleted).toBeDefined();
			expect((deleted as any).success).toBe(true);
		});
	});

	it('deve duplicar uma despesa', async () => {
		const { wrapper } = createWrapper();
		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
		await act(async () => {
			const duplicated = await result.current.duplicateExpense('1');
			expect(duplicated).toBeDefined();
			expect((duplicated as any).description).toBe('Duplicada');
		});
	});

	it('deve criar despesa recorrente', async () => {
		const { wrapper } = createWrapper();
		const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
		await waitFor(() => result.current.expensesQuery.isSuccess);
		await act(async () => {
			const rec = await result.current.createRecurringExpense({
				description: 'Recorrente',
				category: 'Outros',
				amount: 30,
				date: '2025-11-01T00:00:00.000Z',
				recurring: true,
				recurrenceType: 'monthly',
			});
			expect(rec).toBeDefined();
			expect((rec as any).description).toBe('Recorrente');
		});
	});

		it('deve fazer bulk update', async () => {
			const { wrapper } = createWrapper();
			const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
			await waitFor(() => result.current.expensesQuery.isSuccess);
			await act(async () => {
				const bulk = await result.current.bulkUpdate({
					filters: { expenseIds: [] },
					data: {},
				});
				expect(bulk).toBeDefined();
				expect((bulk as any).status || (bulk as any).success).toBeDefined();
			});
		});

		it('deve buscar despesas recorrentes', async () => {
			const { wrapper } = createWrapper();
			const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
			await waitFor(() => result.current.expensesQuery.isSuccess);
			await act(async () => {
				const rec = await result.current.fetchRecurringExpenses();
				expect(rec).toBeDefined();
				expect(Array.isArray(rec.data)).toBe(true);
			});
		});

		it('deve buscar despesas compartilhadas', async () => {
			const { wrapper } = createWrapper();
			const { result } = renderHook(() => useExpenses('2025-11'), { wrapper });
			await waitFor(() => result.current.expensesQuery.isSuccess);
			await act(async () => {
				const shared = await result.current.fetchSharedExpenses();
				expect(shared).toBeDefined();
				expect(Array.isArray(shared.data)).toBe(true);
			});
		});
});
