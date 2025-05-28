import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useLocation } from 'wouter';

export default function Login() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation('/');
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = await login(email, password);
    if (!ok) setError('E-mail ou senha inválidos');
    else setLocation('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 to-black">
      <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-lg p-10 w-full max-w-md space-y-6 border border-yellow-200">
        <h2 className="text-3xl font-bold text-yellow-700 mb-2 text-center">Login</h2>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        <div>
          <label className="block text-yellow-700 font-medium mb-1">E-mail</label>
          <input
            className="w-full px-4 py-2 border border-yellow-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-50"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-yellow-700 font-medium mb-1">Senha</label>
          <input
            className="w-full px-4 py-2 border border-yellow-200 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-50"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 rounded transition-colors"
        >
          Entrar
        </button>
      </form>
    </div>
  );
} 