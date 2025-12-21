import { useMemo } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { salaryKeys } from "../lib/queryKeys";
import {
  createSalaryRecord,
  getSalaryHistory,
  updateSalaryRecord,
} from "../services/salaryService";
import { SalaryPayload } from "../types";
import { useAuth } from "../context/useAuth";

type Options = {
  enabled?: boolean;
};

const mapSalaryRecords = (records: any[]) => {
  return records.reduce<Record<string, any>>((acc, record) => {
    acc[record.month] = {
      ...record,
      hours: String(record.hours ?? 0),
      hourRate: String(record.hourRate ?? 0),
      taxRate: String(record.taxRate ?? 0),
    };
    return acc;
  }, {});
};

export function useSalary(month: string, options: Options = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const enabled = (options.enabled ?? true) && Boolean(userId);
  const salaryKey = userId ? salaryKeys.allForUser(userId) : (["salary", "disabled"] as const);

  const salaryQuery = useQuery({
    queryKey: salaryKey,
    queryFn: getSalaryHistory,
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    select: (records) => mapSalaryRecords(records),
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      targetMonth,
      payload,
    }: {
      targetMonth: string;
      payload: SalaryPayload;
    }) => {
      const records = salaryQuery.data ?? {};
      const existing = records[targetMonth];
      if (existing?.id) {
        return updateSalaryRecord(existing.id, { ...payload, month: targetMonth });
      }
      return createSalaryRecord({ ...payload, month: targetMonth });
    },
    onSuccess: () =>
      userId ? queryClient.invalidateQueries({ queryKey: salaryKeys.allForUser(userId) }) : Promise.resolve(),
  });

  const currentRecord = useMemo(() => {
    const records = salaryQuery.data ?? {};
    return records[month];
  }, [salaryQuery.data, month]);

  return {
    salaryQuery,
    recordsMap: salaryQuery.data ?? {},
    currentRecord,
    saveSalary: (targetMonth: string, payload: SalaryPayload) =>
      saveMutation.mutateAsync({ targetMonth, payload }),
  };
}
