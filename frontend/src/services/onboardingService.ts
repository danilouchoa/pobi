import api from "./api";
import { OnboardingDTO, OnboardingPatch } from "../types";

export const getOnboarding = async (): Promise<OnboardingDTO> => {
  const { data } = await api.get<OnboardingDTO>("/api/onboarding");
  return data;
};

export const patchOnboarding = async (payload: OnboardingPatch): Promise<OnboardingDTO> => {
  const { data } = await api.patch<OnboardingDTO>("/api/onboarding", payload);
  return data;
};

export const skipOnboarding = async (): Promise<OnboardingDTO> => {
  const { data } = await api.post<OnboardingDTO>("/api/onboarding/skip");
  return data;
};

export const completeOnboarding = async (): Promise<OnboardingDTO> => {
  const { data } = await api.post<OnboardingDTO>("/api/onboarding/complete");
  return data;
};
