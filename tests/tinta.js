/* =====================================================================
 * O LÁPIS POR CIMA DA QUESTÃO (v19.7.0)
 *
 * O PEDIDO: um lápis como o do caderno da Literalidade (lápis, marca-texto, borracha, mão, 6 cores, espessura,
 * desfazer, apagar) para marcar direto sobre a questão.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. o traço é guardado PRESO A UMA LETRA (bloco + posição) em "em", e redesenhado a partir dela: o texto andou
 *     (refluxo, letra maior), o traço anda junto — o defeito que derrubou o canvas antigo não volta;
 *  2. lápis e marca-texto desenham; a mão não; a borracha apaga só o pedaço que tocou (até o meio de uma reta);
 *  3. desfazer, apagar tudo (com desfazer), um conjunto de traços por questão (ir e voltar mantém);
 *  4. a camada volta a cada repintura da questão; fechar o lápis devolve o toque à página e mantém os traços;
 *  5. com caneta de tablet, o dedo não risca; com a barra aberta P/M/R/H e Ctrl+Z são do lápis e A–E continuam
 *     respondendo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const perto = (a, b) => Math.abs(a - b) < 0.02;

  /* ---- matemática pura ---- */
  {
    const { api } = rodar();
    const org = { x: 100, y: 200 };
    const rel = api.tnRelativos([[116, 232], [148, 200]], org, 16);
    ok(perto(rel[0][0], 1) && perto(rel[0][1], 2) && perto(rel[1][0], 3) && perto(rel[1][1], 0), "M1 relativos em em: " + JSON.stringify(rel));
    const abs = api.tnAbsolutos(rel, { x: 10, y: 20 }, 20);
    ok(perto(abs[0][0], 30) && perto(abs[0][1], 60), "M1a de volta, com outra origem e outra letra: " + JSON.stringify(abs));
    const reta = []; for (let i = 0; i <= 50; i++) reta.push([i * 2, 10]);
    ok(api.tnSimplificar(reta, 0.8).length === 2, "M2 uma reta simplifica para as duas pontas");
    const canto = reta.concat([[100, 30], [100, 60]]);
    ok(api.tnSimplificar(canto, 0.8).length === 3, "M2a o canto fica");
    ok(api.tnDensificar([[0, 0], [20, 0]], 4).length >= 5, "M3 densificar põe pontos no meio");
    const pt = api.tnPartir(api.tnDensificar([[0, 0], [40, 0]], 2), 20, 0, 5);
    ok(pt.length === 2 && pt[0][pt[0].length - 1][0] < 15 && pt[1][0][0] > 25, "M3a a borracha parte a reta em duas");
    ok(/^M0 0Q/.test(api.tnCaminho([[0, 0], [5, 5], [10, 0]])) && /^M1 1l/.test(api.tnCaminho([[1, 1]])), "M4 caminho SVG");
    api.tnCanetaReset();
    let agora = 10000;
    api.tnRelogioDefinir(() => agora);
    ok(api.tnAceitaPonteiro({ pointerType: "touch", button: 0 }) === true, "M5 sem caneta, o dedo desenha");
    ok(api.tnAceitaPonteiro({ pointerType: "pen", button: 0 }) === true && api.tnAceitaPonteiro({ pointerType: "touch", button: 0 }) === false,
      "M5a com a caneta em uso, o dedo (a palma) não risca");
    agora += 1400;
    ok(api.tnAceitaPonteiro({ pointerType: "touch", button: 0 }) === false, "M5c ainda dentro de 1,5 s da caneta: palma");
    agora += 200;
    ok(api.tnAceitaPonteiro({ pointerType: "touch", button: 0 }) === true,
      "M5d (v19.12.3) passado 1,5 s sem sinal da caneta, o dedo VOLTA a desenhar — antes, ver a caneta uma vez bloqueava o dedo para sempre");
    ok(api.tnAceitaPonteiro({ pointerType: "mouse", button: 2 }) === false, "M5b botão direito não desenha");
    api.tnRelogioDefinir(null);
    api.tnCanetaReset();
  }

  /* ---- na questão, com geometria conhecida ---- */
  {
    const { api, janela } = rodar();
    api.matIniciar(); api.qsUiIniciar();
    const ch = api.matChave("D", "T");
    api.matGravar(ch, "x", { disciplina: "D", topico: "T" });
    api.matAbrirEditor({ disciplina: "D", nome: "T" }, "ler");
    const txt = [1, 2].map((i) => "? CE :: FGV :: Afirmacao numero " + i + " para responder com calma.\n= C :: comentario " + i).join("\n\n");
    api.qsAplicar(api.qsLerResposta(txt, { disciplina: "D", topico: "T", chave: ch }).achados);
    api.qsUiResponderDoTopico();
    /* o enunciado: n letras por linha, letra de 8px (×em/16), linha de 24px; o texto anda quando dx/dy/em/n mudam */
    const g = { dx: 0, dy: 0, em: 16, n: 50 };
    const cw = () => 8 * g.em / 16, lh = () => 24 * g.em / 16;
    api.tnGeoDefinir({
      base: () => ({ x: 0, y: 0 }),
      blocos: (corpo) => { const en = corpo.querySelectorAll(".qs-enunciado")[0]; return en ? [{ id: "en", el: en }] : []; },
      caixa: () => ({ l: g.dx, t: 100 + g.dy, r: g.dx + g.n * cw(), b: 100 + g.dy + 4 * lh() }),
      em: () => g.em,
      /* palavras de 4 letras e um espaço: "abcd abcd …" (a letra 10 é começo de palavra; a 28, fim) */
      texto: () => "abcd ".repeat(60),
      letraEm: (el, x, y) => Math.max(0, Math.floor((y - 100 - g.dy) / lh())) * g.n + Math.min(g.n - 1, Math.max(0, Math.floor((x - g.dx) / cw()))),
      letraCaixa: (el, i) => ({ x: (i % g.n) * cw() + g.dx, y: 100 + g.dy + Math.floor(i / g.n) * lh() }),
      linhas: (el, i, j) => {
        const out = [];
        for (let k = i; k <= j; k++) {
          const ln = Math.floor(k / g.n), x = (k % g.n) * cw() + g.dx, t = 100 + g.dy + ln * lh();
          const u = out.filter((o) => o.ln === ln)[0];
          if (u) u.r = x + cw(); else out.push({ ln, l: x, r: x + cw(), t, b: t + lh() });
        }
        return out;
      },
    });
    const corpo = api.$("qsSessCorpo");
    const svg = () => corpo.querySelectorAll("svg")[0];
    ok(svg() && /tn-camada/.test(svg().getAttribute("class") || ""), "Q1 a questão tem a camada do lápis");
    const bt = corpo.querySelectorAll("button").filter((b) => b.id === "btnQsTinta")[0];
    ok(bt && /✏/.test(bt.textContent), "Q1a o ✏️ está à vista, na linha de cima");
    bt.onclick({ stopPropagation() {} });
    ok(api.tnAbertaAgora() && api.$("tnBarra") && !api.$("tnBarra").hidden, "Q2 o ✏️ abre a barra");
    ["btnTnLapis", "btnTnMarca", "btnTnBorracha", "btnTnMao", "btnTnDesfazer", "btnTnLimpar", "btnTnFechar", "tnEspessura"].forEach((id) => ok(api.$(id), "Q2a falta " + id));
    ok(api.TN_CORES.length === 6 && api.TN_CORES.every((c) => api.$("btnTnCor_" + c.id)), "Q2b seis cores");
    ok(/tn-ativa/.test(svg().getAttribute("class")), "Q2c com o lápis, a camada pega o ponteiro");
    api.tnFerramenta("lapis");
    const ev = (x, y, extra) => Object.assign({ clientX: x, clientY: y, pointerType: "mouse", button: 0, pointerId: 1, preventDefault() {} }, extra || {});
    /* evento sem agrupados (lista vazia, como o sintético): conta o próprio evento */
    api.tnComecar(ev(40, 120)); api.tnMover(ev(80, 120, { getCoalescedEvents: () => [] })); api.tnMover(ev(120, 140)); api.tnSoltar();
    ok(api.tnTracos()[0].pts.length === 3, "Q3c lista de agrupados vazia não perde o ponto: " + api.tnTracos()[0].pts.length);
    api.tnDesfazer();
    /* um traço TORTO (não é sublinhado): fica como desenhado, preso à letra do começo */
    api.tnComecar(ev(40, 120)); api.tnMover(ev(80, 150)); api.tnMover(ev(120, 120)); api.tnSoltar();
    const tr = api.tnTracos()[0];
    ok(api.tnContar() === 1 && tr.anc.b === "en" && tr.anc.i === 5 && tr.f === "lapis", "Q3 o traço fica preso à letra 5 do enunciado: " + JSON.stringify(tr && tr.anc));
    ok(perto(tr.pts[0][0], 0) && perto(tr.pts[0][1], 1.25), "Q3a em em, relativo à letra: " + JSON.stringify(tr.pts));
    const d0 = svg().querySelectorAll("path")[0].getAttribute("d");
    ok(/^M40 120/.test(d0), "Q3b desenhado onde foi feito: " + d0);
    /* o texto refluiu: 30px para baixo e 10 para a direita */
    g.dx = 10; g.dy = 30;
    api.tnPintar();
    ok(/^M50 150/.test(svg().querySelectorAll("path")[0].getAttribute("d")), "Q4 o texto andou e o traço andou junto: " + svg().querySelectorAll("path")[0].getAttribute("d"));
    g.em = 32;
    api.tnPintar();
    const d2 = svg().querySelectorAll("path")[0].getAttribute("d");
    ok(/^M90 170/.test(d2), "Q4a letra maior: o traço cresce com ela: " + d2);
    g.dx = 0; g.dy = 0; g.em = 16;
    /* O SUBLINHADO vira "da letra 5 até a 37": a frase passa a ocupar duas linhas e ele vira duas retas sob as mesmas letras */
    api.tnComecar(ev(40, 118)); api.tnMover(ev(170, 119)); api.tnMover(ev(300, 118)); api.tnSoltar();
    const sub = api.tnTracos()[1];
    ok(sub && sub.anc.i === 5 && sub.fim === 37 && sub.pts.length === 0 && sub.dy > 1.1 && sub.dy < 1.2, "L1 o sublinhado guarda as letras das pontas: " + JSON.stringify(sub));
    const ds = () => svg().querySelectorAll("path").map((p) => p.getAttribute("d"));
    ok(ds().length === 2 && /^M40 118(\.\d)?L304 118(\.\d)?$/.test(ds()[1]), "L1a desenhado como reta sob as letras 5 a 37: " + ds().join(" | "));
    g.n = 20;
    api.tnPintar();
    ok(ds().length === 3 && /^M40 118(\.\d)?L160 118/.test(ds()[1]) && /^M0 142(\.\d)?L144 142/.test(ds()[2]), "L2 a frase quebrou em duas linhas: o sublinhado vira duas retas, sob as mesmas letras: " + ds().join(" | "));
    api.tnFerramenta("borracha");
    api.tnComecar(ev(10, 142)); api.tnSoltar();
    ok(api.tnContar() === 1 && api.tnTracos()[0].fim === undefined, "L3 " + JSON.stringify(api.tnTracos().map((x) => x.fim)) + "  a borracha tira o sublinhado inteiro (e deixa o traço torto)");
    api.tnDesfazer();
    ok(api.tnContar() === 2 && api.tnTracos()[1].fim === 37, "L3a desfaz");
    api.tnDesfazer();
    g.n = 50;
    api.tnFerramenta("lapis");
    ok(api.tnContar() === 1, "L4 de volta ao traço torto só");
    /* O CÍRCULO vira "contorno das letras 9 a 27": a frase quebra em duas linhas e ele vira duas elipses em volta delas */
    const circ = (cx, cy, rx, ry, aberto) => {
      const n = aberto ? 14 : 24;
      const p = (k) => ev(cx + rx * Math.cos(Math.PI + k / 24 * Math.PI * 2), cy + ry * Math.sin(Math.PI + k / 24 * Math.PI * 2));
      api.tnComecar(p(0)); for (let k = 1; k <= n; k++) api.tnMover(p(k)); api.tnSoltar();
    };
    circ(150, 112, 80, 18);
    const ct = api.tnTracos()[1];
    ok(ct && ct.forma === "contorno" && ct.anc.i === 10 && ct.fim === 28 && ct.pts.length === 0, "O1 o círculo guarda as letras de dentro, em palavras inteiras (10 a 28): " + JSON.stringify(ct));
    ok(ds().length === 2 && /^M/.test(ds()[1]), "O1a desenhado como elipse");
    /* o mesmo círculo um pouco à direita: por dentro, começa no MEIO da palavra (letra 11) — o contorno volta ao começo dela */
    api.tnDesfazer();
    circ(158, 112, 80, 18);
    ok(api.tnTracos()[1] && api.tnTracos()[1].anc.i === 10 && api.tnTracos()[1].fim === 28, "O1b começou no meio da palavra: o contorno pega a palavra inteira: " + JSON.stringify(api.tnTracos()[1] && [api.tnTracos()[1].anc.i, api.tnTracos()[1].fim]));
    g.n = 20;
    api.tnPintar();
    ok(ds().length === 3, "O2 a frase quebrou: duas elipses, uma por linha: " + ds().length);
    api.tnFerramenta("borracha");
    api.tnComecar(ev(70, 112)); api.tnSoltar();
    ok(api.tnContar() === 1 && !api.tnTracos().some((x) => x.forma), "O3 a borracha tira o contorno inteiro");
    api.tnDesfazer(); api.tnDesfazer();
    g.n = 50;
    api.tnFerramenta("lapis");
    /* um arco ABERTO (seta, meia-volta) não é contorno: fica como desenhado */
    circ(150, 112, 80, 18, true);
    ok(api.tnTracos()[1] && !api.tnTracos()[1].forma && api.tnTracos()[1].fim === undefined && api.tnTracos()[1].pts.length > 3, "O4 traço aberto continua desenho livre");
    api.tnDesfazer();
    ok(api.tnContar() === 1, "O5 de volta ao traço torto só");
    /* O DEFEITO VISTO NO NAVEGADOR: circular a 2ª linha, com a borda de cima do círculo no vão entre as linhas — o canto
     * da caixa em volta caía na 1ª linha e o contorno pegava letras dela. Só as de dentro contam. */
    circ(150, 136, 80, 18);
    const c2 = api.tnTracos()[1];
    ok(c2 && c2.forma === "contorno" && c2.anc.i >= 50 && c2.fim <= 99, "O7 o contorno da 2ª linha não pega letras da 1ª: " + JSON.stringify(c2 && [c2.anc.i, c2.fim]));
    api.tnDesfazer();
    ok(api.tnDentro([5, 5], [[0, 0], [10, 0], [10, 10], [0, 10]]) && !api.tnDentro([15, 5], [[0, 0], [10, 0], [10, 10], [0, 10]]), "O8 dentro/fora do polígono");
    /* um laço pequeno (uma letra "o" escrita à mão, um ponto caprichado) não é contorno */
    circ(150, 112, 11.5, 8);
    ok(api.tnTracos()[1] && !api.tnTracos()[1].forma, "O6 laço pequeno continua desenho livre");
    api.tnDesfazer();
    /* a mão não desenha */
    api.tnFerramenta("mao");
    ok(api.tnComecar(ev(10, 110)) === false && !/tn-ativa/.test(svg().getAttribute("class")), "Q5 a mão não desenha e devolve o toque à página");
    /* marca-texto */
    api.tnFerramenta("marca");
    api.tnComecar(ev(16, 165)); api.tnMover(ev(200, 165)); api.tnSoltar();
    ok(api.tnContar() === 2 && api.tnTracos()[1].f === "marca" && perto(api.tnTracos()[1].larg, 1) && api.tnTracos()[1].fim > api.tnTracos()[1].anc.i, "Q6 marca-texto, mais grosso, preso às letras que cobre");
    ok(/tn-marca/.test(svg().querySelectorAll("path")[1].getAttribute("class")), "Q6a com a classe do marca-texto (translúcido)");
    /* borracha no meio da reta do lápis */
    api.tnFerramenta("borracha");
    api.tnComecar(ev(60, 135)); api.tnSoltar();
    const lap = api.tnTracos().filter((x) => x.f === "lapis");
    ok(lap.length === 2 && api.tnContar() === 3, "Q7 a borracha no meio parte o traço em dois (e não toca o marca-texto): " + api.tnContar());
    api.tnDesfazer();
    ok(api.tnContar() === 2 && api.tnTracos().filter((x) => x.f === "lapis").length === 1, "Q8 desfazer volta a reta inteira");
    api.tnLimpar();
    ok(api.tnContar() === 0, "Q9 apagar tudo");
    api.tnDesfazer();
    ok(api.tnContar() === 2, "Q9a e desfaz");
    /* repintar a questão (escolher uma alternativa) não perde os traços */
    api.qsUiPintarSessao();
    ok(svg() && api.tnPintar() === 2, "Q10 a repintura recria a camada com os traços");
    /* outra questão: outro papel; voltar: os traços continuam */
    const q1 = api.qsAtual().id;
    api.$("btnQsPular").onclick();
    ok(api.qsAtual().id !== q1 && api.tnContar() === 0, "Q11 a próxima questão começa sem traços");
    ok(api.tnTracos(q1).length === 2, "Q11a os da anterior ficam guardados");
    /* (v19.12.2) O RELATO: "só o primeiro risco é mantido completo; os próximos só funcionam no início". O 2º traço
     * começava EM CIMA do 1º: o ponteiro ficava preso no desenho dele, que a pintura seguinte destruía. */
    {
      const camada = api.tnSvgAtual();
      const presos = [];
      camada.setPointerCapture = (id) => presos.push("camada:" + id);
      const desenho = { tagName: "path", setPointerCapture: (id) => presos.push("traço:" + id) };
      api.tnFerramenta("lapis");
      api.tnComecar(ev(40, 120, { target: desenho, pointerId: 9 }));
      ok(presos.join() === "camada:9", "P1 começando em cima de um traço, o ponteiro fica preso na CAMADA, não no traço: " + presos.join());
      const vivo = api.tnPathVivoAtual();
      const nAntes = svg().querySelectorAll("path").length;
      api.tnMover(ev(90, 160, { pointerId: 9 }));
      api.tnMover(ev(140, 125, { pointerId: 9 }));
      ok(vivo && api.tnPathVivoAtual() === vivo && svg().querySelectorAll("path").length === nAntes && /L140 125|140 125/.test(vivo.getAttribute("d")),
        "P2 o traço em andamento é o MESMO elemento, atualizado no lugar (nada sob o ponteiro é destruído): " + (vivo && vivo.getAttribute("d")));
      api.tnSoltar();
      api.tnDesfazer();
      ok(/\.tn-traco\{pointer-events:none\}/.test(require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8")),
        "P3 os traços não recebem toque (CSS): o alvo é sempre a camada");
    }
    /* teclado com a barra aberta */
    api.tnFerramenta("lapis");
    const tecla = (k, extra) => api.qsTeclaResponder(Object.assign({ key: k, target: {}, preventDefault() {} }, extra || {}));
    tecla("m");
    ok(api.$("btnTnMarca").classList.contains("on"), "K1 M = marca-texto");
    tecla("r");
    ok(api.$("btnTnBorracha").classList.contains("on"), "K2 R = borracha");
    tecla("h");
    ok(api.$("btnTnMao").classList.contains("on"), "K3 H = mão");
    tecla("p");
    tecla("c");
    ok(api.$("btnTnLapis").classList.contains("on") && api.$("qsSessCorpo").querySelectorAll(".qs-op-sel").length === 1, "K4 P = lápis; C continua escolhendo a alternativa");
    api.tnComecar(ev(40, 120)); api.tnMover(ev(90, 125)); api.tnSoltar();
    ok(api.tnContar() === 1, "K5a desenhou na nova questão");
    tecla("z", { ctrlKey: true });
    ok(api.tnContar() === 0, "K5 Ctrl+Z desfaz");
    /* caneta: a palma não risca */
    api.tnCanetaReset();
    let t1 = 50000;
    api.tnRelogioDefinir(() => t1);
    const nC = api.tnContar();
    /* (v19.12.3) O RELATO: com caneta, "só o primeiro risco é mantido completo". Vários traços de caneta seguidos: todos
     * entram, e a camada NUNCA passa a liberar a rolagem (no Windows isso valia para a caneta e cancelava o traço) */
    for (let k = 0; k < 3; k++) {
      api.tnComecar(ev(40 + k * 5, 120, { pointerType: "pen", pointerId: 20 + k }));
      api.tnMover(ev(90 + k * 5, 150, { pointerType: "pen", pointerId: 20 + k }));
      api.tnMover(ev(140 + k * 5, 125, { pointerType: "pen", pointerId: 20 + k }));
      api.tnSoltar();
      api.tnFerramenta("lapis");   /* recalcula a classe da camada */
      ok(/tn-ativa/.test(svg().getAttribute("class")) && !/tn-caneta/.test(svg().getAttribute("class")), "C0 depois do traço " + (k + 1) + " de caneta, a camada continua sem liberar a rolagem: " + svg().getAttribute("class"));
    }
    ok(api.tnContar() === nC + 3, "C0a três traços de caneta seguidos, os três inteiros");
    ok(!/touch-action:\s*pan/.test((require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8").match(/\.tn-camada[^{]*\{[^}]*\}/g) || []).join(" ")),
      "C0b nenhuma regra da camada libera a rolagem (touch-action: pan)");
    /* a palma com a caneta em uso: não risca — rola a questão */
    ok(api.tnComecar(ev(40, 120, { pointerType: "touch", pointerId: 40 })) === false && api.tnRolandoAtual() && api.tnRolandoAtual().id === 40,
      "C1 com a caneta em uso, o toque (palma) não risca: rola a questão");
    api.tnMover(ev(40, 90, { pointerType: "touch", pointerId: 40 }));
    ok(api.tnContar() === nC + 3, "C1a rolar não cria traço");
    api.tnCanetaReset();
    /* passado o tempo da caneta, o dedo desenha */
    t1 += 2000;
    ok(api.tnComecar(ev(40, 120, { pointerType: "touch", pointerId: 41 })) === true, "C2 sem caneta em uso, o dedo desenha (celular, tablet, notebook)");
    api.tnSoltar();
    api.tnRelogioDefinir(null);
    api.tnCanetaReset();
    /* fechar o lápis */
    const nAntesFechar = api.tnContar();
    api.$("btnTnFechar").onclick();
    ok(!api.tnAbertaAgora() && api.$("tnBarra").hidden && !/tn-ativa/.test(svg().getAttribute("class")) && nAntesFechar > 0 && api.tnContar() === nAntesFechar,
      "F1 fechar esconde a barra, devolve o toque e mantém os traços");
    ok(api.tnTecla({ key: "m", target: {} }) === false, "F1a fechado, as teclas não são do lápis");
    /* preferências: a cor escolhida fica */
    api.tnAbrir();
    api.tnCorEscolher("azul");
    ok(/"c":"azul"/.test(janela.localStorage.getItem("eac_tinta_pref") || ""), "P1 a cor escolhida fica lembrada neste aparelho");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["tn_barra", "tn_abrir_aj", "tn_lapis", "tn_marca", "tn_borracha", "tn_mao", "tn_espessura", "tn_desfazer", "tn_limpar", "tn_limpou", "tn_fechar",
      "tn_cor_grafite", "tn_cor_vermelho", "tn_cor_azul", "tn_cor_verde", "tn_cor_laranja", "tn_cor_roxo"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
