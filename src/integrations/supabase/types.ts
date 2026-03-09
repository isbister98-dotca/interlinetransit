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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      gtfs_agency: {
        Row: {
          agency_email: string | null
          agency_fare_url: string | null
          agency_id: string
          agency_lang: string | null
          agency_name: string | null
          agency_phone: string | null
          agency_timezone: string | null
          agency_url: string | null
          gtfs_agency_id: string
        }
        Insert: {
          agency_email?: string | null
          agency_fare_url?: string | null
          agency_id: string
          agency_lang?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agency_timezone?: string | null
          agency_url?: string | null
          gtfs_agency_id: string
        }
        Update: {
          agency_email?: string | null
          agency_fare_url?: string | null
          agency_id?: string
          agency_lang?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agency_timezone?: string | null
          agency_url?: string | null
          gtfs_agency_id?: string
        }
        Relationships: []
      }
      gtfs_calendar: {
        Row: {
          agency_id: string
          end_date: string
          friday: boolean
          monday: boolean
          saturday: boolean
          service_id: string
          start_date: string
          sunday: boolean
          thursday: boolean
          tuesday: boolean
          wednesday: boolean
        }
        Insert: {
          agency_id: string
          end_date: string
          friday?: boolean
          monday?: boolean
          saturday?: boolean
          service_id: string
          start_date: string
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          wednesday?: boolean
        }
        Update: {
          agency_id?: string
          end_date?: string
          friday?: boolean
          monday?: boolean
          saturday?: boolean
          service_id?: string
          start_date?: string
          sunday?: boolean
          thursday?: boolean
          tuesday?: boolean
          wednesday?: boolean
        }
        Relationships: []
      }
      gtfs_calendar_dates: {
        Row: {
          agency_id: string
          date: string
          exception_type: number
          service_id: string
        }
        Insert: {
          agency_id: string
          date: string
          exception_type: number
          service_id: string
        }
        Update: {
          agency_id?: string
          date?: string
          exception_type?: number
          service_id?: string
        }
        Relationships: []
      }
      gtfs_fare_attributes: {
        Row: {
          agency_id: string
          currency_type: string | null
          fare_id: string
          payment_method: number | null
          price: number | null
          transfers: number | null
        }
        Insert: {
          agency_id: string
          currency_type?: string | null
          fare_id: string
          payment_method?: number | null
          price?: number | null
          transfers?: number | null
        }
        Update: {
          agency_id?: string
          currency_type?: string | null
          fare_id?: string
          payment_method?: number | null
          price?: number | null
          transfers?: number | null
        }
        Relationships: []
      }
      gtfs_fare_rules: {
        Row: {
          agency_id: string
          destination_id: string
          fare_id: string
          origin_id: string
        }
        Insert: {
          agency_id: string
          destination_id?: string
          fare_id: string
          origin_id?: string
        }
        Update: {
          agency_id?: string
          destination_id?: string
          fare_id?: string
          origin_id?: string
        }
        Relationships: []
      }
      gtfs_feed_info: {
        Row: {
          agency_id: string
          feed_end_date: string | null
          feed_lang: string | null
          feed_publisher_name: string | null
          feed_publisher_url: string | null
          feed_start_date: string | null
          feed_version: string | null
        }
        Insert: {
          agency_id: string
          feed_end_date?: string | null
          feed_lang?: string | null
          feed_publisher_name?: string | null
          feed_publisher_url?: string | null
          feed_start_date?: string | null
          feed_version?: string | null
        }
        Update: {
          agency_id?: string
          feed_end_date?: string | null
          feed_lang?: string | null
          feed_publisher_name?: string | null
          feed_publisher_url?: string | null
          feed_start_date?: string | null
          feed_version?: string | null
        }
        Relationships: []
      }
      gtfs_feeds: {
        Row: {
          agency_id: string
          created_at: string
          feed_url: string
          id: string
          is_active: boolean
          last_synced: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          feed_url: string
          id?: string
          is_active?: boolean
          last_synced?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          feed_url?: string
          id?: string
          is_active?: boolean
          last_synced?: string | null
        }
        Relationships: []
      }
      gtfs_routes: {
        Row: {
          agency_id: string
          gtfs_agency_id: string | null
          route_color: string | null
          route_desc: string | null
          route_id: string
          route_long_name: string | null
          route_short_name: string | null
          route_sort_order: number | null
          route_text_color: string | null
          route_type: number | null
          route_url: string | null
        }
        Insert: {
          agency_id: string
          gtfs_agency_id?: string | null
          route_color?: string | null
          route_desc?: string | null
          route_id: string
          route_long_name?: string | null
          route_short_name?: string | null
          route_sort_order?: number | null
          route_text_color?: string | null
          route_type?: number | null
          route_url?: string | null
        }
        Update: {
          agency_id?: string
          gtfs_agency_id?: string | null
          route_color?: string | null
          route_desc?: string | null
          route_id?: string
          route_long_name?: string | null
          route_short_name?: string | null
          route_sort_order?: number | null
          route_text_color?: string | null
          route_type?: number | null
          route_url?: string | null
        }
        Relationships: []
      }
      gtfs_shapes: {
        Row: {
          agency_id: string
          shape_id: string
          shape_pt_lat: number
          shape_pt_lon: number
          shape_pt_sequence: number
        }
        Insert: {
          agency_id: string
          shape_id: string
          shape_pt_lat: number
          shape_pt_lon: number
          shape_pt_sequence: number
        }
        Update: {
          agency_id?: string
          shape_id?: string
          shape_pt_lat?: number
          shape_pt_lon?: number
          shape_pt_sequence?: number
        }
        Relationships: []
      }
      gtfs_stop_times: {
        Row: {
          agency_id: string
          arrival_time: string | null
          departure_time: string | null
          drop_off_type: number | null
          pickup_type: number | null
          shape_dist_traveled: number | null
          stop_headsign: string | null
          stop_id: string
          stop_sequence: number
          timepoint: number | null
          trip_id: string
        }
        Insert: {
          agency_id: string
          arrival_time?: string | null
          departure_time?: string | null
          drop_off_type?: number | null
          pickup_type?: number | null
          shape_dist_traveled?: number | null
          stop_headsign?: string | null
          stop_id: string
          stop_sequence: number
          timepoint?: number | null
          trip_id: string
        }
        Update: {
          agency_id?: string
          arrival_time?: string | null
          departure_time?: string | null
          drop_off_type?: number | null
          pickup_type?: number | null
          shape_dist_traveled?: number | null
          stop_headsign?: string | null
          stop_id?: string
          stop_sequence?: number
          timepoint?: number | null
          trip_id?: string
        }
        Relationships: []
      }
      gtfs_stops: {
        Row: {
          agency_id: string
          location_type: number | null
          parent_station: string | null
          stop_code: string | null
          stop_id: string
          stop_lat: number | null
          stop_lon: number | null
          stop_name: string | null
          stop_url: string | null
          wheelchair_boarding: number | null
          zone_id: string | null
        }
        Insert: {
          agency_id: string
          location_type?: number | null
          parent_station?: string | null
          stop_code?: string | null
          stop_id: string
          stop_lat?: number | null
          stop_lon?: number | null
          stop_name?: string | null
          stop_url?: string | null
          wheelchair_boarding?: number | null
          zone_id?: string | null
        }
        Update: {
          agency_id?: string
          location_type?: number | null
          parent_station?: string | null
          stop_code?: string | null
          stop_id?: string
          stop_lat?: number | null
          stop_lon?: number | null
          stop_name?: string | null
          stop_url?: string | null
          wheelchair_boarding?: number | null
          zone_id?: string | null
        }
        Relationships: []
      }
      gtfs_sync_status: {
        Row: {
          agency_id: string
          completed_at: string | null
          error_msg: string | null
          file_type: string
          id: string
          row_count: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          agency_id: string
          completed_at?: string | null
          error_msg?: string | null
          file_type: string
          id?: string
          row_count?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          completed_at?: string | null
          error_msg?: string | null
          file_type?: string
          id?: string
          row_count?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      gtfs_transfers: {
        Row: {
          agency_id: string
          from_stop_id: string
          min_transfer_time: number | null
          to_stop_id: string
          transfer_type: number | null
        }
        Insert: {
          agency_id: string
          from_stop_id: string
          min_transfer_time?: number | null
          to_stop_id: string
          transfer_type?: number | null
        }
        Update: {
          agency_id?: string
          from_stop_id?: string
          min_transfer_time?: number | null
          to_stop_id?: string
          transfer_type?: number | null
        }
        Relationships: []
      }
      gtfs_trips: {
        Row: {
          agency_id: string
          bikes_allowed: number | null
          block_id: string | null
          direction_id: number | null
          route_id: string
          route_variant: string | null
          service_id: string
          shape_id: string | null
          trip_headsign: string | null
          trip_id: string
          trip_short_name: string | null
          wheelchair_accessible: number | null
        }
        Insert: {
          agency_id: string
          bikes_allowed?: number | null
          block_id?: string | null
          direction_id?: number | null
          route_id: string
          route_variant?: string | null
          service_id: string
          shape_id?: string | null
          trip_headsign?: string | null
          trip_id: string
          trip_short_name?: string | null
          wheelchair_accessible?: number | null
        }
        Update: {
          agency_id?: string
          bikes_allowed?: number | null
          block_id?: string | null
          direction_id?: number | null
          route_id?: string
          route_variant?: string | null
          service_id?: string
          shape_id?: string | null
          trip_headsign?: string | null
          trip_id?: string
          trip_short_name?: string | null
          wheelchair_accessible?: number | null
        }
        Relationships: []
      }
      vehicle_cache: {
        Row: {
          agency_status: Json | null
          id: number
          updated_at: string
          vehicles: Json
        }
        Insert: {
          agency_status?: Json | null
          id?: number
          updated_at?: string
          vehicles?: Json
        }
        Update: {
          agency_status?: Json | null
          id?: number
          updated_at?: string
          vehicles?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_route_shapes: {
        Args: never
        Returns: {
          agency_id: string
          coords: Json
          route_color: string
          route_id: string
          route_long_name: string
          route_type: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
