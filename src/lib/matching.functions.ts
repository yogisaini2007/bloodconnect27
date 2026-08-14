import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type ChatThread =
  Database["public"]["Functions"]["chat_threads_for"]["Returns"][number];
export type Donor =
  Database["public"]["Functions"]["find_donors_for"]["Returns"][number];

export const getChatThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatThread[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("chat_threads_for", {
      p_user: context.userId,
    });
    if (error) throw new Error("Unable to load conversations");
    return (data ?? []) as ChatThread[];
  });

export const getRequestDonors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<Donor[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("find_donors_for", {
      p_request_id: data.requestId,
      p_user: context.userId,
    });
    if (error) throw new Error("Unable to load donors");
    return (rows ?? []) as Donor[];
  });
