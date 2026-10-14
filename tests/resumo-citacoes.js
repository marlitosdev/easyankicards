/* =====================================================================
 * CITAÇÕES DE LEI NO RESUMO (v18.24.0)
 *
 * O relato, com o texto real: "(art. 113, § 1º, do CTN)" no resumo era
 * texto morto. O motor que liga o comentário da questão à lei já entendia
 * a citação inteira — só nunca tinha sido chamado na leitura do resumo.
 *
 * O que se prova aqui:
 *  · cada citação vira um link, com o estado à vista (com lei × sem lei);
 *  · o texto do resumo (gravado e na tela) não muda uma letra;
 *  · as marcas continuam, e a citação dentro de uma marca também vira link;
 *  · tocar abre a PRÉVIA do artigo por cima do resumo, e "abrir a lei
 *    inteira" leva ao artigo e devolve ao resumo;
 *  · citação sem lei certa pergunta pelo mesmo menu das questões;
 *  · o vínculo permanente vale no resumo;
 *  · "🔗 vínculos de lei" lista as citações do resumo, com o texto certo.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const DISC = "Direito Tributário";
  const TOP = "Obrigação tributária";
  const TXT = [
    "* Obrigação Principal (art. 113, § 1º, do CTN): surge com a ocorrência do fato gerador.",
    "* Exceções:",
    "* A obrigação acessória converte-se em principal (art. 113, § 3º, do CTN).",
    "* Inaplicabilidade da regra de acessoriedade do Direito Civil: a obrigação acessória é autônoma.",
    "* Falso: o tributo não constitui sanção de ato ilícito (art. 3º do CTN), e a multa é obrigação principal (art. 113, § 1º).",
    "",
    "==?Ponto marcado (art. 113, § 2º, do CTN) para rever==",
  ].join("\n");

  const preparar = (api, opc) => {
    const o = opc || {};
    api.matIniciar(); api.leiIniciar();
    const ch = api.matChave(DISC, TOP);
    api.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", apelido: "CTN",
      especie: "Lei", numero: "5.172",
      texto: "Art. 3º Tributo é toda prestação pecuniária compulsória.\n"
        + "Art. 113. A obrigação tributária é principal ou acessória.\n"
        + "§ 1º A obrigação principal surge com a ocorrência do fato gerador.\n"
        + "§ 2º A obrigação acessória decorre da legislação tributária.\n"
        + "§ 3º A obrigação acessória, pelo simples fato da sua inobservância, converte-se em obrigação principal." });
    api.leiGuardar({ id: "lei_cf", nome: "Constituição Federal de 1988", apelido: "CF/88",
      especie: "Constituição", texto: "Art. 113. Outro artigo 113, da Constituição." });
    api.leiLigar("lei_ctn", ch);
    if (o.duasLeis) api.leiLigar("lei_cf", ch);
    api.matGravar(ch, o.texto || TXT, { disciplina: DISC, topico: TOP });
    api.matAbrirEditor({ disciplina: DISC, nome: TOP }, true);
    return ch;
  };
  const links = (api) => api.$("matLeitura").querySelectorAll("button.mat-lei-link");
  const cls = (b) => String((b && b.className) || "");

  /* R1-R4: as citações viram links, o texto não muda */
  {
    const { api } = rodar();
    const ch = preparar(api);
    const ls = links(api);
    ok(ls.length === 5, "R1 esperava 5 links (4 citações + 1 dentro da marca), vieram " + ls.length
      + ": " + ls.map((b) => b.textContent).join(" | "));
    ok(ls.length && ls[0].textContent === "art. 113, § 1º, do CTN",
      "R1a o 1º link não cobre a citação inteira: " + (ls[0] && ls[0].textContent));
    ok(ls.every((b) => !/qs-lei-link-sem/.test(cls(b))),
      "R2 com o CTN ligado ao tópico, todo link devia saber a lei (inclusive o sem 'do CTN'): "
      + ls.filter((b) => /sem/.test(cls(b))).map((b) => b.textContent).join(" | "));
    ok(/Código Tributário Nacional/.test(ls[0].title || "") && /113/.test(ls[0].title || ""),
      "R2a o balão do link não diz para onde ele leva: " + ls[0].title);
    const tela = api.$("matLeitura").textContent || "";
    ok(tela.indexOf("Obrigação Principal (art. 113, § 1º, do CTN): surge com") >= 0
      && tela.indexOf("sanção de ato ilícito (art. 3º do CTN), e a multa") >= 0,
      "R3 desenhar os links mudou o texto na tela: " + JSON.stringify(tela.slice(0, 200)));
    ok(((api.matObter(ch) || {}).texto || "") === TXT, "R3a o texto gravado do resumo mudou");
    ok(api.$("matTexto").value === TXT, "R3b o texto do editor mudou");
    /* a citação dentro de uma marca vira link sem desmanchar a marca */
    const naMarca = ls.filter((b) => /§ 2º/.test(b.textContent || ""))[0];
    ok(!!naMarca && naMarca.parentNode && String(naMarca.parentNode.tagName || "").toUpperCase() === "MARK",
      "R4 a citação dentro da marca de dúvida não virou link dentro da marca");
    ok(api.$("matLeitura").querySelectorAll("mark.m-duv").length === 1, "R4a a marca de dúvida sumiu");
    /* ligar de novo não aninha link dentro de link */
    ok(api.matCitacoesLigar(api.$("matLeitura")) === 0 && links(api).length === 5,
      "R4b ligar as citações de novo criou link dentro de link");
    /* texto DENTRO de um botão (o modo prova desenha botões) nunca vira link */
    const bt = api.document.createElement("button");
    bt.append(api.document.createTextNode("alternativa: art. 5º do CTN"));
    api.$("matLeitura").append(bt);
    ok(api.matCitacoesLigar(api.$("matLeitura")) === 0, "R4c o texto de um botão virou link (link dentro de botão)");
  }

  /* R5-R8: tocar abre a prévia; "abrir a lei inteira" vai ao artigo e volta */
  {
    const { api } = rodar();
    preparar(api);
    const b = links(api)[0];
    b.onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open === true, "R5 tocar na citação não abriu a prévia do artigo");
    ok(api.$("dlgMaterial").open === true, "R5a a prévia fechou o resumo");
    ok(/Código Tributário Nacional/.test(api.$("leiCitaPreviewTitulo").textContent || ""),
      "R6 a prévia não mostra a lei certa: " + api.$("leiCitaPreviewTitulo").textContent);
    const prev = api.$("leiCitaPreviewTexto").textContent || "";
    ok(/principal ou acessória/.test(prev), "R6a a prévia não mostra o art. 113: " + prev.slice(0, 120));
    ok(/§ 1º[^\n]*surge com a ocorrência/.test(prev),
      "R7 a prévia não separa o trecho citado (§ 1º): " + JSON.stringify(prev.slice(-200)));
    const alvo = api.leiCitaPreviewAlvoAtual();
    ok(alvo && alvo.ctx && alvo.ctx.topico === TOP, "R7a a prévia não sabe que veio do resumo");
    /* a citação SEM "do CTN" (lei única do tópico) abre a prévia na lei do tópico */
    api.$("dlgLeiCitaPreview").close();
    links(api).filter((x) => x.textContent === "art. 113, § 1º")[0].onclick({ stopPropagation() {} });
    ok(/Código Tributário Nacional/.test(api.$("leiCitaPreviewTitulo").textContent || "")
      && /principal ou acessória/.test(api.$("leiCitaPreviewTexto").textContent || ""),
      "R7b a citação sem lei, com uma lei só no tópico, não abriu a prévia nela: " + api.$("leiCitaPreviewTitulo").textContent);
    api.leiCitacaoPreviewAbrirLeiInteira();
    ok(!api.$("dlgLeiCitaPreview").open, "R8 a prévia não fechou ao abrir a lei inteira");
    ok(api.$("dlgLeiSeca").open === true, "R8a a lei não abriu");
    ok(api.leiIdAtualValor() === "lei_ctn", "R8b abriu outra lei: " + api.leiIdAtualValor());
    ok(api.$("dlgMaterial").open === true, "R8c abrir a lei fechou o resumo (devia empilhar por cima)");
    /* fechar a lei devolve ao resumo, que repinta com os links */
    api.$("matLeitura").innerHTML = "";
    api.leiVoltarPara();
    ok(links(api).length === 5, "R8d na volta da lei o resumo não foi repintado com os links");
  }

  /* R9-R11: sem lei certa — pergunta, não chuta */
  {
    const { api } = rodar();
    preparar(api, { duasLeis: true, texto: TXT + "\n* Sem lei nenhuma antes: art. 113, § 2º." });
    const ls = links(api);
    /* sem lei NENHUMA citada antes no parágrafo: pergunta */
    const semNome = ls.filter((b) => b.textContent === "art. 113, § 2º")[0];
    ok(!!semNome && /qs-lei-link-sem/.test(cls(semNome)),
      "R9 com duas leis no tópico, a citação sem lei devia aparecer como 'sem lei'");
    /* D1 (v18.26.0): com a lei citada antes NO MESMO item, a citação sem lei a herda */
    const herda = ls.filter((b) => b.textContent === "art. 113, § 1º")[0];
    ok(!!herda && !/qs-lei-link-sem/.test(cls(herda)) && /qs-lei-link-ded/.test(cls(herda))
      && /usei CTN, a última citada/.test(herda.title || ""),
      "D1 '(art. 113, § 1º)' depois de '(art. 3º do CTN)' no mesmo item devia herdar o CTN e dizer isso: " + (herda && cls(herda) + " | " + herda.title));
    ok(ls.filter((b) => /qs-lei-link-ded/.test(cls(b))).length === 1, "D1a só a citação sem lei devia ser deduzida");
    ok(/não diz de qual lei/.test((semNome && semNome.title) || ""), "R9a o balão não explica: " + (semNome && semNome.title));
    ok(ls.filter((b) => /CTN/.test(b.textContent || "")).every((b) => !/sem/.test(cls(b))),
      "R9b as citações com 'do CTN' deviam continuar sabendo a lei");
    semNome.onclick({ stopPropagation() {} });
    const menu = api.$("qsLeiMenu");
    ok(!!menu && !menu.hidden, "R10 a citação sem lei não abriu o menu de escolher a lei");
    ok(!api.$("dlgLeiCitaPreview").open, "R10a abriu uma prévia chutando a lei");
    const bts = menu ? menu.querySelectorAll("button") : [];
    const doCtn = bts.filter((x) => /Código Tributário/.test(x.textContent || ""))[0];
    ok(!!doCtn, "R10b o menu não oferece o CTN do tópico");
    if (doCtn) {
      doCtn.onclick({});
      ok(api.$("dlgLeiSeca").open === true, "R11 escolher a lei no menu não abriu a lei");
      ok(api.$("dlgMaterial").open === true, "R11a escolher a lei fechou o resumo");
    }
    /* D2: a citação que herdou a lei abre a prévia nela, sem perguntar */
    api.$("dlgLeiSeca").close();
    links(api).filter((b) => b.textContent === "art. 113, § 1º")[0].onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open === true && /Código Tributário/.test(api.$("leiCitaPreviewTitulo").textContent || ""),
      "D2 a citação com lei herdada não abriu a prévia no CTN");
  }

  /* D3-D7 (v18.26.0): a lei herdada do parágrafo — regras e onde vale */
  {
    const { api } = rodar();
    const d = (txt, antes) => { const cs = api.leiCitacoesNoTexto(txt); const r = api.leiDeduzirRotulos(txt, cs, antes); return { cs, r }; };
    let x = d("Ver o art. 3º do CTN e depois o art. 113.");
    ok(x.cs[1].rotuloDeduzido === "CTN" && x.r === "CTN", "D3 no mesmo parágrafo a lei devia passar adiante");
    x = d("Ver o art. 3º do CTN.\nDepois o art. 113.");
    ok(!x.cs[1].rotuloDeduzido && x.r === "", "D3a parágrafo novo devia esquecer a lei");
    x = d("Ver o art. 3º do CTN e o art. 99 desta lei.");
    ok(!x.cs[1].rotuloDeduzido, "D3b 'desta lei' não pode herdar a lei citada antes");
    x = d("e o art. 113.", "CTN");
    ok(x.cs[0].rotuloDeduzido === "CTN", "D3c a lei vista no pedaço anterior (mesmo parágrafo) devia valer");
    x = d("o art. 5º da CF e o art. 113 do CTN, e o art. 9º.");
    ok(x.cs[2].rotuloDeduzido === "CTN", "D3d vale a ÚLTIMA lei citada, não a primeira");
    const perm = [{ ini: 0, fim: 4, leiId: "lei_x", rotulo: "" }];
    api.leiDeduzirRotulos("abcd", perm, "CTN");
    ok(!perm[0].rotuloDeduzido, "D3e o vínculo fixado pela pessoa não pode receber lei deduzida");
    x = d("Ver o art. 3º do CTN.\nOutro parágrafo sem citação.");
    ok(x.r === "", "D3f o parágrafo acabou depois da citação: a lei não pode passar para o próximo pedaço");
  }
  {
    /* D4: com UMA lei no tópico nada muda — vale a do tópico, sem marca de deduzida */
    const { api } = rodar();
    preparar(api);
    ok(links(api).every((b) => !/qs-lei-link-ded/.test(cls(b))), "D4 com uma lei só no tópico, nenhum link devia ser 'deduzido'");
  }
  {
    /* D5: no comentário da questão vale o mesmo, e a lista de vínculos diz que deduziu */
    const { api } = rodar();
    preparar(api, { duasLeis: true });
    const q = { disciplina: DISC, topico: TOP, comentario: "Segundo o art. 3º do CTN, e conforme o art. 113, § 3º, a multa é principal." };
    const el = api.document.createElement("div");
    api.qsUiComentario(el, q);
    const bs = el.querySelectorAll("button.qs-lei-link");
    ok(bs.length === 2 && /qs-lei-link-ded/.test(cls(bs[1])) && !/qs-lei-link-sem/.test(cls(bs[1])),
      "D5 no comentário, a citação sem lei devia herdar o CTN: " + bs.map(cls).join(" | "));
    api.qsVincAbrir(q, el, "");
    ok(/lei deduzida de “CTN”/.test(api.$("qsVincLista").textContent || ""), "D5a a lista de vínculos não diz que a lei foi deduzida");
  }
  {
    /* D6-D7: o pedido à IA exige a citação completa e dá os nomes que o app reconhece */
    const { api } = rodar();
    const ch = preparar(api, { duasLeis: true });
    const leis = api.riaLeisDoTopico(ch);
    const ctn = leis.filter((l) => l.nome.indexOf("Código Tributário") >= 0)[0];
    const cf = leis.filter((l) => l.nome.indexOf("Constituição") >= 0)[0];
    ok(ctn && ctn.sigla === "CTN" && cf && cf.sigla === "CF/88", "D6 as siglas das leis do tópico saíram erradas: " + JSON.stringify(leis));
    const p = api.riaPrompt({ disciplina: DISC, topico: TOP, prof: "padrao", ramos: [], leis });
    ok(/CITAÇÕES: escreva sempre a citação completa/.test(p), "D7 o pedido não exige a citação completa");
    ok(/chame as leis deste tópico assim: /.test(p) && /Código Tributário Nacional \(CTN\)/.test(p) && /Constituição Federal de 1988 \(CF\/88\)/.test(p), "D7a o pedido não dá os nomes das leis: " + p.slice(-300));
    const p0 = api.riaPrompt({ disciplina: DISC, topico: TOP, prof: "padrao", ramos: [] });
    ok(!/chame as leis deste tópico/.test(p0), "D7b sem leis no tópico, a linha dos nomes não devia aparecer");
    /* o pedido montado pela TELA (resumo pela IA) leva os nomes das leis do tópico */
    api.riaAbrirDoTopico(DISC, TOP);
    ok(/Código Tributário Nacional \(CTN\)/.test(api.riaMontarPedido()), "D7c o pedido da tela não leva os nomes das leis do tópico");
    /* duas leis com as mesmas iniciais: "CTN" não leva a uma só — não pode ir no pedido */
    api.leiGuardar({ id: "lei_ctn2", nome: "Lei 1/2000 - Código Tributário Nacional", especie: "Lei", numero: "1", texto: "Art. 1º Um." });
    api.leiLigar("lei_ctn2", ch);
    const leis2 = api.riaLeisDoTopico(ch);
    /* a lei_ctn tem o APELIDO "CTN" (escolhido pela pessoa) e fica com ele; a outra não pode recebê-lo */
    const outra = leis2.filter((l) => /^Lei 1\/2000/.test(l.nome))[0];
    ok(outra && outra.sigla !== "CTN" && leis2.filter((l) => l.sigla === "CTN").length === 1,
      "D6a com duas leis 'CTN', a sigla ambígua foi para o pedido: " + JSON.stringify(leis2));
  }
  {
    const { api } = rodar();
    preparar(api, { texto: "Ver o art. 5º da XPTO e o art. 113 do CTN." });
    const ls = links(api);
    const xpto = ls.filter((b) => /XPTO/.test(b.textContent || ""))[0];
    ok(!!xpto && /qs-lei-link-sem/.test(cls(xpto)) && /XPTO/.test(xpto.title || ""),
      "R12 lei desconhecida devia virar link 'sem lei' dizendo o nome: " + (xpto && xpto.title));
  }

  /* R13: o vínculo permanente que a pessoa fixou vale no resumo */
  {
    const { api } = rodar();
    api.citVinculoSalvar({ trecho: "regra de acessoriedade", leiId: "lei_ctn", artigos: [{ num: "113", numCru: "113" }] });
    preparar(api);
    const perm = links(api).filter((b) => b.textContent === "regra de acessoriedade")[0];
    ok(!!perm && /qs-lei-link-perm/.test(cls(perm)), "R13 o vínculo permanente não virou link no resumo");
  }

  /* R14: sem citação, nada muda */
  {
    const { api } = rodar();
    preparar(api, { texto: "Resumo sem nenhuma citação de artigo. Parte importante." });
    ok(links(api).length === 0, "R14 um resumo sem citação ganhou link");
  }

  /* R15-R16: "🔗 vínculos de lei" do resumo */
  {
    const { api } = rodar();
    preparar(api);
    api.matVinculosAbrir("");
    ok(api.$("dlgQsVinc").open === true, "R15 o botão de vínculos não abriu a janela");
    ok(/resumo/.test(api.$("qsVincTit").textContent || ""), "R15a o título fala de comentário, não de resumo: " + api.$("qsVincTit").textContent);
    ok(/resumo/.test(api.$("qsVincAjuda").textContent || ""), "R15b a ajuda fala de comentário");
    ok(!!api.$("qsVincCit_3") && !api.$("qsVincCit_5"), "R16 a lista devia ter as 5 citações do resumo");
    /* e nas questões continua falando de comentário */
    api.qsVincAbrir({ disciplina: DISC, topico: TOP, comentario: "art. 3º do CTN" }, null, "");
    ok(/comentário/.test(api.$("qsVincTit").textContent || ""), "R16a nas questões o título deixou de falar de comentário");
    ok(!!api.$("btnMatVinc"), "R16b o botão 🔗 vínculos de lei não está na barra da leitura");
  }

  /* R17: quem repinta na volta da lei — questão × resumo */
  {
    const { api } = rodar();
    let chamou = 0;
    api.qsUiVoltaDe({ _aoVoltar: () => { chamou++; } })();
    ok(chamou === 1, "R17 o _aoVoltar do resumo não foi chamado");
    let falhou = false;
    try { api.qsUiVoltaDe({ disciplina: "x", topico: "y" })(); } catch (e) { falhou = true; }
    ok(!falhou, "R17a a volta padrão (questões) quebrou");
  }

  /* =================================================================
   * C2 (v18.25.0): VINCULAR UM TRECHO ESCOLHIDO, VENDO PARA ONDE VAI
   * ================================================================= */
  /* V1-V2: o destino digitado e a parte do artigo */
  {
    const { api } = rodar();
    const d = api.qsVincLerDestinos("113, § 1º, II");
    ok(d.length === 1 && d[0].num === "113" && d[0].numCru === "113, § 1º, II"
      && d[0].sub.paragrafos[0] === "1º" && d[0].sub.incisos[0] === "II",
      "V1 '113, § 1º, II' não foi lido como artigo + parte: " + JSON.stringify(d));
    ok(api.qsVincLerDestinos("77, 78 e 79").map((x) => x.num).join(",") === "77,78,79", "V1a a lista de artigos não foi lida");
    ok(api.qsVincLerDestinos("acessória").length === 0, "V1b uma palavra virou destino (devia buscar)");
    ok((api.qsVincLerDestinos("art. 3º")[0] || {}).num === "3", "V1c 'art. 3º' no campo não foi lido");
    ok(api.qsVincLerDestinos("prazo de 30 dias").length === 0, "V1d uma frase com número virou o art. 30 (devia ser busca)");
    const s1 = api.qsVincSubDaUnidade("P1>II>a");
    ok(s1.paragrafos[0] === "1º" && s1.incisos[0] === "II" && s1.alineas[0] === "a", "V2 a parte P1>II>a virou " + JSON.stringify(s1));
    ok(api.qsVincSubDaUnidade("PU").paragrafos[0] === "único" && api.qsVincSubDaUnidade("P12").paragrafos[0] === "12",
      "V2a parágrafo único / § 12 lidos errado");
    ok(api.qsVincRotuloDestino("113", s1) === "113, § 1º, II, a)", "V2b o rótulo do destino saiu " + api.qsVincRotuloDestino("113", s1));
  }

  /* V3-V8: o fluxo inteiro no resumo, com a prévia antes de gravar */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.matVinculosAbrir("regra de acessoriedade");
    ok(api.$("dlgQsVincEsc").open === true, "V3 com um trecho selecionado, o botão não foi direto para a escolha da lei");
    ok(api.$("qsVincLei").value === "lei_ctn", "V3a a lei única do tópico devia vir escolhida: " + api.$("qsVincLei").value);
    const fichas = api.$("qsVincLeisTopico").querySelectorAll("button.qs-vinc-ficha");
    ok(fichas.length === 1 && /sel/.test(fichas[0].className) && !api.$("qsVincLeisTopico").hidden, "V3b a lei do tópico não aparece em ficha marcada");
    ok(/Digite o número/.test(api.$("qsVincPrev").textContent || ""), "V3c sem destino, a prévia devia dizer o que fazer: " + api.$("qsVincPrev").textContent);
    /* uma PALAVRA lista os artigos que a contêm */
    api.$("qsVincArts").value = "acessória";
    api.$("qsVincArts").oninput();
    const achados = api.$("qsVincAchados").querySelectorAll("button.qs-vinc-achado");
    ok(achados.length === 1 && /^Art\. 113 — A obrigação/.test(achados[0].textContent || ""),
      "V4 a busca por palavra devia achar só o art. 113: " + achados.map((b) => b.textContent).join(" | "));
    ok(/Toque num dos artigos acima/.test(api.$("qsVincPrev").textContent || ""), "V4d durante a busca a prévia devia dizer para escolher um artigo");
    achados[0].onclick();
    ok(api.$("qsVincArts").value === "113", "V4a escolher o achado não pôs o artigo no campo: " + api.$("qsVincArts").value);
    const partes = api.$("qsVincDisp").querySelectorAll("button.qs-vinc-ficha");
    ok(partes.length === 4 && partes[0].textContent === "artigo inteiro" && /sel/.test(partes[0].className),
      "V4b as partes do art. 113 deviam ser 'artigo inteiro' (marcada) + 3 parágrafos: " + partes.map((b) => b.textContent).join(" | "));
    ok(/principal ou acessória/.test(api.$("qsVincPrev").textContent || "")
      && api.$("qsVincPrev").querySelectorAll(".qs-vinc-prev-alvo").length === 0,
      "V4c a prévia do artigo inteiro devia mostrar o texto sem destaque");
    /* tocar no § 2º: o campo e o destaque acompanham */
    partes.filter((b) => /2º/.test(b.textContent || ""))[0].onclick();
    ok(api.$("qsVincArts").value === "113, § 2º", "V5 tocar no § 2º não mudou o destino: " + api.$("qsVincArts").value);
    const alvo = api.$("qsVincPrev").querySelectorAll(".qs-vinc-prev-alvo");
    ok(alvo.length === 1 && /§ 2º A obrigação acessória decorre/.test(alvo[0].textContent || ""),
      "V5a a prévia não destaca o § 2º: " + alvo.map((x) => x.textContent).join(" | "));
    /* parte que não existe e artigo que não existe avisam */
    api.$("qsVincArts").value = "113, § 9º"; api.$("qsVincArts").oninput();
    ok(/Não achei "113, § 9º" no art\. 113/.test(api.$("qsVincPrev").textContent || ""), "V6 parte inexistente não avisou: " + api.$("qsVincPrev").textContent);
    api.$("qsVincArts").value = "999"; api.$("qsVincArts").oninput();
    ok(/Não achei o art\. 999/.test(api.$("qsVincPrev").textContent || ""), "V7 artigo inexistente não avisou");
    /* palavra no campo não grava */
    api.$("qsVincArts").value = "acessória"; api.$("qsVincArts").oninput();
    api.$("btnQsVincEscOk").onclick();
    ok(api.citVinculosLer().length === 0 && /Escolha um artigo da lista/.test(api.$("qsVincEscAviso").textContent || ""),
      "V7a uma palavra no campo foi gravada como destino");
    ok(!api.$("qsVincAlcanceBox").hidden && api.$("qsVincAlcTopico").checked, "V7b 'só neste tópico' devia vir marcado");
    /* grava: só neste tópico, com a parte */
    api.$("qsVincArts").value = "113, § 2º"; api.$("qsVincArts").oninput();
    api.$("btnQsVincEscOk").onclick();
    const vs = api.citVinculosLer();
    ok(vs.length === 1 && vs[0].chave === ch && vs[0].leiId === "lei_ctn" && vs[0].artigos[0].numCru === "113, § 2º"
      && (vs[0].artigos[0].sub.paragrafos || [])[0] === "2º",
      "V8 o vínculo não foi gravado com o tópico e a parte: " + JSON.stringify(vs));
    const perm = links(api).filter((b) => b.textContent === "regra de acessoriedade")[0];
    ok(!!perm && /qs-lei-link-perm/.test(cls(perm)), "V8a depois de gravar, o trecho não virou link no resumo");
    perm.onclick({ stopPropagation() {} });
    ok(/Trecho citado/.test(api.$("leiCitaPreviewTexto").textContent || "")
      && /§ 2º[^\n]*acessória decorre/.test(api.$("leiCitaPreviewTexto").textContent || ""),
      "V8b o vínculo não leva à parte escolhida (§ 2º): " + (api.$("leiCitaPreviewTexto").textContent || "").slice(-160));
    api.$("dlgLeiCitaPreview").close();
    /* o "só neste tópico" não vale em outro tópico */
    const el = api.document.createElement("div");
    api.qsUiComentario(el, { disciplina: DISC, topico: "Outro tópico", comentario: "Sobre a regra de acessoriedade civil." });
    ok(el.querySelectorAll("button.qs-lei-link").length === 0, "V9 o vínculo 'só neste tópico' apareceu em outro tópico");
    const el2 = api.document.createElement("div");
    api.qsUiComentario(el2, { disciplina: DISC, topico: TOP, comentario: "Sobre a regra de acessoriedade civil." });
    ok(el2.querySelectorAll("button.qs-lei-link-perm").length === 1, "V9a o vínculo do tópico não vale numa questão do MESMO tópico");
    /* "este vínculo está errado" → em todo o app: o do tópico sai, fica um só */
    api.matVinculosAbrir("");
    const card = api.$("qsVincLista").querySelectorAll(".lei-bib-card").filter((c) => /regra de acessoriedade/.test(c.textContent || ""))[0];
    ok(!!card && /só neste tópico/.test(card.textContent || ""), "V10 a lista não diz que o vínculo vale só neste tópico");
    card.querySelectorAll("button").filter((b) => /^btnQsVincErrado_/.test(b.id || ""))[0].onclick();
    ok(api.$("qsVincArts").value === "113, § 2º", "V10a corrigir não trouxe o destino gravado: " + api.$("qsVincArts").value);
    api.$("qsVincAlcTopico").checked = false; api.$("qsVincAlcTudo").checked = true;
    api.$("btnQsVincEscOk").onclick();
    const vs2 = api.citVinculosLer();
    ok(vs2.length === 1 && !vs2[0].chave, "V11 trocar para 'em todo o app' devia deixar UM vínculo, sem tópico: " + JSON.stringify(vs2));
    const el3 = api.document.createElement("div");
    api.qsUiComentario(el3, { disciplina: DISC, topico: "Outro tópico", comentario: "Sobre a regra de acessoriedade civil." });
    ok(el3.querySelectorAll("button.qs-lei-link-perm").length === 1, "V11a o vínculo de todo o app não vale em outro tópico");
  }

  /* V12: o vínculo antigo (sem parte, sem tópico) continua valendo como antes */
  {
    const { api } = rodar();
    api.citVinculosGravar([{ k: api.citChave("regra de acessoriedade"), trecho: "regra de acessoriedade", leiId: "lei_ctn",
      artigos: [{ num: "113", numCru: "113" }], criado: "2026-09-19T00:00:00.000Z" }]);
    preparar(api);
    const b = links(api).filter((x) => x.textContent === "regra de acessoriedade")[0];
    ok(!!b && /qs-lei-link-perm/.test(cls(b)), "V12 o vínculo gravado antes da v18.25.0 parou de valer");
    b.onclick({ stopPropagation() {} });
    ok(/principal ou acessória/.test(api.$("leiCitaPreviewTexto").textContent || ""), "V12a o vínculo antigo não abre o artigo");
  }

  /* V13: o tópico vence o app inteiro no mesmo trecho */
  {
    const { api } = rodar();
    const ch = api.matChave(DISC, TOP);
    api.citVinculoSalvar({ trecho: "regra de acessoriedade", leiId: "lei_cf", artigos: [{ num: "113", numCru: "113" }] });
    api.citVinculoSalvar({ trecho: "regra de acessoriedade", leiId: "lei_ctn", artigos: [{ num: "113", numCru: "113" }], chave: ch });
    const cs = api.citVinculosAplicar("a regra de acessoriedade aqui", [], ch);
    ok(cs.length === 1 && cs[0].leiId === "lei_ctn", "V13 no mesmo trecho, o vínculo do tópico devia vencer o de todo o app: " + JSON.stringify(cs.map((c) => c.leiId)));
    const fora = api.citVinculosAplicar("a regra de acessoriedade aqui", [], "outra›coisa");
    ok(fora.length === 1 && fora[0].leiId === "lei_cf", "V13a fora do tópico vale o de todo o app");
    ok(api.citVinculosAplicar("a regra de acessoriedade aqui", []).length === 1, "V13b sem tópico, só o de todo o app");
  }

  /* V15: com duas leis no tópico, o trecho que nomeia a lei ("do CTN") já vem com ela */
  {
    const { api } = rodar();
    preparar(api, { duasLeis: true });
    api.matVinculosAbrir("ocorrência do fato gerador (art. 113, § 1º, do CTN)");
    ok(api.$("qsVincLei").value === "lei_ctn", "V15 o trecho diz 'do CTN' e a lei não veio marcada: " + api.$("qsVincLei").value);
    ok(api.$("qsVincArts").value === "113, § 1º", "V15a o destino do trecho não veio preenchido: " + api.$("qsVincArts").value);
    ok(api.$("qsVincPrev").querySelectorAll(".qs-vinc-prev-alvo").length === 1, "V15b a prévia já devia destacar o § 1º");
  }

  /* =================================================================
   * K (v18.27.0): AS CITAÇÕES DOS CARTÕES VIRAM LINKS
   * ================================================================= */
  {
    const { api } = rodar();
    const ch = preparar(api);
    api.matGravarCartoes(ch, [
      "Segundo o art. 113 do CTN, a multa por infração é? :: Obrigação principal (art. 113, § 1º, do CTN)",
      "+ Literalidade — art. 3º do CTN: tributo não é sanção de ato ilícito",
    ].join("\n"), { disciplina: DISC, topico: TOP });
    api.estcModoForcar("sequencia");
    api.gerAbrirNoTopico(DISC, TOP, { estudar: true });
    const noEstudo = () => api.$("estCartao").querySelectorAll("button.car-lei-link");
    ok(api.$("dlgGerEstudo").open === true, "K0 o estudo do tópico não abriu");
    ok(noEstudo().length === 0, "K1 a citação da FRENTE virou link antes de virar (abrir a lei entregaria a resposta)");
    api.estcVirar();
    const ls = noEstudo();
    ok(ls.some((b) => b.textContent === "art. 113, § 1º, do CTN"), "K2 a citação da resposta não virou link: " + ls.map((b) => b.textContent).join(" | "));
    ok(ls.some((b) => b.textContent === "art. 3º do CTN"), "K2a a citação do 'saiba mais' não virou link");
    ok(ls.every((b) => b.textContent !== "art. 113 do CTN"), "K2b a frente não pode virar link nem depois de virar");
    ok(ls.every((b) => !/qs-lei-link-sem/.test(cls(b))), "K2c as citações do cartão deviam saber a lei (CTN)");
    ok(/sem sair do cartão/.test(ls[0].title || ""), "K2d o balão fala de resumo, não de cartão: " + ls[0].title);
    ls.filter((b) => b.textContent === "art. 113, § 1º, do CTN")[0].onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open === true && /Código Tributário/.test(api.$("leiCitaPreviewTitulo").textContent || ""),
      "K3 tocar na citação do cartão não abriu a prévia no CTN");
    ok(/§ 1º[^\n]*surge com a ocorrência/.test(api.$("leiCitaPreviewTexto").textContent || ""), "K3a a prévia não separa o § 1º");
    ok(api.$("dlgGerEstudo").open === true, "K3b a prévia fechou o estudo");
    api.$("dlgLeiCitaPreview").close();
    /* a prévia da Biblioteca de cartões também liga */
    api.estcFechar();
    api.gerFocoTeste(0);
    api.gerPintarPrevia();
    const naBib = api.$("gerPrevia").querySelectorAll("button.car-lei-link");
    ok(naBib.some((b) => b.textContent === "art. 113, § 1º, do CTN"), "K4 a prévia da Biblioteca de cartões não liga as citações: " + naBib.map((b) => b.textContent).join(" | "));
  }
  {
    /* K6: a lei ligada pela chave GRAVADA do tópico (grafia diferente da do nome) ainda conta */
    const { api } = rodar();
    preparar(api);
    api.leiLigar("lei_cf", "direito tributario›obrigacao tributaria (grafia antiga)");
    const ctx = api.citCtxDe({ disciplina: "Outra grafia", topico: "Sem lei", chave: "direito tributario›obrigacao tributaria (grafia antiga)" });
    ok(ctx.doTopico.length === 1 && ctx.doTopico[0].id === "lei_cf", "K6 a lei ligada pela chave gravada do tópico não foi achada");
  }
  {
    /* K5: cartão da bancada (sem tópico): a lei nomeada abre; a desconhecida diz que não achou */
    const { api } = rodar();
    preparar(api);
    const base = api.estcCitBase({ chave: api.CQ_BANCADA, disciplina: "Bancada", topico: "Bancada" });
    ok(base.disciplina === "" && base.topico === "" && base.onde === "cartao", "K5 o cartão da bancada não pode fingir um tópico");
    api.citIr(api.leiCitacoesNoTexto("art. 113 do CTN")[0], null, base);
    ok(api.$("dlgLeiCitaPreview").open === true && /Código Tributário/.test(api.$("leiCitaPreviewTitulo").textContent || ""),
      "K5a sem tópico, a citação com lei nomeada devia abrir a prévia");
    api.$("dlgLeiCitaPreview").close();
    api.citIr(api.leiCitacoesNoTexto("art. 5º da XPTO")[0], null, base);
    ok(api.$("dlgLeiCitaPreview").open === true && /XPTO/.test(api.$("leiCitaPreviewTitulo").textContent || ""),
      "K5b sem tópico e sem lei conhecida, devia dizer que não achou (em vez de não fazer nada)");
  }

  /* =================================================================
   * N1 (v18.31.0): A NOTA DO ARTIGO AO LADO DA CITAÇÃO
   * ================================================================= */
  {
    const { api } = rodar();
    preparar(api);
    api.leiNotaGuardar("lei_ctn", "113", "obrigação principal × acessória");
    api.matTrocarModo("ler");
    const notas = () => api.$("matLeitura").querySelectorAll("span.cit-nota");
    const ns = notas();
    ok(ns.length === 4 && ns.every((s) => /obrigação principal × acessória/.test(s.textContent || "")),
      "N1 cada citação do art. 113 devia ter a nota ao lado (4), e a do art. 3º não: " + ns.length);
    ok(/Nota do artigo: obrigação principal × acessória/.test(ns[0].title || ""), "N1a o balão da nota não traz o texto inteiro");
    const lk = links(api)[0];
    ok(lk.parentNode && lk.parentNode.children && lk.parentNode.children.indexOf(ns[0]) === lk.parentNode.children.indexOf(lk) + 1,
      "N1b a nota devia vir logo depois do link");
    ok(((api.matObter(api.matChave(DISC, TOP)) || {}).texto || "") === TXT, "N1c a nota mudou o texto gravado do resumo");
    /* tocar na nota abre a prévia do artigo */
    ns[0].onclick({ stopPropagation() {} });
    ok(api.$("dlgLeiCitaPreview").open === true, "N2 tocar na nota não abriu a prévia");
    ok(!api.$("leiCitaNotaBox").hidden && /📝 obrigação principal × acessória/.test(api.$("leiCitaNotaTxt").textContent || ""),
      "N2a a prévia não mostra a nota do artigo");
    api.$("dlgLeiCitaPreview").close();
    /* escrever a nota de um artigo que não tinha (art. 3º) pela prévia */
    links(api).filter((b) => b.textContent === "art. 3º do CTN")[0].onclick({ stopPropagation() {} });
    ok(/Ainda sem nota/.test(api.$("leiCitaNotaTxt").textContent || "") && /escrever nota/.test(api.$("btnLeiCitaNotaEditar").textContent || ""),
      "N3 sem nota, a prévia devia convidar a escrever: " + api.$("leiCitaNotaTxt").textContent);
    api.$("btnLeiCitaNotaEditar").onclick();
    ok(!api.$("leiCitaNotaEd").hidden && api.$("leiCitaNotaCampo").value === "", "N3a a caixa de escrever não abriu (vazia)");
    api.$("btnLeiCitaNotaSugerir").onclick();
    ok(!api.$("leiCitaNotaPrompt").hidden && /Tributo é toda prestação/.test(api.$("leiCitaNotaPrompt").value || ""), "N3b 'sugerir com IA' não montou o pedido com o texto do artigo");
    api.$("leiCitaNotaCampo").value = "tributo não é sanção";
    api.$("btnLeiCitaNotaGuardar").onclick();
    ok(api.leiNotaDe("lei_ctn", "3") === "tributo não é sanção", "N3c a nota escrita pela citação não foi guardada no artigo");
    ok(/📝 tributo não é sanção/.test(api.$("leiCitaNotaTxt").textContent || "") && api.$("leiCitaNotaEd").hidden, "N3d depois de guardar, a prévia devia mostrar a nota");
    ok(notas().some((s) => /tributo não é sanção/.test(s.textContent || "")), "N3e o resumo atrás não foi repintado com a nota nova");
    /* apagar: guardar vazio */
    api.$("btnLeiCitaNotaEditar").onclick();
    ok(api.$("leiCitaNotaCampo").value === "tributo não é sanção", "N3f editar devia trazer a nota atual");
    api.$("leiCitaNotaCampo").value = "";
    api.$("btnLeiCitaNotaGuardar").onclick();
    ok(api.leiNotaDe("lei_ctn", "3") === "" && !notas().some((s) => /sanção/.test(s.textContent || "")), "N3g guardar vazio devia apagar a nota");
    api.$("dlgLeiCitaPreview").close();
    /* esconder as notas (Aa) */
    api.$("matCitNotasVer").checked = false;
    api.$("matCitNotasVer").onchange();
    ok(notas().length === 0, "N4 desmarcar 'mostrar notas' não escondeu as notas");
    api.$("matCitNotasVer").checked = true;
    api.$("matCitNotasVer").onchange();
    ok(notas().length === 4, "N4a marcar de novo não trouxe as notas de volta");
    /* nota longa: cortada ao lado do link, inteira no balão */
    const longa = "x".repeat(90);
    api.leiNotaGuardar("lei_ctn", "113", longa);
    api.matTrocarModo("ler");
    const n0 = notas()[0];
    ok(n0 && (n0.textContent || "").length <= 74 && /…$/.test(n0.textContent || "") && (n0.title || "").indexOf(longa) >= 0, "N5 a nota longa devia ser cortada ao lado e inteira no balão");
    /* nas questões também */
    api.leiNotaGuardar("lei_ctn", "113", "obrigação principal × acessória");
    const el = api.document.createElement("div");
    api.qsUiComentario(el, { disciplina: DISC, topico: TOP, comentario: "Conforme o art. 113, § 3º, do CTN, converte-se." });
    const kids = el.children || [];
    const iLk = kids.findIndex((x) => /qs-lei-link/.test(cls(x)));
    ok(iLk >= 0 && kids[iLk + 1] && /cit-nota/.test(cls(kids[iLk + 1])) && /principal × acessória/.test(kids[iLk + 1].textContent || ""),
      "N6 no comentário da questão a nota não aparece ao lado do link");
  }

  /* V14: nas questões, o vínculo novo também nasce só no tópico da questão */
  {
    const { api } = rodar();
    preparar(api);
    const q = { disciplina: DISC, topico: TOP, comentario: "A regra de acessoriedade não vale aqui." };
    api.qsVincAbrir(q, null, "regra de acessoriedade");
    api.qsVincEscolher({ trecho: "regra de acessoriedade", cit: null });
    api.$("qsVincArts").value = "113"; api.$("qsVincArts").oninput();
    api.$("btnQsVincEscOk").onclick();
    const v = api.citVinculosLer();
    ok(v.length === 1 && v[0].chave === api.matChave(DISC, TOP), "V14 o vínculo da questão não ficou só no tópico dela: " + JSON.stringify(v));
  }

  return falhas;
}

module.exports = { testes };
