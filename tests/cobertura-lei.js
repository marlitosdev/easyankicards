/* =====================================================================
 * COBERTURA DE UMA LEI POR CARTÕES, ARTIGO A ARTIGO (v18.73.0, K1+K2)
 *
 * "Quais artigos do CTN ainda não têm nenhum cartão — e quais caem em
 * questão e têm pouco?" O QUE PRECISA SER VERDADE:
 *  1. um cartão cobre o artigo pela ETIQUETA do "virar cartões"
 *     ("5172-art4") ou pela CITAÇÃO no texto (frente, verso, saiba mais):
 *     com o nome da lei ("art. 3º do CTN"), lista ("arts. 3º e 5º"),
 *     vínculo fixado à mão, ou sem nome quando o tópico tem UMA lei;
 *     citação de OUTRA lei não conta; o mesmo cartão não conta duas vezes;
 *  2. revogados ficam de fora; o peso é 1 + questões + 2 × prova; faixa
 *     vazio / pouco / ok; as divisões somam os artigos dos filhos;
 *  3. a tela: modo "por lei", manchete, divisões que abrem, os cartões de
 *     cada artigo, "criar cartões" abre o "virar cartões" já no artigo;
 *     lei sem tópico avisa; o leitor da lei tem o botão "🃏 cobertura".
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const CTN = ["LEI Nº 5.172, DE 25 DE OUTUBRO DE 1966 - Código Tributário Nacional",
    "TÍTULO I", "Disposição Geral", "Art. 1º Esta Lei regula o sistema tributário.", "Art. 2º O sistema é regido pela Constituição.",
    "CAPÍTULO II", "Tributos", "Art. 3º Tributo é toda prestação pecuniária compulsória.", "Art. 4º A natureza jurídica é determinada pelo fato gerador.",
    "Art. 5º Os tributos são impostos, taxas e contribuições de melhoria.", "Art. 6º (Revogado).", "Art. 7º A competência é indelegável."].join("\n");
  const montar = () => {
    const { api: a } = rodar();
    a.matIniciar(); a.leiIniciar(); a.edIniciar();
    const ch = a.matChave("Direito Tributário", "Tributo");
    const l = a.leiGuardar({ nome: "Lei 5.172/1966 - Código Tributário Nacional", especie: "Lei", numero: "5172", ano: "1966", texto: CTN, topicos: [ch] });
    const cf = a.leiGuardar({ nome: "Constituição Federal", especie: "Constituição", numero: "", ano: "1988", texto: "Art. 1º A República.\nArt. 3º Objetivos.", topicos: [] });
    a.matGravarCartoes(ch, [
      "O que é tributo? :: Prestação pecuniária compulsória (art. 3º do CTN) :: x", "",
      "A natureza do tributo? :: O fato gerador :: 5172-art4", "",
      "Quais as espécies? :: Impostos, taxas e contribuições (arts. 3º e 5º do CTN) :: x", "",
      "Objetivos da República? :: Construir sociedade livre (art. 3º da CF) :: x", "",
      "Sem citação? :: Só texto :: x", "",
      "A competência pode ser delegada? :: Não :: x", "+ Literalidade — art. 7º: a competência é indelegável."].join("\n"),
      { disciplina: "Direito Tributário", topico: "Tributo" });
    return { a, l: a.leiDe(l.id), cf: a.leiDe(cf.id), ch };
  };

  /* ---- 1 e 2: o motor ---- */
  {
    const { a, l, cf } = montar();
    const notas = a.cqLerBiblioteca();
    const m = a.covLeiMapa(l, notas, { ranking: [{ num: "1", questoes: 3, prova: 1 }, { num: "3", questoes: 1, prova: 0 }] });
    const n = (num) => m.artigos.find((x) => x.num === num);
    ok(n("3").cartoes === 2 && n("4").cartoes === 1 && n("5").cartoes === 1, "M1 citação com nome da lei (art. 3º do CTN), etiqueta (5172-art4) e lista (arts. 3º e 5º): " + m.artigos.map((x) => x.num + ":" + x.cartoes).join(" "));
    ok(n("7").cartoes === 1, "M1a citação SEM nome da lei, no 'saiba mais', conta porque o tópico tem uma lei só");
    ok(!n("6") && m.resumo.revogados === 1, "M2 o art. 6º revogado fica de fora");
    ok(n("1").peso === 6 && n("1").faixa === "vazio" && n("3").peso === 2 && n("3").faixa === "ok", "M3 peso = 1 + questões + 2×prova; faixas");
    ok(m.resumo.artigos === 6 && m.resumo.semCartao === 2 && Math.round(m.resumo.pctSem) === 33 && m.resumo.cartoes === 4, "M4 resumo: 2 de 6 sem cartão, 4 cartões cobrem: " + JSON.stringify(m.resumo));
    ok(m.resumo.prioridade.length === 1 && m.resumo.prioridade[0].num === "1", "M5 prioridade: o que cai e não tem cartão (art. 1º)");
    const t1 = m.divisoes.find((d) => /TÍTULO I/.test(d.rotulo));
    ok(t1 && t1.total === 6 && t1.filhos.length === 1 && t1.filhos[0].total === 4 && t1.semCartao === 2, "M6 a divisão soma os artigos dela e dos filhos: " + JSON.stringify(m.divisoes.map((d) => [d.rotulo, d.total, d.filhos.map((f) => f.total)])));
    /* a CF: só o cartão que cita a CF */
    const mc = a.covLeiMapa(cf, notas);
    ok(mc.artigos.find((x) => x.num === "3").cartoes === 1, "M7 'art. 3º da CF' cobre a CF, não o CTN (e vice-versa)");
    /* o mesmo cartão citando duas vezes o mesmo artigo conta uma vez */
    const um = { chave: "x", card: { front: "art. 3º do CTN e de novo art. 3º do CTN", back: "", tags: ["5172-art3"] } };
    ok(a.covLeiArtigosDoCartao(um, l, a.leisLista()).size === 1, "M8 o mesmo cartão não conta duas vezes no mesmo artigo");
    ok(a.covLeiFaixa(0, 1) === "vazio" && a.covLeiFaixa(1, 5) === "pouco" && a.covLeiFaixa(3, 5) === "ok", "M9 faixas");
  }

  /* ---- o que cai: a questão conta para a lei que ela CITA (o ranking do leitor contava qualquer "art. 3º") ---- */
  {
    const { a, l, cf, ch } = montar();
    a.qsTodas().push(
      { tipo: "ce", enunciado: "Segundo o art. 3º do CTN, tributo é prestação pecuniária.", gabarito: "C", comentario: "", disciplina: "Direito Tributário", topico: "Tributo", chave: ch },
      { tipo: "ce", enunciado: "O art. 3º da CF traz os objetivos da República.", gabarito: "C", comentario: "", disciplina: "Direito Tributário", topico: "Tributo", chave: ch },
      { tipo: "ce", enunciado: "Pelo art. 7º, a competência é indelegável.", gabarito: "C", comentario: "", disciplina: "Direito Tributário", topico: "Tributo", chave: ch },
    );
    const rk = (lei) => Object.fromEntries(a.covLeiRanking(lei, a.leisLista()).map((r) => [r.num, r.questoes]));
    const rCtn = rk(l), rCf = rk(cf);
    ok(rCtn["3"] === 1 && rCf["3"] === 1, "Q1 'art. 3º do CTN' conta para o CTN e 'art. 3º da CF' para a CF — um para cada: " + JSON.stringify([rCtn, rCf]));
    ok(rCtn["7"] === 1 && !rCf["7"], "Q2 sem nome da lei, vale a lei do tópico da questão (o CTN)");
    const rp = a.covLeiRanking(l, a.leisLista(), [{ num: "1", questoes: 9, prova: 2 }, { num: "3", questoes: 9, prova: 0 }]);
    const p1 = rp.find((r) => r.num === "1"), p3 = rp.find((r) => r.num === "3");
    ok(p1 && p1.prova === 2 && p1.questoes === 0 && p3.prova === 0 && p3.questoes === 1, "Q2a do leitor vem só o caiu na prova (as questões são as que citam ESTA lei): " + JSON.stringify(rp));
    const m = a.covLeiMapa(l, a.cqLerBiblioteca());
    ok(m.artigos.find((x) => x.num === "3").questoes === 1 && m.artigos.find((x) => x.num === "3").peso === 2, "Q3 o mapa usa o que cai DESTA lei");
    const dup = a.leiDe(a.leiGuardar({ nome: "Constituição Dup", especie: "Constituição", numero: "", ano: "1988",
      texto: "Art. 1º A República.\nArt. 3º Objetivos.\nATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS\nArt. 3º Revisão.", topicos: [] }).id);
    const md = a.covLeiMapa(dup, [], { ranking: [{ num: "3", questoes: 2, prova: 0 }] });
    ok(md.artigos.filter((x) => x.num === "3").length === 2 && md.resumo.prioridade.filter((x) => x.num === "3").length === 1,
       "Q4 número repetido (corpo × ADCT) entra uma vez só em \"por onde começar\": " + JSON.stringify(md.resumo.prioridade.map((x) => x.num)));
  }

  /* ---- 3: a tela ---- */
  {
    const { a, l } = montar();
    a.covAbrirLei(l.id);
    ok(a.$("dlgCobertura").open === true && a.$("btnCovModoLei").getAttribute("aria-selected") === "true" && a.$("covLei").hidden === false && a.$("covLei").value === l.id,
       "T1 abre no modo 'por lei', com a lei escolhida");
    ok(/2 de 6 artigos sem nenhum cartão/.test(a.$("covCorpo").textContent), "T2 a manchete: " + a.$("covCorpo").textContent.slice(0, 120));
    const divs = achar(a.$("covCorpo"), (e) => cls(e, "cov-lei-div"));
    ok(divs.length >= 1, "T3 uma caixa por divisão");
    const cab = achar(divs[0], (e) => cls(e, "cov-disc-cab"))[0];
    cab.onclick();
    const arts = () => achar(a.$("covCorpo"), (e) => cls(e, "cov-art"));
    ok(arts().some((e) => e.id === "covArt_1") && !arts().some((e) => e.id === "covArt_3"), "T4 abrir o Título mostra os artigos dele; o Capítulo dentro dele fica fechado");
    const sub = achar(a.$("covCorpo"), (e) => cls(e, "cov-lei-sub"))[0];
    achar(sub, (e) => cls(e, "cov-disc-cab"))[0].onclick();
    ok(arts().some((e) => e.id === "covArt_3"), "T4a abrir o Capítulo mostra os artigos dele");
    const a3 = arts().find((e) => e.id === "covArt_3");
    const nb = achar(a3, (e) => cls(e, "cov-art-n"))[0];
    ok(/🃏 2/.test(nb.textContent), "T5 o artigo diz quantos cartões o cobrem");
    nb.onclick();
    ok(/O que é tributo\?/.test(a.$("covCorpo").textContent), "T6 tocar no número mostra os cartões que cobrem o artigo");
    /* criar cartões do art. 2º: abre a lei no artigo e o "virar cartões" */
    a.covLeiCriar(l.id, "2");
    ok(a.$("dlgLeiCloze").open === true && /Art\. 2º/.test(a.$("leiClozeTitulo").textContent) && /5172-art2/.test(a.$("leiClozePrompt").value) && a.$("dlgCobertura").open !== true,
       "T7 'criar cartões' abre o 'virar cartões' já no artigo, com a etiqueta dele: " + a.$("leiClozeTitulo").textContent);
    a.$("dlgLeiCloze").close();
    /* voltar ao modo edital */
    a.covAbrirLei(l.id);
    a.$("btnCovModoEdital").onclick();
    ok(a.$("covLei").hidden === true && a.$("btnCovModoEdital").getAttribute("aria-selected") === "true", "T8 'por edital' volta à cobertura de sempre");
  }

  /* lei sem tópico: avisa em vez de falhar */
  {
    const { a, cf } = montar();
    a.covAbrirLei(cf.id);
    ok(/não está ligada a nenhum tópico/.test(a.$("covCorpo").textContent), "S1 a lei sem tópico diz que precisa de um tópico para receber cartões");
    let alerta = "";
    const orig = a.uiAlert;
    void orig;
    const r = a.covLeiCriar(cf.id, "1");
    for (let i = 0; i < 3; i++) await Promise.resolve();
    alerta = a.$("uiModalMsg").textContent;
    try { a._uiFechar(true); } catch (e) {}
    ok(r === false && /não está ligada a nenhum tópico/.test(alerta), "S2 'criar cartões' numa lei sem tópico explica o porquê");
  }

  /* o leitor da lei abre a cobertura dela */
  {
    const { a, l } = montar();
    a.leiAbrir("Direito Tributário", "Tributo", l.id);
    a.leiIrAbrir();
    a.$("btnLeiCobertura").onclick();
    ok(a.$("dlgCobertura").open === true && a.$("dlgLeiIr").open !== true && a.$("covLei").value === l.id && a.$("btnCovModoLei").getAttribute("aria-selected") === "true", "L1 o '🃏 cobertura' do mapa da lei ('ir para…') abre a cobertura desta lei");
  }

  /* textos */
  {
    const { api } = rodar();
    ["cov_modo_edital", "cov_modo_lei", "cov_lei_sub", "cov_lei_nenhuma", "cov_lei_sem_artigos", "cov_lei_manchete", "cov_lei_manchete2", "cov_lei_sem_topico", "cov_lei_f_vazio", "cov_lei_f_pouco", "cov_lei_f_ok",
      "cov_lei_prioridade", "cov_lei_div_n", "cov_lei_cai", "cov_lei_n", "cov_lei_criar", "cov_lei_abrir", "lei_cov_btn", "lei_cov_tip"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "I1 falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
