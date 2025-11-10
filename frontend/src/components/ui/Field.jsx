import { Box, Typography } from "@mui/material";

export default function Field({ label, id, children, hint }) {
  return (
    <Box sx={{ width: "100%" }}>
      {label && (
        <Typography
          component="label"
          htmlFor={id}
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", textTransform: "uppercase", letterSpacing: 0.8, mb: 0.5 }}
        >
          {label}
        </Typography>
      )}
      {children}
      {hint && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
