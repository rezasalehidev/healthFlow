export const EXCHANGES = {
  events: 'healthflow.events',
  retry: 'healthflow.retry',
  dlq: 'healthflow.dlq',
  requeue: 'healthflow.requeue',
} as const;

export const QUEUES = {
  notifications: 'healthflow.notifications',
  notificationsRetry5s: 'healthflow.notifications.retry.5s',
  notificationsRetry30s: 'healthflow.notifications.retry.30s',
  notificationsRetry120s: 'healthflow.notifications.retry.120s',
  notificationsDlq: 'healthflow.notifications.dlq',
  notificationsRequeue: 'healthflow.notifications.requeue',
  audit: 'healthflow.audit',
} as const;

export const ROUTING_KEYS = {
  appointmentCreated: 'appointment.created',
  appointmentConfirmed: 'appointment.confirmed',
  appointmentCancelled: 'appointment.cancelled',
  appointmentRescheduled: 'appointment.rescheduled',
  appointmentCompleted: 'appointment.completed',
  appointmentNoShow: 'appointment.no_show',
  appointmentReminder: 'appointment.reminder',
  prescriptionCreated: 'prescription.created',
  medicalRecordCreated: 'medical-record.created',
  medicalRecordUpdated: 'medical-record.updated',
} as const;

export const NOTIFICATION_BINDING_PATTERNS = [
  'appointment.*',
  'prescription.*',
  'medical-record.*',
] as const;

export const MAX_RETRY_ATTEMPTS = 3;

export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;

export const HEADER_RETRY_COUNT = 'x-healthflow-retry-count';
export const HEADER_ORIGINAL_ROUTING_KEY = 'x-healthflow-original-routing-key';
