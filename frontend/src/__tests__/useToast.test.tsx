import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useToast } from '../hooks/useToast.ts';

vi.mock('notistack', () => ({
	useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}));

describe('useToast', () => {
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
	);

	it('deve exibir toast de sucesso', () => {
		const { result } = renderHook(() => useToast(), { wrapper });
		expect(() => result.current.success('Sucesso!')).not.toThrow();
	});

	it('deve exibir toast de erro', () => {
		const { result } = renderHook(() => useToast(), { wrapper });
		expect(() => result.current.error('Erro!')).not.toThrow();
	});

	it('deve exibir toast de info', () => {
		const { result } = renderHook(() => useToast(), { wrapper });
		expect(() => result.current.info('Info!')).not.toThrow();
	});

	it('deve exibir toast de warning', () => {
		const { result } = renderHook(() => useToast(), { wrapper });
		expect(() => result.current.warning('Atenção!')).not.toThrow();
	});
});
