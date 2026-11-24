// Database types for the Supabase "public" schema.
// Regenerate after changing migrations: `pnpm db:types` (needs `pnpm db:start`).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      branches: {
        Row: {
          accepts_delivery: boolean;
          accepts_pickup: boolean;
          address_ar: string | null;
          address_en: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          location: unknown | null;
          name_ar: string;
          name_en: string;
          opening_hours: Json;
          phone: string | null;
          slug: string;
          sort_order: number;
          timezone: string;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          accepts_delivery?: boolean;
          accepts_pickup?: boolean;
          address_ar?: string | null;
          address_en?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          location?: unknown | null;
          name_ar: string;
          name_en: string;
          opening_hours?: Json;
          phone?: string | null;
          slug: string;
          sort_order?: number;
          timezone?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["branches"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          preferred_locale: Database["public"]["Enums"]["app_locale"];
          updated_at: string;
        };
        Insert: never;
        Update: {
          full_name?: string | null;
          phone?: string | null;
          preferred_locale?: Database["public"]["Enums"]["app_locale"];
        };
        Relationships: [];
      };
      settings: {
        Row: {
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          is_public?: boolean;
          key: string;
          value: Json;
        };
        Update: {
          is_public?: boolean;
          value?: Json;
        };
        Relationships: [];
      };
      staff_roles: {
        Row: {
          branch_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          branch_id?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          branch_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [
          {
            foreignKeyName: "staff_roles_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      assign_staff_role: {
        Args: {
          p_email: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_branch_id?: string | null;
        };
        Returns: string;
      };
      can_access_branch: { Args: { p_branch_id: string }; Returns: boolean };
      can_manage_branch: { Args: { p_branch_id: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      list_staff: {
        Args: Record<PropertyKey, never>;
        Returns: {
          role_id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          role: Database["public"]["Enums"]["app_role"];
          branch_id: string | null;
          created_at: string;
        }[];
      };
      my_roles: {
        Args: Record<PropertyKey, never>;
        Returns: {
          role: Database["public"]["Enums"]["app_role"];
          branch_id: string | null;
        }[];
      };
    };
    Enums: {
      app_locale: "ar" | "en";
      app_role: "owner" | "admin" | "branch_manager" | "staff";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
