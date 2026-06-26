import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../lib/axios';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters')
      .max(50, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const ForceChangePasswordPage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      const { accessToken, refreshToken } = response.data;
      const setAuth = useAuthStore.getState().setAuth;
      setAuth({ ...user, mustChangePassword: false }, accessToken, refreshToken);

      setSuccess('Password updated successfully! Redirecting...');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Password change error:', err);
      setError(err.response?.data?.message || 'Failed to change password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 -left-4 w-96 h-96 bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-3xl" />

      <Card className="w-full max-w-md p-8 glass border border-slate-200/80 dark:border-white/10 relative z-10 bg-white/80 dark:bg-slate-950/40 shadow-2xl rounded-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <div className="mx-auto p-3 bg-amber-550/10 border border-amber-500/20 rounded-full text-amber-600 dark:text-amber-500 w-fit">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Security Policy Update
          </h2>
          <p className="text-xs text-slate-650 dark:text-slate-400 font-medium">
            This is your first login. You must update your password to secure your portal access.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-650 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-655 dark:text-emerald-400">
              {success}
            </div>
          )}

          <Input
            id="currentPassword"
            label="Current Password"
            type="password"
            placeholder="••••••••"
            icon={KeyRound}
            error={errors.currentPassword}
            required
            className="text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 [&_input]:bg-white dark:[&_input]:bg-slate-900/50 [&_input]:border-slate-300 dark:[&_input]:border-slate-800 [&_input]:text-slate-900 dark:[&_input]:text-white [&_input]:focus:border-indigo-500"
            {...register('currentPassword')}
          />

          <Input
            id="newPassword"
            label="New Password"
            type="password"
            placeholder="••••••••"
            icon={KeyRound}
            error={errors.newPassword}
            required
            className="text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 [&_input]:bg-white dark:[&_input]:bg-slate-900/50 [&_input]:border-slate-300 dark:[&_input]:border-slate-800 [&_input]:text-slate-900 dark:[&_input]:text-white [&_input]:focus:border-indigo-500"
            {...register('newPassword')}
          />

          <Input
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            placeholder="••••••••"
            icon={KeyRound}
            error={errors.confirmPassword}
            required
            className="text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 [&_input]:bg-white dark:[&_input]:bg-slate-900/50 [&_input]:border-slate-300 dark:[&_input]:border-slate-800 [&_input]:text-slate-900 dark:[&_input]:text-white [&_input]:focus:border-indigo-500"
            {...register('confirmPassword')}
          />

          <Button
            type="submit"
            className="w-full py-3 mt-2 text-sm font-semibold tracking-wide"
            loading={loading}
          >
            Update Security Credentials
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ForceChangePasswordPage;
