import { Box, LinearProgress, Stack, Typography } from "@mui/material";

export default function Pie({ data }) {
  if (!data?.length) {
    return (
      <Typography variant="body2" color="text.disabled">
        Sem dados para exibir.
      </Typography>
    );
  }

  const total = data.reduce((acc, item) => acc + item.value, 0) || 1;
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
      {sorted.map((item, index) => {
        const percentage = (item.value / total) * 100;
        return (
          <Box key={`${item.name}-${index}`} sx={{ flex: 1, minWidth: 180 }}>
            <LinearProgress
              variant="determinate"
              value={percentage}
              sx={{
                height: 8,
                borderRadius: 999,
                mb: 1,
                backgroundColor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  borderRadius: 999,
                  bgcolor: "secondary.main",
                },
              }}
            />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.primary" noWrap title={item.name}>
                {item.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {percentage.toFixed(0)}%
              </Typography>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
