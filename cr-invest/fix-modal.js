const fs = require('fs');
let lines = fs.readFileSync('src/app/dashboard/vendas/page.tsx', 'utf8').split(/\r?\n/);
let before = lines.slice(0, 790);
let after = lines.slice(888);
let middle = `                 <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorFixo" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#111827" stopOpacity={0.1}/><stop offset="95%" stopColor="#111827" stopOpacity={0}/></linearGradient>
                     <linearGradient id="colorVar" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.3}/><stop offset="95%" stopColor="#d97706" stopOpacity={0}/></linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(value) => \`R$ \${value / 1000}k\`} />
                   <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => [fmtBRL(value)]} />
                   <Area type="monotone" dataKey="Fixo" stroke="#111827" strokeWidth={3} fillOpacity={1} fill="url(#colorFixo)" />
                   <Area type="monotone" dataKey="Variável" stroke="#d97706" strokeWidth={3} fillOpacity={1} fill="url(#colorVar)" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-[#F8F9FA] rounded-3xl w-full max-w-[800px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-end p-4 pb-0">
               <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={20} /></button>
            </div>
            <div className="px-10 pb-4">
               <h2 className="text-[24px] font-bold text-[#111827] tracking-tight">Registrar Venda Oficial</h2>
               <p className="text-[13px] text-gray-500 mt-1">Insira os dados do contrato faturado para processamento de comissões.</p>
            </div>

            {/* Modal Body */}
            <div className="px-10 pb-10 overflow-y-auto">
               <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-5">
                  
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] font-bold text-gray-500">Cliente (Nome completo)</label>
                     <input type="text" value={fClientName} onChange={e=>setFClientName(e.target.value)} placeholder="Ex: João Silva Mendes" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                  </div>

                  {/* Localização */}
                  <div className="grid grid-cols-2 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Cidade</label>
                        <input type="text" value={fCity} onChange={e=>setFCity(e.target.value)} placeholder="Ex: São Paulo" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Estado (UF)</label>
                        <select value={fEstado} onChange={e=>setFEstado(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none cursor-pointer">
                           <option>Selecione</option>
                           {UF_LIST.map(uf => <option key={uf}>{uf}</option>)}
                        </select>
                     </div>
                  </div>

                  {/* Perfil */}
                  <div className="grid grid-cols-2 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Gênero</label>
                        <select value={fGender} onChange={e=>setFGender(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none cursor-pointer">
                           <option>Selecione</option>
                           <option>Masculino</option>
                           <option>Feminino</option>
                           <option>Outro</option>
                        </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Estado Civil</label>
                        <select value={fCivil} onChange={e=>setFCivil(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none cursor-pointer">
                           <option>Selecione</option>
                           <option>Solteiro(a)</option>
                           <option>Casado(a)</option>
                           <option>Divorciado(a)</option>
                           <option>Viúvo(a)</option>
                        </select>
                     </div>
                  </div>

                  {/* Tipo de produto */}
                  <div className="flex flex-col gap-2">
                     <label className="text-[11px] font-bold text-gray-500">Tipo de produto</label>
                     <div className="flex gap-3">
                        {(['Imóvel', 'Automóvel'] as const).map(tipo => (
                           <button
                              key={tipo}
                              type="button"
                              onClick={() => { setFTipoProduto(tipo); setFFinalidade("Selecione"); }}
                              className={\`flex-1 py-3 rounded-xl text-[13px] font-semibold border transition-all \${fTipoProduto === tipo ? "bg-[#1d1d1f] text-white border-[#1d1d1f]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}\`}
                           >
                              {tipo === "Imóvel" ? "🏠 Imóvel" : "🚗 Automóvel"}
                           </button>
                        ))}
                     </div>
                  </div>`.split(/\r?\n/);
fs.writeFileSync('src/app/dashboard/vendas/page.tsx', [...before, ...middle, ...after].join('\n'), 'utf8');
