import { Link } from "@tanstack/react-router";
import { MapPin, Hospital, Droplet } from "lucide-react";
import { BloodChip, PriorityChip, StatusChip } from "./chips";
import { formatDistance, formatDateTime, timeAgo } from "@/lib/blood";
import type { BloodGroup, Urgency, RequestStatus, ResponseStatus } from "@/lib/blood";

export type RequestCardData = {
  id: string;
  blood_group: BloodGroup;
  units: number;
  urgency: Urgency;
  hospital_name: string;
  hospital_address?: string | null;
  required_by?: string | null;
  status: RequestStatus;
  created_at: string;
  distance_km?: number | null;
  my_response?: ResponseStatus | null;
};

export function RequestCard({ request, to }: { request: RequestCardData; to: string }) {
  return (
    <Link
      to="/request/$id"
      params={{ id: request.id }}
      className="block rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40"
      aria-label={`${request.blood_group} request at ${request.hospital_name}`}
      data-to={to}
    >
      <div className="flex items-start gap-3">
        <BloodChip group={request.blood_group} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityChip urgency={request.urgency} />
            <StatusChip status={request.status} />
            {request.my_response && (
              <span className="text-xs font-semibold text-success">
                You {request.my_response}
              </span>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 truncate text-sm font-semibold">
            <Hospital className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {request.hospital_name}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Droplet className="size-3.5" aria-hidden />
              {request.units} unit{request.units > 1 ? "s" : ""}
            </span>
            {request.distance_km !== undefined && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {formatDistance(request.distance_km)}
              </span>
            )}
            <span>{timeAgo(request.created_at)}</span>
          </p>
          {request.required_by && (
            <p className="mt-1 text-xs text-muted-foreground">
              Needed by {formatDateTime(request.required_by)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
