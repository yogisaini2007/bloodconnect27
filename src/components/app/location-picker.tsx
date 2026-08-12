import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { requestBrowserLocation } from "@/lib/geo";
import { searchPlaces, reverseGeocode, type Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

export type LocationValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

export function LocationPicker({
  label,
  hint,
  placeholder = "Type an address, area or hospital name",
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  error?: string | undefined;
}) {
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const typingRef = useRef(false);

  useEffect(() => {
    if (!typingRef.current) return;
    const q = value.address;
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const places = await searchPlaces(q, controller.signal);
        setResults(places);
        setOpen(true);
      } catch {
        /* aborted or offline — keep manual entry usable */
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value.address]);

  async function useCurrent() {
    setLocating(true);
    const result = await requestBrowserLocation();
    if (!result.ok) {
      setLocating(false);
      toast.error(result.message);
      return;
    }
    const address = await reverseGeocode(result.lat, result.lng);
    typingRef.current = false;
    setResults([]);
    setOpen(false);
    onChange({
      address: address ?? `${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`,
      lat: result.lat,
      lng: result.lng,
    });
    setLocating(false);
    toast.success("Current location captured");
  }

  function pick(place: Place) {
    typingRef.current = false;
    setResults([]);
    setOpen(false);
    onChange({ address: place.label, lat: place.lat, lng: place.lng });
  }

  const pinned = value.lat != null && value.lng != null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.address}
          maxLength={300}
          placeholder={placeholder}
          className="h-12 pl-9"
          onChange={(e) => {
            typingRef.current = true;
            onChange({ address: e.target.value, lat: null, lng: null });
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {open && results.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
            {results.map((place) => (
              <li key={`${place.lat},${place.lng},${place.label}`}>
                <button
                  type="button"
                  onClick={() => pick(place)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="line-clamp-2">{place.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={useCurrent}
        disabled={locating}
      >
        {locating ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <MapPin className="mr-1.5 size-4" />
        )}
        Use my current location
      </Button>

      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : (
        <p className={cn("flex items-center gap-1 text-xs", pinned ? "text-tertiary" : "text-muted-foreground")}>
          {pinned && <Check className="size-3" />}
          {pinned
            ? `Pinned at ${value.lat!.toFixed(4)}, ${value.lng!.toFixed(4)}`
            : (hint ?? "Pick a suggestion or use your current location to pin coordinates.")}
        </p>
      )}
    </div>
  );
}
