"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { addRecentSearch, cn } from "@/lib/utils";
import { IPlace } from "@/types/common";
import React, { useEffect, useMemo, useState } from "react";
import RecentSearches from "./RecentSearches";
import { Input } from "@/components/ui/input";
import { useConfig } from "@/contexts/ConfigContext";
import { getDawarichPoints } from "@/handlers/api/dawarich.handler";
import { NormalizedPoint } from "@/types/dawarich";
import { CircleX, MapPin } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import dynamic from "next/dynamic";

const LazyMap = dynamic(() => import("./Map"), {
  ssr: false,
});

interface TagMissingLocationDawarichSearchAndAddProps {
  onSubmit: (place: IPlace) => Promise<any>;
  onOpenChange: (open: boolean) => void;
  onLocationChange: (place: IPlace) => void;
  selectedAssetsDateRange: { start: Date; end: Date };
}

const LOCAL_STORAGE_DAWARICH_API_KEY = "dawarich-api-key";

function pointToPlace(point: NormalizedPoint): IPlace {
  return {
    name: point.name ?? `${point.latitude}, ${point.longitude}`,
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

export default function TagMissingLocationDawarichSearchAndAdd({
  onSubmit,
  onOpenChange,
  onLocationChange,
  selectedAssetsDateRange,
}: TagMissingLocationDawarichSearchAndAddProps) {
  const { toast } = useToast();
  const { dawarichApiKeyConfigured } = useConfig();

  const [dirtyApiKey, setDirtyApiKey] = useState("");
  const [apiKey, setApiKey] = useState<string | undefined>(() => {
    if (dawarichApiKeyConfigured) {
      return undefined;
    }
    return localStorage.getItem(LOCAL_STORAGE_DAWARICH_API_KEY) ?? undefined;
  });
  const [fetchState, setFetchState] = useState<"fetching" | "done" | "failed">(
    "fetching",
  );
  const [points, setPoints] = useState<NormalizedPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<NormalizedPoint | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const saveApiKey = () => {
    setApiKey(dirtyApiKey);
    localStorage.setItem(LOCAL_STORAGE_DAWARICH_API_KEY, dirtyApiKey);
  };

  const clearApiKey = () => {
    setDirtyApiKey("");
    setApiKey(undefined);
    localStorage.removeItem(LOCAL_STORAGE_DAWARICH_API_KEY);
    setPoints([]);
  };

  useEffect(() => {
    const fetchPoints = async () => {
      if (!dawarichApiKeyConfigured && !apiKey) {
        return;
      }

      setFetchState("fetching");

      try {
        const startDate = selectedAssetsDateRange.start.toISOString();
        const endDate = selectedAssetsDateRange.end.toISOString();
        const points = await getDawarichPoints(startDate, endDate, apiKey);
        setPoints(points);
        setFetchState("done");
      } catch (error: any) {
        console.error("Error fetching points from Dawarich:", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to fetch points from Dawarich",
        });
        setFetchState("failed");
      }
    };
    fetchPoints();
  }, [dawarichApiKeyConfigured, apiKey, selectedAssetsDateRange]);

  const handleSelect = (point: NormalizedPoint) => {
    setSelectedPoint(point);
    onLocationChange(pointToPlace(point));
  };

  const handleSubmit = () => {
    if (!selectedPoint) {
      return;
    }

    setSubmitting(true);

    const place = pointToPlace(selectedPoint);
    onSubmit(place)
      .then(() => {
        // Save to recent searches
        addRecentSearch(place, "dawarich");
        toast({
          title: "Location updated",
          description: "Location updated successfully",
        });
      })
      .then(() => {
        onOpenChange(false);
        setSelectedPoint(null);
        setPoints([]);
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Error updating location",
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const renderPoint = (point: NormalizedPoint) => {
    return (
      <PopoverTrigger key={point.id}>
        <div
          onClick={() => handleSelect(point)}
          className={cn(
            "hover:bg-zinc-200 dark:hover:bg-zinc-800 flex justify-between items-center px-3 py-2 rounded-lg cursor-pointer border",
            {
              "bg-zinc-200 dark:bg-zinc-800 border-primary":
                selectedPoint?.id === point.id,
            },
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <p className="text-sm line-clamp-2">{point.name}</p>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {new Date(point.dateTime).toLocaleString()} -{" "}
                {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
              </span>
              {point.topic && (
                <span className="text-xs text-muted-foreground">
                  {point.topic}
                </span>
              )}
            </div>
          </div>
        </div>
      </PopoverTrigger>
    );
  };

  return (
    <div className="flex flex-col gap-4 py-4 px-2">
      {!dawarichApiKeyConfigured && !apiKey ? (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Dawarich API Key"
            value={dirtyApiKey}
            onChange={(e) => setDirtyApiKey(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={saveApiKey}
            disabled={!dirtyApiKey.length || submitting}
          >
            Save
          </Button>
        </div>
      ) : (
        <>
          {/* Recent Searches */}
          <RecentSearches
            searchType="dawarich"
            onSelect={(place) => {
              setSelectedPoint({
                id: place.name,
                name: place.name,
                latitude: place.latitude,
                longitude: place.longitude,
                dateTime: new Date().toISOString(),
              });
              onLocationChange(place);
            }}
            selectedPlace={selectedPoint ? pointToPlace(selectedPoint) : null}
            className="mb-0"
          />

          <hr />

          {fetchState === "fetching" ? (
            <p className="w-full text-center">Fetching points...</p>
          ) : fetchState === "failed" ? (
            <p className="w-full text-center text-red-500">
              Failed to fetch points. Please check the logs for more details.
            </p>
          ) : points.length === 0 ? (
            <p className="w-full text-center">
              No points found for date range of selected images.
            </p>
          ) : (
            <Popover>
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                {points.map((point) =>
                  selectedPoint?.id === point.id ? (
                    <PopoverAnchor key={`${point.id}-anchor`} asChild>
                      {renderPoint(point)}
                    </PopoverAnchor>
                  ) : (
                    renderPoint(point)
                  ),
                )}
              </div>
              <PopoverContent forceMount className="border-primary w-auto pt-9">
                <PopoverArrow className="fill-primary" />
                <PopoverClose className="absolute top-2 right-2">
                  <CircleX className="h-6 w-6 text-muted-foreground" />
                </PopoverClose>
                <LazyMap
                  location={{
                    latitude: selectedPoint?.latitude ?? 0,
                    longitude: selectedPoint?.longitude ?? 0,
                    name: selectedPoint?.name ?? "Not selected",
                  }}
                />
              </PopoverContent>
            </Popover>
          )}

          <div className="flex justify-between w-full">
            {dawarichApiKeyConfigured ? (
              <div />
            ) : (
              <Button variant="outline" onClick={clearApiKey}>
                Clear API Key
              </Button>
            )}
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={!selectedPoint || submitting}
            >
              {submitting ? "Tagging..." : "Tag Location"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
