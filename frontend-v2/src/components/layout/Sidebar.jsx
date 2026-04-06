import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, BadgeDollarSign, ArrowRightLeft, Phone, Target, Calendar, PlusCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Sidebar() {
    const { user } = useAuth();
    const location = useLocation();

    const getLinks = () => {
        if (user?.role === 'ADMIN') {
            return [
                { path: '/admin', icon: <LayoutDashboard size={20} strokeWidth={1.5} />, label: 'Visão Executiva' },
                { path: '/admin/ciclo-comercial', icon: <Target size={20} strokeWidth={1.5} />, label: 'Ciclo Comercial' },
                { path: '/admin/gestao-vendas', icon: <ArrowRightLeft size={20} strokeWidth={1.5} />, label: 'Gestão de Vendas' },
                { path: '/admin/dashboard-sdr', icon: <Phone size={20} strokeWidth={1.5} />, label: 'Performance SDR' },
                { path: '/admin/dashboard-closer', icon: <Target size={20} strokeWidth={1.5} />, label: 'Performance Closer' },
                { path: '/admin/vendas', icon: <BadgeDollarSign size={20} strokeWidth={1.5} />, label: 'Validação de Venda' },
                { path: '/admin/agenda', icon: <Calendar size={20} strokeWidth={1.5} />, label: 'Agenda (Kommo/GoTo)' },
                { path: '/admin/usuarios', icon: <Users size={20} strokeWidth={1.5} />, label: 'Usuários' }
            ];
        }
        if (user?.role === 'CLOSER') {
            return [
                { path: '/closer', icon: <LayoutDashboard size={20} strokeWidth={1.5} />, label: 'Dashboard' },
                { path: '/closer/nova-venda', icon: <PlusCircle size={20} strokeWidth={1.5} />, label: 'Registrar Venda' },
                { path: '/closer/agenda', icon: <Calendar size={20} strokeWidth={1.5} />, label: 'Minha Agenda' },
            ];
        }
        if (user?.role === 'SDR') {
            return [
                { path: '/sdr', icon: <LayoutDashboard size={20} strokeWidth={1.5} />, label: 'Dashboard' },
                { path: '/sdr/nova-venda', icon: <PlusCircle size={20} strokeWidth={1.5} />, label: 'Registrar Venda' },
                { path: '/sdr/agenda', icon: <Calendar size={20} strokeWidth={1.5} />, label: 'Minha Agenda' },
            ];
        }
        return [];
    };

    const links = getLinks();

    return (
        <div className="flex flex-col h-screen w-[320px] bg-[#fbfbfd] border-r border-[#e5e5ea] hidden md:flex relative z-20 shrink-0">
            <div className="flex h-16 shrink-0 items-center px-5 border-b border-black/[0.04] bg-white/80 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <img src="/logo-crinvest.png" alt="CR INVEST" className="h-10 w-auto" />
                    <span className="text-[17px] font-bold tracking-tight text-[#1d1d1f]">CR INVEST</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
                <nav className="space-y-1.5">
                    {links.map((link) => {
                        const isActive = location.pathname === link.path || (link.path === '/admin' && location.pathname.startsWith('/admin/dashboard-admin'));
                        return (
                            <NavLink
                                key={link.path}
                                to={link.path}
                                end={link.path === '/admin' || link.path === '/sdr' || link.path === '/closer'}
                                className="group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition-all duration-300 relative overflow-hidden focus:outline-none"
                                style={{
                                    backgroundColor: isActive ? '#f9f9fb' : 'transparent',
                                    color: isActive ? '#1d1d1f' : '#86868b',
                                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.02)' : 'none',
                                }}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#d4af37] to-[#e8c96b] rounded-r-full" />
                                )}
                                <div className={`flex items-center justify-center transition-colors duration-300 ${isActive ? 'text-[#d4af37]' : 'text-[#86868b] group-hover:text-[#1d1d1f]'}`}>
                                    {link.icon}
                                </div>
                                <span className="truncate group-hover:text-[#1d1d1f] transition-colors">{link.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
