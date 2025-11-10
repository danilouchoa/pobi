import { Paper, Stack, Typography, Box } from "@mui/material";

export default function Section({ title, subtitle, right, children }) {
  return (
    <Paper sx={{ p: { xs: 3, md: 4 } }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {right}
      </Stack>
      {children}
    </Paper>
  );
}
