import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import * as z from 'zod';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', {
        email: data.email.trim(),
        password: data.password,
      });

      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken);
      // Do not force password change on login; users may change password from profile
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 relative overflow-hidden transition-colors duration-300">
      {/* Dynamic Gradients in Background */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-3xl" />

      <Card className="w-full max-w-md p-5 sm:p-8 glass border border-slate-200/80 dark:border-white/10 relative z-10 bg-white/80 dark:bg-slate-950/40 shadow-2xl rounded-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight bg-gradient-to-r from-indigo-600 via-indigo-400 to-indigo-600 dark:from-indigo-200 dark:via-indigo-400 dark:to-indigo-200 bg-clip-text">
            MMS Enterprise
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            Material Management portal login
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-650 dark:text-red-400">
              {error}
            </div>
          )}

          <Input
            id="email"
            label="Email Address"
            type="email"
            placeholder="enter email address"
            icon={User}
            error={errors.email}
            required
            className="text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 [&_input]:bg-white dark:[&_input]:bg-slate-900/50 [&_input]:border-slate-300 dark:[&_input]:border-slate-800 [&_input]:text-slate-900 dark:[&_input]:text-white [&_input]:focus:border-indigo-500"
            {...register('email')}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            icon={KeyRound}
            error={errors.password}
            required
            className="text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 [&_input]:bg-white dark:[&_input]:bg-slate-900/50 [&_input]:border-slate-300 dark:[&_input]:border-slate-800 [&_input]:text-slate-900 dark:[&_input]:text-white [&_input]:focus:border-indigo-500"
            {...register('password')}
          />

          <Button
            type="submit"
            className="w-full py-3 mt-2 text-sm font-semibold tracking-wide"
            loading={loading}
          >
            Authenticate
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
