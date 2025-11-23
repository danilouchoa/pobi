import api from "./api";
import { SalaryPayload, SalaryRecord } from "../types";
import { SalaryRecordSchema, SalaryRecordsSchema } from "../lib/schemas";

export async function getSalaryHistory(): Promise<SalaryRecord[]> {
  const { data } = await api.get<SalaryRecord[]>("/api/salaryHistory");
  return SalaryRecordsSchema.parse(data);
}

export async function createSalaryRecord(payload: SalaryPayload & { month: string }) {
  const { data } = await api.post<SalaryRecord>("/api/salaryHistory", payload);
  return SalaryRecordSchema.parse(data);
}

export async function updateSalaryRecord(
  id: string,
  payload: SalaryPayload & { month: string }
) {
  const { data } = await api.put<SalaryRecord>(`/api/salaryHistory/${id}`, payload);
  return SalaryRecordSchema.parse(data);
}
