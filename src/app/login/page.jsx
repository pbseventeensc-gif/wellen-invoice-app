import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = Array.isArray(params?.error) ? params.error[0] : params?.error;

  const initialError = error === 'access'
    ? 'Your account does not have access to this app. Please contact an administrator.'
    : error === 'session'
      ? 'Your session is invalid or has expired. Please sign in again.'
      : null;

  return <LoginForm initialError={initialError} />;
}
