/* =====================================================================
 * OS BLOCOS DE ALTERAÇÃO — o caso da LC 214/2025
 *
 * A LC 214 tem 49 artigos que "passam a vigorar com as seguintes alterações" e, entre aspas, os artigos
 * alterados de outras leis: "Art. 9º ......" diz que o art. 9º do CTN muda (o caput não), e "...... ” (NR)"
 * fecha o bloco. Na revisão da colagem, aceitando tudo, três limpezas destruíam isso: o fechamento repetido
 * era tomado por rodapé de página (326 linhas), a aspa de abertura era "corrigida" (72) e a linha era colada
 * na frase de cima (32). Ficava um texto sem aspas, sem dizer de qual lei nem de qual artigo se tratava.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. Cada região citada (da linha que abre com aspas até a que fecha, com (NR)/(AC) e notas editoriais
 *     depois) é achada; a lei-alvo sai do artigo que altera ("Lei nº 5.172/1966 (Código Tributário Nacional)").
 *     Uma aspa que NUNCA fecha não engole o texto.
 *  2. As três limpezas poupam essas linhas — e as linhas dentro de anexos (cabeçalho de tabela que se repete
 *     de propósito). As outras limpezas seguem funcionando.
 *  3. Os artigos citados não contam como artigos da lei; cada bloco é um ajuste "citação" e a pessoa pode
 *     mandar manter o original.
 *  4. A revisão mostra os blocos como informação; o leitor mostra o indicador no artigo que altera e o selo
 *     em cada artigo citado. O texto guardado nunca muda.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => {
    acc = acc || [];
    Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); });
    return acc;
  };
  const cls = (c, k) => new RegExp("(^|\\s)" + k + "(\\s|$)").test(c.className || "");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
  const { api: p } = rodar();

  const PTS = ".".repeat(60);
  const L = ["LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025", "Institui o Imposto sobre Bens e Serviços."];
  for (let i = 1; i <= 12; i++) {
    if (i === 4 || i === 10) L.push("Presidência da República — Subchefia para Assuntos Jurídicos");
    L.push("Art. " + i + "º Texto próprio do artigo " + i + ", que trata do imposto e da sua incidência.");
  }
  L.push("Art . 30 Artigo com o espaço a mais depois de Art.");
  L.push("Presidência da República — Subchefia para Assuntos Jurídicos");
  L.push("Art. 495. (VETADO).     Produção de efeitos");
  L.push("Art. 496. A Lei nº 5.172, de 25 de outubro de 1966 - Código Tributário Nacional, passa a vigorar com as seguintes alterações:      Produção de efeitos");
  L.push("“Art. 9º " + PTS, PTS,
    "IV - cobrar impostos e a contribuição de que trata o inciso V do art. 195 da Constituição Federal sobre:", PTS,
    "b) entidades religiosas e templos de qualquer culto, inclusive suas organizações assistenciais e beneficentes;", PTS + " ” (NR)");
  L.push("Art. 497. O Decreto-Lei nº 37, de 18 de novembro de 1966, passa a vigorar com a seguinte redação:      Produção de efeitos");
  L.push("“Art. 44" + PTS, "Parágrafo único. As informações prestadas pelo sujeito passivo constituem confissão de dívida.” (NR)");
  L.push("Presidência da República — Subchefia para Assuntos Jurídicos");
  L.push("Art. 498. A Lei nº 10.931, de 2 de agosto de 2004, passa a vigorar com as seguintes alterações:");
  L.push("“Art. 3º O terreno e as acessões objeto da incorporação imobiliária sujeitas ao regime especial de tributação não responderão por dívidas.", PTS + " ” (NR)");
  L.push("Art. 499. A Lei nº 7.998, de 11 de janeiro de 1990, passa a vigorar com as seguintes alterações:");
  L.push("“Art. 11. " + PTS, PTS, "V - 18% (dezoito por cento) da Contribuição Social sobre Bens e Serviços - CBS; e", "VI - outros recursos que lhe sejam destinados.", PTS + " ” (NR)");
  L.push("Art. 500. A Lei nº 8.019, de 11 de abril de 1990, passa a vigorar com as seguintes alterações:");
  L.push("“Art. 1º A arrecadação correspondente a 18% (dezoito por cento) da Contribuição Social sobre Bens e Serviços - CBS.",
    "“Art. 2º Conforme estabelece o § 1º do art. 239 da Constituição Federal, pelo menos 28% da arrecadação.", PTS + " ” (NR)    (Vide Lei Complementar nº 227, de 2026)");
  L.push("Art. 501. Esta Lei Complementar entra em vigor na data de sua publicação.");
  L.push("ANEXO I", "TABELA DO SIMPLES", "Receita Bruta em 12 Meses", "Alíquota A", "Valor a Deduzir em reais", "Faixa 1", "Faixa 2", "Faixa 3",
    "Receita Bruta em 12 Meses", "Alíquota B", "Valor a Deduzir em reais", "Faixa 4", "Faixa 5", "Faixa 6", "Receita Bruta em 12 Meses", "Alíquota C", "Faixa 7");
  const LC = L.join("\n");
  const linhaDe = (re) => L.findIndex((s) => re.test(s)) + 1;

  /* ---- R: as regioes e os fechamentos ---- */
  {
    ok(p.leiLinhaFechaCitacao(PTS + " ” (NR)") && p.leiLinhaFechaCitacao("texto.” (NR)    (Vide Lei Complementar nº 227, de 2026)") && p.leiLinhaFechaCitacao("fim.\" (AC)") && p.leiLinhaFechaCitacao("fim.”"),
      "R1 fecha com aspas, com (NR)/(AC) e com nota editorial depois");
    ok(!p.leiLinhaFechaCitacao("as alineas \"a\" e \"b\"."), "R2 a alinea entre aspas ('a'.) nao fecha uma citacao");
    ok(!p.leiLinhaFechaCitacao("texto sem aspas (NR)") && !p.leiLinhaFechaCitacao("“Art. 9º texto sem fechar"), "R3 sem aspas de fechar nao fecha");
    ok(p.leiLinhaCitacaoInteira("“Art. 5º Texto inteiro.” (NR)") && !p.leiLinhaCitacaoInteira("“Art. 5º Texto que segue"), "R4 uma linha que abre e fecha e' uma citacao inteira");
    ok(p.leiMarcaDoFecho("x ” (NR)") === "NR" && p.leiMarcaDoFecho("x ” (AC)   (Vide Lei nº 1)") === "AC" && p.leiMarcaDoFecho("x.”") === "", "R5 a marca do fecho, mesmo com nota depois");
    const reg = p.leiRegioesCitadas(L);
    ok(reg.length === 5 && reg.every((r) => r.marca === "NR"), "R6 cinco regioes citadas fechadas, todas (NR): " + reg.length);
    ok(reg[0].ini + 1 === linhaDe(/^“Art\. 9º/) && L[reg[0].fim].indexOf("” (NR)") >= 0, "R7 a primeira vai da linha 'Art. 9º' ate o fechamento");
    ok(reg[4].fim - reg[4].ini === 2 && /Vide Lei Complementar/.test(L[reg[4].fim]), "R8 a do art. 500 traz dois artigos citados e fecha na linha com a nota editorial");
    /* a citacao que nunca fecha nao engole o resto */
    const aberta = ["Art. 1º A Lei nº 1 passa a vigorar com as seguintes alterações:", "“Art. 9º Texto sem fechar", "Art. 2º A Lei nº 2 passa a vigorar com as seguintes alterações:", "“Art. 3º Outro.” (NR)", "Art. 3º Esta Lei entra em vigor."];
    const ra = p.leiRegioesCitadas(aberta);
    ok(ra.length === 1 && ra[0].ini === 3, "R9 uma aspa que nunca fecha e' descartada (uma nova alteracao a encerra); a seguinte, fechada, vale: " + JSON.stringify(ra));
    ok(p.leiRegioesCitadas(["Art. 1º Altera.", "“Art. 9º sem fechar", "texto", "Art. 2º Esta Lei entra em vigor na data.", "outro texto.” (NR)"]).length === 0, "R10 a vigencia da propria lei encerra a citacao aberta: o fechamento que vem DEPOIS nao a fecha");
    ok(p.leiRegioesCitadas(["“Art. 9º sem fechar", "texto", "fim"]).length === 0, "R11 regiao aberta ate o fim do texto: descartada");
    /* aspas retas (o texto do Planalto no navegador) */
    const retas = ["Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:", "\"Art. 43. " + PTS, "§ 4º Sempre que possível.\" (NR)", "Art. 2º Vigência."];
    ok(p.leiRegioesCitadas(retas).length === 1, "R12 aspas retas tambem");
  }

  /* ---- A: a lei-alvo ---- */
  {
    const a = (x) => p.leiAlvoDaAlteracao(x);
    const c = a("Lei nº 5.172, de 25 de outubro de 1966 - Código Tributário Nacional");
    ok(c.curto === "Lei nº 5.172/1966" && c.nome === "Código Tributário Nacional", "A1 lei com ano e nome: " + JSON.stringify(c));
    ok(a("Lei Complementar nº 87, de 13 de setembro de 1996").curto === "Lei Complementar nº 87/1996", "A2 lei complementar");
    ok(a("Decreto-Lei nº 37, de 18 de novembro de 1966").curto === "Decreto-Lei nº 37/1966", "A3 decreto-lei");
    ok(a("Medida Provisória nº 2.158-35, de 24 de agosto de 2001").curto === "Medida Provisória nº 2.158-35/2001", "A4 medida provisoria com traco");
    ok(a("Constituição Federal").curto === "Constituição Federal" && a("Ato das Disposições Constitucionais Transitórias").curto === "ADCT", "A5 a Constituicao e o ADCT");
    ok(a("Lei nº 9.718, de 27 de novembro de 1998").nome === "", "A6 sem nome quando nao ha");
  }

  /* ---- B: os blocos ---- */
  const cit = p.leiLerCitacoes(L);
  {
    ok(cit.blocos.length === 5 && cit.blocos.every((b) => b.alvo && !b.recusado), "B1 cinco blocos de alteracao, cada um com a lei-alvo");
    const b0 = cit.blocos[0];
    ok(b0.rotulo === "Art. 496" && b0.alvo.curto === "Lei nº 5.172/1966" && b0.alvo.nome === "Código Tributário Nacional" && b0.linha === linhaDe(/^Art\. 496\./) && b0.id === "citacao:" + b0.linha,
      "B2 o artigo que altera, a lei-alvo e o id: " + JSON.stringify([b0.rotulo, b0.alvo.curto, b0.id]));
    ok(b0.trechos.length === 1 && b0.trechos[0].artigos.length === 1 && b0.trechos[0].artigos[0].numCru === "9º" && b0.trechos[0].artigos[0].semMudanca === true && b0.trechos[0].marca === "NR",
      "B3 o artigo citado (9º) diz 'caput sem mudanca' porque so' tem pontos: " + JSON.stringify(b0.trechos[0].artigos));
    ok(cit.blocos[1].trechos[0].artigos[0].numCru === "44" && cit.blocos[1].trechos[0].artigos[0].semMudanca === true, "B4 'Art. 44......' (sem espaco antes dos pontos) tambem");
    ok(cit.blocos[2].trechos[0].artigos[0].numCru === "3º" && cit.blocos[2].trechos[0].artigos[0].semMudanca === false, "B5 o artigo citado COM texto nao e' 'sem mudanca'");
    ok(cit.blocos[4].n === 2 && cit.blocos[4].trechos[0].artigos.map((x) => x.numCru).join(",") === "1º,2º", "B6 dois artigos citados no mesmo trecho");
    ok(!cit.citadas.has(b0.linha) && cit.citadas.has(b0.linha + 1) && cit.citadas.has(b0.fim) && !cit.citadas.has(b0.fim + 1), "B7 as linhas do bloco (da citacao ao fechamento) sao 'citadas'; a introducao e o artigo seguinte nao");
    const rec = {}; rec[b0.id] = true;
    const c2 = p.leiLerCitacoes(L, rec);
    ok(c2.blocos[0].recusado === true && !c2.citadas.has(b0.linha + 1) && c2.citadas.has(cit.blocos[1].linha + 1), "B8 um bloco recusado sai das 'citadas'; os outros ficam");
    /* regiao sem introducao: bloco sem lei-alvo */
    const orfa = ["Art. 1º Texto.", "“Art. 9º Citado sem introducao.” (NR)", "Art. 2º Outro."];
    const co = p.leiLerCitacoes(orfa);
    ok(co.blocos.length === 1 && co.blocos[0].alvo === null && /^citacao:o/.test(co.blocos[0].id), "B9 uma citacao sem 'passa a vigorar' vira bloco sem lei-alvo");
    ok(p.leiLerCitacoes(["Art. 1º Texto.", "Art. 2º Texto."]).blocos.length === 0, "B10 uma lei comum nao tem blocos");
    /* uma citacao depois de um artigo COMUM nao pertence a alteracao anterior */
    const dois = ["Art. 1º A Lei nº 1, de 2000, passa a vigorar com as seguintes alterações:", "“Art. 2º Texto.” (NR)", "Art. 2º Outro artigo desta lei.", "“Art. 9º Citado sem introducao.” (NR)"];
    const cd = p.leiLerCitacoes(dois);
    ok(cd.blocos.length === 2 && cd.blocos[0].alvo && cd.blocos[0].trechos.length === 1 && cd.blocos[1].alvo === null && cd.blocos[1].trechos.length === 1, "B11 um artigo comum entre duas citacoes as separa: a segunda nao herda a lei-alvo da primeira");
  }

  /* ---- L: os artigos ---- */
  {
    const arts = p.leiArtigos(LC);
    const nums = arts.map((a) => a.numCru).join(",");
    ok(nums === "1º,2º,3º,4º,5º,6º,7º,8º,9º,10º,11º,12º,495,496,497,498,499,500,501", "L1 so' os artigos da propria lei (o 'Art . 30' com espaco ainda nao e' artigo: e' o que a grafia corrige): " + nums);
    ok(arts.filter((a) => a.num === "9").length === 1 && arts.filter((a) => a.num === "3").length === 1, "L2 o 9º (citado) nao vira um segundo art. 9º");
    const a496 = arts.filter((a) => a.num === "496")[0];
    ok(/entidades religiosas/.test(a496.texto) && /\(NR\)/.test(a496.texto) && a496.linhaFim === cit.blocos[0].fim, "L3 o artigo 496 inclui o bloco todo: " + a496.linhaFim);
    const ajs = p.leiLerLei(LC).ajustes.filter((x) => x.tipo === "citacao");
    ok(ajs.length === 5 && ajs[0].rotulo === "Art. 496" && ajs[0].alvo === "Lei nº 5.172/1966" && ajs[0].n === 1 && ajs[0].recusado === false && ajs[4].n === 2, "L4 cada bloco e' um ajuste 'citacao' com a lei-alvo e quantos artigos: " + JSON.stringify(ajs.map((x) => x.n)));
    /* recusar: as linhas voltam a ser lidas como antes */
    const EC = ["Art. 1º A Constituição Federal passa a vigorar com as seguintes alterações:", "\"Art. 156. " + PTS, "Art. 156-A. Lei complementar instituirá imposto.", "§ 1º Um.", "Art. 156-B. Compete ao Comitê.", "§ 1º Dois.\" (NR)", "Art. 2º Esta Emenda entra em vigor na data de sua publicação."].join("\n");
    ok(p.leiArtigos(EC).map((a) => a.numCru).join(",") === "1º,2º", "L5 os artigos 156-A e 156-B, citados, nao sao artigos da emenda");
    const idEC = p.leiLerCitacoes(EC.split("\n")).blocos[0].id;
    const recEC = {}; recEC[idEC] = true;
    ok(p.leiArtigos(EC, { recusados: recEC }).map((a) => a.numCru).join(",") === "1º,156-A,156-B,2º", "L6 manter o original: as linhas voltam a ser lidas como artigos");
    ok(p.leiArtigos(["“Art. 9º sem fechar", "Art. 2º Dois.", "Art. 3º Tres."].join("\n")).length === 2, "L7 uma aspa que nunca fecha nao engole os artigos");
  }

  /* ---- P: as limpezas da colagem ---- */
  {
    const pre = p.leiPreprocessar(LC);
    const g = (nome) => pre.mudancas.filter((m) => m.grupo === nome);
    ok(g("remissao").length === 0, "P1 nenhuma remissao: o 'Art. 9º ......' nao e' frase quebrada (era colado na linha de cima): " + g("remissao").map((m) => m.antes.slice(0, 40)));
    ok(g("grafia").length === 1 && /^Art \. 30/.test(g("grafia")[0].antes), "P2 a grafia so' corrige o 'Art . 30' (as aspas dos artigos citados ficam): " + g("grafia").map((m) => m.antes.slice(0, 30)));
    const cab = g("cabecalho");
    ok(cab.length === 1 && /Presidência da República/.test(cab[0].antes) && cab[0].ocorrencias === 4, "P3 o cabecalho REPETIDO de pagina segue sendo achado (4 vezes), e so' ele: " + cab.map((m) => m.ocorrencias + "× " + m.antes.slice(0, 30)));
    ok(!cab.some((m) => /\(NR\)|Art\. 11/.test(m.antes)), "P4 o fechamento '...... ” (NR)' repetido e a abertura '“Art. 11.' nao viram cabecalho");
    ok(g("anexo").length === 1 && g("anexo")[0].titulo.indexOf("ANEXO I") === 0, "P5 o anexo segue sendo achado");
    ok(!cab.some((m) => /Receita Bruta/.test(m.antes)), "P6 o cabecalho de TABELA que se repete dentro do anexo nao e' cabecalho de pagina");
    ok(pre.blocos.length === 5 && pre.protegidas === cit.citadas.size, "P7 a analise devolve os blocos e quantas linhas protegeu: " + pre.blocos.length + "/" + pre.protegidas);
    /* aceitando TUDO, o bloco fica como veio */
    const r = p.leiAplicarPreprocesso(LC, pre.mudancas, {});
    const conta = (t, re) => (t.match(re) || []).length;
    ok(conta(r.texto, /“Art\. /g) === conta(LC, /“Art\. /g) && conta(r.texto, /” \(NR\)/g) === conta(LC, /” \(NR\)/g) && r.texto.indexOf("b) entidades religiosas") > 0,
      "P8 aceitando todas as sugestoes, as aspas, os pontos e o (NR) continuam: " + conta(r.texto, /“Art\. /g) + " / " + conta(LC, /“Art\. /g));
    const linhasR = r.texto.split("\n");
    ok(linhasR.some((x) => /^“Art\. 9º \.{20}/.test(x)) && !linhasR.some((x) => /^Art\. 9º \.{20}/.test(x)), "P9 a linha do artigo citado segue com a aspa e sozinha em sua linha");
    /* um artigo SEM aspas de abertura dentro do bloco (o Planalto so' abre a aspa no primeiro): a remissao nao o cola */
    const ea = ["Art. 1º Texto um.", "Art. 2º Texto dois.", "Art. 3º Texto tres.", "Art. 496. A Lei nº 1 passa a vigorar com as seguintes alterações:", "“Art. 9º Texto do nove que segue sem ponto final",
      "Art. 3º Texto do artigo tres citado, sem aspas de abertura.", PTS + " ” (NR)", "Art. 497. Esta Lei entra em vigor."].join("\n");
    ok(p.leiPreprocessar(ea).mudancas.filter((m) => m.grupo === "remissao").length === 0, "P11 um artigo citado sem aspas de abertura, dentro do bloco, nao e' colado na linha de cima");
    /* o anexo termina no proximo artigo: o cabecalho repetido DEPOIS dele volta a ser cabecalho */
    const ax = ["Art. 1º Texto um.", "ANEXO I", "Tabela A", "Linha a", "Art. 2º Texto dois.", "Presidência da República — Subchefia para Assuntos Jurídicos", "Art. 3º Texto tres, um pouco mais longo.", "Art. 4º Texto quatro, um pouco mais longo.",
      "Art. 5º Texto cinco, um pouco mais longo.", "Art. 6º Texto seis, um pouco mais longo.", "Presidência da República — Subchefia para Assuntos Jurídicos", "Art. 7º Texto sete.", "Art. 8º Texto oito.", "Art. 9º Texto nove.", "Art. 10. Texto dez.",
      "Art. 11. Texto onze.", "Presidência da República — Subchefia para Assuntos Jurídicos", "Art. 12. Texto doze."].join("\n");
    const cabAx = p.leiPreprocessar(ax).mudancas.filter((m) => m.grupo === "cabecalho");
    ok(cabAx.length === 1 && cabAx[0].ocorrencias === 3, "P12 o anexo termina no proximo artigo: o cabecalho repetido depois dele e' achado: " + JSON.stringify(cabAx.map((m) => m.ocorrencias)));
    /* o mesmo em texto SEM blocos: nada muda */
    ok(p.leiPreprocessar("Art. 1º Um.\nArt. 2º Dois.").blocos.length === 0, "P10 texto sem citacoes: sem blocos");
  }

  /* ---- U: a revisao da colagem ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    api.leiRevisarColagemAbrir({ modo: "criar", texto: LC, pre: api.leiPreprocessar(LC), aoConfirmar() {} });
    const card = api.$("leiPreGrupo_alteracao");
    ok(!!card && /^Alterações de outras leis \(5\)/.test(achar(card, (c) => cls(c, "lei-pre-cab"))[0].textContent), "U1 a revisao mostra o grupo 'Alterações de outras leis (5)'");
    const det = achar(card, (c) => String(c.tag || c.tagName).toLowerCase() === "details")[0];
    ok(det && det.open !== true, "U2 recolhido");
    const itens = achar(card, (c) => cls(c, "lei-pre-alt-item"));
    ok(itens.length === 5 && /^Art\. 496 altera Lei nº 5\.172\/1966 · art\. 9º$/.test(itens[0].children[0].textContent) && /^Art\. 500 altera Lei nº 8\.019\/1990 · art\. 1º, art\. 2º$/.test(itens[4].children[0].textContent),
      "U3 cada bloco diz qual artigo altera qual lei e quais artigos: " + itens.map((x) => x.children[0].textContent));
    ok(achar(card, (c) => c.type === "checkbox" || c.type === "radio").length === 0, "U4 e' so' informacao: nao ha o que marcar");
    ok(itens.every((x) => achar(x, (c) => cls(c, "lei-dup-ctx-det")).length === 1), "U5 cada bloco tem 'ver no texto'");
    ok(!!api.$("leiPreGrupo_cabecalho") && !!api.$("leiPreGrupo_grafia") && !!api.$("leiPreGrupo_anexo"), "U6 os outros grupos seguem (cabecalho, grafia, anexo)");
    api.$("dlgLeiPre").close();
    const simples = "Art. 1º Um.\nArt . 2 Dois.\nArt. 3º Tres.";
    api.leiRevisarColagemAbrir({ modo: "criar", texto: simples, pre: api.leiPreprocessar(simples), aoConfirmar() {} });
    ok(achar(api.$("leiPreLista"), (c) => c.id === "leiPreGrupo_alteracao").length === 0 && achar(api.$("leiPreLista"), (c) => c.id === "leiPreGrupo_grafia").length === 1, "U7 sem blocos, o grupo nao aparece (e a grafia do 'Art . 2' sim)");
  }

  /* ---- V: o leitor e os ajustes ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_214", nome: "LC 214/2025", texto: LC });
    api.leiAbrir("Direito", "IBS", l.id);
    const arts = () => Array.from(api.$("leiLeitura").querySelectorAll(".lei-art"));
    const deArt = (num) => arts().filter((b) => b._lei && b._lei.num === num)[0];
    const corpoHtml = (b) => String(achar(b, (c) => cls(c, "lei-art-txt"))[0].innerHTML || "");
    const chips = (b) => achar(b, (c) => cls(c, "lei-alt-chip"));
    ok(arts().length === 19, "V1 o leitor desenha os 19 artigos da lei (os citados nao ganham cartao): " + arts().length);
    const b496 = deArt("496");
    ok(chips(b496).length === 1 && chips(b496)[0].textContent === "↪ altera Lei nº 5.172/1966 · art. 9º" && /Código Tributário Nacional/.test(chips(b496)[0].title || ""),
      "V2 o artigo que altera outra lei mostra o indicador: " + chips(b496).map((c) => c.textContent));
    const h = corpoHtml(b496);
    ok((h.match(/lei-citacao/g) || []).length === 1 && /lei-cit-cab">art\. 9º de Lei nº 5\.172\/1966 · caput sem mudança</.test(h) && /lei-cit-fim">\(NR\) · nova redação</.test(h), "V3 o trecho citado ganha borda, selo com o artigo da outra lei e a marca do fim: " + h.slice(0, 200));
    ok(/Art\. 496\./.test(h) && /entidades religiosas/.test(h), "V4 o texto do artigo continua todo la");
    const b500 = deArt("500"), h5 = corpoHtml(b500);
    ok(chips(b500)[0].textContent === "↪ altera Lei nº 8.019/1990 · art. 1º, art. 2º" && (h5.match(/lei-citacao/g) || []).length === 2 && (h5.match(/lei-cit-fim/g) || []).length === 1
      && /art\. 1º de Lei nº 8\.019\/1990<\/div>/.test(h5) && /art\. 2º de Lei nº 8\.019\/1990<\/div>/.test(h5) && !/caput sem mudança/.test(h5), "V5 dois artigos citados COM texto: dois selos (sem 'caput sem mudanca'), e a marca so' no fim do trecho: " + h5.slice(-260));
    ok(chips(deArt("3")).length === 0 && corpoHtml(deArt("3")).indexOf("lei-citacao") < 0 && chips(deArt("501")).length === 0, "V6 artigos comuns: sem indicador e sem selo");
    ok(api.leiDe("lei_214").texto === LC, "V7 o texto guardado nao mudou");
    /* a lista de ajustes: um por bloco, e manter o original */
    api.leiMapaAbrir();
    const aj = api.$("leiMapaAjustes");
    const tipo = achar(aj, (c) => cls(c, "lei-aj-tipo-citacao"))[0];
    ok(!!tipo && /Artigos citados de outra lei \(5\)/.test(achar(tipo, (c) => String(c.tag || c.tagName).toLowerCase() === "summary")[0].textContent), "V8 a lista 'O que o app ajustou' tem o tipo 'Artigos citados de outra lei (5)'");
    const linhas = achar(tipo, (c) => cls(c, "lei-aj-item"));
    ok(linhas.length === 5 && /^linha \d+ · Art\. 496 traz 1 artigo\(s\) de Lei nº 5\.172\/1966 entre aspas: não contam como artigos desta lei$/.test(linhas[0].children[0].textContent), "V9 cada bloco, com a lei e quantos artigos: " + linhas[0].children[0].textContent);
    achar(linhas[0], (c) => cls(c, "lei-aj-alt"))[0].onclick();
    const rec = api.leiDe("lei_214").ajustesRecusados;
    ok(rec["citacao:" + cit.blocos[0].linha] === true, "V10 manter o original grava a escolha na lei");
    ok(arts().length === 19 && chips(deArt("496")).length === 0 && corpoHtml(deArt("496")).indexOf("lei-citacao") < 0 && chips(deArt("500")).length === 1, "V11 o leitor se repinta: o 496 volta a texto comum, os outros seguem com indicador");
    const dd = api.decLer().filter((r) => r.regra === "ajuste.citacao");
    ok(dd.length === 2 && dd[0].decisao === "automatico" && dd[1].decisao === "recusou" && dd[1].risco === "medio" && dd[1].proposta.n === 1, "V12 o historico de decisoes: 1 'automatico' e a recusa: " + JSON.stringify(dd.map((r) => r.decisao)));
    ok(/^Ajuste do leitor: artigos citados de outra lei fora da lista de artigos$/.test(api.decTituloDaRegra("ajuste.citacao")), "V13 a regra tem titulo legivel no historico");
    /* um artigo com camada de alteracao nao e' decorado */
    const alt = Object.assign({}, deArt("496")._lei, {});
    const a496 = p.leiArtigos(LC).filter((a) => a.num === "496")[0];
    ok(api.leiCorpoHtml(a496, cit).indexOf("lei-citacao") > 0 && api.leiCorpoHtml(Object.assign({}, a496, { alterado: true }), cit).indexOf("lei-citacao") < 0 && api.leiCorpoHtml(Object.assign({}, a496, { revogado: true }), cit).indexOf("lei-citacao") < 0,
      "V14 o mesmo artigo com a camada de alteracao (redacao trocada) ou revogado nao recebe selos");
  }

  /* ---- T: CSS e textos ---- */
  {
    ok(/\.lei-citacao\{[^}]*border-left:2px solid var\(--acao\)/.test(html) && /\.lei-alt-chip\{/.test(html) && /\.lei-cit-cab\{/.test(html) && /\.lei-cit-fim\{/.test(html), "T1 CSS do indicador e do selo");
    const chaves = ["aj_t_citacao", "aj_p_citacao", "aj_r_citacao", "aj_r_citacao_orig", "dec_r_ajuste_citacao", "lei_pre_alt_titulo", "lei_pre_alt_ajuda", "lei_pre_alt_item", "lei_pre_alt_item_sem",
      "lei_alt_chip", "lei_alt_chip_sem", "lei_cit_art_curto", "lei_cit_cab", "lei_cit_cab_sem", "lei_cit_lei_outra", "lei_cit_fim_nr", "lei_cit_fim_ac", "lei_cit_fim_vetado"];
    const conta = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": ", "g")) || []).length;
    ok(chaves.every((k) => conta(k) === 2), "T2 os textos existem em portugues E em ingles: " + chaves.filter((k) => conta(k) !== 2).join(","));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
