import { AuthForm } from '../components/AuthForm';
import { registerUser } from '../services/auth';

export function RegisterPage() {
  const handleSubmit = async (email: string, password: string) => {
    await registerUser(email, password);
  };

  return (
    <AuthForm
      title="Registrazione"
      description="Crea un account e unisciti a una lega privata di FantaDrama."
      submitLabel="Registrati"
      onSubmit={handleSubmit}
    />
  );
}
