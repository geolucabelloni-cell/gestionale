
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "azione": string,"created_at": string,"dettagli": Json | null,"entita": string | null,"entita_id": string | null,"id": number,"office_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "azione": string,"created_at"?: string,"dettagli"?: Json | null,"entita"?: string | null,"entita_id"?: string | null,"id"?: number,"office_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "azione"?: string,"created_at"?: string,"dettagli"?: Json | null,"entita"?: string | null,"entita_id"?: string | null,"id"?: number,"office_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cases": {
                  Row: {
                    "client_id": string,"created_at": string,"created_by": string | null,"data_apertura": string,"descrizione": string | null,"id": string,"office_id": string,"prossima_scadenza": string | null,"riferimento_esterno": string | null,"stato": Database["public"]['Enums']["stato_pratica"],"tipo": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"created_by"?: string | null,"data_apertura"?: string,"descrizione"?: string | null,"id"?: string,"office_id": string,"prossima_scadenza"?: string | null,"riferimento_esterno"?: string | null,"stato"?: Database["public"]['Enums']["stato_pratica"],"tipo": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"created_by"?: string | null,"data_apertura"?: string,"descrizione"?: string | null,"id"?: string,"office_id"?: string,"prossima_scadenza"?: string | null,"riferimento_esterno"?: string | null,"stato"?: Database["public"]['Enums']["stato_pratica"],"tipo"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cases_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cases_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "scadenze_permessi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cases_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cases_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"client_notes": {
                  Row: {
                    "author_id": string | null,"client_id": string,"created_at": string,"data_visita": string,"id": string,"numero": number,"office_id": string,"origine": Database["public"]['Enums']["origine_nota"],"rettifica_di": string | null,"testo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"client_id": string,"created_at"?: string,"data_visita"?: string,"id"?: string,"numero": number,"office_id": string,"origine"?: Database["public"]['Enums']["origine_nota"],"rettifica_di"?: string | null,"testo": string
                  }
                  Update: {
                    "author_id"?: string | null,"client_id"?: string,"created_at"?: string,"data_visita"?: string,"id"?: string,"numero"?: number,"office_id"?: string,"origine"?: Database["public"]['Enums']["origine_nota"],"rettifica_di"?: string | null,"testo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "scadenze_permessi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_rettifica_di_fkey"
      columns: ["rettifica_di"]
isOneToOne: false
      referencedRelation: "client_notes"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "cap": string | null,"citta": string | null,"cittadinanza": string | null,"codice": number,"codice_fiscale": string | null,"cognome": string,"consenso_privacy": boolean,"consenso_privacy_data": string | null,"created_at": string,"created_by": string | null,"data_nascita": string | null,"email": string | null,"id": string,"indirizzo": string | null,"lingua_preferita": string,"luogo_nascita": string | null,"nome": string,"note_generali": string | null,"office_id": string,"passaporto_numero": string | null,"passaporto_scadenza": string | null,"permesso_numero": string | null,"permesso_scadenza": string | null,"permesso_tipo": string | null,"search_text": string | null,"sesso": string | null,"stato_civile": string | null,"tags": (string)[],"telefono": string | null,"updated_at": string,"whatsapp_attivo": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "cap"?: string | null,"citta"?: string | null,"cittadinanza"?: string | null,"codice"?: number,"codice_fiscale"?: string | null,"cognome": string,"consenso_privacy"?: boolean,"consenso_privacy_data"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_nascita"?: string | null,"email"?: string | null,"id"?: string,"indirizzo"?: string | null,"lingua_preferita"?: string,"luogo_nascita"?: string | null,"nome": string,"note_generali"?: string | null,"office_id": string,"passaporto_numero"?: string | null,"passaporto_scadenza"?: string | null,"permesso_numero"?: string | null,"permesso_scadenza"?: string | null,"permesso_tipo"?: string | null,"search_text"?: never,"sesso"?: string | null,"stato_civile"?: string | null,"tags"?: (string)[],"telefono"?: string | null,"updated_at"?: string,"whatsapp_attivo"?: boolean
                  }
                  Update: {
                    "cap"?: string | null,"citta"?: string | null,"cittadinanza"?: string | null,"codice"?: number,"codice_fiscale"?: string | null,"cognome"?: string,"consenso_privacy"?: boolean,"consenso_privacy_data"?: string | null,"created_at"?: string,"created_by"?: string | null,"data_nascita"?: string | null,"email"?: string | null,"id"?: string,"indirizzo"?: string | null,"lingua_preferita"?: string,"luogo_nascita"?: string | null,"nome"?: string,"note_generali"?: string | null,"office_id"?: string,"passaporto_numero"?: string | null,"passaporto_scadenza"?: string | null,"permesso_numero"?: string | null,"permesso_scadenza"?: string | null,"permesso_tipo"?: string | null,"search_text"?: never,"sesso"?: string | null,"stato_civile"?: string | null,"tags"?: (string)[],"telefono"?: string | null,"updated_at"?: string,"whatsapp_attivo"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clients_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "ai_riepilogo": string | null,"ai_tipo_documento": string | null,"client_id": string,"created_at": string,"dimensione": number | null,"folder_id": string | null,"id": string,"mime_type": string | null,"nome": string,"office_id": string,"origine": string,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_riepilogo"?: string | null,"ai_tipo_documento"?: string | null,"client_id": string,"created_at"?: string,"dimensione"?: number | null,"folder_id"?: string | null,"id"?: string,"mime_type"?: string | null,"nome": string,"office_id": string,"origine"?: string,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "ai_riepilogo"?: string | null,"ai_tipo_documento"?: string | null,"client_id"?: string,"created_at"?: string,"dimensione"?: number | null,"folder_id"?: string | null,"id"?: string,"mime_type"?: string | null,"nome"?: string,"office_id"?: string,"origine"?: string,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "scadenze_permessi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"folders": {
                  Row: {
                    "client_id": string,"created_at": string,"id": string,"nome": string,"office_id": string,"parent_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"id"?: string,"nome": string,"office_id": string,"parent_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"id"?: string,"nome"?: string,"office_id"?: string,"parent_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "folders_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "scadenze_permessi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    }
                  ]
                },"office_secrets": {
                  Row: {
                    "office_id": string,"wa_access_token": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "office_id": string,"wa_access_token"?: string | null
                  }
                  Update: {
                    "office_id"?: string,"wa_access_token"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "office_secrets_office_id_fkey"
      columns: ["office_id"]
isOneToOne: true
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"offices": {
                  Row: {
                    "ai_istruzioni": string,"ai_risposta_automatica": boolean,"attiva": boolean,"citta": string | null,"created_at": string,"email": string | null,"id": string,"indirizzo": string | null,"nome": string,"telefono": string | null,"wa_numero_visualizzato": string | null,"wa_phone_number_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_istruzioni"?: string,"ai_risposta_automatica"?: boolean,"attiva"?: boolean,"citta"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"indirizzo"?: string | null,"nome": string,"telefono"?: string | null,"wa_numero_visualizzato"?: string | null,"wa_phone_number_id"?: string | null
                  }
                  Update: {
                    "ai_istruzioni"?: string,"ai_risposta_automatica"?: boolean,"attiva"?: boolean,"citta"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"indirizzo"?: string | null,"nome"?: string,"telefono"?: string | null,"wa_numero_visualizzato"?: string | null,"wa_phone_number_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "attivo": boolean,"created_at": string,"email": string | null,"id": string,"nome_completo": string,"office_id": string | null,"ruolo": Database["public"]['Enums']["ruolo_utente"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attivo"?: boolean,"created_at"?: string,"email"?: string | null,"id": string,"nome_completo"?: string,"office_id"?: string | null,"ruolo"?: Database["public"]['Enums']["ruolo_utente"]
                  }
                  Update: {
                    "attivo"?: boolean,"created_at"?: string,"email"?: string | null,"id"?: string,"nome_completo"?: string,"office_id"?: string | null,"ruolo"?: Database["public"]['Enums']["ruolo_utente"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"whatsapp_messages": {
                  Row: {
                    "ai_bozza": string | null,"ai_categoria": string | null,"ai_gestito": boolean,"ai_motivo": string | null,"client_id": string | null,"created_at": string,"da_gestire": boolean,"direzione": Database["public"]['Enums']["direzione_msg"],"document_id": string | null,"id": string,"inviato_da": string | null,"media_mime": string | null,"media_path": string | null,"nome_profilo": string | null,"office_id": string,"stato_invio": string | null,"telefono": string,"testo": string | null,"tipo": string,"wa_message_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_bozza"?: string | null,"ai_categoria"?: string | null,"ai_gestito"?: boolean,"ai_motivo"?: string | null,"client_id"?: string | null,"created_at"?: string,"da_gestire"?: boolean,"direzione": Database["public"]['Enums']["direzione_msg"],"document_id"?: string | null,"id"?: string,"inviato_da"?: string | null,"media_mime"?: string | null,"media_path"?: string | null,"nome_profilo"?: string | null,"office_id": string,"stato_invio"?: string | null,"telefono": string,"testo"?: string | null,"tipo"?: string,"wa_message_id"?: string | null
                  }
                  Update: {
                    "ai_bozza"?: string | null,"ai_categoria"?: string | null,"ai_gestito"?: boolean,"ai_motivo"?: string | null,"client_id"?: string | null,"created_at"?: string,"da_gestire"?: boolean,"direzione"?: Database["public"]['Enums']["direzione_msg"],"document_id"?: string | null,"id"?: string,"inviato_da"?: string | null,"media_mime"?: string | null,"media_path"?: string | null,"nome_profilo"?: string | null,"office_id"?: string,"stato_invio"?: string | null,"telefono"?: string,"testo"?: string | null,"tipo"?: string,"wa_message_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_messages_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_messages_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "scadenze_permessi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_messages_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_messages_inviato_da_fkey"
      columns: ["inviato_da"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whatsapp_messages_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "conversazioni_whatsapp": {
                  Row: {
                    "client_id": string | null,"da_gestire": number | null,"nome_profilo": string | null,"office_id": string,"telefono": string,"ultima_direzione": Database["public"]['Enums']["direzione_msg"],"ultimo_at": string,"ultimo_testo": string | null,"ultimo_tipo": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "whatsapp_messages_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                },"scadenze_permessi": {
                  Row: {
                    "cognome": string,"giorni_mancanti": number | null,"id": string,"nome": string,"office_id": string,"permesso_scadenza": string | null,"permesso_tipo": string | null,"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cognome"?: string | null,"giorni_mancanti"?: never,"id"?: string | null,"nome"?: string | null,"office_id"?: string | null,"permesso_scadenza"?: string | null,"permesso_tipo"?: string | null,"telefono"?: string | null
                         }
                        Update: {
                           "cognome"?: string | null,"giorni_mancanti"?: never,"id"?: string | null,"nome"?: string | null,"office_id"?: string | null,"permesso_scadenza"?: string | null,"permesso_tipo"?: string | null,"telefono"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "clients_office_id_fkey"
      columns: ["office_id"]
isOneToOne: false
      referencedRelation: "offices"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "can_access_office":
{ Args: { "target": string }; Returns: boolean
                           },
"current_office_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_ruolo":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["ruolo_utente"]
                           },
"is_admin_rete":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"unaccent":
{ Args: { "": string }; Returns: string
                           }
          }
          Enums: {
            "direzione_msg": "in"|"out","origine_nota": "manuale"|"whatsapp"|"ai"|"sistema","ruolo_utente": "admin_rete"|"titolare"|"operatore","stato_pratica": "aperta"|"in_attesa_documenti"|"presentata"|"in_lavorazione"|"conclusa_positiva"|"conclusa_negativa"|"archiviata"
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "direzione_msg": ["in", "out"],"origine_nota": ["manuale", "whatsapp", "ai", "sistema"],"ruolo_utente": ["admin_rete", "titolare", "operatore"],"stato_pratica": ["aperta", "in_attesa_documenti", "presentata", "in_lavorazione", "conclusa_positiva", "conclusa_negativa", "archiviata"]
          }
        }
} as const
