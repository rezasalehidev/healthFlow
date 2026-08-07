export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface PublicUser {
  id: string;
  email: string;
  status: string;
  roles: string[];
  permissions: string[];
  createdAt: string;
}
