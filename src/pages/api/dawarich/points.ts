import { ENV } from "@/config/environment";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { NormalizedPoint, Point, PointArraySchema } from "@/types/dawarich";
import { NextApiRequest, NextApiResponse } from "next";

function toPointName(point: Point): string | undefined {
  const name =
    point.geodata?.properties?.name || point.geodata?.properties?.street;
  const city = point.geodata?.properties?.city || point.city;
  const state = point.geodata?.properties?.state;
  const country =
    point.geodata?.properties?.country || point.countryName || point.country;

  return [name, city, state, country].filter(Boolean).join(", ") || undefined;
}

// Regex for "POINT (1.0000000 2.0000000)"
const LONLAT_REGEX = /.*\((-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/;
function toPointCoordinates(point: Point):
  | {
      latitude: number;
      longitude: number;
    }
  | undefined {
  if (point.latitude && point.longitude) {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
    };
  }

  const lonlatMatch = point.lonlat?.match(LONLAT_REGEX);
  if (lonlatMatch) {
    return {
      latitude: parseFloat(lonlatMatch[2]),
      longitude: parseFloat(lonlatMatch[1]),
    };
  }

  if (point.geodata?.geometry?.coordinates) {
    return {
      latitude: point.geodata.geometry.coordinates[1],
      longitude: point.geodata.geometry.coordinates[0],
    };
  }
}

async function makeRequest(
  start: Date,
  end: Date,
  apiKey: string,
): Promise<NormalizedPoint[]> {
  const searchParams = new URLSearchParams();
  searchParams.append("start_at", start.toISOString());
  searchParams.append("end_at", end.toISOString());
  searchParams.append("per_page", "50");

  const response = await fetch(
    `${ENV.DAWARICH_URL}/api/v1/points?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (response.status !== 200){
    console.log("Dawarich API call failed:", response.statusText, await response.text())
    throw new Error("Dawarich API call failed")
  }

  const json = await response.json();
  const parsedResponse = PointArraySchema.parse(json);

  return parsedResponse
    .map((point: Point) => {
      const coordinates = toPointCoordinates(point);
      if (!coordinates) {
        return;
      }

      return {
        id: point.id.toString(),
        topic: point.topic ?? undefined,
        name: toPointName(point),
        dateTime: new Date(point.timestamp * 1000),
        ...coordinates,
      };
    })
    .filter((point) => !!point);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!ENV.DAWARICH_URL) {
    return res.status(500).json({ error: "Dawarich URL is not configured" });
  }

  const apiKeyHeader = req.headers["x-dawarich-api-key"];
  const apiKey =
    ENV.DAWARICH_API_KEY ||
    (Array.isArray(apiKeyHeader) ? apiKeyHeader?.[0] : apiKeyHeader);
  if (!apiKey) {
    return res.status(400).json({ error: "Dawarich API key is required" });
  }

  const startDateStr = req.query.startDate;
  let startDate = startDateStr
    ? new Date(Array.isArray(startDateStr) ? startDateStr[0] : startDateStr)
    : undefined;
  const endDateStr = req.query.endDate;
  let endDate = endDateStr
    ? new Date(Array.isArray(endDateStr) ? endDateStr[0] : endDateStr)
    : undefined;

  // If there is no startDate, set it to 30min before the endDate and put endDate 30min forward
  if (!startDate && endDate) {
    startDate = new Date(endDate.getTime() - 30 * 60 * 1000);
    endDate = new Date(endDate.getTime() + 30 * 60 * 1000);
  }

  // Do the same if there is no endDate
  if (!endDate && startDate) {
    endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
    startDate = new Date(startDate.getTime() - 30 * 60 * 1000);
  }

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "At least one of startDate or endDate is required" });
  }

  try {
    let points: NormalizedPoint[] = [];
    for (let i = 0; i < 3; i++) {
      points = await makeRequest(startDate, endDate, apiKey);

      if (points.length > 0) {
        break; // If we got points, we can stop trying
      }

      // If we could not find anything, we will try to extend the time range exponentially (by 1 hour * 2^i).
      const multiplier = Math.pow(2, i);
      startDate = new Date(startDate.getTime() - 30 * 60 * 1000 * multiplier);
      endDate = new Date(endDate.getTime() + 30 * 60 * 1000 * multiplier);
    }

    res.json(points);
    res.end();
  } catch (error: any) {
    console.error("Dawarich error:", error);
    res.status(500).json({ error: error?.message });
  }
}
