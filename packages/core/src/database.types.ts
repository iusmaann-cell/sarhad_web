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
          latitude: number | null;
          location: unknown | null;
          longitude: number | null;
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
      branch_menu_items: {
        Row: {
          branch_id: string;
          is_available: boolean;
          item_id: string;
          price_override_fils: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_id: string;
          is_available?: boolean;
          item_id: string;
          price_override_fils?: number | null;
        };
        Update: {
          is_available?: boolean;
          price_override_fils?: number | null;
        };
        Relationships: [];
      };
      menu_categories: {
        Row: {
          created_at: string;
          description_ar: string | null;
          description_en: string | null;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["menu_categories"]["Insert"]>;
        Relationships: [];
      };
      menu_items: {
        Row: {
          calories: number | null;
          category_id: string;
          created_at: string;
          description_ar: string | null;
          description_en: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          is_featured: boolean;
          name_ar: string;
          name_en: string;
          price_fils: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          calories?: number | null;
          category_id: string;
          description_ar?: string | null;
          description_en?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          name_ar: string;
          name_en: string;
          price_fils: number;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      modifier_groups: {
        Row: {
          created_at: string;
          id: string;
          item_id: string;
          max_select: number;
          min_select: number;
          name_ar: string;
          name_en: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          item_id: string;
          max_select?: number;
          min_select?: number;
          name_ar: string;
          name_en: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["modifier_groups"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "modifier_groups_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      modifier_options: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string;
          price_delta_fils: number;
          sort_order: number;
        };
        Insert: {
          group_id: string;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en: string;
          price_delta_fils?: number;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["modifier_options"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "modifier_options_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "modifier_groups";
            referencedColumns: ["id"];
          },
        ];
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
      get_branch_menu: { Args: { p_branch_id: string }; Returns: Json };
      save_menu_item: { Args: { p_item: Json }; Returns: string };
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
