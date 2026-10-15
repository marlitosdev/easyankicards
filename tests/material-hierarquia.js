/* =====================================================================
 * MATERIAL: DISCIPLINA › TÓPICO › RAMO, À VISTA (v18.48.0)
 *
 * O pedido: o nome da disciplina tinha o mesmo formato dos tópicos, e os
 * ramos não apareciam. A escolha do usuário: "recuo + linha-guia" — a
 * disciplina vira faixa (maiúsculas, barra, "· N tópicos"), os tópicos
 * ficam recuados e presos a ela por uma linha, e os ramos aparecem
 * recolhidos ("▸ N ramos"), mais recuados, cada um abrindo a ficha nele.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const cls = (e) => String((e && e.className) || "");
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((x) => { if (pred(x)) acc.push(x); achar(x, pred, acc); }); return acc; };
  const D = "Tributário";
  const EDITAL = ["# ISS | prova: 2027-06-01 | horas: 10", "@ " + D + " :: 5",
    "+ Limitações :: 5", "++ Princípios em espécie :: 5", "++ Imunidade recíproca :: 4", "+ Crédito :: 5"].join("\n");
  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const ed = api.edCriar("ISS", EDITAL);
  const L = api.matChave(D, "Limitações"), C = api.matChave(D, "Crédito");
  api.matGravar(L, "Resumo L.", { disciplina: D, topico: "Limitações", concurso: "ISS" });
  api.matGravar(C, "Resumo C.", { disciplina: D, topico: "Crédito", concurso: "ISS" });
  api.editaisAtuais.find((x) => x.id === ed.id).progresso[L + "›#principios_em_especie"] = { e: "feito", d: "2026-10-01" };
  api.matFiltroTiposTeste([]);
  api.matRender();
  const linha = (nome) => achar(api.$("matLista"), (e) => cls(e) === "mat-item").find((i) => i.textContent.indexOf(nome) === 0);

  /* H1: a disciplina é faixa; os tópicos ficam dentro do corpo com a linha-guia */
  const cab = achar(api.$("matLista"), (e) => cls(e) === "mat-disc-cab")[0];
  ok(cab && cab.textContent === "▾ Tributário · 2 tópico(s)" && cab.getAttribute("aria-expanded") === "true", "H1 a faixa da disciplina diz quantos tópicos: " + (cab && cab.textContent));
  const corpo = achar(api.$("matLista"), (e) => cls(e) === "mat-disc-corpo")[0];
  ok(corpo && achar(corpo, (e) => cls(e) === "mat-item").length === 2, "H1a os tópicos ficam dentro do corpo da disciplina (a linha-guia)");

  /* H2: ramos recolhidos; abrir mostra os ramos, o estudado com ✓; tocar abre a ficha no ramo */
  const tg = achar(linha("Limitações"), (e) => cls(e) === "mat-ramos-tog")[0];
  ok(tg && tg.textContent === "▸ 2 ramo(s)" && !achar(linha("Limitações"), (e) => /mat-ramo( |$)/.test(cls(e))).length, "H2 os ramos começam recolhidos: " + (tg && tg.textContent));
  ok(!achar(linha("Crédito"), (e) => cls(e) === "mat-ramos-tog").length, "H2a tópico sem ramos não tem o botão");
  tg.onclick({ stopPropagation() {} });
  const rs = achar(linha("Limitações"), (e) => /(^| )mat-ramo( |$)/.test(cls(e)));
  ok(rs.length === 2 && rs[0].textContent === "↳ Princípios em espécie ✓" && /feito/.test(cls(rs[0])) && rs[1].textContent === "↳ Imunidade recíproca",
     "H2b abertos: '↳ ramo', o estudado com ✓: " + rs.map((r) => r.textContent).join(" | "));
  rs[1].onclick({ stopPropagation() {} });
  ok(api.$("dlgMatFicha").open === true && api.matFichaEscopoAtual() === "imunidade_reciproca", "H2c tocar no ramo abre a ficha JÁ no ramo: " + api.matFichaEscopoAtual());
  api.$("dlgMatFicha").close();
  const tg2 = achar(linha("Limitações"), (e) => cls(e) === "mat-ramos-tog")[0];
  tg2.onclick({ stopPropagation() {} });
  ok(!achar(linha("Limitações"), (e) => /(^| )mat-ramo( |$)/.test(cls(e))).length, "H2d tocar de novo recolhe");

  /* H3: o CSS ganha da regra antiga (all:unset) e desenha a linha-guia e o tracejado */
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  ok(html.indexOf(".mat-disc > .mat-disc-cab{") > 0 && html.indexOf(".mat-disc-corpo{") > 0 && html.indexOf(".mat-disc .mat-disc-corpo > .mat-item::before") < 0 && html.indexOf(".mat-disc-corpo > .mat-item::before{") > 0 && /\.mat-ramos\{[^}]*dashed/.test(html),
     "H3 o CSS da hierarquia existe (faixa com especificidade maior que o all:unset antigo, linha-guia, ramos tracejados)");
  ["mat_disc_n_topicos", "mat_ramos_n", "mat_ramos_tog_tip", "mat_ramo_tip"].forEach((k) => {
    ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "H4 falta " + k + " em " + l); });
  });
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
