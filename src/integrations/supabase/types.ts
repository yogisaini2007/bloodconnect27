export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      blood_requests: {
        Row: {
          blood_group: Database["public"]["Enums"]["blood_group"]
          created_at: string
          hospital_address: string
          hospital_name: string
          hospital_phone: string | null
          id: string
          lat: number | null
          lng: number | null
          note: string | null
          patient_name: string
          radius_km: number
          requester_id: string
          required_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          units: number
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          blood_group: Database["public"]["Enums"]["blood_group"]
          created_at?: string
          hospital_address?: string
          hospital_name: string
          hospital_phone?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          patient_name?: string
          radius_km?: number
          requester_id: string
          required_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          units?: number
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          blood_group?: Database["public"]["Enums"]["blood_group"]
          created_at?: string
          hospital_address?: string
          hospital_name?: string
          hospital_phone?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          patient_name?: string
          radius_km?: number
          requester_id?: string
          required_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          units?: number
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id: string
          request_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          request_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          request_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          request_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blood_group: Database["public"]["Enums"]["blood_group"] | null
          created_at: string
          current_address: string
          full_name: string
          id: string
          is_available: boolean
          last_donation_date: string | null
          lat: number | null
          lng: number | null
          location_updated_at: string | null
          onboarded: boolean
          permanent_address: string
          phone: string
          updated_at: string
        }
        Insert: {
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          created_at?: string
          current_address?: string
          full_name?: string
          id: string
          is_available?: boolean
          last_donation_date?: string | null
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          onboarded?: boolean
          permanent_address?: string
          phone?: string
          updated_at?: string
        }
        Update: {
          blood_group?: Database["public"]["Enums"]["blood_group"] | null
          created_at?: string
          current_address?: string
          full_name?: string
          id?: string
          is_available?: boolean
          last_donation_date?: string | null
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          onboarded?: boolean
          permanent_address?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_responses: {
        Row: {
          created_at: string
          donor_id: string
          eta_note: string | null
          id: string
          request_id: string
          status: Database["public"]["Enums"]["response_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          donor_id: string
          eta_note?: string | null
          id?: string
          request_id: string
          status: Database["public"]["Enums"]["response_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          donor_id?: string
          eta_note?: string | null
          id?: string
          request_id?: string
          status?: Database["public"]["Enums"]["response_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_donate_to: {
        Args: {
          donor: Database["public"]["Enums"]["blood_group"]
          recipient: Database["public"]["Enums"]["blood_group"]
        }
        Returns: boolean
      }
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_eligible: { Args: { last_donation: string }; Returns: boolean }
      nearby_requests: {
        Args: never
        Returns: {
          blood_group: Database["public"]["Enums"]["blood_group"]
          created_at: string
          distance_km: number
          hospital_address: string
          hospital_name: string
          hospital_phone: string
          id: string
          my_response: Database["public"]["Enums"]["response_status"]
          note: string
          patient_name: string
          requester_id: string
          required_by: string
          status: Database["public"]["Enums"]["request_status"]
          units: number
          urgency: Database["public"]["Enums"]["urgency_level"]
        }[]
      }
    }
    Enums: {
      blood_group: "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-"
      request_status: "active" | "fulfilled" | "cancelled" | "expired"
      response_status: "accepted" | "declined"
      urgency_level: "critical" | "urgent" | "normal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      blood_group: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
      request_status: ["active", "fulfilled", "cancelled", "expired"],
      response_status: ["accepted", "declined"],
      urgency_level: ["critical", "urgent", "normal"],
    },
  },
} as const
