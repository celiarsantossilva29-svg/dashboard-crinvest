import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const user = await login(email, senha);
            if (user.role === 'ADMIN') navigate('/admin');
            else if (user.role === 'CLOSER') navigate('/closer');
            else if (user.role === 'SDR') navigate('/sdr');
        } catch (err) {
            setError('Credenciais inválidas. Verifique e-mail e senha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#fbfbfd] p-4 font-sans">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-10">
                    <img 
                        src="/logo-crinvest.png" 
                        alt="CR INVEST — Consórcios e Investimentos" 
                        className="w-44 h-auto"
                    />
                </div>

                {/* Card */}
                <div className="rounded-[32px] border border-black/[0.04] bg-white p-10 shadow-[0_8px_32px_rgb(0,0,0,0.06)]">
                    <h2 className="text-[26px] font-bold tracking-tight text-[#1d1d1f] text-center">
                        Bem-vindo de volta
                    </h2>
                    <p className="text-[15px] text-[#86868b] font-medium text-center mt-2 mb-8">
                        Acesse sua plataforma de gestão comercial
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[13px] font-bold text-[#86868b] uppercase tracking-wider">E-mail</label>
                            <input 
                                type="email" 
                                className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-5 py-4 text-[16px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all placeholder:text-[#86868b]/50"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[13px] font-bold text-[#86868b] uppercase tracking-wider">Senha</label>
                            <input 
                                type="password" 
                                className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-5 py-4 text-[16px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all placeholder:text-[#86868b]/50"
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        
                        {error && (
                            <div className="rounded-xl bg-[#fceceb] border border-[#e3000f]/20 px-4 py-3 text-[14px] font-semibold text-[#e3000f] text-center">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#e8c96b] px-6 py-4 text-[17px] font-bold text-[#1d1d1f] shadow-[0_8px_20px_rgba(212,175,55,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(212,175,55,0.4)] disabled:opacity-70"
                        >
                            {loading ? 'Autenticando...' : 'ACESSAR PLATAFORMA'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[13px] text-[#86868b] font-medium mt-8">
                    CR INVEST · Consórcios e Investimentos
                </p>
            </div>
        </div>
    );
}
