// 3.1 Função calcularTier
async function calcularTier(dbHelper, totalVendido) {
    const rows = await dbHelper.query("SELECT chave, valor FROM Configuracoes");
    const config = {};
    rows.forEach(r => { config[r.chave] = parseFloat(r.valor); });

    if (totalVendido > config.TIER_PRATA_MAX) {
        return {
            tier: "Ouro",
            percentualCloser: config.PERCENTUAL_CLOSER_OURO,
            percentualSDR: config.PERCENTUAL_SDR_OURO
        };
    } else if (totalVendido > config.TIER_BRONZE_MAX) {
        return {
            tier: "Prata",
            percentualCloser: config.PERCENTUAL_CLOSER_PRATA,
            percentualSDR: config.PERCENTUAL_SDR_PRATA
        };
    } else {
        return {
            tier: "Bronze",
            percentualCloser: config.PERCENTUAL_CLOSER_BRONZE,
            percentualSDR: config.PERCENTUAL_SDR_BRONZE
        };
    }
}

// 3.2 Função calcularParcelas
function calcularParcelas(valorTotalComissao) {
    const numParcelas = 12;
    const valorPorParcela = valorTotalComissao / numParcelas;
    const parcelas = Array(numParcelas).fill(valorPorParcela);
    return parcelas;
}

// 3.3 Função gerarPeriodoComissao
function gerarPeriodoComissao(data) {
    const d = new Date(data);
    d.setDate(14); // Parcelas sempre baseadas no dia 14 para projeção (vencimento do cliente)
    
    // O mês de referência da comissão é o mês em que a parcela vence
    const mesReferencia = d.toISOString().substring(0, 7); // "YYYY-MM"

    return {
        mesReferencia: mesReferencia,
        data: d.toISOString().split('T')[0]
    };
}

module.exports = { calcularTier, calcularParcelas, gerarPeriodoComissao };
