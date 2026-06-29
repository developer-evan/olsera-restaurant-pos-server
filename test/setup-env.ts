import { config } from 'dotenv';

config({ path: '.env' });

process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'e2e-test-jwt-secret-with-sufficient-length';
process.env.NODE_ENV = 'test';
delete process.env.SUPER_ADMIN_EMAIL;
delete process.env.SUPER_ADMIN_PASSWORD;

if (process.env.MONGODB_URI) {
  process.env.MONGODB_URI = toTestDatabaseUri(process.env.MONGODB_URI);
}

function toTestDatabaseUri(uri: string): string {
  const [base, query] = uri.split('?');
  const segments = base.split('/');
  segments[segments.length - 1] = 'olsera_pos_test';
  return query ? `${segments.join('/')}?${query}` : segments.join('/');
}
