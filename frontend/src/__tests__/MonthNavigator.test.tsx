// ...existing code moved from ../__tests__/MonthNavigator.test.tsx
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import MonthNavigator from '../components/MonthNavigator';

describe('MonthNavigator', () => {
  it('renderiza o mês atual', () => {
    render(<MonthNavigator month="2025-11" onChange={() => {}} />);
    // Aceita abreviação ou nome completo do mês (jan/janeiro, fev/fevereiro, nov/novembro)
    expect(
      screen.getByText((content: string) =>
        /nov(embro)?|jan(eiro)?|fev(eiro)?/i.test(content)
      )
    ).toBeInTheDocument();
  });
});
