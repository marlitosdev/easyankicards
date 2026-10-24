/* =====================================================================
 * SEÇÕES JÁ LIDAS DO RESUMO (v19.11.0)
 *
 * O PEDIDO: "uma marcação para lembrar o que já li, principalmente para saber qual seção do resumo ainda não foi lida".
 *
 * O QUE PRECISA SER VERDADE:
 *  1. cada título (# a ######) é uma seção; títulos iguais em lugares diferentes são seções diferentes; o título
 *     que só agrupa (seguido de subtítulos) não se marca — mostra o placar das de baixo;
 *  2. ○ → ✓ ao tocar (com a data); tocar de novo desmarca; o texto da seção mudou depois → ↻; grifar NÃO é mudar;
 *  3. a faixa do topo diz "Seções lidas: L de N" e leva à próxima não lida; tudo lido → "todas lidas";
 *  4. vai no backup.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const TXT = ["# Visão geral", "Texto geral do tópico.", "## Ramo — Imunidades", "### Conceito", "Imunidade é limitação constitucional.",
    "### Exceções", "Taxas não são alcançadas.", "## Ramo — Isenções", "### Conceito", "Isenção é dispensa legal."].join(NL);

  /* ---- o motor ---- */
  {
    const { api } = rodar();
    const S = api.rlsSecoes(TXT);
    ok(S.length === 6 && S.map((x) => x.k).join("|") === "visao geral#1|ramo imunidades#1|conceito#1|excecoes#1|ramo isencoes#1|conceito#2",
      "M1 as seções e as chaves (o 2º 'Conceito' é outra seção): " + S.map((x) => x.k).join("|"));
    const ramo = S[1];
    ok(ramo.vazia && ramo.filhas.join() === "conceito#1,excecoes#1", "M2 o título do ramo só agrupa: as filhas são as de baixo: " + JSON.stringify(ramo.filhas));
    ok(!S[0].vazia && S[0].filhas.length === 3, "M2a o # de cima tem corpo e agrupa as 3 seções de baixo (os ramos, vazios, não contam)");
    ok(api.rlsHash("Texto ==!importante== e ==?dúvida==") === api.rlsHash("Texto importante e dúvida") && api.rlsHash("a  b") === api.rlsHash("a b"),
      "M3 grifar e marcar não muda a impressão do texto");
    ok(api.rlsHash("Taxas não são alcançadas.") !== api.rlsHash("Taxas são alcançadas."), "M3a mudar o texto muda");
    ok(api.rlsEstado(null, "x") === "nao" && api.rlsEstado({ h: "x" }, "x") === "lida" && api.rlsEstado({ h: "y" }, "x") === "mudou", "M4 estados");
    const r = api.rlsResumo(S, { "visao geral#1": { h: S[0].h }, "conceito#1": { h: "outro" } });
    ok(r.total === 4 && r.lidas === 1 && r.mudou === 1 && r.proxima && r.proxima.k === "conceito#1", "M5 placar: 1 de 4, 1 mudou, a próxima é a que mudou: " + JSON.stringify([r.total, r.lidas, r.mudou, r.proxima && r.proxima.k]));
  }

  /* ---- na leitura ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, TXT, { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, true);
    const L = () => api.$("matLeitura");
    const faixa = () => L().querySelectorAll(".rls-faixa")[0];
    const bts = () => L().querySelectorAll(".rls-bt");
    ok(faixa() && /Seções lidas: 0 de 4/.test(faixa().textContent) && /«Visão geral»/.test(faixa().textContent), "L1 a faixa: 0 de 4, próxima = a primeira: " + (faixa() && faixa().textContent));
    ok(bts().length === 6 && bts().filter((b) => /rls-grupo/.test(b.className)).length === 2, "L2 seis títulos: quatro com ○ e dois de grupo (os ramos)");
    const deSecao = () => bts().filter((b) => !/rls-grupo/.test(b.className));
    ok(deSecao().every((b) => b.textContent === "○"), "L2a todas ○");
    deSecao()[0].onclick({ stopPropagation() {} });
    ok(deSecao()[0].textContent === "✓" && /Lida em \d\d\/\d\d\/\d{4}/.test(deSecao()[0].title), "L3 tocar marca ✓ (com a data): " + deSecao()[0].title);
    ok(/Seções lidas: 1 de 4/.test(faixa().textContent) && /«Conceito»/.test(faixa().textContent), "L3a a faixa anda: 1 de 4, próxima 'Conceito'");
    ok(JSON.parse(api.localStorage ? "{}" : "{}") && Object.keys(api.rlsMarcasDe(ch)).length === 1, "L3b guardado por tópico");
    deSecao()[1].onclick({ stopPropagation() {} });
    deSecao()[2].onclick({ stopPropagation() {} });
    const grupoImun = bts().filter((b) => /rls-grupo/.test(b.className))[0];
    ok(grupoImun && grupoImun.textContent === "✓ 2/2", "L4 o ramo com as duas lidas: ✓ 2/2: " + (grupoImun && grupoImun.textContent));
    deSecao()[3].onclick({ stopPropagation() {} });
    ok(/Todas as 4 seções lidas/.test(faixa().textContent) && !L().querySelectorAll(".rls-ir").length, "L5 tudo lido: a faixa diz, sem 'próxima'");
    deSecao()[3].onclick({ stopPropagation() {} });
    ok(deSecao()[3].textContent === "○" && /3 de 4/.test(faixa().textContent), "L6 tocar de novo desmarca");
    /* grifar não é mudar; mudar o texto é */
    /* editar o texto como a pessoa edita: no editor, e voltar a ler */
    const editar = (novo) => { api.$("matTexto").value = novo; api.matTrocarModo("ler"); };
    editar(TXT.replace("Taxas não são alcançadas.", "Taxas não são ==!alcançadas==."));
    ok(deSecao()[2].textContent === "✓", "L7 grifar a seção lida: continua ✓");
    editar(TXT.replace("Taxas não são alcançadas.", "Taxas e contribuições não são alcançadas."));
    ok(deSecao()[2].textContent === "↻" && /mudou depois/.test(deSecao()[2].title) && /1 mudaram/.test(faixa().textContent), "L8 o texto mudou depois de lida: ↻ e a faixa conta");
    deSecao()[2].onclick({ stopPropagation() {} });
    ok(deSecao()[2].textContent === "✓", "L9 tocar no ↻ marca como lida de novo");
    /* grifar o PRÓPRIO TÍTULO não troca a seção (a chave é o título sem as marcas) */
    editar(TXT.replace("Taxas não são alcançadas.", "Taxas e contribuições não são alcançadas.").replace("### Exceções", "### ==!Exceções=="));
    ok(deSecao()[2].textContent === "✓", "L10 grifar o título não faz a seção perder o ✓");
    /* backup */
    ok(api.montarBackup().dados.material.eac_mat_lidas, "B1 vai no backup");
  }

  /* ---- lendo SÓ UM RAMO: as linhas da leitura começam no título do ramo, não no topo do texto ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave("D", "R");
    const ramos = [{ id: "imunidades", nome: "Imunidades" }, { id: "isencoes", nome: "Isenções" }];
    const tx = ["Geral do tópico.", "", "## Ramo — Imunidades", "### Conceito", "Imunidade é limitação.", "", "## Ramo — Isenções", "### Conceito", "Isenção é dispensa legal.", "### Revogação", "Pode ser revogada."].join(NL);
    api.matGravar(ch, tx, { disciplina: "D", topico: "R" });
    api.matAbrirEditor({ disciplina: "D", nome: "R", chave: ch }, "ler", { ramos, ramo: "isencoes" });
    const bts = () => api.$("matLeitura").querySelectorAll(".rls-bt").filter((b) => !/rls-grupo/.test(b.className));
    ok(bts().length === 2, "E1 no ramo Isenções, duas seções: " + bts().length);
    bts()[0].onclick({ stopPropagation() {} });
    ok(Object.keys(api.rlsMarcasDe(ch)).join() === "conceito#2", "E2 marcar o 'Conceito' do ramo Isenções marca o 2º 'Conceito' do texto (não o do ramo Imunidades): " + Object.keys(api.rlsMarcasDe(ch)).join());
    api.matEscopoEscolher("*");
    const todos = api.$("matLeitura").querySelectorAll(".rls-bt").filter((b) => !/rls-grupo/.test(b.className));
    ok(todos.length === 3 && todos.map((b) => b.textContent).join(" ") === "○ ✓ ○", "E3 no texto inteiro, a marca aparece na seção certa: " + todos.map((b) => b.textContent).join(" "));
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["rls_nao_tip", "rls_lida_tip", "rls_mudou_tip", "rls_grupo_tip", "rls_placar", "rls_mudaram", "rls_todas", "rls_proxima", "rls_proxima_tip"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
