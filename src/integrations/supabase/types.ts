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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audio_files: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_url: string | null
          frequency_id: string | null
          id: string
          is_active: boolean
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          file_url?: string | null
          frequency_id?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          file_url?: string | null
          frequency_id?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_files_frequency_id_fkey"
            columns: ["frequency_id"]
            isOneToOne: false
            referencedRelation: "frequencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_id: string
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          org_id: string
          practitioner_id: string
          service_id: string
          session_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          org_id: string
          practitioner_id: string
          service_id: string
          session_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          practitioner_id?: string
          service_id?: string
          session_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencies: {
        Row: {
          benefits: string | null
          body_area_tags: string[]
          color: string | null
          created_at: string
          description: string | null
          goal_tags: string[]
          hz: number
          id: string
          name: string
          pain_affinity: number
          sleep_affinity: number
          stress_affinity: number
        }
        Insert: {
          benefits?: string | null
          body_area_tags?: string[]
          color?: string | null
          created_at?: string
          description?: string | null
          goal_tags?: string[]
          hz: number
          id?: string
          name: string
          pain_affinity?: number
          sleep_affinity?: number
          stress_affinity?: number
        }
        Update: {
          benefits?: string | null
          body_area_tags?: string[]
          color?: string | null
          created_at?: string
          description?: string | null
          goal_tags?: string[]
          hz?: number
          id?: string
          name?: string
          pain_affinity?: number
          sleep_affinity?: number
          stress_affinity?: number
        }
        Relationships: []
      }
      org_policy_audit: {
        Row: {
          created_at: string
          edited_by: string
          edited_by_name: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          org_id: string
        }
        Insert: {
          created_at?: string
          edited_by: string
          edited_by_name?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id: string
        }
        Update: {
          created_at?: string
          edited_by?: string
          edited_by_name?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_policy_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          abn: string | null
          brand_color: string | null
          business_name: string | null
          configured_acknowledgement_at: string | null
          configured_acknowledgement_by: string | null
          configured_at: string | null
          consent_text: string | null
          consent_version: number
          contact_email: string | null
          created_at: string
          health_policy_text: string | null
          id: string
          is_configured: boolean
          is_template: boolean
          logo_path: string | null
          logo_url: string | null
          name: string
          privacy_policy_text: string | null
          status: Database["public"]["Enums"]["org_status"]
          updated_at: string
        }
        Insert: {
          abn?: string | null
          brand_color?: string | null
          business_name?: string | null
          configured_acknowledgement_at?: string | null
          configured_acknowledgement_by?: string | null
          configured_at?: string | null
          consent_text?: string | null
          consent_version?: number
          contact_email?: string | null
          created_at?: string
          health_policy_text?: string | null
          id?: string
          is_configured?: boolean
          is_template?: boolean
          logo_path?: string | null
          logo_url?: string | null
          name: string
          privacy_policy_text?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Update: {
          abn?: string | null
          brand_color?: string | null
          business_name?: string | null
          configured_acknowledgement_at?: string | null
          configured_acknowledgement_by?: string | null
          configured_at?: string | null
          consent_text?: string | null
          consent_version?: number
          contact_email?: string | null
          created_at?: string
          health_policy_text?: string | null
          id?: string
          is_configured?: boolean
          is_template?: boolean
          logo_path?: string | null
          logo_url?: string | null
          name?: string
          privacy_policy_text?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          updated_at?: string
        }
        Relationships: []
      }
      practitioner_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          org_id: string
          practitioner_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          org_id: string
          practitioner_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          org_id?: string
          practitioner_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_availability_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          org_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_active?: boolean
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_minutes: number
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          org_id: string
          price: number
          updated_at: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          body_areas: string[]
          client_id: string
          consent_given: boolean
          contraindications: string[]
          created_at: string
          health_concerns: string[]
          id: string
          org_id: string
          pain_level: number | null
          payment_amount: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          practitioner_id: string
          practitioner_notes: string | null
          primary_goals: string[]
          recommended_frequency_id: string | null
          service_id: string | null
          sleep_quality: number | null
          status: Database["public"]["Enums"]["session_status"]
          stress_level: number | null
          updated_at: string
        }
        Insert: {
          body_areas?: string[]
          client_id: string
          consent_given?: boolean
          contraindications?: string[]
          created_at?: string
          health_concerns?: string[]
          id?: string
          org_id: string
          pain_level?: number | null
          payment_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          practitioner_id: string
          practitioner_notes?: string | null
          primary_goals?: string[]
          recommended_frequency_id?: string | null
          service_id?: string | null
          sleep_quality?: number | null
          status?: Database["public"]["Enums"]["session_status"]
          stress_level?: number | null
          updated_at?: string
        }
        Update: {
          body_areas?: string[]
          client_id?: string
          consent_given?: boolean
          contraindications?: string[]
          created_at?: string
          health_concerns?: string[]
          id?: string
          org_id?: string
          pain_level?: number | null
          payment_amount?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          practitioner_id?: string
          practitioner_notes?: string | null
          primary_goals?: string[]
          recommended_frequency_id?: string | null
          service_id?: string | null
          sleep_quality?: number | null
          status?: Database["public"]["Enums"]["session_status"]
          stress_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_recommended_frequency_id_fkey"
            columns: ["recommended_frequency_id"]
            isOneToOne: false
            referencedRelation: "frequencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "org_admin" | "practitioner"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      org_status: "active" | "suspended"
      payment_method: "cash" | "eftpos" | "payid" | "other" | "none"
      session_status: "draft" | "completed" | "cancelled"
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
      app_role: ["super_admin", "org_admin", "practitioner"],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      org_status: ["active", "suspended"],
      payment_method: ["cash", "eftpos", "payid", "other", "none"],
      session_status: ["draft", "completed", "cancelled"],
    },
  },
} as const
