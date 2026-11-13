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
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8").replace(/\r\n/g, "\n"); /* a cópia de trabalho no Windows pode estar em CRLF */

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
  /* ===================================================================
   * (19.116.0) FÓRMULAS E TABELAS NA QUESTÃO
   * O pedido: enunciados como o da tabela-verdade do QConcursos, os símbolos do resumo, estatística e matemática
   * financeira. O texto guardado não muda; o leitor mantém as linhas e a tela mostra tabela, expoente e fórmula —
   * SEM mudar uma posição de letra (o grifo e o lápis dependem delas).
   * =================================================================== */
  {
    const { api, janela } = rodar();
    const doc = janela.document;
    const todos = (el, f, out) => { out = out || []; Array.from(el.childNodes || el.children || []).filter((c) => c && c.nodeType !== 3).forEach((c) => { if (f(c)) out.push(c); todos(c, f, out); }); return out; };
    const cls = (e) => String(e.className || (e.getAttribute && e.getAttribute("class")) || "");
    const tag = (e) => String(e.tagName || "").toUpperCase();
    /* a leitura: tabela em linhas, e a que chega numa linha só */
    const multi = "[QUESTAO]\nTIPO: ME\nBANCA: FCC\nENUNCIADO: Observe a tabela verdade abaixo.\n| P | Q | ~Q → P |\n| --- | --- | --- |\n| V | V | F |\n| V | F | x |\n| F | V | y |\n| F | F | z |\nOs valores lógicos que devem substituir x, y e z são, respectivamente:\nA) V, F e F.\nB) F, V e V.\nC) V, V e F.\nGABARITO: C\nCOMENTARIO: ~Q → P só é falsa quando ~Q é V e P é F.\n[/QUESTAO]";
    const r1 = api.qsLerResposta(multi, {});
    const en1 = r1.achados[0] && r1.achados[0].enunciado;
    ok(r1.achados.length === 1 && r1.achados[0].opcoes.length === 3 && /abaixo\.\n\| P \| Q \| ~Q → P \|\n\| --- \| --- \| --- \|\n\| V \| V \| F \|/.test(en1) && /\| F \| F \| z \|\nOs valores/.test(en1),
       "F1 o leitor mantem as linhas: a tabela continua uma linha por linha: " + JSON.stringify(en1));
    const uma = "[QUESTAO] TIPO: CE BANCA: CEBRASPE ENUNCIADO: Considere a tabela: | P | Q | P ∧ Q | |---|---|---| | V | V | V | | V | F | F | Logo, a conjunção só é verdadeira na primeira linha. GABARITO: C COMENTARIO: ok. [/QUESTAO]";
    const en2 = (api.qsLerResposta(uma, {}).achados[0] || {}).enunciado;
    ok(en2 === "Considere a tabela:\n| P | Q | P ∧ Q |\n| --- | --- | --- |\n| V | V | V |\n| V | F | F |\nLogo, a conjunção só é verdadeira na primeira linha.",
       "F2 a tabela que chegou numa linha so (copia do chat) vira uma linha por linha: " + JSON.stringify(en2));
    ok(api.qsTabelaEmLinhas("a | b sem separador | c | d") === "a | b sem separador | c | d", "F2a sem o separador '---', nada muda");
    /* a tela: tabela de verdade, e o texto inteiro continua lá (na mesma ordem) */
    const caixa = doc.createElement("div");
    const el = api.fmtMontar(caixa, en1);
    ok(el.textContent === en1, "F3 nenhuma letra some nem muda de lugar (o grifo e o lapis guardam posicoes): " + JSON.stringify(el.textContent));
    const tabs = todos(el, (e) => tag(e) === "TABLE");
    const ths = todos(el, (e) => tag(e) === "TH"), tds = todos(el, (e) => tag(e) === "TD" && !/qs-tab-sep/.test(cls(e.parentNode || {})));
    ok(tabs.length === 1 && /qs-tab/.test(cls(tabs[0])) && ths.length === 3, "F3a uma tabela, com o cabecalho P, Q, ~Q → P: " + tabs.length + " · " + ths.length);
    ok(ths.map((h) => todos(h, (x) => /qs-fmt-oc/.test(cls(x))).length).every((n) => n >= 1), "F3b as barras '|' ficam escondidas dentro das celulas");
    ok(/~Q → P/.test(ths[2].textContent) && tds.some((d) => /^\s*x\s*\|?/.test(d.textContent)), "F3c as celulas trazem o conteudo: " + ths[2].textContent);
    /* expoente e fórmula */
    const s1 = "M = C(1+i)^n e VP = VF/(1+i)^{12}; x^2 + 2^10";
    const e1 = api.fmtMontar(doc.createElement("div"), s1);
    const sups = todos(e1, (e) => tag(e) === "SUP");
    ok(e1.textContent === s1 && sups.map((x) => x.textContent).join(",") === "n,12,2,10", "F4 '^n', '^{12}', '^2' e '^10' viram expoente, sem perder letra: " + sups.map((x) => x.textContent).join(","));
    ok(!api.fmtTemAlgo("p ^ q é a conjunção") && !api.fmtPedacos("p ^ q", 0, 5).length, "F4a o '^' solto (o 'e' da logica, com espaco) nao e expoente");
    ok(!api.fmtTemAlgo("pagou R$1.000 e depois R$2.000") && !api.fmtTemAlgo("de R$ 10 a R$ 20"), "F4b dinheiro nao e formula");
    const s2 = "A negação é $\\sim(p \\wedge q) \\equiv \\sim p \\vee \\sim q$, pela lei.";
    const e2 = api.fmtMontar(doc.createElement("div"), s2);
    const tx = todos(e2, (e) => /qs-tex/.test(cls(e)) && !/qs-fmt-oc/.test(cls(e)));
    const f = tx[0] && tx[0].getAttribute("data-f");
    ok(e2.textContent === s2 && tx.length === 1 && /∧/.test(f) && /≡/.test(f) && /∨/.test(f), "F5 LaTeX vira simbolo (por CSS, sem texto a mais): " + f);
    ok(!api.fmtTemAlgo("Texto comum, sem nada.") && api.fmtBlocos("um\ndois").length === 1, "F6 texto comum continua um no de texto so");
    /* o grifo POR CIMA da tabela: as posições continuam as do texto */
    const ini = en1.indexOf("~Q → P"), fim = ini + "~Q → P".length;
    api.grAcrescentar("qF", en1, ini, fim, "amarelo");
    const cxG = doc.createElement("div");
    api.grPintar(cxG, "qF", en1);
    const marks = todos(cxG, (e) => tag(e) === "MARK");
    ok(cxG.textContent === en1 && marks.length === 1 && marks[0].textContent === "~Q → P", "F7 o grifo pinta dentro da celula da tabela: " + (marks[0] && marks[0].textContent));
    const noMark = marks[0] && marks[0].childNodes[0];
    ok(noMark && api.grPosicaoDe(cxG, noMark, 0) === ini, "F7a a selecao dentro da tabela vira a posicao certa no texto: " + (noMark && api.grPosicaoDe(cxG, noMark, 0)) + " ≠ " + ini);
    /* o pedido à IA */
    ok(/FÓRMULAS E TABELAS/.test(api.t("qs_prompt")) && /\| --- \| --- \| --- \|/.test(api.t("qs_prompt")) && /nunca LaTeX/.test(api.t("qs_prompt")) && /FÓRMULAS E TABELAS/.test(api.t("qs_prompt_caderno")),
       "F8 o pedido de questoes ensina simbolos e tabela em linhas (e proibe LaTeX)");
    /* o editor de questão (dúvidas): fileira e atalhos */
    const campo = api.$("txtLivreCampo");
    api.simbLigarCampo(campo, true);
    ok(campo._simbFila && campo._simbFila.hidden === false && campo._simbLigado === true, "F9 o editor de questao ganha a fileira de simbolos");
    api.simbLigarCampo(campo, false);
    ok(campo._simbFila.hidden === true && campo._simbLigado === false, "F9a e ela some nos outros usos da caixa de texto");
  }
  /* ===================================================================
   * (19.117.0) "CRIADAS EM": as questões de uma criação — ver, apagar todas, refazer
   * O relato: "não existe um modo simples de acessar a lista de questões que criei e ficou com erro para apagá-la e
   * refazer".
   * =================================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("Raciocínio Lógico", "Proposições");
    api.matGravar(ch, "x", { disciplina: "Raciocínio Lógico", topico: "Proposições" });
    const ctx = { disciplina: "Raciocínio Lógico", topico: "Proposições", chave: ch };
    const bloco = (k) => "[QUESTAO]\nTIPO: CE\nENUNCIADO: Afirmacao numero " + k + " sobre proposicoes, com texto suficiente para valer.\nGABARITO: C\nCOMENTARIO: ok " + k + ".\n[/QUESTAO]";
    const r1 = api.qsAplicar(api.qsLerResposta([1, 2, 3].map(bloco).join("\n"), ctx).achados);
    const r2 = api.qsAplicar(api.qsLerResposta([4, 5].map(bloco).join("\n"), ctx).achados);
    ok(r1.novas === 3 && r2.novas === 2 && r1.lote && r2.lote && r1.lote !== r2.lote, "L1 cada gravacao e uma criacao (lote) propria: " + r1.lote + " · " + r2.lote);
    ok(api.qsFiltrar({ lote: r1.lote }).length === 3 && api.qsFiltrar({ lote: r2.lote }).length === 2, "L1a o filtro do lote traz so as daquela criacao");
    /* as de antes desta versão (sem a marca): agrupadas pelo minuto e pelo tópico */
    const antigas = api.qsTodas().filter((q) => q.lote === r2.lote);
    antigas.forEach((q) => { delete q.lote; q.criado = "2026-10-01T10:15:" + (q === antigas[0] ? "05" : "48") + ".000Z"; });
    const idAnt = api.qsLoteDe(antigas[0]);
    ok(idAnt && idAnt === api.qsLoteDe(antigas[1]) && api.qsFiltrar({ lote: idAnt }).length === 2, "L2 as antigas da mesma colagem (mesmo minuto e topico) viram uma criacao: " + idAnt);
    const ls = api.qsLotes();
    ok(ls.length === 2 && ls[0].id === r1.lote && ls[0].n === 3 && ls[0].topico === "Proposições" && ls[1].n === 2, "L2a as criacoes, da mais nova para a mais velha: " + JSON.stringify(ls.map((g) => [g.n, g.quando])));
    /* a biblioteca com a criação escolhida */
    api.qsUiVerLote(r1.lote);
    ok(api.qsUiFiltroAtual().lote === r1.lote && api.$("qsLoteAcoes").hidden === false, "L3 'ver estas na biblioteca' abre a biblioteca so com a criacao");
    const kids = (el) => Array.from(el.childNodes || el.children || []);
    const bA = kids(api.$("qsLoteAcoes")).filter((b) => b.id === "btnQsLoteApagar")[0];
    const bR = kids(api.$("qsLoteAcoes")).filter((b) => b.id === "btnQsLoteRefazer")[0];
    ok(bA && /apagar estas 3/.test(bA.textContent) && bR, "L3a a faixa da criacao: apagar as 3 de uma vez e refazer: " + (bA && bA.textContent));
    ok(/Criadas em/.test(api.$("qsChips").textContent || "") || kids(api.$("qsChips")).some((c) => /Criadas em/.test(c.textContent)), "L3b a etiqueta do filtro diz 'Criadas em'");
    /* apagar todas de uma vez: uma confirmação, todas para a lixeira */
    const antes = api.qsTodas().length;
    const p = api.qsUiApagarLote(api.qsFiltrar({ lote: r1.lote }).map((q) => q.id));
    await Promise.resolve();
    api._uiFechar(true);
    const n = await p;
    ok(n === 3 && api.qsTodas().length === antes - 3 && api.qsUiFiltroAtual().lote === "", "L4 uma confirmacao apaga as 3 juntas e a biblioteca volta sem o filtro: " + n);
    api._uiFechar(true);
    const lix = typeof api.lixLer === "function" ? (api.lixLer() || []) : null;
    ok(lix && lix.filter((x) => x.tipo === "questao").length >= 3, "L4a as apagadas vao para a lixeira (podem voltar): " + (lix && lix.length));
    /* refazer: a criação de questões no mesmo tópico */
    api.qsUiVerLote(idAnt);
    const g = api.qsLotes(api.qsFiltrar({ lote: idAnt }))[0];
    ok(api.qsUiRefazerLote(g) === true && api.$("dlgQsCriar").open === true, "L5 refazer abre a criacao de questoes no mesmo topico");
    api.$("dlgQsCriar").close && api.$("dlgQsCriar").close();
  }

  /* ===================================================================
   * (19.120.0) QUESTÕES PRONTAS, DIRETO DO PDF
   * O pedido: "ajudar o usuário a extrair questões de um PDF (…) para estudar questões já prontas".
   * O texto abaixo é INVENTADO, no formato medido numa aula real: cabeçalho do curso em toda página (com o número da
   * página enfiado no meio do texto), a marca do comprador (CPF e nome — aqui, fictícios), a questão cortada pela
   * virada de página, as questões repetidas na "Lista de questões" e a tabela de gabarito no fim.
   * =================================================================== */
  {
    const { api } = rodar();
    /* o rodapé real tem seis linhas: curso, site, marca, o número da página, o total e um código */
    const cab = (n) => ["Curso de Teste (Auditor) Noções de Tudo - 2026 (Pó" + n + "s-Edital)", "www.exemplo.com.br", "00000000000 - Fulano de Tal da Silva", String(60 + n), "85", "==1c0de==", "Equipe Exemplo", "Aula 01 - Somente em PDF"];
    const pg = (n, linhas) => cab(n).slice(6).concat(linhas, cab(n).slice(0, 6));
    const Q1 = ["1.\u200b (Questão Inédita) Sobre a organização do Município de Exemplo, assinale a alternativa", "correta:",
      "a) O Município não tem autonomia", "legislativa.", "b) O Município tem auto-organização, autogoverno e autoadministração."];
    const Q1b = ["c) A competência legislativa municipal é residual.", "d\u200b ) Compete ao Município legislar sobre trânsito.", "e) A Lei Orgânica é votada em turno único."];
    const Q2 = ["2. (FGV/2023/Prefeitura de Exemplo) Compete à Câmara Municipal:", "a) sancionar leis.", "b) vetar leis.", "c) criar comissões de inquérito.", "d) nomear secretários.", "e) executar o orçamento."];
    const Q3 = ["3. (CEBRASPE/2024/Exemplo) O controle externo do Município é exercido pela Câmara Municipal com", "o auxílio do Tribunal de Contas dos Municípios."];
    const paginas = [
      pg(1, ["TEORIA", "Os Municípios são entes federativos.", "1. Auto-organização: elaboram a Lei Orgânica."]),
      pg(2, ["QUESTÕES COMENTADAS"].concat(Q1)),
      /* nesta página o bloco de cabeçalho e rodapé vem NO MEIO do texto, como numa página do PDF real */
      Q1b.concat(["Comentários:", "A letra A está errada. O Município também legisla."], cab(3).slice(6), cab(3).slice(0, 6),
        ["A letra B está correta. São as três aptidões da", "==1c0de==", "autonomia.", "A letra C está errada."]),
      pg(4, Q2.concat(["Comentários", "A Câmara fiscaliza. Gabarito: letra C.", "As demais são atribuições do Prefeito."],
        Q3, ["Comentários:", "Em Pernambuco não há Tribunal de Contas dos Municípios.", "Gabarito: Errado"])),
      pg(5, ["LISTA DE QUESTÕES"].concat(Q1, Q1b, Q2, Q3)),
      pg(6, ["GABARITO", "1. B 3. E", "2. D"]),
    ];
    const L = api.qsPdfLimpar(paginas);
    ok(L.marcas === 6 && L.linhas.every((l) => !/\d{11}/.test(l) && !/Fulano/.test(l)), "P1 a marca do comprador (CPF e nome) sai de todas as páginas: " + L.marcas);
    ok(L.linhas.every((l) => !/Pó\d*s-Edital|exemplo\.com\.br|Equipe Exemplo|Somente em PDF|^\d+$|==/.test(l)) && L.linhas.indexOf("TEORIA") >= 0,
      "P1a cabeçalho e rodapé repetidos saem (mesmo com o número da página no meio do texto); o conteúdo fica: " + L.cabecalhos);
    const r = api.qsPdfExtrair(paginas);
    ok(r.questoes.length === 3 && r.questoes.map((q) => q.n).join() === "1,2,3", "P2 três questões (as da 'Lista de questões' não duplicam; o '1. Auto-organização' da teoria não é questão): " + r.questoes.map((q) => q.n).join());
    const q1 = r.questoes[0], q2 = r.questoes[1], q3 = r.questoes[2];
    ok(q1.opcoes.length === 5 && q1.opcoes[0].txt === "O Município não tem autonomia legislativa." && q1.opcoes[3].letra === "D" && /trânsito/.test(q1.opcoes[3].txt),
      "P2a as cinco alternativas, com a linha quebrada junta e a virada de página no meio: " + JSON.stringify(q1.opcoes.map((o) => o.letra + ":" + o.txt.slice(0, 18))));
    ok(q1.situacao === "conferido" && q1.gabarito === "B" && q1.gabTabela === "B" && q1.gabComentario === "B", "P3 gabarito conferido nos dois lugares (tabela B = 'A letra B está correta')");
    ok(q2.situacao === "diverge" && q2.gabarito === "D" && q2.gabComentario === "C" && q2.origem === "FGV/2023/Prefeitura de Exemplo", "P3a tabela D × comentário C: sai marcada 'a conferir', com a banca lida do parêntese: " + [q2.situacao, q2.gabarito, q2.gabComentario, q2.origem].join(" | "));
    ok(q3.tipo === "ce" && q3.gabarito === "E" && q3.situacao === "conferido" && !q3.opcoes.length, "P3b certo/errado: 'Gabarito: Errado' = E da tabela");
    ok(r.resumo.achadas === 3 && r.resumo.conferidas === 2 && r.resumo.divergem.join() === "2" && r.resumo.semGabarito.length === 0 && r.resumo.marcas === 6, "P3c o resumo conta: " + JSON.stringify(r.resumo));
    /* o texto é o que a criação de questões já lê */
    const lido = api.qsLerResposta(r.texto, { disciplina: "D", topico: "T", chave: api.matChave("D", "T") });
    ok(lido.achados.length === 3 && lido.ignoradas.length === 0, "P4 o texto gerado é lido inteiro pela criação de questões, sem linha recusada: " + lido.achados.length + " · " + JSON.stringify(lido.ignoradas));
    const a1 = lido.achados[0], a2 = lido.achados[1], a3 = lido.achados[2];
    ok(a1.tipo === "me" && a1.gabarito === "B" && a1.opcoes.length === 5 && /assinale a alternativa correta:$/.test(a1.enunciado) && a1.banca === "Questão Inédita" && /A letra B está correta\. São as três aptidões da autonomia\./.test(a1.comentario),
      "P4a a questão 1 chega inteira (enunciado, 5 alternativas, gabarito B, banca e comentário): " + JSON.stringify([a1.tipo, a1.gabarito, a1.opcoes.length, a1.banca, a1.enunciado.slice(-30)]));
    ok(a2.gabarito === "D" && /A conferir: a tabela de gabarito do PDF diz D e o comentário indica C/.test(a2.comentario) && /Gabarito — letra C/.test(a2.comentario),
      "P4b a divergente avisa no comentário, e o 'Gabarito:' do texto não vira campo (não troca a resposta): " + a2.gabarito + " | " + a2.comentario.slice(0, 120));
    ok(a3.tipo === "ce" && a3.gabarito === "E" && /Tribunal de Contas dos Municípios\.$/.test(a3.enunciado), "P4c a de certo/errado chega com o enunciado junto e gabarito E");
    ok(!/\d{11}|Fulano/.test(r.texto), "P4d nada da marca do comprador no texto que vai para a caixa");
    /* sem gabarito em lugar nenhum: fica de fora e o resumo diz qual */
    const r2 = api.qsPdfExtrair([["QUESTÕES COMENTADAS", "7. (Banca X) Enunciado de teste sem resposta em parte alguma do arquivo.", "a) um", "b) dois", "Comentários:", "Nada aqui decide."]]);
    ok(r2.resumo.semGabarito.join() === "7" && api.qsLerResposta(r2.texto, {}).achados.length === 0, "P5 questão sem gabarito: o resumo diz o número e ela não entra");
    ok(api.qsPdfExtrair([["Só teoria.", "1. Um item de lista.", "2. Outro item."]]).questoes.length === 0, "P5a texto sem questões: nenhuma inventada");
    /* o mesmo enunciado abrindo questões DIFERENTES (a aula real tem três "…assinale a alternativa correta:" iguais) */
    const iguais = api.qsPdfExtrair([["QUESTÕES COMENTADAS",
      "13. (Inédita) Sobre o processo legislativo, assinale a alternativa correta:", "a) Primeira.", "b) Segunda.", "Comentários:", "A letra A está correta.",
      "14. (Inédita) Sobre o processo legislativo, assinale a alternativa correta:", "a) Terceira.", "b) Quarta.", "Comentários:", "A letra B está correta.",
      "LISTA DE QUESTÕES",
      "13. (Inédita) Sobre o processo legislativo, assinale a alternativa correta:", "a) Primeira.", "b) Segunda.",
      "14. (Inédita) Sobre o processo legislativo, assinale a alternativa correta:", "a) Terceira.", "b) Quarta.",
      "GABARITO", "13. A 14. B"]]);
    ok(iguais.questoes.length === 2 && iguais.questoes.map((q) => q.n + q.gabarito + q.situacao).join() === "13Aconferido,14Bconferido",
      "P5b enunciados iguais com alternativas diferentes são questões diferentes; a cópia da lista continua juntando: " + iguais.questoes.map((q) => q.n + q.gabarito + q.situacao).join());
    /* a tela: o arquivo escolhido enche a caixa, diz o que leu e confere */
    api.matIniciar(); api.qsUiIniciar();
    ok(typeof api.$("btnQsPdf").onclick === "function", "P6 o botão 'importar de PDF' está ligado");
    api.$("qsCriarResposta").value = "";
    const falsoLib = { getDocument: () => ({ promise: Promise.resolve({ numPages: paginas.length,
      getPage: (n) => Promise.resolve({ getTextContent: () => Promise.resolve({ items: paginas[n - 1].map((s2, k) => ({ str: s2, transform: [1, 0, 0, 10, 0, 800 - k * 14], width: 100, height: 10, hasEOL: true })) }) }) }) }) };
    const lidoPdf = await api.qsPdfPaginas(new Uint8Array([1, 2, 3]), { pdfjsLib: falsoLib });
    ok(lidoPdf.paginas.length === 6 && lidoPdf.paginas[1].indexOf("QUESTÕES COMENTADAS") >= 0, "P6a as páginas do PDF viram linhas de texto pelo leitor das leis");
    ok((await api.qsPdfPaginas(new Uint8Array([1]), { pdfjsLib: { getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items: [] }) }) }) }) } })).motivo === "pdf_sem_texto",
      "P6b PDF de imagem (sem texto): diz o motivo em vez de devolver nada");
    ["qs_pdf_btn", "qs_pdf_btn_tip", "qs_pdf_lidas", "qs_pdf_conferidas", "qs_pdf_divergem", "qs_pdf_sem_gab", "qs_pdf_marca", "qs_pdf_nenhuma", "qs_pdf_m_pdf_sem_leitor", "qs_pdf_m_pdf_invalido", "qs_pdf_m_pdf_sem_texto", "qs_pdf_diverge_com", "qs_pdf_lendo", "qs_pdf_so_tabela", "qs_pdf_so_coment"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "P7 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
    ok(/3 questão\(ões\) lida\(s\) em 6 página\(s\)/.test(api.qsPdfFrase(r.resumo)) && /2 com o gabarito conferido/.test(api.qsPdfFrase(r.resumo)) && /a conferir.*nº 2/.test(api.qsPdfFrase(r.resumo)) && /marca do comprador/.test(api.qsPdfFrase(r.resumo)),
      "P7a a frase da tela diz quantas, quantas conferidas, quais a conferir e que a marca saiu: " + api.qsPdfFrase(r.resumo));
  }

  /* ===================================================================
   * (19.122.0) O LIVRO DE FATOS
   * O pedido: "uma forma mais potente de gerar e armazenar dados". Cada resposta e cada revisão de cartão entra uma
   * vez e nunca sai — nem quando a questão é apagada. Um registro por fato; o mesmo fato escrito de novo não duplica.
   * =================================================================== */
  {
    const { api } = rodar();
    /* a loja de mentira (o "disco"): o que está nela sobrevive a recarregar */
    const disco = new Map();
    const antigo = { id: "q|velha|2026-09-01T10:00:00.000Z", k: "q", t: "2026-09-01T10:00:00.000Z", d: "2026-09-01", ch: "d›t", disc: "D", top: "T", qid: "velha", ok: true, resp: "C", gab: "C", tipo: "ce" };
    disco.set(antigo.id, antigo);
    const loja = {
      lerTudo: () => Promise.resolve([...disco.values()]),
      por: (l) => { l.forEach((f) => disco.set(f.id, JSON.parse(JSON.stringify(f)))); return Promise.resolve(true); },
      apagar: (ids) => { ids.forEach((id) => disco.delete(id)); return Promise.resolve(true); },
      limpar: () => { disco.clear(); return Promise.resolve(true); },
    };
    api.fatosLojaDefinir(loja);
    api.matIniciar(); api.qsUiIniciar();
    await api.fatosPronto();
    ok(api.fatosTotal() === 1 && api.fatosLista()[0].qid === "velha", "T1 o livro guardado chega à memória ao abrir (a resposta de uma questão que já não existe continua lá): " + api.fatosTotal());
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    const bloco = (k) => "[QUESTAO]\nTIPO: CE\nENUNCIADO: Afirmacao numero " + k + " sobre o assunto, com texto suficiente para valer.\nGABARITO: C\nCOMENTARIO: ok " + k + ".\n[/QUESTAO]";
    api.qsAplicar(api.qsLerResposta([1, 2, 3].map(bloco).join("\n"), { disciplina: "D", topico: "T", chave: ch }).achados);
    const lista = api.qsTodas().slice();
    api.qsSessaoIniciar(lista, { escopo: "fatos" });
    const q1 = api.qsAtual();
    api.qsResponder("C");
    await api.fatosGravandoAtual();
    const f1 = api.fatosLista({ tipo: "q" }).filter((f) => f.qid === q1.id)[0];
    ok(f1 && f1.ok === true && f1.top === "T" && f1.disc === "D" && f1.gab === "C" && /^\d{4}-\d{2}-\d{2}$/.test(f1.d) && disco.has(f1.id),
      "T2 responder grava o fato na memória e no disco, com tópico, dia e resultado: " + JSON.stringify(f1));
    api.qsMarcarChute(true);
    await api.fatosGravandoAtual();
    ok(api.fatosTotal() === 2 && api.fatosLista().filter((f) => f.qid === q1.id).length === 1 && disco.get(f1.id).chute === true,
      "T2a marcar 'foi chute' corrige o MESMO fato (não vira dois): " + api.fatosTotal());
    /* apagar a questão não apaga o fato */
    api.qsApagarVarias([q1.id]);
    ok(api.fatosLista().some((f) => f.qid === q1.id) && api.qsTodas().every((q) => q.id !== q1.id), "T3 a questão apagada sai do banco e o fato dela fica");
    /* o histórico que já existe: as tentativas guardadas nas questões viram fatos, uma vez só */
    const q2 = api.qsTodas()[0];
    q2.tentativas = [{ q: "2026-10-05T12:00:00.000Z", resp: "E", acertou: false }, { q: "2026-10-06T12:00:00.000Z", resp: "C", acertou: true, chute: true }];
    ok(api.fatosRetroativo() === 2 && api.fatosRetroativo() === 0, "T4 o histórico antigo entra uma vez; rodar de novo não duplica");
    await api.fatosGravandoAtual();
    ok(disco.size === api.fatosTotal() && api.fatosTotal() === 4, "T4a o disco tem os mesmos fatos da memória: " + disco.size + " / " + api.fatosTotal());
    /* as contas: acerto no chute vale 1/4; por tópico; os minutos vêm do diário */
    const todos = api.fatosLista();
    const r = api.fatosResumo(todos);
    ok(r.respostas === 4 && r.certas === 3 && r.chutes === 2 && r.pct === Math.round(((1 + 0.25 + 0.25) / 4) * 100) && r.desde === "2026-09-01",
      "T5 o resumo: 4 respostas, 3 certas (2 no chute, que valem 1/4): " + JSON.stringify(r));
    const mins = api.fatosMinutosDoDiario([{ d: "2026-10-05", c: ch, m: 40, a: "feito" }, { d: "2026-10-06", c: ch, m: 20, a: "pendente" }, { d: "2026-08-01", c: ch, m: 99, a: "feito" }], "2026-09-01", "");
    const pt = api.fatosPorTopico(todos, mins);
    ok(pt.length === 1 && pt[0].top === "T" && pt[0].respostas === 4 && pt[0].minutos === 40 && pt[0].ultimo >= "2026-10-06",
      "T5a por tópico, com o tempo do diário no período ('pendente' e o que é de antes ficam de fora): " + JSON.stringify(pt));
    ok(api.fatosLista({ de: "2026-10-01", ate: "2026-10-05" }).length === 1 && api.fatosLista({ chave: "outro›topico" }).length === 0, "T5b o filtro por período e por tópico");
    /* a revisão de cartão */
    const fc = api.fatoDeCartao({ id: "g1#c1" }, 3, Date.parse("2026-11-01T15:00:00Z"), { chave: ch, disciplina: "D", topico: "T" });
    ok(fc.k === "c" && fc.nota === 3 && fc.ok === true && fc.top === "T" && api.fatoGravar(fc) && api.fatosResumo(api.fatosLista()).cartoes === 1, "T6 a revisão de um cartão é um fato (nota 3 = bom)");
    ok(api.fatoApagar(fc.id) === true && api.fatosResumo(api.fatosLista()).cartoes === 0, "T6a a nota dada por engano sai do livro no 'desfazer'");
    /* o backup leva o livro e o traz de volta */
    const bk = api.montarBackup();
    ok(typeof bk.dados.material.eac_fatos === "string" && JSON.parse(bk.dados.material.eac_fatos).length === 4, "T7 o backup leva o livro de fatos (4 fatos)");
    api.fatosDefinirTudo([]);
    await api.fatosGravandoAtual();
    ok(api.fatosTotal() === 0 && disco.size === 0, "T7-pre livro esvaziado para o teste");
    api.fatosDefinirTudo(JSON.parse(bk.dados.material.eac_fatos));
    await api.fatosGravandoAtual();
    ok(api.fatosTotal() === 4 && disco.size === 4 && api.fatosLista()[0].qid === "velha", "T7a restaurar traz o livro inteiro de volta, na memória e no disco");
    /* a tela */
    api.fatosUiPeriodoDefinir(0);
    api.fatosUiPintar();
    const txt = api.$("fatosCorpo").textContent || "";
    const achaTxt = (el, acc) => { Array.from(el.children || []).forEach((c) => { acc.push(c.textContent || ""); achaTxt(c, acc); }); return acc; };
    const tudo = achaTxt(api.$("fatosCorpo"), []).join(" | ");
    ok(/De onde vêm os números: 4 resposta/.test(tudo) && /4 resposta\(s\)/.test(tudo) && /38% de acerto/.test(tudo) && /menos de 5 respostas|T/.test(tudo),
      "T8 a tela diz de onde vêm os números antes dos números, e mostra o período: " + (txt || tudo).slice(0, 200));
    const csv = api.fatosUiCsv().split("\n");
    ok(csv.length === 2 && /^disciplina;topico;respostas/.test(csv[0]) && /"D";"T";4;3;2;38;0;/.test(csv[1]), "T8a a tabela copiada para planilha: " + csv[1]);
    api.fatosUiResumoLinha();
    ok(/4 resposta\(s\) e 0 revisão/.test(api.$("fatosResumoLinha").textContent), "T8b a linha ao lado do botão resume o livro: " + api.$("fatosResumoLinha").textContent);
    ["fatos_btn", "fatos_titulo", "fatos_fonte", "fatos_limite", "fatos_pouco", "fatos_csv", "fatos_sem_espaco", "idb_gaveta_fatos", "fatos_c_acerto", "fatos_h_ultimo"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "T9 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  /* ===================================================================
   * (19.123.0) PREPARAR O TÓPICO — um pedido, uma resposta, uma conferência, um gravar
   * O relato: "passo 30% do meu tempo para criar o material de estudo. Criando questões, criando resumo, criando
   * cartões". Eram três criações por ramo, cada uma com a sua ida e volta à IA.
   * =================================================================== */
  {
    const { api } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("Tributário", "Crédito tributário");
    api.matGravar(ch, "", { disciplina: "Tributário", topico: "Crédito tributário" });
    const ramos = [{ id: api.edRamoId("Suspensão da exigibilidade"), nome: "Suspensão da exigibilidade", nota: "art. 151" }, { id: api.edRamoId("Extinção do crédito"), nome: "Extinção do crédito" }];
    const ctx = { disciplina: "Tributário", topico: "Crédito tributário", chave: ch, editalId: "", concurso: "ISS Teste", ramos };
    /* o pedido único */
    const tags = ["disc_Tributario", "top_Credito_tributario"];
    const ped = api.prepPedido({ disciplina: "Tributário", topico: "Crédito tributário", concurso: "ISS Teste", ramos, partes: { resumo: true, questoes: true, cartoes: true }, fonte: "anexo", tags });
    ok(/RESPONDA SÓ COM OS BLOCOS/.test(ped) && /\[RESUMO\]/.test(ped) && /\[QUESTOES\]/.test(ped) && /\[CARTOES\]/.test(ped) && !/\[RAMOS\]/.test(ped),
      "Q1 o pedido único pede os três blocos (e não pede ramos quando o tópico já tem)");
    ok(/- Suspensão da exigibilidade — art\. 151/.test(ped) && /- Extinção do crédito/.test(ped) && /disc_Tributario top_Credito_tributario/.test(ped) && /material que estou enviando junto/.test(ped) && /FALTA:/.test(ped),
      "Q1a leva os ramos (com a nota), as etiquetas dos cartões, a fonte escolhida e a regra do FALTA");
    const ped2 = api.prepPedido({ disciplina: "D", topico: "T", ramos: [], partes: { questoes: true }, fonte: "resumo", texto: "O TEXTO DO RESUMO", tags: [] });
    ok(/\[RAMOS\]/.test(ped2) && /ainda não foi dividido/.test(ped2) && !/\[CARTOES\]/.test(ped2) && !/\[RESUMO\]\n# Resumo geral/.test(ped2) && /TEXTO:\nO TEXTO DO RESUMO$/.test(ped2),
      "Q1b sem ramos, pede a divisão; só as partes marcadas; com o resumo como fonte, o texto vai no fim");
    /* a resposta única */
    const RESP = [
      "[RESUMO]", "# Resumo geral", "O crédito nasce com o lançamento.", "## Ramo — Suspensão da exigibilidade", "Moratória e depósito suspendem (art. 151, I e II, do CTN).",
      "## Ramo — Extinção do crédito", "Pagamento extingue (art. 156, I, do CTN).", "[/RESUMO]",
      "[QUESTOES]",
      "[QUESTAO]", "TIPO: CE", "RAMO: Suspensão da exigibilidade", "BANCA:", "ENUNCIADO: A moratória suspende a exigibilidade do crédito tributário.", "GABARITO: C", "COMENTARIO: Art. 151, I, do CTN.", "[/QUESTAO]",
      "[QUESTAO]", "TIPO: ME", "RAMO: Suspensão da exigibilidade", "ENUNCIADO: Suspende a exigibilidade do crédito:", "A) o pagamento", "B) o depósito do montante integral", "C) a remissão", "GABARITO: B", "COMENTARIO: Art. 151, II, do CTN.", "[/QUESTAO]",
      "[QUESTAO]", "TIPO: CE", "ENUNCIADO: Questão sem gabarito para ficar de fora.", "COMENTARIO: nada.", "[/QUESTAO]",
      "[/QUESTOES]",
      "[CARTOES]", "## Ramo — Suspensão da exigibilidade", "O que suspende a exigibilidade? :: Moratória, depósito integral, reclamações e recursos, liminar e parcelamento. :: disc_Tributario",
      "+ Literalidade — art. 151 do CTN", "", "Certo ou errado: o depósito parcial suspende? :: ERRADO — só o montante integral. :: disc_Tributario",
      "## Ramo — Extinção do crédito", "O que extingue o crédito? :: Pagamento, compensação, transação e remissão, entre outros. :: disc_Tributario", "[/CARTOES]",
      "FALTA: questões do ramo Extinção do crédito",
    ].join("\n");
    const l = api.prepLerResposta(RESP, ctx, { resumo: true, questoes: true, cartoes: true });
    const n = api.prepContagem(l);
    ok(n.questoes === 2 && n.cartoes === 3 && n.resumo === 3 && n.avisos === 1 && l.falta.length === 1,
      "Q2 a resposta única é separada pelos blocos e lida pelos leitores de sempre: " + JSON.stringify(n) + " · falta " + JSON.stringify(l.falta));
    ok(l.questoes.achados.every((q) => q.ramo === ramos[0].id) && l.questoes.achados[1].opcoes.length === 3 && l.cartoes.cartoes[0].card.more && l.cartoes.cartoes[2].ramoId === ramos[1].id,
      "Q2a cada questão e cada cartão chega ligado ao ramo; o '+' fica no cartão dele");
    const cob = l.cobertura;
    ok(cob.length === 2 && cob[0].resumo && cob[0].questoes === 2 && cob[0].cartoes === 2 && cob[1].resumo && cob[1].questoes === 0 && cob[1].cartoes === 1,
      "Q3 a cobertura é medida pelo app, ramo a ramo (o segundo ramo ficou sem questão): " + JSON.stringify(cob));
    const cont = api.prepPedidoContinuar(ctx, cob, { resumo: true, questoes: true, cartoes: true });
    ok(/SOMENTE o que falta/.test(cont) && /- Extinção do crédito: as questões/.test(cont) && !/Suspensão/.test(cont), "Q3a o pedido da continuação traz só o que falta: " + cont.split("\n").slice(1, 3).join(" | "));
    ok(api.prepLerResposta(ped, ctx).ehPedido === true && api.prepLerResposta("", ctx).vazio === true, "Q3b o pedido colado no lugar da resposta é reconhecido; vazio é vazio");
    /* gravar tudo, de uma vez */
    const rec = api.prepGravar(l, ctx, {});
    const reg0 = api.matObter(ch);
    const qs = api.qsTodas().filter((q) => q.chave === ch);
    ok(qs.length === 2 && qs.every((q) => q.ramo === ramos[0].id && q.lote === rec.questoes.lote), "Q4 as questões entram com o ramo e a marca da criação");
    ok(api.matContarCartoes(ch) === 3 && new RegExp("ram_" + ramos[0].id).test(reg0.cartoes) && new RegExp("ram_" + ramos[1].id).test(reg0.cartoes) && /disc_Tributario/.test(reg0.cartoes) && /\+ Literalidade — art\. 151 do CTN/.test(reg0.cartoes),
      "Q4a os cartões entram com as etiquetas do tópico e a do ramo, e o 'saiba mais' junto: " + String(reg0.cartoes).split("\n")[0]);
    ok(/O crédito nasce com o lançamento/.test(reg0.texto) && /## Ramo — Suspensão da exigibilidade\nMoratória/.test(reg0.texto) && /## Ramo — Extinção do crédito\nPagamento/.test(reg0.texto),
      "Q4b o resumo entra em seções por ramo: " + String(reg0.texto).slice(0, 90).replace(/\n/g, " ⏎ "));
    /* preparar de novo o mesmo: nada dobra */
    const l2 = api.prepLerResposta(RESP, ctx, { resumo: false, questoes: true, cartoes: true });
    ok(l2.cartoes.cartoes.length === 0 && l2.cartoes.repetidos === 3 && l2.resumo === null, "Q5 os cartões que já existem ficam de fora (e a parte desmarcada não é lida): " + l2.cartoes.repetidos);
    /* o que o ramo JÁ TEM conta na cobertura: o segundo ramo tem 1 cartão de antes e nenhuma questão */
    ok(l2.cobertura[0].tinhaQ === 2 && l2.cobertura[0].tinhaC === 2 && l2.cobertura[1].tinhaQ === 0 && l2.cobertura[1].tinhaC === 1,
      "Q5b a cobertura conta o que cada ramo já tinha: " + JSON.stringify(l2.cobertura.map((x) => [x.tinhaQ, x.tinhaC])));
    const cont2 = api.prepPedidoContinuar(ctx, l2.cobertura, { questoes: true, cartoes: true });
    ok(/- Extinção do crédito: as questões$/m.test(cont2) && !/Suspensão/.test(cont2) && !/os cartões/.test(cont2), "Q5c e o pedido do que falta não repete o que o ramo já tem: " + cont2.split("\n").slice(1, 3).join(" | "));
    const rec2 = api.prepGravar(l2, ctx, {});
    ok(rec2.questoes.novas === 0 && rec2.questoes.repetidas === 2 && api.qsTodas().filter((q) => q.chave === ch).length === 2, "Q5a as questões repetidas também não dobram");
    /* desfazer */
    ok(api.prepDesfazer(rec) === true && api.qsTodas().filter((q) => q.chave === ch).length === 0 && api.matContarCartoes(ch) === 0 && !String((api.matObter(ch) || {}).texto || "").trim(),
      "Q6 desfazer tira as questões e os cartões e devolve o resumo como estava");
    /* sem ramos: a IA sugere; sem edital aberto, o material entra no tópico inteiro */
    const ctx0 = Object.assign({}, ctx, { ramos: [] });
    const l3 = api.prepLerResposta("[RAMOS]\n- Lançamento\n- Garantias\n[/RAMOS]\n[QUESTOES]\n[QUESTAO]\nTIPO: CE\nRAMO: Lançamento\nENUNCIADO: O lançamento é atividade vinculada e obrigatória.\nGABARITO: C\nCOMENTARIO: Art. 142 do CTN.\n[/QUESTAO]\n[/QUESTOES]", ctx0, { questoes: true });
    ok(l3.ramosNovos.length === 2 && l3.questoes.achados[0].ramo === api.edRamoId("Lançamento") && l3.cobertura.length === 2 && l3.cobertura[0].novo === true && l3.cobertura[1].questoes === 0,
      "Q7 os ramos sugeridos entram na cobertura e as questões já apontam para eles: " + JSON.stringify(l3.cobertura));
    const rec3 = api.prepGravar(l3, ctx0, {});
    ok(rec3.ramos === 0 && api.qsTodas().filter((q) => q.chave === ch)[0].ramo === undefined, "Q7a sem edital aberto os ramos não são criados, e a questão não fica presa a um ramo que não existe");
    /* a tela */
    ok(api.prepAbrir(ctx) === true && api.$("dlgPreparar").open === true && /Preparar o tópico: Crédito tributário/.test(api.$("prepTit").textContent) && api.$("btnPrepGravar").disabled === true,
      "Q8 a janela abre no tópico, com o gravar desligado até haver o que gravar");
    ok(api.$("prepPResumo").checked === true && api.$("prepFonte_resumo").disabled === true && api.$("prepFonte_anexo").checked === true, "Q8a sem resumo, ele é pedido e a fonte é o material enviado junto");
    api.$("prepResposta").value = RESP;
    api.prepConferir();
    ok(api.$("btnPrepGravar").disabled === false && /2 questões · 3 cartões · 3 partes de resumo/.test(api.$("btnPrepGravar").textContent) && api.$("btnPrepContinuar").hidden === false,
      "Q8b conferida, o botão diz o que vai gravar e o pedido do que falta aparece: " + api.$("btnPrepGravar").textContent);
    await api.prepAplicar();
    ok(/Gravado: 2 questão\(ões\) e 3 cartão\(ões\), resumo acrescentado/.test(api.$("prepMsg").textContent) && api.$("btnPrepDesfazer").hidden === false && api.$("prepResposta").value === "",
      "Q8c gravar tudo de uma vez diz o que entrou e deixa o desfazer à mão: " + api.$("prepMsg").textContent);
    ok(typeof api.$("btnMatFichaPreparar").onclick === "function", "Q8d a ficha do tópico tem o botão 'preparar o tópico' ligado");
    ["prep_btn", "prep_titulo", "prep_p_intro", "prep_p_blocos", "prep_p_b_resumo", "prep_p_b_questoes", "prep_p_b_cartoes", "prep_p_cobertura", "prep_p_continuar", "prep_cob_tit", "prep_gravado", "prep_c_sem_blocos"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "Q9 falta " + k + " em " + lg); }));
    api.setLanguage("en");
    ok(api.prepLerResposta(api.prepPedido({ disciplina: "D", topico: "T", ramos: [], partes: { questoes: true }, fonte: "anexo", tags: [] }), ctx).ehPedido === true, "Q9a o pedido em inglês também é reconhecido como pedido");
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };