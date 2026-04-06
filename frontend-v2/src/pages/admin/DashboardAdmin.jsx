import React from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import { Crown, ArrowDown } from 'lucide-react';

export default function DashboardAdmin() {
  return (
    <div className="flex h-screen bg-[#f7f8f9] overflow-hidden text-[#1d1d1f] font-sans selection:bg-[#c89f3c] selection:text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto w-full pt-8 pb-16">
          <div className="mx-auto max-w-[960px] px-6">
            
            {/* Title */}
            <h1 className="text-center font-serif text-[28px] text-[#1d1d1f] mb-6 tracking-wide">
              <span className="font-bold">Ciclo Comercial</span> — Visão Executiva
            </h1>

            {/* Top Large Card */}
            <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6 pb-4">
              {/* Row 1: Main KPIs */}
              <div className="grid grid-cols-4 gap-6 text-center divide-x divide-[#f0f0f5]">
                <div className="px-2">
                  <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Realizado</p>
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-[16px] font-bold text-[#1d1d1f]">R$</span>
                    <span className="text-[36px] font-black text-[#1d1d1f] tracking-tight leading-none">413.122</span>
                  </div>
                </div>
                <div className="px-2">
                  <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Meta</p>
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-[14px] font-bold text-[#86868b]">R$</span>
                    <span className="text-[28px] font-bold text-[#1d1d1f] tracking-tight leading-none">5.000.000</span>
                  </div>
                </div>
                <div className="px-2">
                  <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Atingido</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-[28px] font-bold text-[#1d1d1f] tracking-tight leading-none">8,3%</span>
                  </div>
                </div>
                <div className="px-2">
                  <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Faltam</p>
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-[14px] font-bold text-[#86868b]">R$</span>
                    <span className="text-[28px] font-bold text-[#1d1d1f] tracking-tight leading-none">4.586.878</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-[#e5e5ea] rounded-full mt-6 mb-5 relative overflow-hidden shadow-inner">
                <div className="absolute top-0 left-0 h-full bg-[#b22222] rounded-full transition-all duration-1000 ease-out" style={{ width: '8.3%' }}></div>
              </div>

              {/* Row 2: Secondary Metrics */}
              <div className="flex items-center justify-between border-t border-[#f0f0f5] pt-4 pb-2">
                <div className="flex items-center gap-8 text-[13px]">
                  <p className="text-[#1d1d1f]">Ticket médio: <span className="font-bold">R$ 206.561</span></p>
                  <div className="w-px h-4 bg-[#e5e5ea]"></div>
                  <p className="text-[#1d1d1f]">Vendas realizadas: <span className="font-bold">2</span></p>
                  <div className="w-px h-4 bg-[#e5e5ea]"></div>
                  <p className="text-[#1d1d1f]">Faltam: <span className="font-bold">23 vendas</span></p>
                  <div className="w-px h-4 bg-[#e5e5ea]"></div>
                  <p className="text-[#1d1d1f]"><span className="italic">Fechamentos por dia:</span> <span className="font-bold text-[14px]">1,2</span></p>
                </div>
              </div>

              {/* Row 3: Projection & Days */}
              <div className="border-t border-[#f0f0f5] mt-1 pt-3 flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 text-[12px] font-medium text-[#86868b]">
                  <span>Conservador: faltam 26 vendas</span>
                  <div className="bg-[#b49136] text-white px-3 py-1 text-[11px] font-bold relative" style={{ clipPath: 'polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%)' }}>
                    Base: faltam 23 vendas
                  </div>
                </div>
                <div className="text-[13px] text-[#1d1d1f]">
                  Dias restantes: <span className="font-black text-[15px]">18</span>
                </div>
              </div>
            </div>

            {/* Warning Text */}
            <div className="flex justify-end mt-2.5 mb-5 px-2">
              <p className="text-[13px] text-[#b22222] font-semibold italic">
                No ritmo atual você <span className="underline font-bold uppercase">NÃO</span> bate a meta.
              </p>
            </div>

            {/* Dark Cards Row */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-[#262626] rounded-xl p-5 shadow-lg border border-[#333] flex flex-col justify-center">
                <p className="text-[#a1a1a6] text-[12px] font-bold mb-1">Ritmo atual</p>
                <div className="flex items-baseline gap-1.5 text-white">
                  <span className="text-[16px] font-bold">R$</span>
                  <span className="text-[26px] font-black tracking-tight leading-none">11.500</span>
                  <span className="text-[12px] font-medium text-[#a1a1a6] ml-1">/ dia</span>
                </div>
              </div>
              
              <div className="bg-[#262626] rounded-xl p-5 shadow-lg border border-[#333] flex flex-col justify-center">
                <p className="text-[#a1a1a6] text-[12px] font-bold mb-1">Ritmo necessário</p>
                <div className="flex items-baseline gap-1.5 text-white">
                  <span className="text-[14px] font-bold">R$</span>
                  <span className="text-[26px] font-black tracking-tight leading-none">166.000</span>
                  <span className="text-[12px] font-medium text-[#a1a1a6] ml-1">/ dia</span>
                </div>
              </div>

              <div className="bg-[#262626] rounded-xl p-5 shadow-lg border border-[#333] flex flex-col justify-center relative">
                <p className="text-[#a1a1a6] text-[12px] font-bold mb-1">Projeção final</p>
                <div className="flex items-baseline gap-1.5 text-white">
                  <span className="text-[14px] font-bold">R$</span>
                  <span className="text-[26px] font-black tracking-tight leading-none">900.000</span>
                </div>
                <span className="text-[11px] font-medium text-[#86868b] absolute bottom-3 right-5 uppercase tracking-wide">(18% da meta)</span>
              </div>

              <div className="bg-[#262626] rounded-xl shadow-lg border border-[#333] flex flex-col items-center justify-center py-4">
                <p className="text-[#a1a1a6] text-[12px] font-bold mb-1">Dias restantes</p>
                <div className="text-white text-[38px] font-black tracking-tight leading-none">18</div>
              </div>
            </div>

            {/* Funnel Section */}
            <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6 mb-6">
              
              {/* Funnel Headers */}
              <div className="flex mb-2 px-1">
                <div className="flex-1 text-center">
                  <p className="text-[13px] font-bold text-[#1d1d1f]">Leads &nbsp;<span className="font-black text-[15px]">2.350</span></p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[13px] font-bold text-[#1d1d1f]">48% Contatados</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[13px] font-bold text-[#1d1d1f]">15% Agendados</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[13px] font-bold text-[#1d1d1f]">11% Reuniões</p>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[17px] font-black text-[#1d1d1f]">2</p>
                </div>
              </div>

              {/* Funnel Chevrons */}
              <div className="flex h-[36px] w-full items-stretch">
                <div className="flex-1 bg-[#e0e1e2]" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%)' }}></div>
                
                <div className="flex-1 bg-[#f0f0f2] flex items-center justify-center -ml-4" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)', paddingLeft: '8%' }}>
                  <div className="flex items-center gap-1.5 text-[#1d1d1f] font-bold text-[12px]">
                    29% 
                    <ArrowDown size={14} className="text-[#b22222] stroke-[3px] mx-0.5" /> 
                    <span className="text-[#86868b]">-71%</span>
                  </div>
                </div>

                <div className="flex-1 bg-[#b49136] flex items-center justify-center -ml-4" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)', paddingLeft: '8%' }}>
                  <div className="flex items-center gap-1.5 text-white font-bold text-[12px]">
                    24% 
                    <ArrowDown size={14} className="text-white stroke-[3px] mx-0.5 opacity-80" /> 
                    <span className="text-white/80">-76%</span>
                  </div>
                </div>

                <div className="flex-1 bg-[#e0e1e2] flex items-center justify-center -ml-4" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)', paddingLeft: '8%' }}>
                  <div className="flex items-center gap-1.5 text-[#1d1d1f] font-bold text-[12px]">
                    27% 
                    <ArrowDown size={14} className="text-[#b22222] stroke-[3px] mx-0.5" /> 
                    <span className="text-[#86868b]">-73%</span>
                  </div>
                </div>

                <div className="flex-1 bg-[#f0f0f2] -ml-4" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10% 50%)' }}></div>
              </div>

              <div className="text-center mt-5 text-[13px] font-medium italic text-[#1d1d1f]">
                <span className="font-bold">Gargalo em agendamento</span> <span className="text-[#c7c7c9] mx-2 text-[10px]">•</span> Baixa conversão reunião ➔ venda
              </div>
            </div>

            {/* Metrics Grids (Row 1) */}
            <div className="grid grid-cols-12 gap-5 mb-5">
              
              {/* Prospecção (7 cols) */}
              <div className="col-span-7 bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Prospecção</h3>
                <div className="grid grid-cols-2 gap-x-10 relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#f0f0f5] -ml-px"></div>
                  
                  <ul className="space-y-4">
                    <li className="flex justify-between text-[13px]">
                      <span className="text-[#1d1d1f] font-semibold">Leads gerados</span>
                      <span className="font-bold text-[#1d1d1f] tabular-nums">2.350</span>
                    </li>
                    <li className="flex justify-between text-[13px]">
                      <span className="text-[#1d1d1f] font-semibold">No-show</span>
                      <span className="font-bold text-[#1d1d1f] tabular-nums">18,8%</span>
                    </li>
                    <li className="flex justify-between text-[13px]">
                      <span className="text-[#1d1d1f] font-semibold">Qualificação</span>
                      <span className="font-bold text-[#1d1d1f] tabular-nums">42,5%</span>
                    </li>
                  </ul>

                  <ul className="space-y-4">
                    <li className="flex justify-between text-[13px]">
                      <span className="text-[#1d1d1f] font-semibold">Taxa de Agendamento</span>
                      <span className="font-bold text-[#1d1d1f] tabular-nums">15,2%</span>
                    </li>
                    <li className="flex justify-between text-[13px]">
                      <span className="text-[#1d1d1f] font-semibold">Qualificação</span>
                      <span className="font-bold text-[#1d1d1f] tabular-nums">42,5%</span>
                    </li>
                    <li className="flex justify-between text-[13px]">
                      <span className="text-[#1d1d1f] font-semibold">Contatos por Lead</span>
                      <span className="font-bold text-[#1d1d1f] tabular-nums">3,7</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Performance de Vendas (5 cols) */}
              <div className="col-span-5 bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Performance de Vendas</h3>
                <ul className="space-y-4">
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">CAC</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>820</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Ticket Médio</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>206.561</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Conversão Geral</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">0,1%</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Ciclo de Vendas</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">18 dias</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Metrics Grids (Row 2) */}
            <div className="grid grid-cols-3 gap-5 mb-8">
              
              {/* Tráfego Meta Ads */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Tráfego Meta Ads</h3>
                <ul className="space-y-4">
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Investimento Total</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>150.000</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">CPL</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>63,80</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">CPC</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>4,25</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">CTR</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">1,8%</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">ROAS</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">2,75</span>
                  </li>
                </ul>
              </div>

              {/* Discadores */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Discadores</h3>
                <ul className="space-y-4">
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Total de Ligações</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">780</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Tempo Falado</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">32h 40m</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Média por Ligação</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">2m 30s</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px] pt-1 border-t border-[#f0f0f5] border-dashed">
                    <span className="text-[#86868b] font-medium">GoTo</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">420</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#86868b] font-medium">3C Plus</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">360</span>
                  </li>
                </ul>
              </div>

              {/* Tabulações 3C Plus */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Tabulações 3C Plus</h3>
                <ul className="space-y-4">
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Sem Interesse</span>
                    <span className="font-bold text-[#b49136] tabular-nums">38%</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Não Atendeu</span>
                    <span className="font-bold text-[#b49136] tabular-nums">22%</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Retornar</span>
                    <span className="font-bold text-[#b49136] tabular-nums">12%</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Negociação</span>
                    <span className="font-bold text-[#b49136] tabular-nums">8%</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Fechamento</span>
                    <span className="font-bold text-[#b49136] tabular-nums">5%</span>
                  </li>
                </ul>
              </div>

            </div>

            {/* Bottom Table: Ranking de Closers */}
            <div className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] overflow-hidden mb-12">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#f7f8f9] border-b border-[#e5e5ea]">
                    <th className="px-6 py-3 text-[12px] font-bold text-[#1d1d1f] w-1/3">Ranking de Closers</th>
                    <th className="px-4 py-3 text-[12px] font-medium text-[#86868b] text-center">Receita</th>
                    <th className="px-4 py-3 text-[12px] font-medium text-[#86868b] text-center">Vendas</th>
                    <th className="px-4 py-3 text-[12px] font-medium text-[#86868b] text-center">Ticket</th>
                    <th className="px-6 py-3 text-[12px] font-medium text-[#86868b] text-center">Win</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f5]">
                  {/* #1 Winner Row */}
                  <tr className="bg-[#b49136] text-white">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Crown size={15} fill="currentColor" strokeWidth={1} className="text-white/90" />
                        <span className="font-bold text-[14px]">Eunice</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold tabular-nums"><span className="text-[10px] font-normal mr-1 opacity-75">R$</span>280.000</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold tabular-nums">5</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold tabular-nums"><span className="text-[10px] font-normal mr-1 opacity-75">R$</span>56.000</td>
                    <td className="px-6 py-3 text-center text-[14px] font-bold tabular-nums">71%</td>
                  </tr>
                  
                  {/* Normal Striped Rows */}
                  <tr className="bg-white">
                    <td className="px-6 py-3 text-[14px] font-bold text-[#1d1d1f] pl-[38px]">Celia</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>133.122</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums">3</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>44.374</td>
                    <td className="px-6 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums">60%</td>
                  </tr>

                  <tr className="bg-[#fbfbfc]">
                    <td className="px-6 py-3 text-[14px] font-bold text-[#1d1d1f] pl-[38px]">Pedro</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>0</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums">0</td>
                    <td className="px-4 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>0</td>
                    <td className="px-6 py-3 text-center text-[14px] font-bold text-[#1d1d1f] tabular-nums">0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
