/* =====================================================================
 * AS DECISÕES ANTIGAS SEM LEI (19.170.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  A1. uma sessão de colagem (decisões a menos de 1 minuto) vai para a lei cujo texto tem os trechos que saíram,
 *      com 2+ acertos, o triplo da segunda e gravada entre 10 min antes e 3 dias depois;
 *  A2. com 1 acerto só, sem acerto nenhum, ou com a lei gravada muito antes, fica como está;
 *  A3. a decisão recente (ainda na janela do batismo normal) não é tocada;
 *  A4. roda uma vez por sessão do app; e o mapa da lei passa a mostrar o que saiu.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const { api } = rodar();
  api.matIniciar(); api.leiIniciar();
  const ALFA = ["Art. 1º Para o ano-calendário de dois mil e trinta e dois, a alíquota de referência será reduzida.",
    "", "Art. 2º O contribuinte que optar pelo regime regular apura o imposto pelo valor de cada operação.",
    "", "Art. 3º A restituição do imposto pago na aquisição de bens de uso pessoal segue o regulamento."].join(NL);
  const BETA = ["Art. 1º Constitui crime contra a ordem econômica abusar do poder econômico de forma reiterada.",
    "", "Art. 2º Extingue-se a punibilidade quando o agente promover o pagamento antes da denúncia."].join(NL);
  const la = api.leiGuardar({ id: "lei_alfa", nome: "Lei Alfa", texto: ALFA });
  const lb = api.leiGuardar({ id: "lei_beta", nome: "Lei Beta", texto: BETA });
  { const T = api.leisLerTudo(); T[la.id].criado = "2026-09-27T22:51:08.944Z"; T[lb.id].criado = "2026-01-01T10:00:00.000Z"; api.leisGravarTudo(T); }
  ok(api.leiDe(la.id).criado === "2026-09-27T22:51:08.944Z", "A0 (preparo) a data de criação da lei de teste");

  const linha = (txt) => ({ linha: 10, texto: txt });
  const dec = (q, regra, txts) => {
    api.decRegistrar({ area: "colagem", regra, origem: "app", lei: "(lei nova)", ref: "linha 10", decisao: "aceitou", via: "padrao",
      proposta: { acao: "remover", amostra: txts[0].replace(/~~/g, ""), n: 1, linhas: txts.map(linha) } });
    const ds = api.decLer(); ds[ds.length - 1].q = q; return ds[ds.length - 1];
  };
  /* sessão 1: três trechos da Alfa e um da Beta — vai para a Alfa (3 ≥ 3 × 1) */
  const s1 = [
    dec("2026-09-27T20:43:06.000Z", "colagem.tachado", ["~~Para o ano-calendário de dois mil e trinta e dois, a alíquota~~"]),
    dec("2026-09-27T20:43:10.000Z", "colagem.tachado", ["~~O contribuinte que optar pelo regime regular apura o imposto~~"]),
    dec("2026-09-27T20:43:24.000Z", "colagem.anexo", ["A restituição do imposto pago na aquisição de bens de uso pessoal"]),
    dec("2026-09-27T20:43:30.000Z", "colagem.tachado", ["~~abusar do poder econômico de forma reiterada~~ texto antigo"]),
  ];
  /* sessão 2, 7 minutos depois: um acerto só — fica */
  const s2 = dec("2026-09-27T20:50:58.000Z", "repetidos.intra", ["O contribuinte que optar pelo regime regular apura o imposto"]);
  /* sessão 3: as penas de uma lei que nunca foi gravada — fica */
  const s3 = [dec("2026-10-21T16:11:08.000Z", "colagem.cabecalho", ["Pena - detenção, de um a três anos, e multa de cem."]),
    dec("2026-10-21T16:11:08.500Z", "colagem.cabecalho", ["Pena - reclusão, de um a quatro anos, e multa de mil."])];
  /* sessão 4: bate com a Beta, mas a Beta foi gravada meses antes da colagem — fica */
  const s4 = [dec("2026-10-21T16:08:06.000Z", "colagem.tachado", ["~~Constitui crime contra a ordem econômica abusar do poder~~"]),
    dec("2026-10-21T16:08:06.100Z", "colagem.tachado", ["~~Extingue-se a punibilidade quando o agente promover o pagamento~~"])];
  /* recente: ainda na janela do batismo normal */
  const rec = dec(new Date().toISOString(), "colagem.tachado", ["~~Para o ano-calendário de dois mil e trinta e dois, a alíquota~~"]);

  const r = api.leiDecLigarAntigas(true);
  const lei = (d) => api.decLer().filter((x) => x.id === d.id)[0].lei;
  ok(r.ligadas === 4 && s1.every((d) => lei(d) === "Lei Alfa"), "A1 a sessão vai inteira para a lei dos trechos (inclusive a decisão que batia com a outra): " + JSON.stringify(r));
  ok(lei(s2) === "(lei nova)", "A2a um acerto só não basta");
  ok(s3.every((d) => lei(d) === "(lei nova)"), "A2b sem acerto nenhum, fica sem lei");
  ok(s4.every((d) => lei(d) === "(lei nova)"), "A2c a lei gravada muito antes da colagem não recebe");
  ok(lei(rec) === "(lei nova)", "A3 a decisão recente fica para o batismo normal");
  ok(r.sessoes.length === 4 && r.sessoes.filter((x) => x.lei).length === 1, "A1b o relatório diz cada sessão: " + JSON.stringify(r.sessoes));
  ok(api.leiDecLigarAntigas().ligadas === 0, "A4a uma vez por sessão do app");
  ok(api.leiDecLigarAntigas(true).ligadas === 0, "A4b rodar de novo não muda nada");
  api.leiAbrir("Direito", "Testes", la.id);
  api.leiMapaAbrir();
  const dd = api.$("leiMapaDec");
  ok(dd && /ver o que saiu \(3\)/.test(dd.textContent), "A4c o mapa da lei mostra o que saiu (as 3 aceitas com texto): " + (dd && dd.textContent.slice(0, 200)));
  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
