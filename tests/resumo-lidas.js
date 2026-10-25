/* =====================================================================
 * SEÇÕES JÁ LIDAS DO RESUMO (v19.11.0)
 *
 * O PEDIDO: "uma marcação para lembrar o que já li, principalmente para saber qual seção do resumo ainda não foi lida".
 *
 * O QUE PRECISA SER VERDADE:
 *  1. cada título (# a ######) é uma seção; títulos iguais em lugares diferentes são seções diferentes; o título
 *     que só agrupa (seguido de subtítulos) não se marca — mostra o placar das de baixo;
 *  2. (v19.14.0) no FIM de cada seção, um botão com rótulo: "✓ Terminei de ler esta seção" → "✓ Lida em DD/MM · desmarcar";
 *     o texto mudou depois → aviso e "marcar como lida de novo"; grifar NÃO é mudar; o título só ganha marca quando há
 *     estado ("✓ lida" / "↻ mudou"), nunca um "○" mudo;
 *  3. no topo, o sumário de leitura (recolhido) só com DUAS ou mais seções na tela: "L de N seções lidas", a lista e a
 *     próxima não lida; com uma seção só, nada no topo (a "próxima" seria ela mesma);
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
    const fins = () => L().querySelectorAll(".rls-fim");
    const tags = () => L().querySelectorAll(".rls-tag");
    const sum = () => L().querySelectorAll(".rls-sumario")[0];
    const toque = (n) => fins()[n].querySelectorAll("button")[0].onclick({ stopPropagation() {} });
    ok(fins().length === 4 && fins().every((f) => /Terminei de ler esta seção/.test(f.textContent)), "L1 no fim de cada uma das 4 seções, o botão com rótulo: " + fins().map((f) => f.textContent).join(" | "));
    ok(!L().querySelectorAll(".rls-bt").length && tags().length === 0, "L1a nenhum '○' mudo no título; sem estado, o título fica limpo");
    const b0 = fins()[0].querySelectorAll("button")[0];
    ok(/já leu esta seção/.test(b0.title) && /falta ler/.test(b0.title), "L1b o botão explica para que serve: " + b0.title);
    /* o botão fica onde a seção ACABA: logo antes do título seguinte */
    const prox0 = fins()[0].nextSibling;
    ok(prox0 && /^H/i.test(prox0.tagName || "") && /Imunidades/.test(prox0.textContent), "L1c o botão da 1ª seção fica logo antes do título seguinte: " + (prox0 && prox0.textContent));
    ok(L().children[0] === sum(), "L1g o sumário fica no TOPO da leitura");
    ok(sum() && /0 de 4 seções lidas/.test(sum().textContent) && sum().open !== true, "L1d no topo, o sumário (recolhido): 0 de 4: " + (sum() && sum().textContent.slice(0, 80)));
    ok(/próxima não lida: Visão geral/.test(sum().textContent) && sum().querySelectorAll(".rls-sum-item").length === 4, "L1e o sumário lista as 4 seções e leva à próxima não lida");
    ok(/Terminei de ler esta seção/.test(sum().querySelectorAll(".rls-sum-exp")[0].textContent), "L1f o sumário diz como marcar");
    toque(0);
    ok(/✓ Lida em \d\d\/\d\d\/\d{4}/.test(fins()[0].textContent) && /desmarcar/.test(fins()[0].textContent), "L3 marcar: o fim da seção diz 'Lida em …' e 'desmarcar': " + fins()[0].textContent);
    ok(tags().length === 1 && tags()[0].textContent === "✓ lida", "L3a o título da seção lida ganha '✓ lida' (só ele)");
    ok(/1 de 4 seções lidas/.test(sum().textContent) && /próxima não lida: Conceito/.test(sum().textContent), "L3b o sumário anda: 1 de 4, próxima 'Conceito'");
    ok(Object.keys(api.rlsMarcasDe(ch)).length === 1, "L3c guardado por tópico");
    toque(1);
    toque(2);
    const grupo = tags().filter((x) => /de 2 lidas/.test(x.textContent))[0];
    ok(grupo && grupo.textContent === "2 de 2 lidas" && /lida/.test(grupo.className), "L4 o ramo com as duas lidas: '2 de 2 lidas': " + tags().map((x) => x.textContent).join(" | "));
    toque(3);
    ok(/Leitura completa: as 4 seções lidas/.test(sum().textContent) && !L().querySelectorAll(".rls-ir").length && /completa/.test(sum().className), "L5 tudo lido: o sumário diz, sem 'próxima'");
    fins()[3].querySelectorAll("button")[0].onclick({ stopPropagation() {} });
    ok(/Terminei de ler/.test(fins()[3].textContent) && /3 de 4/.test(sum().textContent), "L6 'desmarcar' volta a 'não lida'");
    /* grifar não é mudar; mudar o texto é — editar como a pessoa edita: no editor, e voltar a ler */
    const editar = (novo) => { api.$("matTexto").value = novo; api.matTrocarModo("ler"); };
    editar(TXT.replace("Taxas não são alcançadas.", "Taxas não são ==!alcançadas==."));
    ok(/✓ Lida em/.test(fins()[2].textContent), "L7 grifar a seção lida: continua lida");
    editar(TXT.replace("Taxas não são alcançadas.", "Taxas e contribuições não são alcançadas."));
    ok(/mudou depois que você a leu/.test(fins()[2].textContent) && /marcar como lida de novo/.test(fins()[2].textContent) && /1 mudaram/.test(sum().textContent),
      "L8 o texto mudou depois de lida: o fim avisa e oferece reler; o sumário conta: " + fins()[2].textContent);
    ok(tags().some((x) => x.textContent === "↻ mudou"), "L8a o título diz '↻ mudou'");
    toque(2);
    ok(/✓ Lida em/.test(fins()[2].textContent), "L9 'marcar como lida de novo'");
    /* grifar o PRÓPRIO TÍTULO não troca a seção (a chave é o título sem as marcas) */
    editar(TXT.replace("Taxas não são alcançadas.", "Taxas e contribuições não são alcançadas.").replace("### Exceções", "### ==!Exceções=="));
    ok(/✓ Lida em/.test(fins()[2].textContent), "L10 grifar o título não faz a seção perder a marca");
    /* repintar não duplica */
    api.matTrocarModo("ler");
    ok(fins().length === 4 && L().querySelectorAll(".rls-sumario").length === 1, "L11 repintar não duplica os botões nem o sumário");
    /* ir até uma seção (pelo sumário) não quebra */
    let erro = null;
    try { sum().querySelectorAll(".rls-sum-item")[1].onclick({ stopPropagation() {} }); } catch (e) { erro = e; }
    ok(!erro, "L12 tocar numa seção do sumário leva até ela sem erro: " + erro);
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
    const fins = () => api.$("matLeitura").querySelectorAll(".rls-fim");
    ok(fins().length === 2 && api.$("matLeitura").querySelectorAll(".rls-sumario").length === 1, "E1 no ramo Isenções, duas seções (e o sumário): " + fins().length);
    fins()[0].querySelectorAll("button")[0].onclick({ stopPropagation() {} });
    ok(Object.keys(api.rlsMarcasDe(ch)).join() === "conceito#2", "E2 marcar o 'Conceito' do ramo Isenções marca o 2º 'Conceito' do texto (não o do ramo Imunidades): " + Object.keys(api.rlsMarcasDe(ch)).join());
    api.matEscopoEscolher("*");
    const est = fins().map((f) => (/Lida em/.test(f.textContent) ? "✓" : "○")).join(" ");
    ok(fins().length === 3 && est === "○ ✓ ○", "E3 no texto inteiro, a marca aparece na seção certa: " + est);
    /* o caso do relato: um ramo com UMA seção só — sem sumário e sem "próxima" (seria ela mesma) */
    api.matEscopoEscolher("imunidades");
    ok(fins().length === 1 && /Terminei de ler/.test(fins()[0].textContent), "E4 ramo com uma seção: só o botão no fim dela");
    ok(!api.$("matLeitura").querySelectorAll(".rls-sumario").length && !api.$("matLeitura").querySelectorAll(".rls-ir").length, "E5 ramo com uma seção: nada no topo (nem 'próxima não lida')");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["rls_lida_tip", "rls_mudou_tip", "rls_grupo_tip", "rls_proxima_tip", "rls_tag_lida", "rls_tag_mudou", "rls_tag_grupo", "rls_fim_marcar", "rls_fim_marcar_aj",
      "rls_fim_lida", "rls_fim_desmarcar", "rls_fim_desmarcar_aj", "rls_fim_mudou", "rls_fim_reler", "rls_sum", "rls_sum_todas", "rls_sum_mudaram", "rls_sum_aj", "rls_ir_proxima", "rls_sum_item_aj"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
