import { Card, CardContent, Typography } from "@mui/material";

export default function KPI({ label, value, sub, highlight }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        border: highlight ? "2px solid" : "1px solid",
        borderColor: highlight ? "secondary.main" : "divider",
        boxShadow: highlight ? 6 : 0,
      }}
    >
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
