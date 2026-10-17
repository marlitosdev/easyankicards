/* DIÁRIO: os registros automáticos de ramo (defeito de uma versão antiga), as sessões iguais agrupadas, a cor do acerto,
 * "dias com estudo: X de Y", o balão do mapa com os tópicos do dia e o "Copiar" com um separador só.
 *
 * O CASO REAL (backup de 12/10/2026): em 07/09 o estudo foi UM registro de 65 min ("o tópico todo", 9 ramos marcados).
 * Uma versão antiga passou as marcas dos ramos por completarDiario como se fossem tópicos e criou 9 registros "retro",
 * cada um com o tempo PREVISTO do ramo (30 ou 23 min): 4h09 que não foram estudadas — o dia aparecia com 5h14. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (cond, msg) => { n++; if (!cond) falhas.push(msg); };
  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const hoje = api.hojeISO();
  const atras = (k) => { const d = new Date(hoje + "T00:00:00"); d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); };
  const filhos = (el) => Array.from((el && el.children) || []);
  const achar = (el, pred, acc) => { acc = acc || []; filhos(el).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };
  const cls = (c, k) => new RegExp("(^| )" + k + "( |$)").test(c.className || "");

  /* ---- C1: a porta fechada — marca de ramo nunca vira registro ---- */
  {
    api.diarioPor([]);
    api.completarDiario([
      { chave: "t›x›#r1", estado: "feito", quando: "2026-09-07", nome: "R1", disciplina: "T", minutos: 30 },
      { chave: "t›y", estado: "feito", quando: "2026-08-01", nome: "Y", disciplina: "T", minutos: 45 },
    ]);
    const d = JSON.parse(api.loja.getItem("eac_edital_diario") || "[]");
    ok(d.length === 1 && d[0].c === "t›y" && d[0].retro === true, "C1 completarDiario: marca antiga de TOPICO vira registro; marca de RAMO nao: " + JSON.stringify(d.map((x) => x.c)));
  }

  /* o diário do caso real (encurtado): o estudo de verdade + 3 retro de ramo + 1 retro de tópico (esse é legítimo) */
  const top = "sistema tributário brasileiro›os princípios constitucionais tributários";
  const real = { d: "2026-09-07", c: top, disc: "Sistema Tributário Brasileiro", n: "Os princípios constitucionais tributários", a: "feito", m: 65, f: ["questoes", "resumo", "leitura"], cc: "ISS" };
  const retro = (id, m) => ({ d: "2026-09-07", c: top + "›#" + id, disc: "Sistema Tributário Brasileiro", n: "Os princípios constitucionais tributários", a: "feito", m, f: null, retro: true });
  const retroTopico = { d: "2026-08-01", c: "x›antigo", disc: "X", n: "Antigo", a: "feito", m: 40, f: null, retro: true };
  const outro = { d: "2026-09-08", c: "x›outro", disc: "X", n: "Outro", a: "feito", m: 20, f: ["leitura"] };
  const base = () => [retroTopico, real, retro("legalidade", 30), retro("anterioridade", 30), retro("nao_confisco", 23), outro].map((x) => Object.assign({}, x));

  /* ---- C2: quais são os automáticos de ramo ---- */
  {
    const l = api.diarioRetroDeRamo(base());
    ok(l.length === 3 && l.map((i) => i.idx).join() === "2,3,4" && l.every((i) => i.x.retro && /›#/.test(i.x.c)), "C2 so' os 'retro' com chave de RAMO (o retro de topico e o estudo real ficam): " + JSON.stringify(l.map((i) => i.idx)));
    ok(api.diarioRetroDeRamo([real, outro]).length === 0 && api.diarioRetroDeRamo(null).length === 0, "C2b diario limpo (ou vazio): nada");
    /* registro FEITO PELA PESSOA com chave de ramo (não "retro") nunca é tomado por automático */
    ok(api.diarioRetroDeRamo([Object.assign({}, real, { c: top + "›#legalidade", m: 25, f: ["leitura"] })]).length === 0, "C2c registro de verdade com chave de ramo (sem 'retro') fica");
  }

  /* ---- C3: a faixa, retirar e desfazer ---- */
  {
    try { api.loja.removeItem("eac_diario_retro_recibo"); } catch (e) {}
    const orig = base();
    api.diarioPor(orig.map((x) => Object.assign({}, x)));
    const progAntes = JSON.stringify(api.edProgressoAtual ? api.edProgressoAtual() : {});
    api.abrirDiario();
    ok(api.$("diarioConserto").hidden === false && /3 registro/.test(api.$("diarioConsertoTxt").textContent) && /1h23/.test(api.$("diarioConsertoTxt").textContent) && /07\/09/.test(api.$("diarioConsertoTxt").textContent)
       && api.$("btnDiarioRetroTirar").hidden === false && api.$("btnDiarioRetroDesfazer").hidden === true,
       "C3 a faixa diz quantos, quanto tempo inventado e o dia: " + api.$("diarioConsertoTxt").textContent);
    api.$("btnDiarioRetroTirar").onclick();
    const d1 = JSON.parse(api.loja.getItem("eac_edital_diario") || "[]");
    ok(d1.length === 3 && d1.map((x) => x.c).join("|") === [retroTopico.c, top, outro.c].join("|") && api.diarioRetroDeRamo(d1).length === 0, "C3b retirar tira SO' os 3 automaticos de ramo (o estudo real, o retro de topico e o resto ficam, na ordem): " + JSON.stringify(d1.map((x) => x.c)));
    ok(JSON.stringify(api.edProgressoAtual ? api.edProgressoAtual() : {}) === progAntes, "C3c as marcas de estudado (progresso) nao mudam");
    ok(api.$("diarioConserto").hidden === false && /Retirado/.test(api.$("diarioConsertoTxt").textContent) && api.$("btnDiarioRetroTirar").hidden === true && api.$("btnDiarioRetroDesfazer").hidden === false, "C3d a faixa diz o que fez e oferece desfazer: " + api.$("diarioConsertoTxt").textContent);
    ok(!!api.loja.getItem("eac_diario_retro_recibo"), "C3e o recibo fica guardado (desfazer sobrevive a fechar o diario)");
    api.$("btnDiarioRetroDesfazer").onclick();
    const d2 = JSON.parse(api.loja.getItem("eac_edital_diario") || "[]");
    ok(JSON.stringify(d2) === JSON.stringify(orig), "C3f desfazer devolve os registros NO MESMO LUGAR (o diario volta a ser o de antes)");
    ok(!api.loja.getItem("eac_diario_retro_recibo") && api.$("btnDiarioRetroTirar").hidden === false, "C3g depois de desfazer, o recibo some e a faixa volta a oferecer retirar");
    /* um registro novo depois de retirar nao atrapalha o desfazer */
    api.$("btnDiarioRetroTirar").onclick();
    const novo = { d: hoje, c: "x›novo", disc: "X", n: "Novo", a: "feito", m: 10 };
    const dd = JSON.parse(api.loja.getItem("eac_edital_diario")); dd.push(novo); api.diarioPor(dd);
    api.$("btnDiarioRetroDesfazer").onclick();
    const d3 = JSON.parse(api.loja.getItem("eac_edital_diario") || "[]");
    ok(JSON.stringify(d3) === JSON.stringify(orig.concat([novo])), "C3h registro feito depois de retirar continua la' (no fim) ao desfazer");
    /* sem automáticos e sem recibo: nada de faixa */
    try { api.loja.removeItem("eac_diario_retro_recibo"); } catch (e) {}
    api.diarioPor([real, outro].map((x) => Object.assign({}, x)));
    api.abrirDiario();
    ok(api.$("diarioConserto").hidden === true, "C3i diario limpo: sem faixa");
    api.$("dlgDiario").close();
  }

  /* ---- C4: sessões iguais do mesmo dia viram um bloco ---- */
  const lo = "direito financeiro›leis orçamentárias";
  const sess = (m, extra) => Object.assign({ d: atras(2), c: lo, disc: "Direito Financeiro", n: "Leis Orçamentárias", a: "revisado", m, cc: "TCE" }, extra || {});
  /* na ordem em que foram feitas: 3 dias atrás uma revisão; 2 dias atrás uma revisão, um estudo NO MEIO, e mais duas revisões */
  const diario4 = [
    sess(20, { d: atras(3), f: ["revisao"] }),
    sess(30, { f: ["revisao"] }),
    sess(15, { a: "feito", f: ["leitura"] }),
    sess(30, { f: ["revisao"] }), sess(30, { f: ["questoes"], q: { feitas: 21, certas: 19 } }),
  ];
  {
    const g = api.diarioAgrupar(api.diarioFiltrar(diario4, { dias: 0 }));
    ok(g.length === 3 && g[0].itens.length === 3 && g[0].a === "revisado" && g[1].a === "feito" && g[2].d === atras(3) && g[2].itens.length === 1, "C4 agrupa o mesmo topico + mesma acao + mesmo dia, mesmo com outra sessao no meio (e nao junta dias diferentes): " + JSON.stringify(g.map((x) => [x.d, x.a, x.itens.length])));
    ok(api.diarioAgrupar([{ x: { d: "1", c: "a", a: "pendente" } }, { x: { d: "1", c: "a", a: "pendente" } }]).length === 2, "C4b 'desmarcou' nunca agrupa");
    api.diarioPor(diario4.map((x) => Object.assign({}, x)));
    api.abrirDiario();
    const bTudo = filhos(api.$("diarioPeriodos")).find((b) => b.textContent === api.t("ed_diario_per_0"));
    bTudo.onclick();
    const itens = () => filhos(api.$("diarioLista")).filter((c) => cls(c, "diario-item"));
    const grupo = () => itens().find((c) => cls(c, "di-grupo"));
    ok(itens().length === 3 && !!grupo() && /1h30/.test(grupo().textContent) && /3 sessões/.test(grupo().textContent) && /19\/21/.test(grupo().textContent), "C4c a lista mostra o bloco (1h30 · 3 sessoes · acerto somado) no lugar de 3 linhas: " + (grupo() && grupo().textContent));
    ok(!/Revisão/.test(grupo().textContent) && /Questões/.test(grupo().textContent), "C4d a forma 'Revisao' nao se repete num registro de revisao: " + grupo().textContent);
    const tg = achar(grupo(), (c) => cls(c, "di-grupo-tg"))[0];
    ok(tg && tg.getAttribute("aria-expanded") === "false" && !achar(grupo(), (c) => /Apagar|apagar/.test(c.textContent || "") && c.tag === "button").length, "C4e o bloco nao tem 'apagar' (fica em cada sessao) e comeca fechado");
    tg.onclick();
    const subs = itens().filter((c) => cls(c, "di-sub"));
    ok(subs.length === 3 && subs.every((s) => achar(s, (c) => c.textContent === api.t("ed_diario_apagar")).length === 1) && achar(grupo(), (c) => cls(c, "di-grupo-tg"))[0].getAttribute("aria-expanded") === "true",
       "C4f 'ver as 3 sessoes' abre as 3, cada uma com o seu 'apagar'");
    /* apagar uma sessão de dentro do bloco */
    achar(subs[0], (c) => c.textContent === api.t("ed_diario_apagar"))[0].onclick();
    ok(/2 sessões/.test(grupo().textContent) && /1h/.test(grupo().textContent), "C4g apagar uma sessao: o bloco passa a 2 sessoes: " + (grupo() && grupo().textContent));
    achar(grupo(), (c) => cls(c, "di-grupo-tg"))[0].onclick();
    ok(itens().filter((c) => cls(c, "di-sub")).length === 0, "C4h 'recolher' fecha");
    api.$("dlgDiario").close();
  }

  /* ---- C5: o "Copiar" ---- */
  {
    const tc = api.diarioTextoCopia(api.diarioFiltrar(diario4, { dias: 0 }), "T");
    ok(/• 1h30 · revisou Leis Orçamentárias \(Direito Financeiro · TCE\) · 3 sessões: 30min \+ 30min \+ 30min · Questões · 19\/21 questões \(90%\)/.test(tc), "C5 copiar: as sessoes iguais numa linha (com as partes da soma — v18.60.0), um separador so', sem 'Revisao' repetida: " + JSON.stringify(tc));
    ok(!/\|/.test(tc) && /• 15min · estudou Leis Orçamentárias \(Direito Financeiro · TCE\) · Leitura/.test(tc), "C5b sem '|' e a sessao sozinha continua a linha dela");
  }

  /* ---- C6: dias do período ---- */
  {
    const E = [{ d: "2026-08-17" }, { d: "?" }, { d: "2026-09-01" }];
    ok(api.diarioDiasDoPeriodo({ dias: 90 }, E, "2026-10-12") === 90 && api.diarioDiasDoPeriodo({ dias: 1 }, E, "2026-10-12") === 1, "C6 'ultimos N dias' = N");
    ok(api.diarioDiasDoPeriodo({ de: "2026-09-01", ate: "2026-09-10" }, E, "2026-10-12") === 10 && api.diarioDiasDoPeriodo({ de: "2026-10-10" }, E, "2026-10-12") === 3, "C6b intervalo a mao: inclusivo; sem 'ate' vai ate hoje");
    ok(api.diarioDiasDoPeriodo({ dias: 0 }, E, "2026-10-12") === 57 && api.diarioDiasDoPeriodo({ dias: 0 }, [], "2026-10-12") === 0, "C6c 'tudo': do primeiro registro ate hoje (data '?' fora); sem registro, 0");
  }

  /* ---- C7: o resumo em números, com a constância e a cor do acerto ---- */
  {
    api.diarioPor(diario4.map((x) => Object.assign({}, x)));
    api.abrirDiario();
    const chips = filhos(api.$("diarioResumo")).filter((c) => cls(c, "di-res-n"));
    const tudo = filhos(api.$("diarioPeriodos")).find((b) => b.textContent === api.t("ed_diario_per_0"));
    tudo.onclick();
    const chips2 = filhos(api.$("diarioResumo")).filter((c) => cls(c, "di-res-n"));
    ok(chips2.length === 5 && /^2h05 estudadas/.test(chips2[0].textContent) && /^2 de 4 dias com estudo$/.test(chips2[1].textContent) && cls(chips2[4], "di-q-bom"),
       "C7 o resumo em numeros: tempo, '2 de 4 dias com estudo', media, topicos e o acerto com cor: " + chips2.map((c) => c.textContent).join(" | "));
    ok(chips.length >= 4, "C7b numeros lado a lado (um por chip)");
    ok(api.diarioQClasse(80) === "di-q-bom" && api.diarioQClasse(79) === "di-q-medio" && api.diarioQClasse(60) === "di-q-medio" && api.diarioQClasse(59) === "di-q-fraco", "C7c faixas da cor do acerto: 80+ verde, 60-79 amarelo, abaixo vermelho");
    /* a cor na linha de um registro sozinho */
    api.diarioPor([{ d: atras(1), c: "a›b", disc: "A", n: "B", a: "feito", m: 30, f: ["questoes"], q: { feitas: 10, certas: 5 } }]);
    api.abrirDiario();
    const li = filhos(api.$("diarioLista")).find((c) => cls(c, "diario-item"));
    const q = achar(li, (c) => cls(c, "di-q"))[0];
    ok(q && cls(q, "di-q-fraco") && /5\/10/.test(q.textContent), "C7d o acerto do registro ganha a cor (50% = vermelho)");
    api.$("dlgDiario").close();
  }

  /* ---- C8: o balão do mapa diz os tópicos do dia ---- */
  {
    api.diarioPor([
      { d: hoje, c: "a›x", disc: "A", n: "Alfa", a: "feito", m: 30 },
      { d: hoje, c: "a›y", disc: "A", n: "Beta", a: "revisado", m: 20 },
      { d: hoje, c: "a›z", disc: "A", n: "Gama", a: "pendente", m: 0 },
    ]);
    api.abrirDiario();
    if (api.$("diarioMapa").hidden) api.$("btnDiarioMapa").onclick();
    const cel = achar(api.$("diarioMapa"), (c) => cls(c, "di-mp-hoje"))[0];
    ok(cel && /2 tópico\(s\): (Alfa, Beta|Beta, Alfa)\./.test(cel.title) && !/Gama/.test(cel.title), "C8 o balao da celula diz os topicos do dia ('desmarcou' fora): " + (cel && cel.title));
    api.$("btnDiarioMapa").onclick();
    api.$("dlgDiario").close();
  }

  /* ---- A1-A4: a agenda — faixa da semana compacta, a frase do que falta na linha do medidor, "também cai em" curto ---- */
  {
    /* o nome curto do outro concurso */
    ok(api.edNomeCurtoConcurso("SEFAZ Alagoas - Auditor Fiscal 2026") === "SEFAZ Alagoas" && api.edNomeCurtoConcurso("TCE-PE Auditor de Controle Externo - Contas Públicas") === "TCE-PE Auditor"
       && api.edNomeCurtoConcurso("ISS Caruaru Auditor Fiscal") === "ISS Caruaru" && api.edNomeCurtoConcurso("SEFAZ") === "SEFAZ" && api.edNomeCurtoConcurso("") === "" && api.edNomeCurtoConcurso("PGE – Procurador do Estado") === "PGE",
       "A1 nome curto do concurso: antes do ' - ', ate' duas palavras");
    /* a célula do dia: a barrinha do previsto */
    const S = { dias: [
      { cod: "seg", iso: "2026-10-12", estudo: true, previstoMin: 60, feitoMin: 30, estado: "hoje" },
      { cod: "ter", iso: "2026-10-13", estudo: true, previstoMin: 60, feitoMin: 90, estado: "futuro" },
      { cod: "sáb", iso: "2026-10-17", estudo: false, previstoMin: 0, feitoMin: 0, estado: "futuro" } ] };
    const cx = api.edSemanaCelulas(S, null);
    const cel = filhos(cx);
    const fill = (c) => achar(c, (e) => cls(e, "di-sem-barra-fill"))[0];
    ok(cel[0].children[0].textContent === "seg" && /30min/.test(cel[0].children[1].textContent) && fill(cel[0]) && fill(cel[0]).style.width === "50%", "A2 a celula guarda dia/feito/previsto e ganha a barrinha do previsto (50%)");
    ok(fill(cel[1]).style.width === "100%" && !fill(cel[2]), "A2b passou do previsto: a barrinha para em 100%; dia de folga sem previsto: sem barrinha");
    const css = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/@media \(min-width:700px\)\{\s*\.di-sem-cels\{[^}]*\}\s*\.di-sem-dia\{flex-direction:row/.test(css), "A2c em tela larga cada dia fica numa linha so' (no celular continua em coluna)");
    /* a frase curta do que falta */
    const SC = { metaMin: 1200, faltaMin: 1200, diasRestantes: 7, porDiaNecessario: 172, restantes: [] };
    ok(api.edSemanaDicaCurta(SC) === api.t("ed_sem_dica_curta", { h: api.horasTexto(172), n: 7 }) && api.edSemanaDicaCurta(SC).length < api.edSemanaDicaTexto(Object.assign({}, SC, { restantes: [{ cod: "seg" }, { cod: "ter" }] })).length + 40,
       "A3 a frase curta: '2h52/dia nos 7 dia(s) que restam': " + api.edSemanaDicaCurta(SC));
    ok(api.edSemanaDicaCurta({ metaMin: 600, faltaMin: 0, diasRestantes: 3 }) === api.t("ed_sem_batida") && api.edSemanaDicaCurta({ metaMin: 0 }) === "", "A3b meta batida usa a frase dela; sem meta, nada");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
