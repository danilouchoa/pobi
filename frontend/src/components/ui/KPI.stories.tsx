import type { Meta, StoryObj } from '@storybook/react';
import KPI from './KPI';

const meta: Meta<typeof KPI> = {
  title: 'UI/KPI',
  component: KPI,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    sub: { control: 'text' },
    highlight: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof KPI>;

export const Default: Story = {
  args: {
    label: 'Saldo Atual',
    value: 'R$ 1.234,56',
    sub: 'Atualizado em 09/11/2025',
    highlight: false,
  },
};

export const Highlight: Story = {
  args: {
    label: 'Líquido (Mês)',
    value: 'R$ 8.900,00',
    highlight: true,
  },
};
