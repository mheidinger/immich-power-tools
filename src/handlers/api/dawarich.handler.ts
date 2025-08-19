import { DAWARICH_POINTS_PATH } from "@/config/routes";
import API from "@/lib/api";
import { NormalizedPoint } from "@/types/dawarich";

export const getDawarichPoints = async (
  startDate: string,
  endDate: string,
  apiKey?: string,
): Promise<NormalizedPoint[]> => {
  return API.get(
    DAWARICH_POINTS_PATH,
    { startDate, endDate },
    { "X-Dawarich-Api-Key": apiKey },
  );
};
