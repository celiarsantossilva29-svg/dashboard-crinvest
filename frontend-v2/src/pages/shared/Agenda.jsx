import React, { useState, useEffect } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import { useAuth } from "../../contexts/AuthContext";
import { Calendar, Clock, Video, CheckCircle2 } from "lucide-react";

const mockAgenda = [
  { id: 1, type: "Reunião de Apresentação", client: "Roberto Almeida", time: "10:00", date: new Date().toISOString().split('T')[0], status: "Confirmado", link: "https://goto.com/meet/123" },
  { id: 2, type: "Fechamento", client: "Mariana Souza", time: "14:30", date: new Date().toISOString().split('T')[0], status: "Aguardando", link: "https://goto.com/meet/456" },
  { id: 3, type: "Follow up (Kommo)", client: "Carlos Fernandes", time: "16:00", date: new Date().toISOString().split('T')[0], status: "Cancelado", link: "" },
];

export default function Agenda() {
  const { user } = useAuth();
  
  return (
    <div className="flex h-screen bg-[#fbfbfd] overflow-hidden text-[#1d1d1f] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#fbfbfd]">
          <div className="mx-auto px-8 py-10 lg:px-12 max-w-[1000px]">
            <div className="mb-10">
              <h1 className="text-[40px] leading-tight font-bold tracking-tight text-[#1d1d1f]">
                Minha Agenda
              </h1>
              <p className="mt-2 text-[17px] leading-relaxed text-[#86868b] font-medium">
                Sincronizado automaticamente com Kommo e GoTo Meetings.
              </p>
            </div>

            <section className="rounded-[32px] border border-black/[0.04] bg-white p-8 shadow-[0_8px_32px_rgb(0,0,0,0.04)]">
              <div className="flex items-center gap-4 mb-8">
                <div className="flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-[#1d1d1f] to-[#3a3a3c] text-[#d4af37] shadow-lg">
                  <Calendar size={28} />
                </div>
                <div>
                  <h3 className="text-[22px] font-bold tracking-tight">Próximos Compromissos</h3>
                  <p className="text-[#86868b] text-[15px] font-medium">Hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
              </div>

              <div className="space-y-4">
                {mockAgenda.map(item => (
                  <div key={item.id} className="group relative rounded-3xl border border-black/[0.04] p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col items-center justify-center h-14 w-14 rounded-full bg-[#f5f5f7] border border-[#e5e5ea]">
                        <span className="text-[16px] font-bold text-[#1d1d1f] leading-none">{item.time.split(':')[0]}</span>
                        <span className="text-[12px] font-semibold text-[#86868b] leading-none mt-1">{item.time.split(':')[1]}</span>
                      </div>
                      <div>
                        <h4 className="text-[18px] font-bold text-[#1d1d1f] tracking-tight">{item.client}</h4>
                        <p className="text-[14px] text-[#86868b] font-medium mt-1">{item.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {item.status === 'Confirmado' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ea] px-3 py-1.5 text-[13px] font-bold text-[#008f39]">
                          <CheckCircle2 size={14} /> Confirmado
                        </span>
                      )}
                      {item.status === 'Aguardando' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef2d6] px-3 py-1.5 text-[13px] font-bold text-[#b06a00]">
                          <Clock size={14} /> Aguardando
                        </span>
                      )}
                      
                      {item.link ? (
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-[#0066cc] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#0055aa] shadow-[0_4px_12px_rgba(0,102,204,0.3)]"
                        >
                          <Video size={16} /> Entrar
                        </a>
                      ) : (
                        <button disabled className="inline-flex items-center gap-2 rounded-xl bg-[#f5f5f7] px-5 py-2.5 text-[14px] font-semibold text-[#86868b] cursor-not-allowed">
                          Indisponível
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
