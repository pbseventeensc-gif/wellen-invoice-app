import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = Array.isArray(params?.error) ? params.error[0] : params?.error;

  const initialError = error === 'access'
    ? 'Akun belum memiliki izin aplikasi. Silakan hubungi administrator.'
    : error === 'session'
      ? 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.'
      : null;

  return <LoginForm initialError={initialError} />;
}
