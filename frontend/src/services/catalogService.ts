import api from "./api";
import { Debtor, DebtorPayload, Origin, OriginPayload } from "../types";
import {
  DebtorSchema,
  DebtorsSchema,
  OriginSchema,
  OriginsSchema,
} from "../lib/schemas";

export async function getOrigins(): Promise<Origin[]> {
  const { data } = await api.get<Origin[]>("/api/origins");
  return OriginsSchema.parse(data);
}

export async function createOrigin(payload: OriginPayload): Promise<Origin> {
  const { data } = await api.post<Origin>("/api/origins", payload);
  return OriginSchema.parse(data);
}

export async function updateOrigin(id: string, payload: OriginPayload): Promise<Origin> {
  const { data } = await api.patch<Origin>(`/api/origins/${id}`, payload);
  return OriginSchema.parse(data);
}

export async function deleteOrigin(id: string) {
  await api.delete(`/api/origins/${id}`);
}

export async function getDebtors(): Promise<Debtor[]> {
  const { data } = await api.get<Debtor[]>("/api/debtors");
  return DebtorsSchema.parse(data);
}

export async function createDebtor(payload: DebtorPayload): Promise<Debtor> {
  const { data } = await api.post<Debtor>("/api/debtors", payload);
  return DebtorSchema.parse(data);
}

export async function updateDebtor(id: string, payload: DebtorPayload): Promise<Debtor> {
  const { data } = await api.patch<Debtor>(`/api/debtors/${id}`, payload);
  return DebtorSchema.parse(data);
}

export async function deleteDebtor(id: string) {
  await api.delete(`/api/debtors/${id}`);
}
