import { forwardRef } from "react";
import MuiTab from "@mui/material/Tab";

const Tab = forwardRef(({ id, name, ...props }, ref) => (
  <MuiTab
    ref={ref}
    value={id}
    label={name}
    wrapped
    disableRipple
    sx={{
      textTransform: "none",
      fontWeight: 600,
      borderRadius: 2,
      minHeight: 48,
      "&.Mui-selected": {
        color: "secondary.main",
      },
    }}
    {...props}
  />
));

Tab.displayName = "Tab";

export default Tab;
