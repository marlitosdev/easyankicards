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
    preparar(api, { duasLeis: true });
    const ls = links(api);
    const semNome = ls.filter((b) => b.textContent === "art. 113, § 1º")[0];
    ok(!!semNome && /qs-lei-link-sem/.test(cls(semNome)),
      "R9 com duas leis no tópico, a citação sem lei devia aparecer como 'sem lei'");
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

  return falhas;
}

module.exports = { testes };
