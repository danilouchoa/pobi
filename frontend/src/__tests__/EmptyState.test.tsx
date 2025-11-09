import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmptyState from '../components/ui/EmptyState';

describe('EmptyState', () => {
	it('renderiza o título padrão', () => {
		render(<EmptyState title="Nenhum registro encontrado" />);
		expect(screen.getByText(/nenhum registro/i)).toBeInTheDocument();
	});

	it('renderiza o título customizado', () => {
		render(<EmptyState title="Nada encontrado!" />);
		expect(screen.getByText(/nada encontrado/i)).toBeInTheDocument();
	});

	it('renderiza a descrição se fornecida', () => {
		render(<EmptyState title="Teste" description="Descrição customizada" />);
		expect(screen.getByText(/descrição customizada/i)).toBeInTheDocument();
	});
});
