import { AuthForm } from '../components/AuthForm';
import { TelegramLoginButton } from '../components/TelegramLoginButton';
import { loginUser } from '../services/auth';

export function LoginPage() {
  const handleSubmit = async (email: string, password: string) => {
    await loginUser(email, password);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <AuthForm
          title="Accesso"
          description="Entra con email e password per gestire la tua lega privata."
          submitLabel="Accedi"
          onSubmit={handleSubmit}
        />
      </div>
      <div>
        <TelegramLoginButton />
      </div>
    </div>
  );
}
