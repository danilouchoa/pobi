import type { Meta, StoryObj } from '@storybook/react';
import EmptyState from './EmptyState';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    ctaLabel: { control: 'text' },
    icon: { control: false },
    onCtaClick: { action: 'cta clicked' },
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'Nenhum registro encontrado',
    description: 'Você ainda não cadastrou nenhuma origem. Clique abaixo para adicionar.',
    ctaLabel: 'Adicionar origem',
    icon: AddCircleOutlineIcon,
    iconProps: { fontSize: 'large', color: 'primary' },
  },
};
