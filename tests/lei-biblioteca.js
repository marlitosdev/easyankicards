/* =====================================================================
 * A LEI EXISTE UMA VEZ SÓ — e a Biblioteca mostra isso
 *
 * O DEFEITO REAL. Colar a Lei 4.320 num SEGUNDO tópico caía no mesmo registro
 * (o id nasce do nome) e o leiGuardar da criação substituía o texto e a lista
 * de tópicos: o primeiro tópico perdia o vínculo e o texto era trocado por
 * baixo, sem aviso. Fonte única não é só "um registro": é nunca deixar duas
 * coisas escreverem nele sem a pessoa saber.
 *
 * OS TIPOS DE ERRO, um bloco de testes para cada:
 *   I  identidade           duas leis iguais / duas leis diferentes confundidas
 *   O  sobrescrita          colar por cima do que já existe
 *   D  ponteiro solto       apagar a lei e o tópico continuar dizendo "tem lei"
 *   B  a Biblioteca         achar, ver onde é usada, ligar, desligar, abrir sem tópico
 *   M  duplicata            leis que parecem a mesma: unir sem perder nada
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const T = (tag, n) => Array.from({ length: n || 10 }, (_, i) =>
  "Art. " + (i + 1) + "º Texto " + tag + " do artigo " + (i + 1) + " completo da lei.").join("\n");
const CAB = (num, ano, ente) => "LEI COMPLEMENTAR Nº " + num + ", DE 05 DE JANEIRO DE " + ano + "\n"
  + (ente ? "Prefeitura de " + ente + " Praça Sen. Teotônio Vilela\n" : "");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const conduzir = async (api, aceitar) => {
    for (let i = 0; i < 25; i++) { await Promise.resolve(); try { api._uiFechar(aceitar); } catch (e) {} }
    await new Promise((r) => setTimeout(r, 5));
  };
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const resumo = (api, disc, top, concurso) => {
    const ch = api.matChave(disc, top);
    api.matGravar(ch, "Resumo.", { disciplina: disc, topico: top, concurso: concurso || "" });
    return ch;
  };

  const { api: p } = rodar();

  /* ==============================================================
   * I: IDENTIDADE
   * ============================================================== */
  ok(p.leiNumeroNorm("015") === "15" && p.leiNumeroNorm("4.320") === "4320" && p.leiNumeroNorm("0") === "0" && p.leiNumeroNorm("") === "",
     "I1 numero normalizado: " + [p.leiNumeroNorm("015"), p.leiNumeroNorm("4.320"), p.leiNumeroNorm("0")]);
  ok(p.leiEspecieNorm("Lei Complementar") === "lc" && p.leiEspecieNorm("LC") === "lc" && p.leiEspecieNorm("Lei") === "lei"
     && p.leiEspecieNorm("Decreto-Lei") === "decreto-lei" && p.leiEspecieNorm("Emenda Constitucional") === "ec",
     "I2 especie normalizada");
  const M = (a, b) => p.leiMesmaLei(a, b);
  ok(M({ especie: "Lei Complementar", numero: "15", ano: "2009" }, { especie: "LC", numero: "015", ano: "2009" }),
     "I3 'LC 15/2009' e 'Lei Complementar 015/2009' sao a mesma lei");
  ok(!M({ especie: "Lei", numero: "15", ano: "2009" }, { especie: "Lei Complementar", numero: "15", ano: "2009" }),
     "I3a Lei 15/2009 e LC 15/2009 sao leis diferentes");
  ok(!M({ numero: "15", ano: "2009" }, { numero: "15", ano: "2010" }), "I3b o ano diferente e' outra lei");
  ok(!M({ numero: "15", ano: "2009", ente: "Caruaru" }, { numero: "15", ano: "2009", ente: "Recife" }),
     "I3c a mesma LC 15/2009 de outra CIDADE e' outra lei");
  ok(M({ numero: "15", ano: "2009", ente: "Caruaru" }, { numero: "15", ano: "2009" }),
     "I3d se um lado nao sabe a cidade, so o numero e o ano decidem");
  ok(!M({ numero: "15", nome: "X" }, { numero: "", nome: "X" }), "I3e com numero de um lado so, nao e' a mesma");
  ok(M({ nome: "Constituição Federal de 1988" }, { nome: "constituicao federal de 1988" }) && !M({ nome: "Constituição Federal" }, { nome: "Lei X" }),
     "I3f sem numero, o nome (sem acento e caixa) decide");
  ok(p.leiEnteDoTexto("LEI COMPLEMENTAR 015\nPrefeitura de Caruaru Praça Sen. Teotônio Vilela, S/N°") === "Caruaru",
     "I4 a cidade do cabecalho nao foi lida: " + p.leiEnteDoTexto("Prefeitura de Caruaru Praça Sen."));
  ok(p.leiEnteDoTexto("Art. 1º Esta lei regula a prefeitura e o município.") === "", "I4a inventou uma cidade");
  ok(p.leiChaveIdentidade({ especie: "LC", numero: "015", ano: "2009", ente: "Caruaru" }) === "lc|15|2009|caruaru"
     && p.leiChaveIdentidade({ nome: "Constituição" }) === "", "I5 chave de identidade");

  /* ==============================================================
   * O: COLAR POR CIMA DO QUE JÁ EXISTE
   * ============================================================== */
  const criar = (api, disc, top, texto) => {
    api.leiAbrir(disc, top);
    api.$("leiTexto").value = texto;
    return api.leiGravar();
  };
  const A = CAB("15", "2009", "Caruaru") + T("A");
  const B = CAB("15", "2009", "Caruaru") + T("B");

  {
    const a = iniciar();
    criar(a, "Direito Tributário", "Receita", A);
    const l1 = a.leisLista()[0];
    a.leiNotaGuardar(l1.id, "3", "minha nota do art 3");
    const r = criar(a, "Direito Tributário", "Despesa", B);
    const l = a.leisLista();
    ok(r === "pendente" && a.$("dlgLeiJa").open === true, "O1 colar a mesma lei em outro topico nao perguntou: " + r);
    ok(l.length === 1 && /Texto A/.test(l[0].texto) && !/Texto B/.test(l[0].texto),
       "O1a o texto da lei que ja existia foi SUBSTITUIDO pelo colado");
    ok(l[0].topicos.length === 1 && /receita/.test(l[0].topicos[0]), "O1b o vinculo do primeiro topico foi apagado: " + JSON.stringify(l[0].topicos));
    ok(l[0].notasArtigos && l[0].notasArtigos["3"] === "minha nota do art 3", "O1c a nota do artigo se perdeu");
    ok(/Caruaru|15/.test(a.$("leiJaMsg").textContent || "") && /já existe/.test(a.$("leiJaMsg").textContent || ""), "O1d a mensagem nao diz qual lei ja existe: " + a.$("leiJaMsg").textContent);
    const ops = achar(a.$("leiJaOpcoes"), (c) => c.type === "radio").map((c) => c.value);
    ok(ops.join(",") === "usar,atualizar,separada", "O1e opcoes: " + ops);
    ok(a.$("btnLeiJaConfirmar").disabled === true, "O1f 'continuar' devia esperar a escolha");
    /* usar a que existe */
    achar(a.$("leiJaOpcoes"), (c) => c.value === "usar")[0].onchange();
    a.$("btnLeiJaConfirmar").onclick();
    const dep = a.leisLista();
    ok(dep.length === 1 && dep[0].topicos.length === 2 && /Texto A/.test(dep[0].texto),
       "O2 'usar' devia ligar o topico novo SEM mexer no texto: " + JSON.stringify(dep.map((x) => [x.topicos.length, /Texto A/.test(x.texto)])));
    ok(a.leiIdAtualValor() === dep[0].id && a.$("dlgLeiJa").open === false, "O2a a lei aberta devia ser a existente");
  }
  {
    const a = iniciar();
    criar(a, "D", "T1", A);
    criar(a, "D", "T2", B);
    achar(a.$("leiJaOpcoes"), (c) => c.value === "atualizar")[0].onchange();
    a.$("btnLeiJaConfirmar").onclick();
    ok(a.$("dlgLeiAtualizar").open === true && a.$("leiUpdTexto").value === B && a.leisLista().length === 1 && a.leisLista()[0].topicos.length === 2,
       "O3 'atualizar' devia ligar o topico e abrir a comparacao ja com o texto colado");
  }
  {
    const a = iniciar();
    criar(a, "D", "T1", A);
    criar(a, "D", "T2", B);
    achar(a.$("leiJaOpcoes"), (c) => c.value === "separada")[0].onchange();
    a.$("btnLeiJaConfirmar").onclick();
    const l = a.leisLista();
    ok(l.length === 2 && l[0].id !== l[1].id, "O4 'separada' devia criar outra lei, com outro id: " + JSON.stringify(l.map((x) => x.id)));
    const um = l.filter((x) => /Texto A/.test(x.texto))[0], dois = l.filter((x) => /Texto B/.test(x.texto))[0];
    ok(um && dois && um.topicos.length === 1 && dois.topicos.length === 1, "O4a a lei separada tirou algo da primeira");
  }
  {
    const a = iniciar();
    criar(a, "D", "T1", A);
    criar(a, "D", "T2", A);
    const ops = achar(a.$("leiJaOpcoes"), (c) => c.type === "radio").map((c) => c.value);
    ok(ops.join(",") === "usar,separada" && /igual ao guardado/.test(a.$("leiJaMsg").textContent), "O5 texto identico nao tem o que comparar: " + ops);
    a.$("btnLeiJaVoltar").onclick();
    ok(a.$("dlgLeiJa").open === false && a.leisLista().length === 1 && a.leisLista()[0].topicos.length === 1 && a.$("leiTexto").value === A && a.leiJaCtxAtual() === null,
       "O5a voltar nao pode mudar nada nem perder o texto colado");
  }
  {
    /* a mesma numeração em OUTRA cidade é outra lei: cria, sem perguntar e sem cair por cima */
    const a = iniciar();
    criar(a, "D", "T1", CAB("15", "2009", "Caruaru") + T("A"));
    const r = criar(a, "D", "T2", CAB("15", "2009", "Recife") + T("B"));
    const l = a.leisLista();
    ok(r !== "pendente" && l.length === 2 && l[0].id !== l[1].id, "O6 LC 15/2009 de outra cidade devia virar outra lei sem perguntar: " + r + " " + l.length);
    ok(l.some((x) => /Texto A/.test(x.texto) && x.ente === "Caruaru") && l.some((x) => /Texto B/.test(x.texto) && x.ente === "Recife"),
       "O6a os textos ou a cidade se misturaram: " + JSON.stringify(l.map((x) => [x.ente, /Texto A/.test(x.texto)])));
  }

  /* ==============================================================
   * D: APAGAR NÃO DEIXA PONTEIRO SOLTO
   * ============================================================== */
  {
    const a = iniciar();
    const ch = resumo(a, "Direito", "Receita");
    const l = a.leiGuardar({ nome: "Lei 4.320/1964", texto: T("A"), topicos: [ch] });
    a.matResumosAtual()[ch].leiId = l.id;
    a.leiApagar(l.id);
    ok(a.matResumosAtual()[ch].leiId === "", "D1 apagar a lei deixou o topico apontando para ela: " + a.matResumosAtual()[ch].leiId);
  }
  {
    const a = iniciar();
    const ch1 = resumo(a, "Direito", "Receita"), ch2 = resumo(a, "Direito", "Despesa");
    const l = a.leiGuardar({ nome: "Lei 4.320/1964", numero: "4320", ano: "1964", texto: T("A"), topicos: [ch1, ch2] });
    a.matResumosAtual()[ch1].leiId = l.id;
    a.leiBibAbrir();
    const conf = a.leiBibApagar(l);
    await conduzir(a, false);
    ok((await conf) === false && a.leisLista().length === 1, "D2 recusar a confirmacao devia manter a lei");
    const conf2 = a.leiBibApagar(l);
    const msg = a.$("uiModalMsg").textContent || "";
    ok(/2 tópico/.test(msg) && /Receita/.test(msg) && /Despesa/.test(msg), "D2a a confirmacao nao diz ONDE a lei e' usada: " + msg);
    await conduzir(a, true);
    await conf2;
    ok(a.leisLista().length === 0 && a.matResumosAtual()[ch1].leiId === "", "D2b confirmar devia apagar e soltar o ponteiro");
  }

  /* ==============================================================
   * B: A BIBLIOTECA
   * ============================================================== */
  const montar = () => {
    const a = iniciar();
    const ch1 = resumo(a, "Direito Financeiro", "Receita pública", "TCE-PE");
    const ch2 = resumo(a, "Direito Financeiro", "Despesa pública", "TCE-PE");
    const ch3 = resumo(a, "Direito Tributário", "Código Tributário", "Prefeitura de Caruaru");
    const l4320 = a.leiGuardar({ nome: "Lei 4.320/1964", especie: "Lei", numero: "4320", ano: "1964", apelido: "LORC",
      texto: T("A"), topicos: [ch1, ch2], parei: "4" });
    const lctm = a.leiGuardar({ nome: "LC 015/2009", especie: "Lei Complementar", numero: "15", ano: "2009", ente: "Caruaru",
      texto: T("B", 6), topicos: [ch3], anexos: [{ titulo: "ANEXO I", texto: "x" }] });
    const livre = a.leiGuardar({ nome: "Lei 8.666/1993", especie: "Lei", numero: "8666", ano: "1993", texto: T("C", 5), topicos: [] });
    return { a, ch1, ch2, ch3, l4320, lctm, livre };
  };
  {
    const { a, l4320, lctm, livre } = montar();
    a.leiBibAbrir();
    ok(a.$("dlgLeiBib").open === true, "B1 a biblioteca nao abriu");
    ok(a.leiBibLista().length === 3, "B1a devia listar as 3 leis: " + a.leiBibLista().length);
    a.leiBibFiltrar("sem");
    ok(a.leiBibLista().map((x) => x.l.id).join(",") === livre.id, "B2 o filtro 'sem vinculo' devia mostrar so a Lei 8.666");
    a.leiBibFiltrar("todas", "4320");
    ok(a.leiBibLista().map((x) => x.l.id).join(",") === l4320.id, "B3 buscar '4320' devia achar a Lei 4.320 (numero sem ponto)");
    a.leiBibFiltrar("todas", "lorc");
    ok(a.leiBibLista().length === 1 && a.leiBibLista()[0].l.id === l4320.id, "B3a buscar pela sigla");
    a.leiBibFiltrar("todas", "caruaru");
    ok(a.leiBibLista().length === 1 && a.leiBibLista()[0].l.id === lctm.id, "B3b buscar pela cidade");
    a.leiBibFiltrar("todas", "2009");
    ok(a.leiBibLista().length === 1 && a.leiBibLista()[0].l.id === lctm.id, "B3c buscar pelo ano");
    a.leiBibFiltrar("todas", "");
    a.leiBibPintar();
    const cards = achar(a.$("leiBibLista"), (c) => /lei-bib-card/.test(c.className || ""));
    ok(cards.length === 3, "B4 a tela devia ter 3 cartoes: " + cards.length);
    const txt = (el) => [el].concat(achar(el, () => true)).map((c) => c.textContent || "").join(" ");
    const c4320 = cards.filter((c) => /4\.320/.test(txt(c)))[0];
    ok(/10 artigo/.test(txt(c4320)) && /ligada a 2 tópico/.test(txt(c4320)) && /parei no art\. 4/.test(txt(c4320)) && /sigla: LORC/.test(txt(c4320)),
       "B4a o cartao nao diz artigos, onde e' usada, onde parei e a sigla: " + txt(c4320).slice(0, 300));
    const cctm = cards.filter((c) => /015/.test(txt(c)))[0];
    ok(/1 anexo/.test(txt(cctm)) && /cidade\/órgão: Caruaru/.test(txt(cctm)), "B4b anexo e cidade no cartao");
    const clivre = cards.filter((c) => /8\.666/.test(txt(c)))[0];
    ok(/sem vínculo com nenhum tópico/.test(txt(clivre)), "B4c a lei sem vinculo nao avisa: " + txt(clivre).slice(0, 200));
    ok(a.$("leiBibResumo").textContent.indexOf("1 sem vínculo") >= 0, "B4d o resumo nao conta as leis sem vinculo: " + a.$("leiBibResumo").textContent);
    const usos = achar(c4320, (c) => /lei-bib-uso(\s|$)/.test(c.className || ""));
    ok(usos.length === 2 && /TCE-PE/.test(usos[0].textContent) && /Receita pública/.test(usos.map((u) => u.textContent).join("")),
       "B5 'onde e' usada' nao lista concurso, disciplina e topico: " + usos.map((u) => u.textContent).join(" | "));
  }
  {
    /* desligar de UM tópico */
    const { a, ch1, ch2, l4320 } = montar();
    a.matResumosAtual()[ch1].leiId = l4320.id;
    a.leiBibAbrir();
    const usos = a.leiUsosDaLei(a.leiDe(l4320.id), null);
    const p1 = a.leiBibDesligar(a.leiDe(l4320.id), usos.filter((u) => /Receita/.test(u.topico))[0]);
    await conduzir(a, true);
    await p1;
    const dep = a.leiDe(l4320.id);
    ok(dep.topicos.length === 1 && /despesa/.test(dep.topicos[0]) && !!dep, "B6 desligar de um topico so devia tirar aquele: " + JSON.stringify(dep.topicos));
    ok(a.matResumosAtual()[ch1].leiId === "", "B6a o ponteiro preferido do topico continuou apontando para a lei");
    ok(a.leiDe(l4320.id) && /Texto A/.test(a.leiDe(l4320.id).texto), "B6b desligar apagou a lei");
  }
  {
    /* ligar a um tópico, a partir da biblioteca */
    const { a, ch3, livre } = montar();
    a.leiTopicoAbrir(a.leiDe(livre.id));
    const linhas = achar(a.$("leiTopLista"), (c) => /lei-bib-uso/.test(c.className || ""));
    ok(linhas.length >= 3, "B7 o seletor de topicos devia listar os topicos conhecidos: " + linhas.length);
    const alvo = linhas.filter((x) => /Código Tributário/.test(x.textContent))[0];
    achar(alvo, (c) => c.tagName === "BUTTON" || c.textContent === "ligar")[0].onclick();
    ok(a.leiDe(livre.id).topicos.length === 1 && a.leiDe(livre.id).topicos[0].indexOf("código tributário") >= 0,
       "B7a ligar nao gravou o vinculo: " + JSON.stringify(a.leiDe(livre.id).topicos));
    a.leiTopCtxAtual().busca = "receita";
    a.leiTopicoPintar();
    ok(achar(a.$("leiTopLista"), (c) => /lei-bib-uso/.test(c.className || "")).length === 1, "B7b a busca de topico nao filtrou");
  }
  {
    /* abrir SEM tópico: o que depende de um tópico sabe disso, e o resto funciona */
    const { a, lctm } = montar();
    a.leiAbrirAvulsa(lctm.id);
    ok(a.$("dlgLeiSeca").open === true && a.leiIdAtualValor() === lctm.id, "B8 a lei nao abriu pela biblioteca");
    ok(/Aberta pela Biblioteca/.test(a.$("leiSub").textContent || ""), "B8a o subtitulo devia dizer que veio da biblioteca: " + a.$("leiSub").textContent);
    const fila = achar(a.$("leiFila"), () => true).map((c) => c.textContent || "").join("|");
    ok(/LC 015\/2009/.test(fila) && achar(a.$("leiFila"), (c) => c.id === "btnLeiNova" || c.id === "btnLeiVincular").length === 0 && achar(a.$("leiFila"), (c) => /lei-chip-x/.test(c.className || "")).length === 0,
       "B8b a fila devia mostrar so a lei, sem 'colar nova', 'usar guardada' nem 'desligar': " + fila);
    a.leiRegistrarLeitura();
    ok(a.$("dlgRegistro").open !== true && /sem um tópico/.test(a.$("uiModalMsg").textContent || ""),
       "B8c registrar leitura sem topico devia avisar (e nao gravar estudo de um topico que nao existe)");
    await conduzir(a, true);
    /* marcar/gravar no texto continua funcionando */
    a.leiAplicarNoTopico("", a.leiDe(lctm.id).texto + "\nArt. 7º Acrescentado pela biblioteca.");
    ok(/Acrescentado pela biblioteca/.test(a.leiDe(lctm.id).texto), "B8d o texto da lei aberta sem topico nao gravou");
    ok(a.leiTextoDoTopico("").indexOf("Acrescentado") >= 0, "B8e leiTextoDoTopico('') nao devolve a lei aberta");
  }

  /* ==============================================================
   * M: LEIS QUE PARECEM A MESMA
   * ============================================================== */
  const gemeas = () => {
    const a = iniciar();
    const ch1 = resumo(a, "Direito Tributário", "CTM"), ch2 = resumo(a, "Direito Tributário", "ISS"), ch3 = resumo(a, "Direito", "Outro");
    const x = a.leiGuardar({ id: "lei_x", nome: "LC 015/2009", especie: "Lei Complementar", numero: "15", ano: "2009", apelido: "CTM",
      texto: T("X", 8), topicos: [ch1], notasArtigos: { "3": "nota do X", "5": "so no X" }, blocos: { "Cap I": "2026-01-10" },
      alteracoes: { "2": { texto: "Art. 2º novo X", fonteAlteracao: "LC 1", data: "2026-01-01", revogado: false } }, parei: "3", pareiEm: "2026-01-01T10:00:00.000Z" });
    const y = a.leiGuardar({ id: "lei_y", nome: "Lei Complementar 15/2009", especie: "Lei Complementar", numero: "015", ano: "2009", apelido: "CODIGO",
      texto: T("Y", 12), topicos: [ch2, ch3], notasArtigos: { "3": "nota do Y" }, blocos: { "Cap I": "2026-03-01", "Cap II": "2026-03-02" },
      notasTrechos: [{ k: "abc", trecho: "abc", texto: "nota de trecho" }], repetidosOk: ["9"],
      alteracoes: { "2": { texto: "Art. 2º novo Y" }, "4": { texto: "Art. 4º novo Y" } }, parei: "6", pareiEm: "2026-03-01T10:00:00.000Z",
      fonte: "http://exemplo/y" });
    a.matResumosAtual()[ch2].leiId = y.id;
    return { a, ch1, ch2, ch3, x, y };
  };
  {
    const { a } = gemeas();
    const g = a.leiDuplicadasNaBiblioteca();
    ok(g.length === 1 && g[0].length === 2, "M1 as duas versoes da LC 15/2009 nao foram apontadas como a mesma: " + JSON.stringify(g.map((x) => x.map((l) => l.id))));
    a.leiMarcarDistintas(["lei_x", "lei_y"]);
    ok(a.leiDuplicadasNaBiblioteca().length === 0, "M1a 'sao diferentes' nao silenciou o aviso");
    ok(a.leiAcharIgual(a.leiDe("lei_x"), "lei_x") === null, "M1b leiAcharIgual ainda acha a que a pessoa disse ser diferente");
  }
  {
    const { a, ch1, ch2, ch3 } = gemeas();
    const r = a.leiMesclar("lei_y", ["lei_x"]);
    const l = a.leisLista();
    ok(!!r && l.length === 1 && l[0].id === "lei_y", "M2 a lei absorvida devia sumir: " + JSON.stringify(l.map((x) => x.id)));
    const y = l[0];
    ok(y.topicos.length === 3 && y.topicos.indexOf(ch1) >= 0, "M2a os topicos das duas leis deviam ser unidos: " + JSON.stringify(y.topicos));
    ok(/nota do Y/.test(y.notasArtigos["3"]) && /nota do X/.test(y.notasArtigos["3"]) && y.notasArtigos["5"] === "so no X",
       "M2b a nota do mesmo artigo devia ficar com as DUAS, e a que so existia numa devia entrar: " + JSON.stringify(y.notasArtigos));
    ok(y.blocos["Cap I"] === "2026-03-01" && y.blocos["Cap II"] === "2026-03-02", "M2c blocos lidos: fica a data mais recente");
    ok(/novo Y/.test(y.alteracoes["2"].texto) && !!y.alteracoes["4"], "M2d alteracoes: a da lei mantida vence, as outras entram");
    ok(/CODIGO/.test(y.apelido) && /CTM/.test(y.apelido), "M2e as siglas das duas devem ficar: " + y.apelido);
    ok(y.parei === "6", "M2f onde parei: a leitura mais recente vence: " + y.parei);
    ok(/Texto Y/.test(y.texto) && !/Texto X/.test(y.texto), "M2g o texto e' o da lei mantida");
    ok(y.notasTrechos.length === 1 && y.repetidosOk.indexOf("9") >= 0, "M2h notas de trecho e conferidos");
    ok(a.matResumosAtual()[ch2].leiId === "lei_y", "M2i o ponteiro do topico devia continuar apontando para a mantida");
  }
  {
    /* mesclar ponteiro da absorvida para a mantida */
    const { a, ch1, x } = gemeas();
    a.matResumosAtual()[ch1].leiId = "lei_x";
    a.leiMesclar("lei_y", ["lei_x"]);
    ok(a.matResumosAtual()[ch1].leiId === "lei_y", "M3 o ponteiro do topico que apontava para a absorvida devia passar para a mantida: " + a.matResumosAtual()[ch1].leiId);
    ok(a.leiMesclar("lei_y", ["lei_y"]) === null && a.leiMesclar("nao_existe", ["lei_y"]) === null, "M3a mesclar consigo mesma ou com lei inexistente devia recusar");
  }
  {
    /* a tela: sugere a mais usada, avisa se outra tem mais artigos, mescla e fecha */
    const { a } = gemeas();
    a.leiBibAbrir();
    ok(a.$("leiBibDup").hidden === false && /1 grupo/.test(a.$("btnLeiBibDup").textContent), "M4 a biblioteca nao avisa das leis que parecem a mesma: " + a.$("btnLeiBibDup").textContent);
    a.leiMesAbrir();
    ok(a.$("dlgLeiMes").open === true && a.leiMesCtxAtual().manter === "lei_y", "M4a a sugestao devia ser a lei ligada a mais topicos: " + (a.leiMesCtxAtual() || {}).manter);
    achar(a.$("leiMesLista"), (c) => c.value === "lei_x")[0].onchange();
    ok(a.$("leiMesAviso").hidden === false && /mais artigos \(12\)/.test(a.$("leiMesAviso").textContent), "M4b escolher a de MENOS artigos devia avisar: " + a.$("leiMesAviso").textContent);
    a.$("btnLeiMesConfirmar").onclick();
    ok(a.leisLista().length === 1 && a.leisLista()[0].id === "lei_x" && a.$("dlgLeiMes").open === false, "M4c confirmar devia manter a escolhida e fechar");
  }
  {
    const { a } = gemeas();
    a.leiMesAbrir();
    a.$("btnLeiMesDistintas").onclick();
    ok(a.leisLista().length === 2 && a.$("dlgLeiMes").open === false && a.leiDuplicadasNaBiblioteca().length === 0,
       "M5 'sao leis diferentes' devia manter as duas e parar de avisar");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
