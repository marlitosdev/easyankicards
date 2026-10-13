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
    ok(linha.indexOf('id="btnMatVincLista"') >= 0, "B1b a linha da leitura perdeu a lista de vínculos");
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

  return falhas;
}

module.exports = { testes };
