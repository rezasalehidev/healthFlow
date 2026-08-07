export interface GatewayJwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}
