import React from 'react';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Header() {
    const { user, logout } = useAuth();

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-black/[0.04] bg-white/80 px-6 backdrop-blur-xl transition-all">
            <div className="flex items-center gap-4">
                <span className="text-[14px] font-medium text-[#86868b] tracking-wide">
                Sistema de Performance <span className="text-[#1d1d1f] font-semibold">CR INVEST</span>
                </span>
            </div>

            <div className="flex items-center space-x-5">
                <div className="flex flex-col text-right">
                    <span className="text-[13px] font-semibold text-[#1d1d1f] uppercase tracking-wide">{user?.nome}</span>
                    <span className="text-[10px] font-medium text-[#86868b] uppercase tracking-wider">{user?.role}</span>
                </div>
                
                <div className="h-8 w-8 bg-[#f5f5f7] border border-[#e5e5ea] rounded-full flex items-center justify-center text-[#1d1d1f]">
                    <User size={16} strokeWidth={1.5} />
                </div>

                <button 
                    onClick={logout}
                    className="text-[#86868b] hover:text-[#ff3b30] transition-colors flex items-center justify-center h-8 w-8 rounded-full hover:bg-red-50"
                    title="Sair do Sistema"
                >
                    <LogOut size={16} strokeWidth={1.5} />
                </button>
            </div>
        </header>
    );
}
