import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';

export default function Register() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Erro ao registrar');
        return;
      }
      setSuccess(true);
      // Login automático após cadastro
      const ok = await login(email, password);
      if (ok) {
        window.location.href = '/';
      } else {
        setError('Erro ao fazer login automático. Faça login manualmente.');
      }
    } catch {
      setError('Erro ao registrar');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 to-black">
      <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-lg p-10 w-full max-w-md space-y-6 border border-yellow-200">
        <h2 className="text-3xl font-bold text-yellow-700 mb-2 text-center">Cadastro</h2>
        {error && <div className="text-red-600 text-sm text-center">{error}</div>}
        {success && <div className="text-green-600 text-sm text-center">Cadastro realizado com sucesso! Redirecionando...</div>}
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
          Cadastrar
        </button>
        <div className="text-center text-sm mt-2">
          Já possui uma conta? <a href="/login" className="text-yellow-700 hover:underline">Entrar</a>
        </div>
      </form>
    </div>
  );
} 