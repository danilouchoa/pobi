import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { AnimatePresence, motion } from "framer-motion";
import {
  compareMonths,
  formatMonthLabel,
  getNextMonth,
  getPreviousMonth,
} from "../utils/dateHelpers";

type MonthNavigatorProps = {
  month: string;
  onChange: (value: string) => void;
};

const MotionDiv = motion.div;

export default function MonthNavigator({ month, onChange }: MonthNavigatorProps) {
  const [direction, setDirection] = useState(0);
  const lastMonthRef = useRef(month);

  useEffect(() => {
    if (lastMonthRef.current !== month) {
      const diff = compareMonths(month, lastMonthRef.current);
      setDirection(diff === 0 ? 0 : diff > 0 ? 1 : -1);
      lastMonthRef.current = month;
    }
  }, [month]);

  const handlePrevious = () => {
    setDirection(-1);
    onChange(getPreviousMonth(month));
  };

  const handleNext = () => {
    setDirection(1);
    onChange(getNextMonth(month));
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <IconButton aria-label="Mês anterior" onClick={handlePrevious} size="small">
        <ChevronLeftIcon />
      </IconButton>
      <Box sx={{ overflow: "hidden", minWidth: 160, textAlign: "center" }}>
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <MotionDiv
            key={month}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.3 }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ textTransform: "none" }}>
              {formatMonthLabel(month)}
            </Typography>
          </MotionDiv>
        </AnimatePresence>
      </Box>
      <IconButton aria-label="Próximo mês" onClick={handleNext} size="small">
        <ChevronRightIcon />
      </IconButton>
    </Box>
  );
}
