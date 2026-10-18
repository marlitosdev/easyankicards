/* =====================================================================
 * O LEITOR DE RESUMOS (v18.74.0+)
 *
 * R1 (18.74.0) — ONDE PAREI, EM CADA RAMO. A leitura é um painel só, e
 * trocar de ramo deixava a rolagem onde estava: o ramo novo abria no meio.
 * O QUE PRECISA SER VERDADE:
 *  1. cada bloco desenhado leva a linha de origem (data-l), e a linha do
 *     marcador — que o desenho acrescenta — não desloca as outras;
 *  2. cada escopo (Tudo, Geral, cada ramo) de cada tópico guarda o seu
 *     lugar: o parágrafo do alto e quanto dele já passou (e a fração, de
 *     reserva); o que nunca foi lido começa do INÍCIO;
 *  3. voltar a um ramo, sair para editar e voltar, fechar e reabrir: o
 *     lugar volta; com a leitura escondida ou fechada nada é gravado (ela
 *     lê 0 e apagaria o lugar);
 *  4. mudar a letra mantém o mesmo parágrafo no alto.
 *
 * R2 (18.75.0) — A TELA CHEIA À VISTA E A LEITURA COM A CARA DELA.
 *  5. o topo tem "⛶ Tela cheia" (antes só dentro do "Aa"), que entra na
 *     tela cheia; a tecla F entra e sai — lendo, nunca enquanto se digita
 *     nem editando; fechar virou ✕ (com nome para leitor de tela);
 *  6. lendo, a janela ganha "mat-lendo": o texto sem caixa, ocupando a
 *     janela, na coluna da tela cheia; editando, volta a ser como era.
 *
 * R3 (18.76.0) — EDITAR UM PARÁGRAFO SÓ.
 *  7. a linha do bloco no escopo vira a do texto inteiro (Tudo, Geral, a
 *     seção do ramo); a dica de várias linhas é um bloco; título de ramo,
 *     divisória e questão não se editam por aqui;
 *  8. gravar troca SÓ aquelas linhas, grava o resumo, e dá para desfazer;
 *     se o texto mudou por baixo, não grava; caixa vazia apaga (com
 *     pergunta); Esc desiste só do parágrafo;
 *  9. o pedido à IA leva a ação, as regras, o contexto e o parágrafo entre
 *     <<< >>>; a resposta é limpa (cerca, <<< >>>, rótulo) e o pedido colado
 *     de volta é recusado; ela só entra no parágrafo com «usar»;
 * 10. o lápis aparece no parágrafo sob o mouse (não no título do ramo) e
 *     a bolha da seleção tem "✎ parágrafo".
 *
 * R4 (18.77.0) — PEDIR À IA QUANDO JÁ HÁ RESUMO: O OBJETIVO.
 * 11. com texto já escrito no escopo, aparece o objetivo — complementar
 *     (padrão), avaliar e melhorar, escrever de novo; sem texto, não;
 * 12. complementar: o pedido manda o texto e pede SÓ o que falta; a
 *     resposta é ACRESCENTADA no fim de cada parte (geral e ramos), nada do
 *     que existe muda (marcas inclusive); parte que não veio não é "falta";
 * 13. avaliar e melhorar: a "# Avaliação" sai à parte (aparece na
 *     conferência, não entra no texto) e o texto melhorado troca as partes;
 * 14. escrever de novo: o pedido vai sem o texto atual.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api: a } = rodar();
  a.matIniciar();

  /* ---- 1: a linha de origem ---- */
  {
    const h = a.matParaHtml("Primeiro.\n\n## Título\n- item\n1. passo\n---\n> dica", null, { comLinhas: true });
    ok(/<p data-l="0">Primeiro/.test(h) && /<h4 data-l="2">Título/.test(h) && /<li data-l="3">item/.test(h)
       && /mat-num' data-l="4"/.test(h) && /<hr data-l="5">/.test(h) && /mat-dica" data-l="6"/.test(h), "R1 cada bloco leva a sua linha de origem: " + h);
    ok(!/data-l/.test(a.matParaHtml("Primeiro.\n- item")), "R1a sem pedir, nada muda no desenho (a lei e as prévias usam o mesmo motor)");
  }

  const ch = a.matChave("Leitura", "Rolagem");
  const ramos = [{ id: "a", nome: "A" }, { id: "b", nome: "B" }];
  const texto = "Geral um.\n\nGeral dois.\n\n## Ramo — A\nA um.\n\nA dois.\n\n## Ramo — B\nB um.\n\nB dois.";
  a.matGravar(ch, texto, { disciplina: "Leitura", topico: "Rolagem" });

  /* ---- 1b: o marcador não desloca as linhas ---- */
  {
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos });
    a.matObter(ch).marcador = 3;            /* fim da 1ª linha: o marcador entra depois dela */
    a.matTrocarModo("ler");
    const h = a.$("matLeitura").innerHTML;
    ok(/mat-marcador/.test(h) && /<p data-l="2">Geral dois/.test(h), "R1b a linha do marcador não desloca as outras: " + h.slice(0, 200));
    delete a.matObter(ch).marcador;
    a.matTrocarModo("ler");
    a.matFechar();
  }

  /* ---- 2: o guardado ---- */
  {
    a.matRolGuardar("x", "*", { l: 4, d: 12.6, f: 0.41234 });
    a.matRolGuardar("x", "", { l: 1, d: 0, f: 0.1 });
    a.matRolGuardar("x", "a", { l: null, d: 0, f: 0.5 });
    const g = a.matRolLer().x;
    ok(g["*"].l === 4 && g["*"].d === 13 && g["*"].f === 0.412 && g._geral.l === 1 && g.a.f === 0.5,
       "R2 cada escopo guarda o seu lugar ('' = geral não se confunde com '*' = tudo): " + JSON.stringify(g));
    ok(a.matRolDe("x", "b") === null && a.matRolDe("y", "*") === null, "R2a o que nunca foi lido não tem lugar");
    a.matRolGuardar("x", "a", null);
    ok(a.matRolDe("x", "a") === null && a.matRolDe("x", "*").l === 4, "R2b apagar um lugar não mexe nos outros");
  }

  /* ---- 3: trocar de ramo ---- */
  const painel = a.$("matLeitura");
  /* um painel de 200 px de altura com 1000 px de texto, no alto da tela */
  painel.clientHeight = 200; painel.scrollHeight = 1000; painel._rect = { top: 100, height: 200 };
  const bloco = (l) => painel.querySelector('[data-l="' + l + '"]');
  /* o simulador não mede: por padrão os blocos ficam "fora da vista" e só vale a fração; cada caso põe a medida que quer */
  const semMedida = () => painel.querySelectorAll("[data-l]").forEach((b) => { b._rect = { top: -5000, height: 0 }; });
  const ir = (e) => { a.matEscopoEscolher(e); semMedida(); };
  {
    a.loja.removeItem(a.MAT_ROL_CHAVE);
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos });
    semMedida();
    ok(a.matEscopoAtual() === "*" && painel.scrollTop === 0, "R3 a primeira leitura começa do início");
    /* rolou 300 px: o 1º bloco (linha 0) já passou; o da linha 2 está pela metade no alto */
    painel.scrollTop = 300;
    bloco(0)._rect = { top: -200, height: 100 };
    bloco(2)._rect = { top: -100, height: 250 };
    ir("a");
    const g = a.matRolDe(ch, "*");
    ok(g && g.l === 2 && g.d === 200 && g.f === 0.375, "R3a trocar de ramo guarda o lugar do 'Tudo': o parágrafo do alto (linha 2) e 200 px dele: " + JSON.stringify(g));
    ok(painel.scrollTop === 0 && /A um/.test(painel.innerHTML) && !/Geral um/.test(painel.innerHTML), "R3b o ramo A nunca lido abre no INÍCIO (antes: no ponto em que o outro parou)");
    painel.scrollTop = 400;
    ir("b");
    ok(a.matRolDe(ch, "a").f === 0.5 && painel.scrollTop === 0, "R3c o ramo B também começa do início; o A ficou guardado na metade");
    ir("a");
    ok(painel.scrollTop === 400, "R3d voltar ao ramo A volta à metade: " + painel.scrollTop);
    /* voltar ao Tudo: o bloco da linha 2 é desenhado 300 px abaixo do alto (com a rolagem em 0) */
    a.matEscopoEscolher("*");
  }

  /* ---- 3f: o lugar é o parágrafo, não o pixel ---- */
  {
    bloco(2)._rect = { top: 400, height: 250 };
    a.matRolAplicar(painel, a.matRolDe(ch, "*"));
    ok(painel.scrollTop === 500, "R3f vai ao parágrafo guardado (300 até ele + 200 dentro dele), não à fração (0,375 = 300): " + painel.scrollTop);
    semMedida();
    a.matRolAplicar(painel, { l: 99, d: 0, f: 0.25 });
    ok(painel.scrollTop === 200, "R3g a linha não existe mais (texto editado) e não há bloco depois: usa a fração: " + painel.scrollTop);
    a.matRolAplicar(painel, null);
    ok(painel.scrollTop === 0, "R3h sem lugar guardado: início");
    /* a janela em escala (transform 0,97): a tela mede 97% da distância de layout — a medida é convertida */
    painel.offsetHeight = 200; painel._rect = { top: 100, height: 194 };
    bloco(2)._rect = { top: 100 + 291, height: 250 };
    a.matRolAplicar(painel, { l: 2, d: 200, f: 0 });
    ok(Math.round(painel.scrollTop) === 500, "R3h2 com a janela em escala a volta ao parágrafo desfaz a escala (291 na tela = 300 de rolagem): " + painel.scrollTop);
    painel.scrollTop = 500;
    bloco(2)._rect = { top: 100 - 194, height: 250 };
    bloco(0)._rect = { top: -5000, height: 0 };
    const mEsc = a.matRolMedir(painel);
    ok(mEsc.l === 2 && Math.round(mEsc.d) === 200, "R3h3 e a medida também (194 na tela = 200 de layout): " + JSON.stringify(mEsc));
    delete painel.offsetHeight; painel._rect = { top: 100, height: 200 };
    semMedida();
  }

  /* ---- 3i: editar e fechar não apagam o lugar ---- */
  {
    ir("a");
    painel.scrollTop = 160;
    a.matTrocarModo("editar");
    ok(a.matRolDe(ch, "a").f === 0.2, "R3i ir editar guarda o lugar do ramo (antes de esconder a leitura): " + JSON.stringify(a.matRolDe(ch, "a")));
    painel.scrollTop = 0;                 /* escondida, a leitura lê 0 */
    a.matTrocarModo("editar");
    ok(a.matRolDe(ch, "a").f === 0.2, "R3j com a leitura escondida nada é gravado (ela leria 0): " + JSON.stringify(a.matRolDe(ch, "a")));
    painel.scrollTop = 0;
    a.matTrocarModo("ler");
    ok(painel.scrollTop === 160, "R3k voltar a ler volta ao lugar: " + painel.scrollTop);
    semMedida();
    painel.scrollTop = 240;
    a.matFechar();
    ok(a.matRolDe(ch, "a").f === 0.3 && a.$("dlgMaterial").open === false, "R3l fechar guarda o lugar antes de fechar");
    painel.scrollTop = 0;
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos, ramo: "a" });
    ok(painel.scrollTop === 240, "R3m reabrir o tópico no ramo A volta ao lugar: " + painel.scrollTop);
    semMedida();
    /* a rolagem é lida também ao rolar (Esc fecha sem passar por matFechar) */
    painel.scrollTop = 80;
    const ouv = (painel._ouv && painel._ouv.scroll) || [];
    ouv.forEach((f) => f({}));
    ok(ouv.length >= 1 && a.matRolDe(ch, "a").f === 0.1, "R3n rolar grava o lugar: " + JSON.stringify(a.matRolDe(ch, "a")));
    /* fechada por fora (Esc, outra janela por cima): a leitura fechada lê 0 — reabrir não pode gravar esse 0 por cima */
    a.$("dlgMaterial").open = false;
    painel.scrollTop = 0;
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos, ramo: "a" });
    ok(a.matRolDe(ch, "a").f === 0.1 && painel.scrollTop === 80, "R3o com a janela fechada nada é gravado (ela leria 0): " + JSON.stringify(a.matRolDe(ch, "a")) + " " + painel.scrollTop);
    semMedida();
  }

  /* ---- 4: a letra muda, o parágrafo fica ---- */
  {
    ir("*");
    painel.scrollTop = 300;
    bloco(0)._rect = { top: -200, height: 100 };
    bloco(2)._rect = { top: -100, height: 250 };
    /* depois da letra maior o mesmo bloco fica noutro lugar (o simulador não reflui: a posição nova é a do retângulo) */
    a.matRolManter(() => { bloco(2)._rect = { top: 150, height: 300 }; });
    ok(painel.scrollTop === 150 - 100 + 200, "R4 mudar a letra mantém o parágrafo do alto (e o ponto dentro dele): " + painel.scrollTop);
    /* o A+ de verdade: com a letra maior, o parágrafo da linha 2 desce (400 px × 17/15); a medida acompanha a rolagem */
    const posDe = (base) => () => { const y = base * a.matFonteAtual() / 15; const top = 100 + y - painel.scrollTop; return { top, bottom: top + 250, left: 0, right: 0, width: 0, height: 250 }; };
    a.matFonteZerar();
    bloco(0).getBoundingClientRect = () => ({ top: 100 - painel.scrollTop, bottom: 200 - painel.scrollTop, left: 0, right: 0, width: 0, height: 100 });
    bloco(2).getBoundingClientRect = posDe(400);
    painel.scrollTop = 500;
    a.$("btnMatMaior").onclick();
    ok(a.matFonteAtual() === 17 && painel.scrollTop === Math.round(400 * 17 / 15 + 100) || Math.abs(painel.scrollTop - (400 * 17 / 15 + 100)) < 1,
       "R4a o A+ mantém o parágrafo (desceu para 453 px; ficam os 100 px dentro dele): " + painel.scrollTop);
    a.matFonteZerar();
  }
  /* ---- 5 e 6: a tela cheia à vista; a leitura com a cara dela ---- */
  {
    const HTML = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const iTopo = HTML.indexOf('id="matTopo"'), iFim = HTML.indexOf('id="matAjudaNota"');
    const pos = (id) => HTML.indexOf('id="' + id + '"');
    ok(pos("btnMatCheiaTopo") > iTopo && pos("btnMatCheiaTopo") < pos("btnMatModoTopo") && pos("btnMatCheiaTopo") < iFim,
       "R5 '⛶ Tela cheia' está no topo, antes de Editar (antes ficava escondida no 'Aa')");
    ok(HTML.includes('class="btn-min mat-cheia-bt" id="btnMatCheiaTopo"') && HTML.includes(".mat-cheia-bt{background:var(--acao)"), "R5a com destaque (a cor da ação)");
    ok(/id="btnMatFecharTopo"[^>]*aria-label="Fechar o resumo"/.test(HTML) && a.t("mat_fechar_topo") === "✕", "R5b fechar é ✕, com nome para leitor de tela");
    const dlg = a.$("dlgMaterial");
    a.matEscopoEscolher("*");
    a.matTrocarModo("ler");
    ok(/mat-lendo/.test(dlg.className), "R6 lendo, a janela tem a cara da tela cheia (mat-lendo)");
    ok(HTML.includes("#dlgMaterial.mat-lendo #matLeitura{flex:1 1 auto;min-height:0;max-height:none;resize:none;border:none")
       && HTML.includes("#dlgMaterial.mat-lendo[open]{height:92vh"),"R6a sem caixa, ocupando a janela de altura fixa");
    ok(HTML.indexOf("#dlgMaterial.mat-lendo #matLeitura{") < HTML.indexOf("#dlgMaterial.mat-cheia #matLeitura{flex:1 1 auto"), "R6b a tela cheia vem depois no CSS (com as duas classes, ganha a dela)");
    a.matTrocarModo("editar");
    ok(!/mat-lendo/.test(dlg.className), "R6c editando, volta a ser como era");
    const raiz = a.document.documentElement;
    raiz.requestFullscreen = () => { a.document.fullscreenElement = raiz; return Promise.resolve(); };
    a.document.exitFullscreen = () => { a.document.fullscreenElement = null; return Promise.resolve(); };
    const tecla = (key, alvo) => { let parou = false; (dlg._ouv.keydown || []).forEach((f) => f({ key, target: alvo || { tagName: "DIV" }, preventDefault() { parou = true; } })); return parou; };
    tecla("f");
    ok(a.matCheiaAtual() === false, "R5c editando, F não faz nada (é uma letra)");
    a.matTrocarModo("ler");
    tecla("f", { tagName: "INPUT" });
    ok(a.matCheiaAtual() === false, "R5d digitando num campo, F é só uma letra");
    const parou = tecla("F");
    ok(a.matCheiaAtual() === true && parou, "R5e lendo, F entra na tela cheia");
    tecla("f");
    ok(a.matCheiaAtual() === false, "R5f e sai");
    a.$("btnMatCheiaTopo").onclick();
    ok(a.matCheiaAtual() === true, "R5g o botão do topo entra na tela cheia");
    a.matCheiaTrocar(false);
  }
  /* ---- 7: que linhas são ---- */
  {
    const T = "Geral um.\n\n## Ramo — A\nA um.\n\n> dica 1\n> dica 2\n>~ outra\n---";
    ok(a.rpaLinhaBase(T, "*", ramos) === 0 && a.rpaLinhaBase(T, "", ramos) === 0 && a.rpaLinhaBase(T, "a", ramos) === 2 && a.rpaLinhaBase(T, "b", ramos) === null,
       "R7 a linha 0 do escopo no texto inteiro: Tudo e Geral = 0; o ramo A = a linha do título dele (2); ramo sem seção = null");
    const L = T.split("\n");
    ok(JSON.stringify(a.rpaExtensao(L, 5)) === "[5,6]" && JSON.stringify(a.rpaExtensao(L, 7)) === "[7,7]" && JSON.stringify(a.rpaExtensao(L, 3)) === "[3,3]",
       "R7a a dica de várias linhas é um bloco (e a de outro tipo, não)");
    ok(a.rpaPodeEditar("Texto.") && a.rpaPodeEditar("- item") && a.rpaPodeEditar("### Sub") && !a.rpaPodeEditar("## Ramo — A") && !a.rpaPodeEditar("---") && !a.rpaPodeEditar("?> enunciado") && !a.rpaPodeEditar(">> gabarito") && !a.rpaPodeEditar("  "),
       "R7b título de ramo, divisória, questão e linha vazia não se editam por aqui");
    ok(a.rpaTrocar("a\nb\nc", 1, 1, "B1\n\nB2  ") === "a\nB1\n\nB2\nc" && a.rpaTrocar("a\nb\nc", 1, 1, "") === "a\nc" && a.rpaTrocar("a\nb\nc\nd", 1, 2, "x") === "a\nx\nd",
       "R7c troca só as linhas (uma por várias, nenhuma, várias por uma)");
  }

  /* ---- 9: o pedido e a resposta ---- */
  {
    const p = a.rpaPrompt({ disciplina: "D", topico: "T", ramo: "A", antes: "Antes.", alvo: "O ==!parágrafo== alvo.", depois: "Depois.", acao: "encurtar" });
    ok(p.includes(a.t("rpa_p_encurtar")) && p.includes("Ramo: A") && p.includes("<<<\nO ==!parágrafo== alvo.\n>>>") && p.includes("«Antes.»") && p.includes("«Depois.»") && p.includes("==!…==") && !p.includes(a.t("rpa_p_varios")),
       "R9 o pedido leva a ação, o ramo, o contexto, as regras (marcas) e o parágrafo entre <<< >>>: " + p);
    const p2 = a.rpaPrompt({ topico: "T", alvo: "x", acao: "livre", instrucao: "inclua a exceção do § 2º" });
    ok(p2.includes("inclua a exceção do § 2º") && p2.includes(a.t("rpa_p_varios")) && !p2.includes(a.t("rpa_p_contexto")), "R9a instrução livre (pode virar vários parágrafos); sem vizinhos, sem contexto");
    ok(a.rpaPrompt({ alvo: "x", acao: "ampliar" }).includes(a.t("rpa_p_varios")), "R9b ampliar pode virar vários parágrafos");
    const r = a.rpaLerResposta("```markdown\n<<<\nParágrafo: Novo texto.\n>>>\n```");
    ok(r.texto === "Novo texto." && !r.ehPedido, "R9c a resposta sai limpa (cerca, <<< >>>, rótulo): " + JSON.stringify(r));
    ok(a.rpaLerResposta(p).ehPedido && a.rpaLerResposta("  ").vazio, "R9d o pedido colado de volta é recusado; vazio é vazio");
  }

  /* ---- 8: abrir, gravar, desfazer ---- */
  {
    const chP = a.matChave("Leitura", "Paragrafo");
    const T0 = "Geral um.\n\n## Ramo — A\nA um.\n\n- A dois.\n\n> dica 1\n> dica 2\n\n## Ramo — B\nB um.";
    a.matGravar(chP, T0, { disciplina: "Leitura", topico: "Paragrafo" });
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Paragrafo", chave: chP }, "ler", { ramos, ramo: "a" });
    const pn = a.$("matLeitura");
    const blocoP = (l) => pn.querySelector('[data-l="' + l + '"]');
    /* na seção do ramo A: linha 0 = o título, 3 = "- A dois.", 5 = a dica */
    ok(a.rpaAbrir(blocoP(0)) === false && a.rpaEdAtual() === null && a.$("matEstado").textContent === a.t("rpa_tit_ramo"), "R8 o título do ramo não se edita aqui (e diz onde se muda)");
    ok(a.rpaAbrir(blocoP(3)) === true, "R8a abre o item da lista");
    const ed = a.rpaEdAtual();
    ok(ed.ta.value === "- A dois." && ed.el === blocoP(3) && ed.el.style.display === "none" && ed.caixa.parentNode === blocoP(3).parentNode && ed.salvar.disabled === true,
       "R8b a caixa entra no lugar do bloco, só com ele (o item com o '- '); sem mudança, gravar fica desligado");
    ed.ta.value = "- A dois, ==!editado==.";
    (ed.ta._ouv.input || []).forEach((f) => f({}));
    ok(ed.salvar.disabled === false && /9 → 23/.test(ed.conta.textContent), "R8c a conta acompanha (antes → agora): " + ed.conta.textContent);
    await a.rpaSalvar();
    const T1 = a.matObter(chP).texto;
    ok(T1 === T0.replace("- A dois.", "- A dois, ==!editado==."), "R8d grava SÓ aquela linha, no texto inteiro: " + JSON.stringify(T1));
    ok(a.rpaEdAtual() === null && /editado/.test(pn.innerHTML) && a.$("matEstado").textContent.indexOf(a.t("rpa_salvo")) === 0, "R8e a leitura volta desenhada, com 'gravado' e o desfazer");
    a.rpaDesfazer();
    ok(a.matObter(chP).texto === T0, "R8f desfazer volta o texto de antes");
    /* a dica de duas linhas: um bloco, editado inteiro */
    a.rpaAbrir(blocoP(5));
    ok(a.rpaEdAtual().ta.value === "> dica 1\n> dica 2", "R8g a dica de duas linhas abre inteira: " + JSON.stringify(a.rpaEdAtual().ta.value));
    a.rpaEdAtual().ta.value = "> dica nova";
    await a.rpaSalvar();
    ok(a.matObter(chP).texto === T0.replace("> dica 1\n> dica 2", "> dica nova"), "R8h as duas linhas viram uma");
    a.rpaDesfazer();
    /* o texto mudou por baixo: não grava em cima */
    a.rpaAbrir(blocoP(1));
    const ed2 = a.rpaEdAtual();
    ok(ed2.ta.value === "A um.", "R8i (abre 'A um.')");
    a.$("matTexto").value = a.$("matTexto").value.replace("A um.", "A um mudado por outro lugar.");
    ed2.ta.value = "A um, meu.";
    const gr = await a.rpaSalvar();
    ok(gr === false && ed2.aviso.hidden === false && ed2.aviso.textContent === a.t("rpa_mudou") && a.matObter(chP).texto === T0, "R8j o texto mudou por baixo: nada é gravado, e diz por quê");
    a.rpaCancelar();
    ok(a.rpaEdAtual() === null && ed2.el.style.display === "" && !ed2.caixa.parentNode, "R8k cancelar devolve o bloco e tira a caixa");
    a.$("matTexto").value = T0;
    a.matTrocarModo("ler");
    /* Esc desiste só do parágrafo */
    a.rpaAbrir(blocoP(1));
    const ed3 = a.rpaEdAtual();
    let parou = false;
    (ed3.ta._ouv.keydown || []).forEach((f) => f({ key: "Escape", preventDefault() { parou = true; }, stopPropagation() {} }));
    ok(a.rpaEdAtual() === null && parou && a.$("dlgMaterial").open === true, "R8l Esc desiste do parágrafo e não fecha o resumo");
    /* Ctrl+Enter grava */
    a.rpaAbrir(blocoP(1));
    a.rpaEdAtual().ta.value = "A um, com Ctrl+Enter.";
    (a.rpaEdAtual().ta._ouv.keydown || []).forEach((f) => f({ key: "Enter", ctrlKey: true, preventDefault() {} }));
    await Promise.resolve();
    ok(a.matObter(chP).texto === T0.replace("A um.", "A um, com Ctrl+Enter."), "R8m Ctrl+Enter grava");
    a.rpaDesfazer();
    /* caixa vazia + "não": nada muda */
    a.rpaAbrir(blocoP(1));
    a.rpaEdAtual().ta.value = "";
    const prN = a.rpaSalvar();
    for (let i = 0; i < 8; i++) { await Promise.resolve(); try { a.uiModalResponder(false); } catch (e) {} }
    await prN;
    ok(a.matObter(chP).texto === T0 && a.rpaEdAtual() !== null, "R8n0 caixa vazia + 'não': nada é apagado e o parágrafo continua aberto");
    a.rpaCancelar();
    /* caixa vazia: pergunta e apaga */
    a.rpaAbrir(blocoP(1));
    a.rpaEdAtual().ta.value = "   ";
    const pr = a.rpaSalvar();
    for (let i = 0; i < 8; i++) { await Promise.resolve(); try { a._uiFechar(true); } catch (e) {} }
    await pr;
    ok(a.matObter(chP).texto === T0.replace("A um.\n", ""), "R8n caixa vazia + 'sim' apaga a linha: " + JSON.stringify(a.matObter(chP).texto));
    a.rpaDesfazer();
    ok(a.matObter(chP).texto === T0, "R8o e o desfazer devolve");

    /* ---- 9e: a resposta da IA ---- */
    a.rpaAbrir(blocoP(1));
    const ed4 = a.rpaEdAtual();
    const pedido = a.rpaPedir("encurtar");
    ok(pedido.includes("<<<\nA um.\n>>>") && pedido.includes("Ramo: A") && ed4.resp.hidden === false && ed4.usarBt.disabled === true,
       "R9e o botão copia o pedido (com o parágrafo e o ramo) e abre a caixa da resposta, com 'usar' desligado");
    ed4.respTa.value = pedido;
    a.rpaConferirResposta();
    ok(ed4.usarBt.disabled === true && ed4.respMsg.textContent === a.t("rpa_resp_pedido"), "R9f o pedido colado de volta: recusado");
    ed4.respTa.value = "<<<\nA um, curto.\n>>>";
    a.rpaConferirResposta();
    ok(ed4.usarBt.disabled === false && ed4.ta.value === "A um.", "R9g a resposta lida liga 'usar' — e ainda não mexe no parágrafo");
    a.rpaUsarResposta();
    ok(ed4.ta.value === "A um, curto." && ed4.resp.hidden === true && a.matObter(chP).texto === T0, "R9h 'usar' põe a resposta na caixa do parágrafo (sem gravar ainda)");
    ok(a.rpaPedir("livre") === false && ed4.respMsg.textContent === a.t("rpa_livre_vazio"), "R9i instrução livre vazia: pede para escrever");
    a.rpaCancelar();

    /* ---- 10: o lápis e a bolha ---- */
    a.rpaAoPassar({ target: blocoP(3) });
    const lap = pn.querySelector(".mat-par-lapis");
    ok(lap && lap.hidden === false && lap._alvo === blocoP(3), "R10 o lápis aparece no parágrafo sob o mouse");
    a.rpaAoPassar({ target: blocoP(0) });
    ok(lap.hidden === true, "R10a no título do ramo, não");
    a.rpaAoPassar({ target: blocoP(3) });
    lap.onclick();
    ok(a.rpaEdAtual() && a.rpaEdAtual().ta.value === "- A dois." && lap.hidden === true, "R10b clicar no lápis abre o parágrafo (e o lápis sai de cena)");
    a.rpaCancelar();
    const HTML = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const iB = HTML.indexOf('id="matBolha"'), iF = HTML.indexOf("</div>", HTML.indexOf('id="btnMatQstTrecho"'));
    ok(HTML.indexOf('id="btnBolhaPar"') > iB && HTML.indexOf('id="btnBolhaPar"') < iF && typeof a.$("btnBolhaPar").onclick === "function", "R10c a bolha da seleção tem '✎ parágrafo' (no celular não há mouse)");
    /* a seleção dentro do item: a bolha abre aquele parágrafo */
    const txtNo = blocoP(3).children[0] || blocoP(3);
    a.porSelecao(() => ({ anchorNode: txtNo, removeAllRanges() {} }));
    a.$("btnBolhaPar").onclick();
    ok(a.rpaEdAtual() && a.rpaEdAtual().el === blocoP(3), "R10d '✎ parágrafo' abre o parágrafo onde está a seleção");
    /* redesenhar a leitura leva a caixa junto (não fica um parágrafo 'aberto' que não está na tela) */
    a.matTrocarModo("ler");
    ok(a.rpaEdAtual() === null, "R10e redesenhar a leitura fecha o parágrafo aberto");
  }
  /* ---- 11–14: o objetivo do pedido à IA ---- */
  {
    a.matFechar();
    const chI = a.matChave("Leitura", "IA");
    const NL = "\n";
    const T0 = ["Geral ==velho==.", "", "## Ramo — A", "A um ==!marca==.", "> dica de A", "", "## Ramo — B", "B um."].join(NL);
    a.matGravar(chI, T0, { disciplina: "Leitura", topico: "IA" });
    const digita = (v) => { a.$("resIATexto").value = v; ((a.$("resIATexto")._ouv || {}).input || []).forEach((fn) => fn()); };
    a.riaAbrirDoTopico("Leitura", "IA", chI, { ramos });
    ok(a.$("resIAAtualLin").hidden === false && a.riaObjetivoAtual() === "complementar" && a.$("btnResIAObjCompl").getAttribute("aria-pressed") === "true"
       && a.$("resIAObjExp").textContent === a.t("ria_obj_compl_exp"), "R11 com resumo escrito: o objetivo aparece, e o padrão é COMPLEMENTAR (não perde nada)");
    let ped = a.riaMontarPedido();
    ok(ped.includes(a.t("ria_p_obj_compl")) && ped.includes("A um ==!marca==.") && !ped.includes(a.t("ria_p_atual")), "R12 o pedido manda o texto e pede só o que falta");
    digita(["# Resumo geral", "Mais geral.", "", "## Ramo — A", "Mais A."].join(NL));
    ok(a.$("resIASemTxt").textContent.indexOf("ACRESCENTAR") >= 0 && !/Sem seção/.test(a.$("resIASemTxt").textContent) && /sem-ok/.test(a.$("resIASem").className)
       && a.$("resIAModoLin").hidden === true, "R12a o semáforo diz que vai acrescentar; o ramo B que não veio não é 'falta'; não há 'trocar tudo': " + a.$("resIASemTxt").textContent);
    ok(/resumo geral: \+ 11 caracteres no fim/.test(a.$("resIAConf").textContent) && /A: \+ 7 caracteres no fim/.test(a.$("resIAConf").textContent) && !/marca\(s\)/.test(a.$("resIAConf").textContent),
       "R12b a conferência mostra o que entra no fim de cada parte e não fala em perder marca: " + a.$("resIAConf").textContent);
    a.$("btnResIAAplicar").onclick();
    const T1 = a.matObter(chI).texto;
    ok(T1 === ["Geral ==velho==.", "", "Mais geral.", "", "## Ramo — A", "A um ==!marca==.", "> dica de A", "", "Mais A.", "", "## Ramo — B", "B um."].join(NL),
       "R12c aplicar ACRESCENTA no fim do geral e do ramo A; B, as marcas e a dica ficam: " + JSON.stringify(T1));
    a.$("btnResIADesfazer").onclick();
    ok(a.matObter(chI).texto === T0, "R12d desfazer volta");
    /* parte nova (ramo sem seção ainda) entra como seção nova */
    ok(a.riaAplicarTexto("Geral.", { geral: "", secoes: [{ id: "b", nome: "B", corpo: "B novo." }] }, "acrescentar", ramos) === "Geral.\n\n## Ramo — B\nB novo.", "R12e no complementar, ramo sem seção ganha a seção");
    /* avaliar e melhorar */
    a.$("btnResIAObjMelhor").onclick();
    ped = a.riaMontarPedido();
    ok(a.riaObjetivoAtual() === "melhorar" && ped.includes(a.t("ria_p_obj_melhor")) && ped.includes("A um ==!marca==."), "R13 avaliar e melhorar: o pedido pede a avaliação e manda o texto");
    digita(["# Avaliação", "- O geral está vago.", "- Falta a exceção do ramo A.", "", "# Resumo geral", "Geral melhor.", "", "## Ramo — A", "A melhor ==!marca==."].join(NL));
    const conf = a.$("resIAConf").textContent;
    ok(conf.indexOf(a.t("ria_conf_aval")) >= 0 && conf.indexOf("Falta a exceção do ramo A.") >= 0 && /resumo geral: \d+ → \d+ caracteres/.test(conf) && a.$("resIAModoLin").hidden === false,
       "R13a a avaliação aparece na conferência, antes do que muda; volta a escolha 'só as partes / tudo': " + conf);
    a.$("btnResIAAplicar").onclick();
    const T2 = a.matObter(chI).texto;
    ok(T2 === ["Geral melhor.", "", "## Ramo — A", "A melhor ==!marca==.", "", "## Ramo — B", "B um."].join(NL) && T2.indexOf("Avaliação") < 0,
       "R13b o texto melhorado troca as partes que vieram; a avaliação NÃO entra no resumo: " + JSON.stringify(T2));
    a.$("btnResIADesfazer").onclick();
    ok(a.riaLerResposta("## Avaliação\n- x\n## Ramo — A\nA.", ramos).avaliacao === "- x" && a.riaLerResposta("Só texto.", ramos).avaliacao === "", "R13c a avaliação é lida em qualquer nível de título; sem ela, vazia");
    /* escrever de novo */
    a.$("btnResIAObjNovo").onclick();
    ped = a.riaMontarPedido();
    ok(a.riaObjetivoAtual() === "novo" && ped.indexOf("A um ==!marca==.") < 0 && ped.indexOf(a.t("ria_p_obj_compl")) < 0, "R14 escrever de novo: o pedido vai sem o texto atual");
    ok(a.riaPrompt({ topico: "T", disciplina: "D", atual: "Texto velho.", objetivo: "novo" }).indexOf("Texto velho.") < 0
       && a.riaPrompt({ topico: "T", disciplina: "D", atual: "Texto velho." }).indexOf("Texto velho.") >= 0, "R14a o pedido 'de novo' deixa o texto de fora (sem objetivo, vai como antes)");
    a.$("btnResIAFechar").onclick();
    /* pelo ramo: complementar acrescenta no fim da seção dele */
    a.riaAbrirDoTopico("Leitura", "IA", chI, { ramos, ramo: "a" });
    ok(a.riaObjetivoAtual() === "complementar" && a.riaMontarPedido().includes(a.t("ria_p_obj_compl_ramo", { r: "A" })), "R12f pelo ramo, com seção escrita: complementar, com o pedido do ramo");
    digita("Mais do A.");
    ok(a.$("resIASemTxt").textContent === a.t("ria_sem_ramo_compl", { r: "A", c: 10 }), "R12g o semáforo do ramo diz que acrescenta: " + a.$("resIASemTxt").textContent);
    a.$("btnResIAAplicar").onclick();
    ok(a.matObter(chI).texto === T0.replace("> dica de A", "> dica de A\n\nMais do A."), "R12h acrescenta no fim da seção do ramo A, e só nela: " + JSON.stringify(a.matObter(chI).texto));
    a.$("btnResIADesfazer").onclick();
    a.$("btnResIAFechar").onclick();
    /* sem texto no escopo: não há objetivo */
    a.riaAbrirDoTopico("Leitura", "IA", chI, { ramos: ramos.concat([{ id: "c", nome: "C" }]), ramo: "c" });
    ok(a.$("resIAAtualLin").hidden === true && a.riaObjetivoAtual() === "novo" && a.riaModoDeAplicar() === "secoes", "R11a ramo sem seção: não há o que complementar (escreve)");
    a.$("btnResIAFechar").onclick();
  }
  a.matFechar();
  return falhas;
}

module.exports = { testes };
