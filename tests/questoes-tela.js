/* =====================================================================
 * RESPONDER QUESTÕES: TECLADO, TELA INTEIRA, BALÕES (v18.54.0)
 *
 * O pedido: "navegação para pular questões ou seguir para a próxima
 * usando os direcionais do teclado"; "resolução maximizada na tela";
 * "a linha de 3 botões (rascunho, julgados, consultar a lei) deve ser
 * movida"; "o gabarito e a dica com espaço muito pequeno"; "grifos
 * tomando muito espaço"; "recolher enunciado não funciona em telas
 * maiores"; "o próxima fixo embaixo toma grande parte do espaço — um
 * balão flutuante quando os botões não estiverem visíveis".
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");

  const montar = () => {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("D", "T");
    api.qsAplicar(api.qsLerResposta([
      "[QUESTAO] ENUNCIADO: Q1 certo ou errado. GABARITO: C COMENTARIO: c1.",
      "[QUESTAO] ENUNCIADO: Q2 certo ou errado. GABARITO: E COMENTARIO: c2.",
      "[QUESTAO] ENUNCIADO: Q3 certo ou errado. GABARITO: C COMENTARIO: c3.",
    ].join("\n"), { disciplina: "D", topico: "T", chave: ch }).achados);
    api.qsUiResponderAbrir(api.qsFiltrar({}), "aba", "t");
    return api;
  };
  const tecla = (api, key, target) => {
    let impedido = false;
    const feito = api.qsTeclaResponder({ key, target: target || { tagName: "BODY" }, preventDefault() { impedido = true; } });
    return { feito, impedido };
  };

  /* ---- K: o teclado ---- */
  {
    const api = montar();
    const q1 = api.qsAtual();
    ok(tecla(api, "c").feito && api.$("btnQsProxima").disabled === false, "K1 'c' escolhe Certo e libera o responder");
    ok(api.$("qsSessCorpo").querySelectorAll(".qs-op-sel").length === 1, "K1a a alternativa escolhida aparece marcada");
    const r = tecla(api, "Enter");
    ok(r.feito && r.impedido && api.qsJaRespondida(), "K2 Enter responde (e o navegador não faz mais nada com a tecla)");
    ok(tecla(api, "e").feito === false, "K2a depois de responder, letra não muda a resposta");
    ok(tecla(api, "ArrowRight").feito && api.qsAtual().id !== q1.id, "K3 → vai para a próxima depois de responder");
    const q2 = api.qsAtual();
    ok(tecla(api, "ArrowLeft").feito && api.qsAtual().id === q1.id, "K4 ← volta à anterior");
    tecla(api, "ArrowRight");
    ok(api.qsAtual().id === q2.id && !api.qsJaRespondida(), "K4a → de novo, de volta à segunda");
    ok(tecla(api, "ArrowRight").feito && api.qsAtual().id !== q2.id, "K5 → numa questão não respondida pula");
    ok(tecla(api, "1").feito && api.$("qsSessCorpo").querySelectorAll(".qs-op-sel").length === 1, "K6 '1' escolhe a primeira alternativa");
    /* digitando num campo, as teclas são do campo */
    ok(tecla(api, "ArrowRight", { tagName: "TEXTAREA" }).feito === false, "K7 no rascunho digitado (textarea) as setas não andam");
    ok(tecla(api, "Enter", { tagName: "BUTTON" }).feito === false, "K7a Enter num botão em foco fica com o botão (não aperta dois)");
    ok(tecla(api, "x").feito === false, "K7b letra que não é alternativa não faz nada");
    /* outra janela por cima: o teclado é dela */
    api.$("uiModal").open = true;
    ok(tecla(api, "ArrowLeft").feito === false, "K8 com um aviso aberto por cima, as setas não mexem na questão");
    api.$("uiModal").open = false;
    ok(tecla(api, "ArrowLeft", undefined).feito === true, "K8a fechado o aviso, voltam a funcionar");
    ok(api.qsTeclaResponder({ key: "ArrowLeft", ctrlKey: true, target: {} }) === false, "K8b com Ctrl/Alt/Cmd, nada");
    api.$("dlgQsResponder").close();
    ok(tecla(api, "ArrowRight").feito === false, "K9 com a sessão fechada, nada");
    ok(/Enter responde/.test(api.$("qsTeclas").textContent || ""), "K10 a dica dos atalhos aparece junto da faixa de andar: " + api.$("qsTeclas").textContent);
  }

  /* ---- F: o balão de andar ---- */
  {
    const api = montar();
    api.qsNavFlutAtualizar(true);
    ok(api.$("qsNavFlut").hidden === true, "F1 com a faixa de andar à vista, sem balão");
    api.qsNavFlutAtualizar(false);
    ok(api.$("qsNavFlut").hidden === false, "F2 com a faixa fora da tela, o balão aparece");
    ok(api.$("btnQsFlutPrincipal").textContent === api.$("btnQsProxima").textContent && api.$("btnQsFlutPrincipal").disabled === true,
       "F3 o botão do balão é o mesmo passo (responder, desligado sem escolha)");
    ok(api.$("btnQsFlutVoltar").hidden === true && api.$("btnQsFlutPular").hidden === false, "F3a na primeira, sem voltar; pular sim");
    tecla(api, "c");
    ok(api.$("btnQsFlutPrincipal").disabled === false, "F4 escolhida a alternativa, o balão acompanha");
    api.$("btnQsFlutPrincipal").onclick();
    ok(api.qsJaRespondida() && /próxima/i.test(api.$("btnQsFlutPrincipal").textContent), "F5 o balão responde, e vira 'próxima'");
    const q1 = api.qsAtual().id;
    api.$("btnQsFlutPrincipal").onclick();
    ok(api.qsAtual().id !== q1 && api.$("btnQsFlutVoltar").hidden === false, "F6 e avança; aparece o voltar");
    api.$("btnQsFlutPular").onclick();
    api.$("btnQsFlutPular").onclick();
    api.$("btnQsFlutVoltar").onclick();
    ok(!!api.qsAtual(), "F7 os três botões chamam os de verdade");
    /* fim da rodada: sem passo, sem balão */
    while (api.qsAtual()) { api.qsResponder("C"); api.qsAndar(1); }
    api.qsUiPintarSessao();
    api.qsNavFlutAtualizar(false);
    ok(api.$("qsNavFlut").hidden === true, "F8 no fim da rodada o balão some");
    api.qsNavFlutAtualizar(null);
  }

  /* ---- G: o balão do grifo ---- */
  {
    const api = montar();
    const en = api.$("qsSessCorpo").querySelectorAll(".qs-enunciado")[0];
    ok(en && !api.$("qsSessCorpo").querySelectorAll(".qs-cor").length, "G1 nenhuma fileira de cores na questão");
    const no = (en.childNodes || [])[0] || en;
    api.porSelecao(() => ({ rangeCount: 1, isCollapsed: false,
      getRangeAt: () => ({ startContainer: no, startOffset: 0, endContainer: no, endOffset: 2, getBoundingClientRect: () => ({ top: 200, bottom: 220, left: 50, width: 40 }) }),
      removeAllRanges() {} }));
    ok(api.qsGrBolhaAtualizar() === true && api.$("qsGrBolha").hidden === false, "G2 com um trecho do enunciado selecionado, o balão das cores aparece");
    const azul = (api.$("qsGrBolha").children || []).find((b) => /gr-az/.test(b.className || ""));
    azul.onclick();
    ok(api.grContar(api.qsAtual().id) === 1 && api.$("qsGrBolha").hidden === true, "G3 tocar numa cor grifa o trecho e o balão some");
    api.porSelecao(() => ({ rangeCount: 0, isCollapsed: true, removeAllRanges() {} }));
    ok(api.qsGrBolhaAtualizar() === false && api.$("qsGrBolha").hidden === true, "G4 sem seleção, sem balão");
    /* um cursor (seleção sem largura) também não é trecho */
    api.porSelecao(() => ({ rangeCount: 1, isCollapsed: true,
      getRangeAt: () => ({ startContainer: no, startOffset: 1, endContainer: no, endOffset: 1, getBoundingClientRect: () => ({}) }), removeAllRanges() {} }));
    ok(api.qsGrBolhaAtualizar() === false && api.$("qsGrBolha").hidden === true, "G4a cursor parado não abre o balão");
    /* seleção fora do enunciado (no comentário, nas alternativas): não é grifo */
    const fora = api.document.createTextNode("fora do enunciado");
    api.porSelecao(() => ({ rangeCount: 1, isCollapsed: false,
      getRangeAt: () => ({ startContainer: fora, startOffset: 0, endContainer: fora, endOffset: 4, getBoundingClientRect: () => ({}) }), removeAllRanges() {} }));
    ok(api.qsGrBolhaAtualizar() === false, "G4b seleção fora do enunciado não abre o balão");
    api.porSelecao(() => ({ rangeCount: 1, isCollapsed: false,
      getRangeAt: () => ({ startContainer: no, startOffset: 0, endContainer: no, endOffset: 2, getBoundingClientRect: () => ({ top: 200, bottom: 220, left: 50, width: 40 }) }),
      removeAllRanges() {} }));
    api.qsGrBolhaAtualizar();
    (api.$("qsGrBolha").children || []).find((b) => /qs-fer-limpar/.test(b.className || "")).onclick();
    ok(api.grContar(api.qsAtual().id) === 0, "G5 'limpar' no balão tira os grifos da questão");
    /* o enunciado foi redesenhado pelo limpar: seleciona de novo, no nó novo */
    const en2 = api.$("qsSessCorpo").querySelectorAll(".qs-enunciado")[0];
    const no2 = (en2.childNodes || [])[0] || en2;
    api.porSelecao(() => ({ rangeCount: 1, isCollapsed: false,
      getRangeAt: () => ({ startContainer: no2, startOffset: 0, endContainer: no2, endOffset: 2, getBoundingClientRect: () => ({ top: 200, bottom: 220, left: 50, width: 40 }) }),
      removeAllRanges() {} }));
    ok(api.qsGrBolhaAtualizar() === true, "G6-pre o balão está aberto antes de repintar");
    tecla(api, "c"); /* repintar a questão esconde o balão */
    ok(api.$("qsGrBolha").hidden === true, "G6 repintar a questão esconde o balão");
    const de = api.$("qsSessCorpo").querySelectorAll(".qs-de-linha")[0];
    ok(de && (de.children || []).some((x) => /qs-fer/.test(x.className || "")), "G7 o ⋮ mora na linha de cima, ao lado de onde é a questão");
    const barra = api.qsUiFerramentas(api.qsAtual());
    const menu = barra.querySelectorAll(".qs-fer-menu")[0];
    ok(menu && (menu.children || []).some((x) => /qs-fer-limpar/.test(x.className || "")), "G8 'limpar grifos' também está no ⋮");
  }

  /* ---- H: estrutura e CSS ---- */
  {
    const dlg = html.slice(html.indexOf('<dialog id="dlgQsResponder"'), html.indexOf("</dialog>", html.indexOf('<dialog id="dlgQsResponder"')));
    const cab = dlg.slice(dlg.indexOf('class="vka-cab qs-cab"'), dlg.indexOf('id="qsSessPlacar"'));
    ok(["btnRsAbrir", "btnQsJuris", "btnQsLei"].every((id) => cab.indexOf('id="' + id + '"') > 0), "H1 rascunho, julgados e lei moram no cabeçalho");
    const lado = dlg.slice(dlg.indexOf('id="qsCorpoLado"'), dlg.indexOf('id="qsNavFlut"'));
    ok(["qsBarraAndar", "btnQsProxima", "btnQsRodapeAlternar", "qsRodape"].every((id) => lado.indexOf('id="' + id + '"') > 0),
       "H2 a faixa de andar e as saídas moram no fim do que rola (não presas embaixo)");
    ok(dlg.indexOf('id="qsNavFlut"') > 0 && dlg.indexOf('id="qsGrBolha"') > 0, "H3 os dois balões existem na janela");
    ok(/#dlgQsResponder\[open\]\{width:100vw!important;max-width:none!important;height:100vh;height:100dvh;\n  max-height:100dvh!important;margin:0!important/.test(html),
       "H4 a janela ocupa a tela inteira em qualquer largura");
    ok(html.indexOf("#dlgQsResponder .qs-sess .qs-enunciado.qs-enun-colapsado{max-height:2.8em;min-height:0;") > 0,
       "H5 'recolher' zera a altura mínima (era o que o impedia em tela grande)");
    ok(html.indexOf("#dlgQsResponder .qs-coment,#dlgQsResponder .qs-minha-dica{font-size:15.5px;line-height:1.62;color:var(--texto)}") > 0,
       "H6 comentário e dica com letra de leitura (em toda largura, não só no celular)");
    ok(/\.qs-teclas\{/.test(html) && /@media \(hover:none\),\(max-width:760px\)\{\.qs-teclas\{display:none\}\}/.test(html), "H7 a dica de teclado só onde há teclado");
  }
  {
    const { api } = rodar();
    ["qs_flut_voltar_tip", "qs_flut_principal_tip", "qs_flut_pular_tip", "qs_teclas"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "H8 falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
