
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_usage": {
                  Row: {
                    "cost_usd": number,"created_at": string,"escalated": boolean,"feature": string,"id": number,"input_tokens": number,"latency_ms": number | null,"model": string,"ok": boolean,"output_tokens": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_usd"?: number,"created_at"?: string,"escalated"?: boolean,"feature": string,"id"?: never,"input_tokens"?: number,"latency_ms"?: number | null,"model": string,"ok"?: boolean,"output_tokens"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "cost_usd"?: number,"created_at"?: string,"escalated"?: boolean,"feature"?: string,"id"?: never,"input_tokens"?: number,"latency_ms"?: number | null,"model"?: string,"ok"?: boolean,"output_tokens"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"created_at": string,"id": number,"ip_hash": string | null,"metadata": NonNullable<Json>,"target_id": string | null,"target_type": string | null,"user_agent": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: never,"ip_hash"?: string | null,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: never,"ip_hash"?: string | null,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"card_images": {
                  Row: {
                    "contact_id": string,"created_at": string,"id": string,"path": string,"side": string,"thumb_path": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id": string,"created_at"?: string,"id"?: string,"path": string,"side": string,"thumb_path"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"id"?: string,"path"?: string,"side"?: string,"thumb_path"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_images_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "created_at": string,"id": string,"message_id": string,"parts_enc": string,"role": string,"thread_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message_id": string,"parts_enc": string,"role": string,"thread_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message_id"?: string,"parts_enc"?: string,"role"?: string,"thread_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "chat_threads"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_threads": {
                  Row: {
                    "created_at": string,"id": string,"title_enc": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title_enc"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title_enc"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"companies": {
                  Row: {
                    "created_at": string,"domain": string | null,"id": string,"industry": string | null,"name": string,"normalized_name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"domain"?: string | null,"id"?: string,"industry"?: string | null,"name": string,"normalized_name": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string | null,"id"?: string,"industry"?: string | null,"name"?: string,"normalized_name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contact_identifiers": {
                  Row: {
                    "blind_index": string,"contact_id": string,"created_at": string,"id": string,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blind_index": string,"contact_id": string,"created_at"?: string,"id"?: string,"kind": string,"user_id"?: string
                  }
                  Update: {
                    "blind_index"?: string,"contact_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_identifiers_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "address_enc": string | null,"city": string | null,"company_id": string | null,"country": string | null,"created_at": string,"emails_enc": string | null,"full_name": string,"id": string,"index_requested_at": string,"indexed_at": string | null,"industry_override": string | null,"language": string | null,"last_contacted_at": string | null,"name_native": string | null,"needs_index": boolean | null,"past_positions": NonNullable<Json>,"phones_enc": string | null,"raw_extraction_enc": string | null,"role_family": string | null,"seniority": string | null,"source_scan_id": string | null,"title": string | null,"title_native": string | null,"updated_at": string,"user_id": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_enc"?: string | null,"city"?: string | null,"company_id"?: string | null,"country"?: string | null,"created_at"?: string,"emails_enc"?: string | null,"full_name": string,"id"?: string,"index_requested_at"?: string,"indexed_at"?: string | null,"industry_override"?: string | null,"language"?: string | null,"last_contacted_at"?: string | null,"name_native"?: string | null,"needs_index"?: never,"past_positions"?: NonNullable<Json>,"phones_enc"?: string | null,"raw_extraction_enc"?: string | null,"role_family"?: string | null,"seniority"?: string | null,"source_scan_id"?: string | null,"title"?: string | null,"title_native"?: string | null,"updated_at"?: string,"user_id"?: string,"website"?: string | null
                  }
                  Update: {
                    "address_enc"?: string | null,"city"?: string | null,"company_id"?: string | null,"country"?: string | null,"created_at"?: string,"emails_enc"?: string | null,"full_name"?: string,"id"?: string,"index_requested_at"?: string,"indexed_at"?: string | null,"industry_override"?: string | null,"language"?: string | null,"last_contacted_at"?: string | null,"name_native"?: string | null,"needs_index"?: never,"past_positions"?: NonNullable<Json>,"phones_enc"?: string | null,"raw_extraction_enc"?: string | null,"role_family"?: string | null,"seniority"?: string | null,"source_scan_id"?: string | null,"title"?: string | null,"title_native"?: string | null,"updated_at"?: string,"user_id"?: string,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlements": {
                  Row: {
                    "plan_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "plan_id"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "plan_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlements_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"description_enc": string | null,"id": string,"index_requested_at": string,"indexed_at": string | null,"location": string | null,"name": string,"needs_index": boolean | null,"starts_on": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description_enc"?: string | null,"id"?: string,"index_requested_at"?: string,"indexed_at"?: string | null,"location"?: string | null,"name": string,"needs_index"?: never,"starts_on"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"description_enc"?: string | null,"id"?: string,"index_requested_at"?: string,"indexed_at"?: string | null,"location"?: string | null,"name"?: string,"needs_index"?: never,"starts_on"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"interactions": {
                  Row: {
                    "contact_id": string,"created_at": string,"event_id": string | null,"id": string,"occurred_at": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id": string,"created_at"?: string,"event_id"?: string | null,"id"?: string,"occurred_at"?: string,"type": string,"user_id"?: string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"event_id"?: string | null,"id"?: string,"occurred_at"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interactions_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interactions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"knowledge_chunks": {
                  Row: {
                    "chunk_index": number,"contact_id": string | null,"content_enc": string,"content_hash": string,"created_at": string,"embedding": string,"embedding_model": string,"event_id": string | null,"id": string,"note_id": string | null,"source_id": string,"source_type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chunk_index"?: number,"contact_id"?: string | null,"content_enc": string,"content_hash": string,"created_at"?: string,"embedding": string,"embedding_model": string,"event_id"?: string | null,"id"?: string,"note_id"?: string | null,"source_id": string,"source_type": string,"user_id": string
                  }
                  Update: {
                    "chunk_index"?: number,"contact_id"?: string | null,"content_enc"?: string,"content_hash"?: string,"created_at"?: string,"embedding"?: string,"embedding_model"?: string,"event_id"?: string | null,"id"?: string,"note_id"?: string | null,"source_id"?: string,"source_type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_chunks_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_chunks_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_chunks_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "notes"
      referencedColumns: ["id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "audio_path": string | null,"body_enc": string,"contact_id": string | null,"created_at": string,"duration_s": number | null,"event_id": string | null,"id": string,"kind": string,"summary_enc": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_path"?: string | null,"body_enc": string,"contact_id"?: string | null,"created_at"?: string,"duration_s"?: number | null,"event_id"?: string | null,"id"?: string,"kind"?: string,"summary_enc"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "audio_path"?: string | null,"body_enc"?: string,"contact_id"?: string | null,"created_at"?: string,"duration_s"?: number | null,"event_id"?: string | null,"id"?: string,"kind"?: string,"summary_enc"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notes_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "created_at": string,"id": string,"limits": NonNullable<Json>,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"limits": NonNullable<Json>,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"limits"?: NonNullable<Json>,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"phone_region": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"phone_region"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"phone_region"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reminders": {
                  Row: {
                    "contact_id": string,"created_at": string,"done_at": string | null,"due_at": string,"id": string,"note_enc": string | null,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_id": string,"created_at"?: string,"done_at"?: string | null,"due_at": string,"id"?: string,"note_enc"?: string | null,"source"?: string,"user_id"?: string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"done_at"?: string | null,"due_at"?: string,"id"?: string,"note_enc"?: string | null,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"scans": {
                  Row: {
                    "attempts": number,"back_path": string | null,"batch_id": string | null,"claimed_at": string | null,"contact_id": string | null,"created_at": string,"error": string | null,"extraction_enc": string | null,"front_path": string,"id": string,"model_used": string | null,"qr_payload_enc": string | null,"status": string,"thumb_path": string | null,"updated_at": string,"user_id": string,"validation": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"back_path"?: string | null,"batch_id"?: string | null,"claimed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"error"?: string | null,"extraction_enc"?: string | null,"front_path": string,"id"?: string,"model_used"?: string | null,"qr_payload_enc"?: string | null,"status"?: string,"thumb_path"?: string | null,"updated_at"?: string,"user_id"?: string,"validation"?: Json | null
                  }
                  Update: {
                    "attempts"?: number,"back_path"?: string | null,"batch_id"?: string | null,"claimed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"error"?: string | null,"extraction_enc"?: string | null,"front_path"?: string,"id"?: string,"model_used"?: string | null,"qr_payload_enc"?: string | null,"status"?: string,"thumb_path"?: string | null,"updated_at"?: string,"user_id"?: string,"validation"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scans_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_counters": {
                  Row: {
                    "count": number,"feature": string,"period": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"feature": string,"period": string,"user_id": string
                  }
                  Update: {
                    "count"?: number,"feature"?: string,"period"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_keys": {
                  Row: {
                    "created_at": string,"key_version": number,"rotated_at": string | null,"user_id": string,"wrapped_dek": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key_version": number,"rotated_at"?: string | null,"user_id": string,"wrapped_dek": string
                  }
                  Update: {
                    "created_at"?: string,"key_version"?: number,"rotated_at"?: string | null,"user_id"?: string,"wrapped_dek"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ai_spend_today":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"ask_find_contacts":
{ Args: { "p_city"?: string,"p_company"?: string,"p_company_normalized"?: string,"p_country"?: string,"p_event"?: string,"p_industry"?: string,"p_limit"?: number,"p_met_after"?: string,"p_met_before"?: string,"p_name"?: string,"p_role_family"?: string,"p_seniority"?: string,"p_title"?: string }; Returns: {
              "city": string,"company": string,"country": string,"events": (string)[],"first_met": string,"full_name": string,"id": string,"industry": string,"last_contacted": string,"role_family": string,"seniority": string,"title": string,"total_count": number
            }[]
                           },
"claim_scan":
{ Args: { "p_scan_id": string,"p_stale_after"?: string }; Returns: {
              "attempts": number,
"back_path": string | null,
"batch_id": string | null,
"claimed_at": string | null,
"contact_id": string | null,
"created_at": string,
"error": string | null,
"extraction_enc": string | null,
"front_path": string,
"id": string,
"model_used": string | null,
"qr_payload_enc": string | null,
"status": string,
"thumb_path": string | null,
"updated_at": string,
"user_id": string,
"validation": Json | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "scans"
        isOneToOne: false
        isSetofReturn: true
      } },
"consume_quota":
{ Args: { "p_amount"?: number,"p_feature": string,"p_user_id": string }; Returns: {
              "allowed": boolean,"quota": number,"used": number
            }[]
                           },
"contact_facets":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"event_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"location": string,"name": string,"people": number,"starts_on": string
            }[]
                           },
"like_pattern":
{ Args: { "p": string }; Returns: string
                           },
"match_chunks":
{ Args: { "p_contact_id"?: string,"p_embedding": string,"p_limit"?: number,"p_model": string }; Returns: {
              "contact_id": string,"content_enc": string,"event_id": string,"id": string,"similarity": number,"source_id": string,"source_type": string
            }[]
                           },
"mfa_required":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mfa_satisfied":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"release_quota":
{ Args: { "p_amount"?: number,"p_feature": string,"p_user_id": string }; Returns: undefined
                           },
"search_contacts":
{ Args: { "p_company_id"?: string,"p_country"?: string,"p_event_id"?: string,"p_industry"?: string,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_role_family"?: string,"p_seniority"?: string,"p_sort"?: string }; Returns: {
              "city": string,"company_id": string,"company_name": string,"country": string,"created_at": string,"full_name": string,"id": string,"industry": string,"last_contacted_at": string,"name_native": string,"role_family": string,"seniority": string,"title": string,"total_count": number
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
