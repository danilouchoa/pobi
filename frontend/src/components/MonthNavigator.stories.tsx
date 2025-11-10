/**
 * MonthNavigator Stories
 * 
 * Componente de navegação temporal para trocar entre meses.
 * Usado nas views de Dashboard e Lançamentos.
 */

import type { Meta, StoryObj } from '@storybook/react';
import MonthNavigator from './MonthNavigator';
import { useState } from 'react';

const meta: Meta<typeof MonthNavigator> = {
  title: 'Components/MonthNavigator',
  component: MonthNavigator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof MonthNavigator>;

/**
 * Controle do componente MonthNavigator com useState
 */
export const Controlled: Story = {
  render: () => {
    const [month, setMonth] = useState('2025-11');
    return <MonthNavigator month={month} onChange={setMonth} />;
  },
};
