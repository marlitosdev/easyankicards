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

  /* =================================================================
   * E (18.30.0): A BARRA DE EDIÇÃO
   * ================================================================= */
  {
    const { api } = rodar();
    preparar(api);
    api.matTrocarModo("editar");
    const ta = api.$("matTexto");
    const BASE = "A relação jurídica é principal.\n\nSegunda linha aqui.\nTerceira linha.";
    const por = (txt, alvo, n) => { ta.value = txt; const i = txt.indexOf(alvo); ta.selectionStart = i; ta.selectionEnd = i + (n === undefined ? alvo.length : n); };
    /* E1: negrito liga e desliga (selecionado inteiro OU só o miolo) */
    por(BASE, "relação");
    api.matEnvolver("**");
    ok(ta.value.indexOf("A **relação** jurídica") === 0, "E1 o negrito não envolveu o trecho: " + ta.value.slice(0, 30));
    api.matEnvolver("**");
    ok(ta.value === BASE, "E1a apertar de novo devia tirar o negrito (não '****'): " + ta.value.slice(0, 30));
    por("A **relação** jurídica", "relação");
    api.matEnvolver("**");
    ok(ta.value === "A relação jurídica", "E1b selecionar só o miolo e apertar devia tirar o negrito: " + ta.value);
    por(BASE, "relação");
    api.matEnvolver("_"); api.matEnvolver("_");
    ok(ta.value === BASE, "E1c o itálico não desliga");
    por("A  fim", "  fim", 0); ta.selectionStart = ta.selectionEnd = 2;
    api.matEnvolver("**");
    ok(ta.value === "A **** fim" && ta.selectionStart === 4 && ta.selectionEnd === 4, "E1d sem seleção: as marcas e o cursor no meio");
    /* E2: as cinco marcas — marca, troca a cor, tira */
    por(BASE, "relação");
    api.matMarcaEdicao("importante");
    ok(ta.value.indexOf("A ==!relação== jurídica") === 0, "E2 a marca 'importante' não entrou: " + ta.value.slice(0, 30));
    api.matMarcaEdicao("duvida");
    ok(ta.value.indexOf("A ==?relação== jurídica") === 0, "E2a outra marca devia TROCAR a cor, não empilhar: " + ta.value.slice(0, 30));
    api.matMarcaEdicao("duvida");
    ok(ta.value === BASE, "E2b a mesma marca de novo devia tirar: " + ta.value.slice(0, 30));
    por("A ==!relação== jurídica", "relação");
    api.matMarcaEdicao("prova");
    ok(ta.value === "A ==*relação== jurídica", "E2c com só o miolo selecionado, a troca de cor falhou: " + ta.value);
    por("A ==relação== jurídica", "relação");
    api.matMarcaEdicao("destaque");
    ok(ta.value === "A relação jurídica", "E2d destaque sobre destaque devia tirar: " + ta.value);
    /* E3: título anda os níveis */
    por(BASE, "relação", 0);
    api.matTituloAlternar();
    ok(ta.value.split("\n")[0] === "## A relação jurídica é principal.", "E3 o título não entrou: " + ta.value.split("\n")[0]);
    api.matTituloAlternar();
    ok(ta.value.split("\n")[0] === "### A relação jurídica é principal.", "E3a o segundo toque devia descer para ### (não '## ##'): " + ta.value.split("\n")[0]);
    api.matTituloAlternar();
    ok(ta.value === BASE, "E3b o terceiro toque devia tirar o título: " + ta.value.split("\n")[0]);
    por("# Grande\nx", "Grande", 0);
    api.matTituloAlternar();
    ok(ta.value.split("\n")[0] === "## Grande", "E3c '# ' devia virar '## ': " + ta.value.split("\n")[0]);
    /* E4: lista em várias linhas, liga e desliga, linha vazia intacta */
    ta.value = BASE; ta.selectionStart = 0; ta.selectionEnd = BASE.length;
    api.matListaAlternar();
    ok(ta.value === "- A relação jurídica é principal.\n\n- Segunda linha aqui.\n- Terceira linha.", "E4 a lista não pegou todas as linhas selecionadas: " + JSON.stringify(ta.value));
    ta.selectionStart = 0; ta.selectionEnd = ta.value.length;
    api.matListaAlternar();
    ok(ta.value === BASE, "E4a o segundo toque devia tirar a lista (não '- - '): " + JSON.stringify(ta.value));
    /* E5: divisória numa linha própria antes da linha do cursor */
    por(BASE, "Segunda", 0);
    api.matPrefixo("---\n");
    ok(ta.value === "A relação jurídica é principal.\n\n---\nSegunda linha aqui.\nTerceira linha.", "E5 a divisória não entrou no lugar: " + JSON.stringify(ta.value));
    /* E6: colar formatado ONDE ESTÁ O CURSOR */
    por(BASE, "Segunda", 0);
    api.matAplicarColagem("Texto colado.");
    ok(ta.value === "A relação jurídica é principal.\n\nTexto colado.\n\nSegunda linha aqui.\nTerceira linha.", "E6 a colagem não entrou onde estava o cursor: " + JSON.stringify(ta.value));
    ta.value = BASE; ta.selectionStart = ta.selectionEnd = BASE.length;
    api.matAplicarColagem("No fim.");
    ok(ta.value === BASE + "\n\nNo fim.", "E6a com o cursor no fim, a colagem devia ir para o fim: " + JSON.stringify(ta.value.slice(-30)));
    por(BASE, "Segunda linha aqui.");
    api.matAplicarColagem("Trocado.");
    ok(ta.value.indexOf("Trocado.") > 0 && ta.value.indexOf("Segunda linha aqui.") < 0, "E6b a colagem devia trocar o trecho selecionado");
    ta.value = ""; ta.selectionStart = ta.selectionEnd = 0;
    api.matAplicarColagem("Primeiro texto.");
    ok(ta.value === "Primeiro texto.", "E6c com o campo vazio, a colagem é o texto todo: " + JSON.stringify(ta.value));
    /* E7: digitar conta como alteração não salva (fechar pergunta) */
    api.matSalvarEstado();
    ok(api.matEstaSujo() === false, "E7pre depois de salvar não devia haver alteração pendente");
    (ta._ouv.input || []).forEach((f) => f({}));
    ok(api.matEstaSujo() === true, "E7 digitar no modo edição não conta como alteração: fechar perderia o texto sem perguntar");
    api.matSalvarEstado();
    por(ta.value, "relação");
    api.matEnvolver("**");
    ok(api.matEstaSujo() === true, "E7a formatar por botão não conta como alteração");
    /* E8: atalhos Ctrl+B / Ctrl+I no campo e Ctrl+S na janela */
    por(BASE, "relação");
    let prev = 0;
    (ta._ouv.keydown || []).forEach((f) => f({ ctrlKey: true, key: "b", preventDefault() { prev++; } }));
    ok(ta.value.indexOf("A **relação**") === 0 && prev === 1, "E8 Ctrl+B não pôs negrito");
    por(BASE, "relação");
    (ta._ouv.keydown || []).forEach((f) => f({ ctrlKey: true, key: "i", preventDefault() {} }));
    ok(ta.value.indexOf("A _relação_") === 0, "E8a Ctrl+I não pôs itálico");
    let salvou = 0;
    api.$("btnMatSalvarEstadoTopo").onclick = () => { salvou++; };
    (api.$("dlgMaterial")._ouv.keydown || []).forEach((f) => f({ ctrlKey: true, key: "s", preventDefault() {} }));
    ok(salvou === 1, "E8b Ctrl+S não salvou o resumo");
    (api.$("dlgMaterial")._ouv.keydown || []).forEach((f) => f({ ctrlKey: false, key: "s", preventDefault() {} }));
    ok(salvou === 1, "E8c a tecla s sozinha salvou");
    /* E9: a letra do "Aa" vale no campo de edição */
    api.matFonteMudar(1);
    ok(ta.style.fontSize && ta.style.fontSize === api.$("matLeitura").style.fontSize, "E9 A+ não mudou a letra do campo de edição: " + ta.style.fontSize);
  }
  {
    /* E10: as cinco marcas também na barra de edição; os botões da barra ligados às funções novas */
    const barra = HTML.slice(HTML.indexOf('id="matBarra"'), HTML.indexOf('id="matTexto"'));
    ["btnFmtMkD", "btnFmtMkI", "btnFmtMkQ", "btnFmtMkP", "btnFmtMkG", "matPopMarcas"].forEach((id) =>
      ok(barra.indexOf('id="' + id + '"') >= 0, "E10 '" + id + "' devia estar na barra de edição"));
    /* com #matBarra (id): a regra antiga "#dlgMaterial .mat-barra{max-height:24vh;overflow-y:auto}" vem depois no arquivo e venceria uma de mesma força */
    ok(/#dlgMaterial #matBarra\{max-height:none;overflow:visible\}/.test(HTML), "E10a a barra de edição corta o menu das marcas");
    const { api } = rodar();
    preparar(api);
    api.matTrocarModo("editar");
    const ta = api.$("matTexto");
    ta.value = "A x b"; ta.selectionStart = 2; ta.selectionEnd = 3;
    api.$("btnFmtMkQ").onclick();
    ok(ta.value === "A ==?x== b", "E10b o botão 'dúvida' da barra de edição não marcou: " + ta.value);
    ta.value = "## x\ny"; ta.selectionStart = ta.selectionEnd = 3;
    api.$("btnFmtH").onclick();
    ok(ta.value === "### x\ny", "E10c o botão H não anda o nível: " + ta.value);
    ta.value = "a\nb"; ta.selectionStart = 0; ta.selectionEnd = 3;
    api.$("btnFmtL").onclick();
    ok(ta.value === "- a\n- b", "E10d o botão de lista não usa a lista nova: " + ta.value);
    ta.value = "a b"; ta.selectionStart = 2; ta.selectionEnd = 3;
    api.$("btnFmtM").onclick(); api.$("btnFmtM").onclick();
    ok(ta.value === "a b", "E10e o ▮ não desliga: " + ta.value);
  }

  return falhas;
}

module.exports = { testes };
