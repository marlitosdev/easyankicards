/* =====================================================================
 * O LEITOR COMPACTO — mais lei na tela, sem perder botão nenhum
 *
 * O leitor tinha, antes do texto: título, subtítulo, procedência, "onde parei", fila de leis,
 * barra de botões, gaveta e barra de marcas — nove faixas. Agora: o cabeçalho (com ajuda, registro
 * e fechar), UMA faixa de informação (procedência + "onde parei"), a fila (só quando há o que
 * escolher), UMA linha de trabalho (modos, ir para, exibição, leis e as marcas) e, no rodapé,
 * "gravar" e "registrar estudo" juntos.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Com UMA lei no tópico a fila recolhe e o botão "leis" a abre; com várias, ou nenhuma,
 *     ela fica à vista (é a escolha); a leitura ampliada esconde os dois; reabrir recolhe de novo.
 *  2. As ações de procedência (fonte, atualizar, mapa) moram num menu "fonte e versão"; os AVISOS
 *     (numeração, repetidos) ficam fora dele, à vista; escolher uma ação fecha o menu.
 *  3. Nenhum botão sumiu: todos os que existiam continuam com ação.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const eh = (c, tag) => String(c.tag || c.tagName || "").toLowerCase() === tag;
  const LEI = ["Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Três.", "Art. 4º Quatro.", "Art. 5º Cinco.", "Art. 6º Seis.",
    "Art. 7º Sete.", "Art. 8º Oito.", "Art. 9º Nove.", "Art. 40. Uma remissão lida como artigo.", "Art. 10. Dez.", "Art. 11. Onze."].join("\n");
  const montar = (extra) => {
    const r = rodar();
    const api = r.api;
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave("Direito", "Tributário");
    api.matGravar(ch, "R.", { disciplina: "Direito", topico: "Tributário", concurso: "TCE" });
    const l = api.leiGuardar(Object.assign({ id: "lei_a", nome: "Lei A", texto: LEI, consultadaEm: "2026-01-01" }, extra || {}));
    api.leiLigar(l.id, ch);              /* como leiGravar faz: a lei serve a este topico */
    return { api, l, ch };
  };

  /* ==============================================================
   * F: A FILA RECOLHE QUANDO NÃO HÁ O QUE ESCOLHER
   * ============================================================== */
  {
    const { api, l } = montar();
    api.leiAbrir("Direito", "Tributário", l.id);
    ok(api.$("leiFila").hidden === true && api.$("btnLeiFilaMais").hidden === false, "F1 uma lei so: fila recolhida e botao 'leis' a vista");
    api.$("btnLeiFilaMais").onclick();
    ok(api.$("leiFila").hidden === false && /btn-min-ok/.test(api.$("btnLeiFilaMais").className), "F1a o botao abre a fila e fica marcado");
    ok(achar(api.$("leiFila"), (c) => c.id === "btnLeiNova").length === 1 && achar(api.$("leiFila"), (c) => /lei-chip/.test(c.className || "")).length >= 1, "F1b a fila tem as leis e o 'colar uma lei nova'");
    api.$("btnLeiFilaMais").onclick();
    ok(api.$("leiFila").hidden === true && !/btn-min-ok/.test(api.$("btnLeiFilaMais").className), "F1c tocar de novo recolhe");
    /* a leitura ampliada esconde a fila e o botao; sair devolve o estado */
    api.$("btnLeiFilaMais").onclick();
    api.$("btnLeiCheia").onclick();
    ok(api.$("leiFila").hidden === true && api.$("btnLeiFilaMais").hidden === true, "F2 leitura ampliada esconde a fila e o botao");
    api.$("btnLeiCheia").onclick();
    ok(api.$("leiFila").hidden === false && api.$("btnLeiFilaMais").hidden === false, "F2a sair devolve a fila que a pessoa tinha aberto");
    /* reabrir recolhe de novo */
    api.leiAbrir("Direito", "Tributário", l.id);
    ok(api.$("leiFila").hidden === true, "F3 reaberta, nasce recolhida");
  }
  {
    /* duas leis no mesmo tópico: a fila E a escolha, fica à vista */
    const { api, l, ch } = montar();
    const l2 = api.leiGuardar({ id: "lei_b", nome: "Lei B", texto: "Art. 1º Outra." });
    api.leiLigar(l.id, ch); api.leiLigar(l2.id, ch);
    api.leiAbrir("Direito", "Tributário", l.id);
    ok(api.$("leiFila").hidden === false && api.$("btnLeiFilaMais").hidden === true, "F4 com duas leis a fila fica a vista e nao ha botao 'leis'");
  }
  {
    /* tópico sem lei: a fila é o convite para colar/usar */
    const { api } = montar();
    api.matGravar(api.matChave("Direito", "Outro"), "R.", { disciplina: "Direito", topico: "Outro", concurso: "TCE" });
    api.leiAbrir("Direito", "Outro");
    ok(api.$("leiFila").hidden === false && api.$("btnLeiFilaMais").hidden === true, "F5 topico sem lei: a fila (colar/usar) fica a vista");
  }
  {
    /* aberta pela Biblioteca: so a propria lei */
    const { api, l } = montar();
    api.leiAbrirAvulsa(l.id);
    ok(api.$("leiFila").hidden === true && api.$("btnLeiFilaMais").hidden === false, "F6 aberta pela Biblioteca: recolhida, com o botao");
  }

  /* ==============================================================
   * P: A PROCEDÊNCIA — UM MENU, E OS AVISOS À VISTA
   * ============================================================== */
  {
    const { api, l } = montar({ fonte: "https://exemplo.gov.br/lei" });
    api.leiAbrir("Direito", "Tributário", l.id);
    const proc = api.$("leiProc");
    const menu = achar(proc, (c) => eh(c, "details") && /lei-mais/.test(c.className || ""))[0];
    ok(!!menu && /fonte e versão/.test(achar(menu, (c) => eh(c, "summary"))[0].textContent), "P1 a procedencia tem o menu 'fonte e versão'");
    const dentro = (id) => achar(menu, (c) => c.id === id).length === 1;
    ok(dentro("btnLeiAtualizarVersao") && dentro("btnLeiMapa"), "P2 atualizar e mapa moram no menu");
    ok(achar(menu, (c) => eh(c, "a") && /lei-fonte/.test(c.className || "")).length === 1, "P2a o link da fonte tambem");
    ok(achar(menu, (c) => eh(c, "button") && /btn-min/.test(c.className || "")).length === 3, "P2b tres botoes no menu (procedencia, atualizar, mapa)");
    ok(/consultada em 2026-01-01/.test(proc.textContent), "P3 o texto da data continua a vista: " + proc.textContent.slice(0, 80));
    /* escolher uma ação fecha o menu */
    menu.open = true;
    achar(menu, (c) => c.id === "btnLeiMapa")[0].onclick();
    ok(menu.open === false, "P4 escolher uma acao fecha o menu");
    api.$("dlgLeiMapa").close();
    /* o aviso de numeração NÃO está no menu (o número 40 isolado é o problema) */
    const av = achar(proc, (c) => c.id === "btnLeiNumeracao");
    ok(av.length === 1 && achar(menu, (c) => c.id === "btnLeiNumeracao").length === 0, "P5 o aviso de numeracao fica FORA do menu, a vista");
  }

  /* ==============================================================
   * B: NENHUM BOTÃO SUMIU
   * ============================================================== */
  {
    const { api, l } = montar();
    api.leiAbrir("Direito", "Tributário", l.id);
    ["btnLeiModoLer", "btnLeiModoEditar", "btnLeiModoRecitar", "btnLeiNavegar", "btnLeiExibir", "btnLeiFilaMais",
      "btnLeiSalvar", "btnLeiLido", "btnLeiFechar", "btnLeiFechar2", "btnLeiAjuda", "btnLeiLog", "btnLeiCheia",
      "btnLeiMaior", "btnLeiMenor", "btnLeiFonteReset", "btnLeiJanelaMais", "btnLeiJanelaMenos",
      "btnLeiMarcaDest", "btnLeiMarcaImp", "btnLeiMarcaDuv", "btnLeiMarcaProva", "btnLeiMarcaPeg", "btnLeiMarcaNota"].forEach((id) => {
      ok(api.$(id) && typeof api.$(id).onclick === "function", "B1 o botao " + id + " ficou sem acao (ou sumiu)");
    });
    ok(api.$("leiEstado") && typeof api.$("leiEstado").textContent === "string", "B2 o aviso 'ainda nao salvo' continua existindo");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
