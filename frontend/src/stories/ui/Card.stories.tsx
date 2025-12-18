import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const AuthShell: Story = {
  args: {
    title: "Entrar",
    description: "Acesse com e-mail e senha. Sua sessão é protegida por cookies seguros.",
    actions: <Button label="Criar conta" variant="ghost" />, 
    children: <div>Conteúdo do formulário vai aqui.</div>,
  },
};
