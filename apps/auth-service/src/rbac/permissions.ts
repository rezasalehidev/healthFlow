export const RoleName = {
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  PATIENT: 'PATIENT',
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];

export const PermissionCode = {
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  PATIENTS_READ: 'patients:read',
  PATIENTS_UPDATE: 'patients:update',
  MEDICAL_RECORDS_READ: 'medical-records:read',
  MEDICAL_RECORDS_CREATE: 'medical-records:create',
  MEDICAL_RECORDS_UPDATE: 'medical-records:update',
  APPOINTMENTS_READ: 'appointments:read',
  APPOINTMENTS_CREATE: 'appointments:create',
  APPOINTMENTS_UPDATE: 'appointments:update',
  DOCTORS_READ: 'doctors:read',
  DOCTORS_UPDATE: 'doctors:update',
  PRESCRIPTIONS_CREATE: 'prescriptions:create',
  PRESCRIPTIONS_READ: 'prescriptions:read',
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PermissionCode);

/** Default permission grants per role (seed source of truth). */
export const ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  DOCTOR: [
    PermissionCode.PATIENTS_READ,
    PermissionCode.MEDICAL_RECORDS_READ,
    PermissionCode.MEDICAL_RECORDS_CREATE,
    PermissionCode.MEDICAL_RECORDS_UPDATE,
    PermissionCode.APPOINTMENTS_READ,
    PermissionCode.APPOINTMENTS_UPDATE,
    PermissionCode.DOCTORS_READ,
    PermissionCode.DOCTORS_UPDATE,
    PermissionCode.PRESCRIPTIONS_CREATE,
    PermissionCode.PRESCRIPTIONS_READ,
  ],
  PATIENT: [
    PermissionCode.PATIENTS_READ,
    PermissionCode.PATIENTS_UPDATE,
    PermissionCode.MEDICAL_RECORDS_READ,
    PermissionCode.APPOINTMENTS_READ,
    PermissionCode.APPOINTMENTS_CREATE,
    PermissionCode.APPOINTMENTS_UPDATE,
    PermissionCode.DOCTORS_READ,
    PermissionCode.PRESCRIPTIONS_READ,
  ],
};
