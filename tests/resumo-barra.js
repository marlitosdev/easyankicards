/* =====================================================================
 * A BARRA DO RESUMO (v18.28.0+)
 *
 * O relato, com print: as opções do resumo tomavam quase metade da tela, e
 * na tela cheia não havia "vínculos de lei" (nem como marcar). A escolha do
 * usuário: uma linha no topo + uma BOLHA que aparece ao selecionar um trecho.
 * Nenhuma função some — os botões mantêm os ids e só mudam de lugar.
 *
 * B (18.28.0): a bolha da seleção.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const HTML = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const bloco = (id) => {
    const i = HTML.indexOf('id="' + id + '"');
    if (i < 0) return "";
    const ini = HTML.lastIndexOf("<div", i);
    const fim = HTML.indexOf("</div>", i);
    return HTML.slice(ini, fim);
  };

  /* B1: os botões do trecho moram na bolha; a linha da leitura ficou só com a dica e a lista */
  {
    const bolha = bloco("matBolha");
    ["btnMarcaD", "btnMarcaI", "btnMarcaQ", "btnMarcaProva", "btnMarcaPeg", "btnMatVinc", "btnBolhaJuris", "btnMatQstTrecho"]
      .forEach((id) => ok(bolha.indexOf('id="' + id + '"') >= 0, "B1 o botão " + id + " devia estar na bolha da seleção"));
    const linha = bloco("matCtrlLeitura");
    ok(linha.indexOf("btnMarcaD") < 0 && linha.indexOf('id="btnMatVinc"') < 0, "B1a a linha da leitura ainda tem as marcas");
    /* (v18.29.0) a lista de vínculos foi da linha da leitura para o "⋯" do topo */
    ok(bloco("matPopMaisCorpo").indexOf('id="btnMatVincLista"') >= 0, "B1b a lista de vínculos sumiu (devia estar no '⋯')");
    ok(bloco("matTopo").indexOf("btnMatQstTrecho") < 0, "B1c 'questões do trecho' ficou duplicado no topo");
    ok(HTML.indexOf('id="btnMatCheiaVinc"') > HTML.indexOf('id="matCheiaBarra"'), "B1d a tela cheia não tem os vínculos de lei");
    ["btnMarcaD", "btnMatVinc", "btnMatQstTrecho", "btnBolhaJuris"].forEach((id) =>
      ok(HTML.split('id="' + id + '"').length === 2, "B1e o id " + id + " aparece mais de uma vez"));
  }

  const preparar = (api) => {
    api.matIniciar();
    const ch = api.matChave("Direito Tributário", "Obrigação tributária");
    api.matGravar(ch, "A obrigação tributária é principal ou acessória (art. 113 do CTN).", { disciplina: "Direito Tributário", topico: "Obrigação tributária" });
    api.matAbrirEditor({ disciplina: "Direito Tributário", nome: "Obrigação tributária" }, true);
    const no = api.document.createElement("span");
    api.$("matLeitura").append(no);
    return no;
  };
  const selDe = (no, rect, txt) => ({
    isCollapsed: false, rangeCount: 1, anchorNode: no, toString() { return txt === undefined ? "principal ou acessória" : txt; },
    getRangeAt() { return { getBoundingClientRect() { return rect; } }; },
  });

  /* B2-B5: aparece com seleção no texto, junto dela; some sem ela */
  {
    const { api } = rodar();
    const no = preparar(api);
    ok(api.$("matBolha").hidden === true, "B2 a bolha aparece sem seleção nenhuma");
    ok(api.matBolhaAtualizar(selDe(no, { top: 300, bottom: 320, left: 100, width: 80 })) === true && !api.$("matBolha").hidden,
      "B2a com um trecho selecionado no resumo a bolha não apareceu");
    const topo = parseInt(api.$("matBolha").style.top, 10);
    ok(topo < 300, "B3 a bolha devia ficar ACIMA do trecho: top=" + api.$("matBolha").style.top);
    api.matBolhaAtualizar(selDe(no, { top: 20, bottom: 40, left: 100, width: 80 }));
    ok(parseInt(api.$("matBolha").style.top, 10) > 40, "B3a sem espaço acima, a bolha devia ir para baixo do trecho: " + api.$("matBolha").style.top);
    const fora = api.document.createElement("span");
    ok(api.matBolhaAtualizar(selDe(fora, { top: 300, bottom: 320, left: 100, width: 80 })) === false && api.$("matBolha").hidden,
      "B4 seleção FORA do resumo mostrou a bolha");
    ok(api.matBolhaAtualizar(selDe(no, { top: 300, bottom: 320, left: 0, width: 0 }, "   ")) === false, "B4a seleção vazia mostrou a bolha");
    const col = Object.assign(selDe(no, { top: 300, bottom: 320, left: 0, width: 0 }), { isCollapsed: true });
    ok(api.matBolhaAtualizar(col) === false, "B4b seleção recolhida (só o cursor) mostrou a bolha");
    api.matTrocarModo("editar");
    ok(api.matBolhaAtualizar(selDe(no, { top: 300, bottom: 320, left: 100, width: 80 })) === false, "B5 editando o texto cru, a bolha não devia aparecer");
    api.matTrocarModo("ler");
  }

  /* B6: na tela cheia a bolha continua (antes não havia como marcar ali) */
  {
    const { api } = rodar();
    const no = preparar(api);
    api.matCheiaTrocar(true);
    ok(api.$("matCtrlLeitura").hidden === true, "B6pre a tela cheia devia esconder a linha da leitura");
    const no2 = api.document.createElement("span");
    api.$("matLeitura").append(no2);
    ok(api.matBolhaAtualizar(selDe(no2, { top: 300, bottom: 320, left: 100, width: 80 })) === true,
      "B6 na tela cheia a bolha da seleção não aparece");
    api.matCheiaTrocar(false);
    void no;
  }

  /* B7-B8: os botões novos fazem o que os de antes faziam */
  {
    const { api } = rodar();
    preparar(api);
    let n = 0;
    api.$("btnMatJuris").onclick = () => { n++; };
    api.$("btnBolhaJuris").onclick();
    ok(n === 1, "B7 o '⚖ julgado' da bolha não chama o mesmo botão de antes");
    api.$("btnMatVincLista").onclick();
    ok(api.$("dlgQsVinc").open === true && /resumo/.test(api.$("qsVincTit").textContent || ""), "B8 '🔗 vínculos de lei' da linha não abriu a lista do resumo");
    api.$("dlgQsVinc").close();
    api.$("btnMatCheiaVinc").onclick();
    ok(api.$("dlgQsVinc").open === true, "B8a '🔗 vínculos de lei' da tela cheia não abriu a lista");
    api.$("dlgQsVinc").close();
  }

  /* =================================================================
   * T (18.29.0): O TOPO EM UMA LINHA — "Aa" e "⋯"
   * ================================================================= */
  {
    const entre = (de, ate) => { const i = HTML.indexOf(de); const j = HTML.indexOf(ate, i); return i >= 0 && j > i ? HTML.slice(i, j) : ""; };
    const topo = entre('id="matTopo"', 'id="matAjudaNota"');
    const ordem = ["btnMatConsertar", "btnMatDuvidas", "btnMatQuestoes", "btnMatModoTopo", "btnMatSalvarEstadoTopo", "matPopAa", "matPopMais", "btnMatFecharTopo"];
    const pos = ordem.map((id) => topo.indexOf('id="' + id + '"'));
    ok(pos.every((p) => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), "T1 o topo não tem tudo na ordem (avisos, Editar, Salvar, Aa, ⋯, fechar): " + pos.join(","));
    const aa = entre('id="matPopAa"', 'id="matPopMais"');
    ["btnMatMenor", "matFonteVal", "btnMatMaior", "btnMatJanNormal", "btnMatAmpliar", "btnMatCheia"].forEach((id) =>
      ok(aa.indexOf('id="' + id + '"') >= 0, "T1a '" + id + "' devia estar no 'Aa'"));
    const mais = entre('id="matPopMaisCorpo"', 'id="btnMatFecharTopo"');
    ["btnMatMarcador", "btnMatIrMarcador", "matMarcadorInfo", "btnMatQstResumo", "btnMatProva", "btnMatJuris", "btnMatVincLista",
     "btnMatProvaLista", "btnMatPegLista", "btnMatDicasLista", "btnMatDicas", "btnMatLog", "btnMatAjuda"].forEach((id) =>
      ok(mais.indexOf('id="' + id + '"') >= 0, "T1b '" + id + "' devia estar no '⋯'"));
    ok(bloco("matCtrlLeitura").indexOf("btnMatMenor") < 0 && entre('id="matCtrlLeitura"', 'id="matCheiaBarra"').indexOf("btnMatCheia\"") < 0,
      "T1c letra e janela ficaram também na linha da leitura");
    ["matTitulo", "matSub", "btnMatMenor", "btnMatCheia", "btnMatMarcador", "matAjudaNota", "btnMatFecharTopo"].forEach((id) =>
      ok(HTML.split('id="' + id + '"').length === 2, "T1d o id " + id + " não aparece exatamente uma vez"));
    ok(/#matRodape #btnMatModo,#matRodape #btnMatSalvar,#matRodape #btnMatFechar\{display:none\}/.test(HTML), "T1e o rodapé continua repetindo Editar/Salvar/Fechar");
    ok(/#dlgMaterial \.mat-cab \.mat-topo\{max-height:none;overflow:visible/.test(HTML), "T1f o topo continua com rolagem própria (cortaria os menus)");
  }
  {
    const { api } = rodar();
    preparar(api);
    /* T2: a ajuda só aparece quando pedida, e nunca na tela cheia */
    ok(api.$("matAjudaNota").hidden === true, "T2 a frase de ajuda aparece sem ser pedida");
    api.$("btnMatAjuda").onclick();
    ok(api.$("matAjudaNota").hidden === false, "T2a '? como funciona' não mostrou a ajuda");
    api.matCheiaTrocar(true);
    ok(api.$("matAjudaNota").hidden === true, "T2b a ajuda aparece na tela cheia");
    api.matCheiaTrocar(false);
    ok(api.$("matAjudaNota").hidden === false, "T2c ao sair da tela cheia a ajuda pedida sumiu");
    api.$("btnMatAjuda").onclick();
    ok(api.$("matAjudaNota").hidden === true, "T2d o segundo toque não escondeu a ajuda");
    api.matCheiaTrocar(true);
    api.matCheiaTrocar(false);
    ok(api.$("matAjudaNota").hidden === true, "T2e com a ajuda fechada, sair da tela cheia fez a frase reaparecer");
    /* T3: escolher uma ação no "⋯" fecha o menu */
    api.$("matPopMais").open = true;
    (api.$("matPopMaisCorpo")._ouv.click || []).forEach((f) => f({ target: api.$("btnMatLog") }));
    ok(api.$("matPopMais").open === false, "T3 escolher uma ação no '⋯' não fechou o menu");
    /* T4: clicar fora fecha */
    api.$("matPopAa").open = true;
    (api.$("dlgMaterial")._ouv.click || []).forEach((f) => f({ target: api.$("matLeitura") }));
    ok(api.$("matPopAa").open === false, "T4 clicar fora não fechou o 'Aa'");
    /* T5: entrar na tela cheia fecha os menus (o topo some) */
    api.$("matPopAa").open = true;
    api.matCheiaTrocar(true);
    ok(api.$("matPopAa").open === false, "T5 a tela cheia deixou o 'Aa' aberto");
    api.matCheiaTrocar(false);
  }

  return falhas;
}

module.exports = { testes };
