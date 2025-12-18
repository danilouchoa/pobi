import type { Meta, StoryObj } from "@storybook/react";
import { Alert } from "../../ui/Alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  args: {
    title: "Erro",
    message: "Email ou senha incorretos.",
    variant: "error",
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Error: Story = {};

export const Info: Story = {
  args: {
    title: "Conectando",
    message: "Estamos validando seus dados...",
    variant: "info",
  },
};

export const Success: Story = {
  args: {
    title: "Conta criada",
    message: "Verifique seu e-mail para confirmar o acesso.",
    variant: "success",
  },
};
