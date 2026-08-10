import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Subscribes to a realtime table and invalidates the given query keys on change. */
export function useRealtime(
  channelName: string,
  table: "messages" | "notifications" | "request_responses" | "blood_requests",
  keys: unknown[][],
  filter?: string,
) {
  const queryClient = useQueryClient();
  const keyString = JSON.stringify(keys);

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        filter
          ? { event: "*", schema: "public", table, filter }
          : { event: "*", schema: "public", table },
        () => {
          for (const key of JSON.parse(keyString) as unknown[][]) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, table, filter, keyString, queryClient]);
}
