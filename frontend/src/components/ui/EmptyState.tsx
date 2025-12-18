import InboxIcon from "@mui/icons-material/Inbox";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { OverridableComponent } from "@mui/material/OverridableComponent";
import type { SvgIconTypeMap } from "@mui/material/SvgIcon";

/**
 * EmptyState
 *
 * Componente reutilizável usado em telas de CRUD quando não há registros.
 * Ajuda o usuário a entender o contexto (ex.: “Nenhuma categoria cadastrada”)
 * e oferece um CTA que navega para a ação apropriada (abrir modal, foco em formulário, etc.).
 * A abordagem visual consistente evita que cada lista precise reinventar o placeholder.
 */

type IconComponent = OverridableComponent<SvgIconTypeMap<unknown, "svg">> & {
  muiName?: string;
};

export type EmptyStateProps = {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  icon?: IconComponent;
  iconProps?: SvgIconProps;
};

export default function EmptyState({
  title,
  description,
  ctaLabel,
  onCtaClick,
  icon: Icon = InboxIcon,
  iconProps,
}: EmptyStateProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        textAlign: "center",
        borderStyle: "dashed",
        borderColor: "divider",
        bgcolor: "grey.50",
      }}
    >
      <CardContent>
        <Stack spacing={2} alignItems="center">
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: "background.paper",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)",
            }}
          >
            <Icon color="disabled" sx={{ fontSize: 36 }} {...iconProps} />
          </Box>
          <Stack spacing={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              {title}
            </Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}
          </Stack>
          {ctaLabel ? (
            /**
             * O CTA é opcional porque algumas listas apenas informam o estado vazio.
             * Quando presente, direciona o usuário para iniciar o fluxo de criação correspondente.
             */
            <Button variant="contained" color="primary" onClick={onCtaClick}>
              {ctaLabel}
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
