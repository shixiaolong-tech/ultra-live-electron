export type MessageToastType = 'info' | 'success' | 'warning' | 'error'

export interface MessageToastOptions {
  message: string
  type?: MessageToastType
  // Auto-dismiss duration in milliseconds. When omitted, a type-based
  // default is used (success: 3s, others: 5s).
  duration?: number
}
