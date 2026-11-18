/** Result returned by every Server Action (serializable, safe for the client). */
export interface ActionState {
  ok: boolean;
  /** Translation key under messages.errors */
  error?: string;
  /** Offending field reported by validation or the database */
  field?: string;
  /** Translation key or literal confirmation message */
  message?: string;
  id?: string;
  data?: Record<string, string | number | boolean | null>;
  /** Timestamp so the client can react to repeated identical results */
  at?: number;
}

export const IDLE: ActionState = { ok: false };
