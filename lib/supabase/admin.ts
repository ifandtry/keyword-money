import { createClient } from "@supabase/supabase-js";

// Supabase DB 스키마 타입 (자동 생성 대신 수동 정의)
interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          plan: string;
          plan_started_at: string | null;
          plan_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: string;
          plan_started_at?: string | null;
          plan_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          user_id: string;
          plan: string;
          plan_started_at: string | null;
          plan_expires_at: string | null;
          updated_at: string;
        }>;
      };
      subscriptions: {
        Row: {
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          updated_at: string;
        }>;
      };
      usage_daily: {
        Row: {
          user_id: string;
          date: string;
          discovery_count: number;
          analysis_count: number;
          production_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          date?: string;
          discovery_count?: number;
          analysis_count?: number;
          production_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          discovery_count: number;
          analysis_count: number;
          production_count: number;
          updated_at: string;
        }>;
      };
      event_logs: {
        Row: {
          id: number;
          event_type: string;
          metadata: Record<string, unknown>;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          event_type: string;
          metadata?: Record<string, unknown>;
          user_id?: string | null;
        };
        Update: Partial<{
          event_type: string;
          metadata: Record<string, unknown>;
        }>;
      };
      blog_views: {
        Row: {
          slug: string;
          count: number;
          updated_at: string;
        };
        Insert: {
          slug: string;
          count?: number;
        };
        Update: Partial<{
          count: number;
          updated_at: string;
        }>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_blog_view: {
        Args: { post_slug: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}

let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function getAdminClient() {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }
    _admin = createClient<Database>(url, key);
  }
  return _admin;
}
