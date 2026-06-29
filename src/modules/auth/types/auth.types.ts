import { PlatformRole } from '../../users/enums/user.enum';

export type JwtPayload = {
  sub: string;
  email: string;
  platformRole: PlatformRole | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthResult = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    platformRole: PlatformRole | null;
    status: string;
  };
  tokens: AuthTokens;
};
