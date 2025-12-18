import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../ui/Button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: {
    label: "Entrar",
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: "primary",
  },
};

export const Secondary: Story = {
  args: {
    label: "Criar conta",
    variant: "secondary",
  },
};

export const Ghost: Story = {
  args: {
    label: "Esqueci a senha",
    variant: "ghost",
  },
};

export const Danger: Story = {
  args: {
    label: "Excluir",
    variant: "danger",
  },
};

export const Loading: Story = {
  args: {
    variant: "primary",
    isLoading: true,
    label: "Autenticando...",
  },
};
