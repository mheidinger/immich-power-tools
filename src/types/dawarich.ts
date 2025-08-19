import { z } from "zod";

export const PointSchema = z.object({
  id: z.number(),
  topic: z.string().nullish(), // e.g. "Google Maps Phone Timeline Export"
  longitude: z.coerce.number().nullish(),
  timestamp: z.number(),
  latitude: z.coerce.number().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  countryName: z.string().nullish(),
  lonlat: z.string().nullish(),
  geodata: z
    .object({
      geometry: z
        .object({
          coordinates: z.array(z.number()).length(2), // [longitude, latitude]
        })
        .nullish(),
      properties: z
        .object({
          name: z.string().nullish(),
          street: z.string().nullish(),
          city: z.string().nullish(),
          state: z.string().nullish(),
          country: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
});

export const PointArraySchema = z.array(PointSchema);

export type Point = z.infer<typeof PointSchema>;
export type PointArray = z.infer<typeof PointArraySchema>;

export interface NormalizedPoint {
  id: string;
  name?: string;
  dateTime: Date | string;
  latitude: number;
  longitude: number;
  topic?: string;
}
