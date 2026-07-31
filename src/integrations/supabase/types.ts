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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      audio_files: {
        Row: {
          created_at: string
          duration_seconds: number | null
          file_url: string | null
          frequency_id: string | null
          id: string
          is_active: boolean
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          practitioner_id: string | null
          public_note: string | null
          service_id: string
          session_id: string | null
          source: string
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
          practitioner_id?: string | null
          public_note?: string | null
          service_id: string
          session_id?: string | null
          source?: string
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
          practitioner_id?: string | null
          public_note?: string | null
          service_id?: string
          session_id?: string | null
          source?: string
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
      client_clearance_letter_revocations: {
        Row: {
          created_at: string
          id: string
          letter_id: string
          org_id: string
          reason: string
          revoked_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          letter_id: string
          org_id: string
          reason: string
          revoked_by: string
        }
        Update: {
          created_at?: string
          id?: string
          letter_id?: string
          org_id?: string
          reason?: string
          revoked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_clearance_letter_revocations_letter_id_fkey"
            columns: ["letter_id"]
            isOneToOne: true
            referencedRelation: "client_clearance_letters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_clearance_letter_revocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_clearance_letters: {
        Row: {
          client_id: string
          created_at: string
          file_path: string | null
          id: string
          issued_on: string | null
          issuer_name: string
          item_key: string
          notes: string | null
          org_id: string
          recorded_by: string
        }
        Insert: {
          client_id: string
          created_at?: string
          file_path?: string | null
          id?: string
          issued_on?: string | null
          issuer_name: string
          item_key: string
          notes?: string | null
          org_id: string
          recorded_by: string
        }
        Update: {
          client_id?: string
          created_at?: string
          file_path?: string | null
          id?: string
          issued_on?: string | null
          issuer_name?: string
          item_key?: string
          notes?: string | null
          org_id?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_clearance_letters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_clearance_letters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_screenings: {
        Row: {
          blocking_items: string[]
          booking_id: string | null
          checklist_snapshot: Json
          checklist_version: string
          cleared_items: Json
          client_id: string
          client_signature: string
          client_signed_at: string
          consent_text_snapshot: string
          consent_version: number | null
          created_at: string
          decline_reason: string | null
          flagged_items: string[]
          health_text_snapshot: string | null
          id: string
          is_reattestation: boolean
          none_apply: boolean
          org_id: string
          org_name_snapshot: string | null
          outcome: string
          practitioner_id: string
          practitioner_notes: string | null
          practitioner_signature: string
          practitioner_signed_at: string
          prior_screening_id: string | null
          privacy_text_snapshot: string | null
          response: string
        }
        Insert: {
          blocking_items?: string[]
          booking_id?: string | null
          checklist_snapshot: Json
          checklist_version: string
          cleared_items?: Json
          client_id: string
          client_signature: string
          client_signed_at?: string
          consent_text_snapshot: string
          consent_version?: number | null
          created_at?: string
          decline_reason?: string | null
          flagged_items?: string[]
          health_text_snapshot?: string | null
          id?: string
          is_reattestation?: boolean
          none_apply: boolean
          org_id: string
          org_name_snapshot?: string | null
          outcome: string
          practitioner_id: string
          practitioner_notes?: string | null
          practitioner_signature: string
          practitioner_signed_at?: string
          prior_screening_id?: string | null
          privacy_text_snapshot?: string | null
          response: string
        }
        Update: {
          blocking_items?: string[]
          booking_id?: string | null
          checklist_snapshot?: Json
          checklist_version?: string
          cleared_items?: Json
          client_id?: string
          client_signature?: string
          client_signed_at?: string
          consent_text_snapshot?: string
          consent_version?: number | null
          created_at?: string
          decline_reason?: string | null
          flagged_items?: string[]
          health_text_snapshot?: string | null
          id?: string
          is_reattestation?: boolean
          none_apply?: boolean
          org_id?: string
          org_name_snapshot?: string | null
          outcome?: string
          practitioner_id?: string
          practitioner_notes?: string | null
          practitioner_signature?: string
          practitioner_signed_at?: string
          prior_screening_id?: string | null
          privacy_text_snapshot?: string | null
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_screenings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_screenings_prior_screening_id_fkey"
            columns: ["prior_screening_id"]
            isOneToOne: false
            referencedRelation: "client_screenings"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string | null
          email_status: Database["public"]["Enums"]["email_status"]
          email_status_updated_at: string | null
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
          email_status?: Database["public"]["Enums"]["email_status"]
          email_status_updated_at?: string | null
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
          email_status?: Database["public"]["Enums"]["email_status"]
          email_status_updated_at?: string | null
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
      kit_invoices: {
        Row: {
          billing_address: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount_cents: number
          due_date: string | null
          gst_cents: number
          id: string
          invoice_number: string
          list_cents: number
          notes: string | null
          package_key: string
          package_label: string
          payment_terms: string
          plan: string
          shipping_address: string | null
          shipping_cents: number
          shipping_gst_inclusive: boolean
          shipping_region: string | null
          status: string
          stripe_session_id: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount_cents?: number
          due_date?: string | null
          gst_cents?: number
          id?: string
          invoice_number: string
          list_cents?: number
          notes?: string | null
          package_key: string
          package_label: string
          payment_terms?: string
          plan?: string
          shipping_address?: string | null
          shipping_cents?: number
          shipping_gst_inclusive?: boolean
          shipping_region?: string | null
          status?: string
          stripe_session_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount_cents?: number
          due_date?: string | null
          gst_cents?: number
          id?: string
          invoice_number?: string
          list_cents?: number
          notes?: string | null
          package_key?: string
          package_label?: string
          payment_terms?: string
          plan?: string
          shipping_address?: string | null
          shipping_cents?: number
          shipping_gst_inclusive?: boolean
          shipping_region?: string | null
          status?: string
          stripe_session_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      kit_payments: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          gst_cents: number
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_at: string
          receipt_number: string
          reference: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          gst_cents?: number
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_number: string
          reference?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          gst_cents?: number
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          receipt_number?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kit_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "kit_invoices"
            referencedColumns: ["id"]
          },
        ]
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
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_postcode: string | null
          address_state: string | null
          brand_color: string | null
          business_name: string | null
          clinic_type: string
          clinic_type_confirmed: boolean
          configured_acknowledgement_at: string | null
          configured_acknowledgement_by: string | null
          configured_acknowledgement_signature: string | null
          configured_at: string | null
          consent_text: string | null
          consent_version: number
          contact_email: string | null
          created_at: string
          health_policy_text: string | null
          id: string
          is_configured: boolean
          logo_path: string | null
          logo_url: string | null
          music_licence_expires_at: string | null
          music_licence_note: string | null
          music_licence_plan: Database["public"]["Enums"]["music_licence_plan"]
          music_licence_status: Database["public"]["Enums"]["music_licence_status"]
          name: string
          practitioners_can_complete_unpaid: boolean
          practitioners_can_manage_bookings: boolean
          practitioners_can_manage_clients: boolean
          practitioners_can_view_all_clients: boolean
          privacy_policy_text: string | null
          public_blurb: string | null
          public_booking_enabled: boolean
          public_contact_email: string | null
          public_contact_phone: string | null
          public_suburb: string | null
          published: boolean
          retail_show_address: boolean
          slug: string | null
          status: Database["public"]["Enums"]["org_status"]
          theme_accent: string | null
          theme_primary: string | null
          theme_sidebar: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          abn?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_state?: string | null
          brand_color?: string | null
          business_name?: string | null
          clinic_type?: string
          clinic_type_confirmed?: boolean
          configured_acknowledgement_at?: string | null
          configured_acknowledgement_by?: string | null
          configured_acknowledgement_signature?: string | null
          configured_at?: string | null
          consent_text?: string | null
          consent_version?: number
          contact_email?: string | null
          created_at?: string
          health_policy_text?: string | null
          id?: string
          is_configured?: boolean
          logo_path?: string | null
          logo_url?: string | null
          music_licence_expires_at?: string | null
          music_licence_note?: string | null
          music_licence_plan?: Database["public"]["Enums"]["music_licence_plan"]
          music_licence_status?: Database["public"]["Enums"]["music_licence_status"]
          name: string
          practitioners_can_complete_unpaid?: boolean
          practitioners_can_manage_bookings?: boolean
          practitioners_can_manage_clients?: boolean
          practitioners_can_view_all_clients?: boolean
          privacy_policy_text?: string | null
          public_blurb?: string | null
          public_booking_enabled?: boolean
          public_contact_email?: string | null
          public_contact_phone?: string | null
          public_suburb?: string | null
          published?: boolean
          retail_show_address?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          theme_accent?: string | null
          theme_primary?: string | null
          theme_sidebar?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          abn?: string | null
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_state?: string | null
          brand_color?: string | null
          business_name?: string | null
          clinic_type?: string
          clinic_type_confirmed?: boolean
          configured_acknowledgement_at?: string | null
          configured_acknowledgement_by?: string | null
          configured_acknowledgement_signature?: string | null
          configured_at?: string | null
          consent_text?: string | null
          consent_version?: number
          contact_email?: string | null
          created_at?: string
          health_policy_text?: string | null
          id?: string
          is_configured?: boolean
          logo_path?: string | null
          logo_url?: string | null
          music_licence_expires_at?: string | null
          music_licence_note?: string | null
          music_licence_plan?: Database["public"]["Enums"]["music_licence_plan"]
          music_licence_status?: Database["public"]["Enums"]["music_licence_status"]
          name?: string
          practitioners_can_complete_unpaid?: boolean
          practitioners_can_manage_bookings?: boolean
          practitioners_can_manage_clients?: boolean
          practitioners_can_view_all_clients?: boolean
          privacy_policy_text?: string | null
          public_blurb?: string | null
          public_booking_enabled?: boolean
          public_contact_email?: string | null
          public_contact_phone?: string | null
          public_suburb?: string | null
          published?: boolean
          retail_show_address?: boolean
          slug?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          theme_accent?: string | null
          theme_primary?: string | null
          theme_sidebar?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      policy_templates: {
        Row: {
          body: string
          kind: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          kind: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          kind?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
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
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email_status: Database["public"]["Enums"]["email_status"]
          email_status_updated_at: string | null
          id: string
          is_active: boolean
          org_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email_status?: Database["public"]["Enums"]["email_status"]
          email_status_updated_at?: string | null
          id: string
          is_active?: boolean
          org_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email_status?: Database["public"]["Enums"]["email_status"]
          email_status_updated_at?: string | null
          id?: string
          is_active?: boolean
          org_id?: string | null
          phone?: string | null
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
      promo_code_redemptions: {
        Row: {
          amount_discounted_cents: number
          created_at: string
          id: string
          promo_code_id: string
          stripe_session_id: string
        }
        Insert: {
          amount_discounted_cents?: number
          created_at?: string
          id?: string
          promo_code_id: string
          stripe_session_id: string
        }
        Update: {
          amount_discounted_cents?: number
          created_at?: string
          id?: string
          promo_code_id?: string
          stripe_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          discount_percent: number
          id: string
          max_redemptions: number | null
          times_redeemed: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          discount_percent: number
          id?: string
          max_redemptions?: number | null
          times_redeemed?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          discount_percent?: number
          id?: string
          max_redemptions?: number | null
          times_redeemed?: number
          updated_at?: string
        }
        Relationships: []
      }
      public_booking_attempts: {
        Row: {
          accepted: boolean
          created_at: string
          email_hash: string
          id: string
          ip_hash: string
          org_id: string
        }
        Insert: {
          accepted?: boolean
          created_at?: string
          email_hash: string
          id?: string
          ip_hash: string
          org_id: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          email_hash?: string
          id?: string
          ip_hash?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_booking_attempts_org_id_fkey"
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
          org_id: string | null
          price: number
          rrp: number | null
          source_global_id: string | null
          updated_at: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          price?: number
          rrp?: number | null
          source_global_id?: string | null
          updated_at?: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          price?: number
          rrp?: number | null
          source_global_id?: string | null
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
          {
            foreignKeyName: "services_source_global_id_fkey"
            columns: ["source_global_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          body_areas: string[]
          client_id: string
          client_signature: string | null
          consent_given: boolean
          contraindications: string[]
          created_at: string
          decline_reason: string | null
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
          screening_id: string | null
          service_id: string | null
          signed_at: string | null
          sleep_quality: number | null
          status: Database["public"]["Enums"]["session_status"]
          stress_level: number | null
          updated_at: string
        }
        Insert: {
          body_areas?: string[]
          client_id: string
          client_signature?: string | null
          consent_given?: boolean
          contraindications?: string[]
          created_at?: string
          decline_reason?: string | null
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
          screening_id?: string | null
          service_id?: string | null
          signed_at?: string | null
          sleep_quality?: number | null
          status?: Database["public"]["Enums"]["session_status"]
          stress_level?: number | null
          updated_at?: string
        }
        Update: {
          body_areas?: string[]
          client_id?: string
          client_signature?: string | null
          consent_given?: boolean
          contraindications?: string[]
          created_at?: string
          decline_reason?: string | null
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
          screening_id?: string | null
          service_id?: string | null
          signed_at?: string | null
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
            foreignKeyName: "sessions_screening_id_fkey"
            columns: ["screening_id"]
            isOneToOne: false
            referencedRelation: "client_screenings"
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
      shipping_rates: {
        Row: {
          active: boolean
          allowed_countries: string[]
          amount_cents: number
          created_at: string
          gst_inclusive: boolean
          id: string
          label: string
          region: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_countries?: string[]
          amount_cents: number
          created_at?: string
          gst_inclusive?: boolean
          id?: string
          label: string
          region: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_countries?: string[]
          amount_cents?: number
          created_at?: string
          gst_inclusive?: boolean
          id?: string
          label?: string
          region?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_access_grants: {
        Row: {
          created_at: string
          expires_at: string
          granted_at: string
          granted_by: string
          id: string
          org_id: string
          revoked_at: string | null
          revoked_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_at?: string
          granted_by: string
          id?: string
          org_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_at?: string
          granted_by?: string
          id?: string
          org_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_access_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sessions: {
        Row: {
          created_at: string
          emergency: boolean
          entered_at: string
          exited_at: string | null
          grant_id: string | null
          id: string
          org_id: string
          reason: string | null
          super_admin_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          emergency?: boolean
          entered_at?: string
          exited_at?: string | null
          grant_id?: string | null
          id?: string
          org_id: string
          reason?: string | null
          super_admin_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          emergency?: boolean
          entered_at?: string
          exited_at?: string | null
          grant_id?: string | null
          id?: string
          org_id?: string
          reason?: string | null
          super_admin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_sessions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "support_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
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
      client_item_cleared: {
        Args: { _client_id: string; _item: string }
        Returns: boolean
      }
      current_org_id: { Args: never; Returns: string }
      get_public_org: {
        Args: { p_slug: string }
        Returns: {
          brand_color: string
          clinic_type: string
          logo_url: string
          name: string
          public_address: string
          public_blurb: string
          public_booking_enabled: boolean
          public_contact_email: string
          public_contact_phone: string
          public_suburb: string
          slug: string
          theme_primary: string
          theme_sidebar: string
          timezone: string
        }[]
      }
      get_public_services: {
        Args: { p_slug: string }
        Returns: {
          duration_minutes: number
          id: string
          name: string
          price: number
        }[]
      }
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
      next_kit_invoice_number: { Args: never; Returns: string }
      next_kit_receipt_number: { Args: never; Returns: string }
      org_has_active_support_grant: {
        Args: { _org_id: string }
        Returns: boolean
      }
      org_music_licence_ok: { Args: { _org_id: string }; Returns: boolean }
      org_practitioner_permission: {
        Args: { _flag: string; _org_id: string }
        Returns: boolean
      }
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
      email_status: "valid" | "bounced" | "complained" | "unsubscribed"
      music_licence_plan: "none" | "basic" | "pro"
      music_licence_status: "trial" | "active" | "expired"
      org_status: "active" | "suspended"
      payment_method:
        | "cash"
        | "eftpos"
        | "payid"
        | "other"
        | "none"
        | "unpaid"
        | "comp"
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
      email_status: ["valid", "bounced", "complained", "unsubscribed"],
      music_licence_plan: ["none", "basic", "pro"],
      music_licence_status: ["trial", "active", "expired"],
      org_status: ["active", "suspended"],
      payment_method: [
        "cash",
        "eftpos",
        "payid",
        "other",
        "none",
        "unpaid",
        "comp",
      ],
      session_status: ["draft", "completed", "cancelled"],
    },
  },
} as const
