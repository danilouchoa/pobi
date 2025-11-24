import type { Meta, StoryObj } from "@storybook/react";
import { TextField } from "../../ui/TextField";

const meta: Meta<typeof TextField> = {
  title: "UI/TextField",
  component: TextField,
  args: {
    label: "Email",
    name: "email",
    placeholder: "nome@empresa.com",
    helperText: "Use o e-mail corporativo para facilitar o reconhecimento",
  },
};

export default meta;
type Story = StoryObj<typeof TextField>;

export const Default: Story = {};

export const Error: Story = {
  args: {
    error: "Email inválido",
  },
};

export const Password: Story = {
  args: {
    label: "Senha",
    name: "password",
    type: "password",
    helperText: "Mínimo de 8 caracteres com letra e número",
  },
};
