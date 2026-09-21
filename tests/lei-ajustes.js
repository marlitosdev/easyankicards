/* =====================================================================
 * O QUE O APP AJUSTOU AO LER — mostrar, deixar manter o original e registrar
 *
 * O leitor arruma sozinho alguns detalhes ao ler uma lei: separa a nota de alteração do nome do
 * capítulo, tira o link grudado no nome ("Regulamento"), lê "42O" como "42º", lê "Art. 178 - A isenção"
 * como o art. 178, e deixa fora da leitura as linhas que não são de artigo nenhum. Antes era tudo
 * silencioso: quem errava não deixava rastro nem dava chance de desfazer.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O parser devolve cada ajuste (id estável, tipo, linha, o que era e os campos do tipo) e NÃO altera
 *     o texto. Com `recusados`, o ajuste não é feito: o nome fica como veio, "42O" fica "42O", o "A"
 *     fica no número. Sem `recusados`, a leitura é a mesma de sempre.
 *  2. Uma lei limpa não tem ajuste nenhum (a tela não ganha ruído).
 *  3. A escolha vale onde a lei é lida: artigos efetivos, blocos, "ir para…", numeração.
 *  4. A tela: um grupo RECOLHIDO à parte (não mexe na linha de estado), um subgrupo por tipo, cada item
 *     com "manter o original" / "usar o ajuste", e "manter todos" / "usar todos" por tipo. Só "fora da
 *     leitura" é informativo (sem botão).
 *  5. O texto guardado nunca muda; a escolha fica na lei e o mapa e o leitor se repintam.
 *  6. O histórico de decisões: a 1ª vez que a pessoa vê cada tipo entra UM registro "automático"; cada
 *     decisão dela é um registro novo (recusou/aceitou, item ou todos), com risco e o que era.
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

  const LEI = [
    "Dispõe sobre testes.",
    "O PRESIDENTE DA REPÚBLICA decreta:",
    "TÍTULO I",
    "DAS DISPOSIÇÕES GERAIS Regulamento",
    "Art. 1º Primeiro.",
    "CAPÍTULO I",
    "(Redação dada pela Lei nº 1, de 2001)",
    "Do Começo",
    "Art. 2º Segundo.",
    "Art. 3O Terceiro com a letra O.",
    "Art. 4 - A isenção é concedida nos termos desta lei.",
    "Art. 5º Quinto.",
    "CAPÍTULO II",
    "Do Fim",
    "Vide art. 9º da Lei nº 3",
    "Art. 6º Sexto.",
  ].join("\n");

  /* ==============================================================
   * P: O PARSER
   * ============================================================== */
  {
    const r = p.leiLerLei(LEI);
    const por = {}; r.ajustes.forEach((a) => { (por[a.tipo] = por[a.tipo] || []).push(a); });
    ok(r.ajustes.length === 6 && ["nota", "link", "ordinal", "sufixo"].every((k) => por[k].length === 1) && por.fora.length === 2,
      "P1 cada ajuste vira um item (1 nota, 1 link, 1 ordinal, 1 sufixo, 2 trechos fora): " + r.ajustes.map((a) => a.id).join(" | "));
    ok(r.ajustes.every((a, i, v) => !i || v[i - 1].linha <= a.linha), "P1a em ordem de linha");
    ok(r.ajustes.every((a) => a.id && a.tipo && a.linha > 0 && a.antes && a.recusado === false), "P1b todos com id, tipo, linha e o que era; nenhum recusado por padrao");
    const nota = por.nota[0], link = por.link[0], ord = por.ordinal[0], suf = por.sufixo[0];
    ok(nota.id === "nota:TITULO I>CAPITULO I" && nota.linha === 7 && nota.rotulo === "CAPÍTULO I" && nota.nome === "Do Começo" && nota.nota === "(Redação dada pela Lei nº 1, de 2001)",
      "P2 a nota: id pela divisao, a linha da nota, o nome que veio DEPOIS dela e o texto da nota: " + JSON.stringify(nota));
    ok(link.id === "link:TITULO I" && link.link === "Regulamento" && link.nome === "DAS DISPOSIÇÕES GERAIS" && link.linha === 4, "P3 o link: a palavra tirada e o nome que ficou: " + JSON.stringify(link));
    ok(ord.id === "ordinal:10:3O" && ord.de === "3O" && ord.para === "3º" && ord.linha === 10, "P4 o ordinal: '3O' lido como '3º': " + JSON.stringify(ord));
    ok(suf.id === "sufixo:11:4-A" && suf.de === "4-A" && suf.para === "4" && suf.letra === "A" && suf.linha === 11, "P5 o sufixo: '4-A' lido como '4', a letra e' do texto: " + JSON.stringify(suf));
    ok(por.fora[0].id === "fora:1" && por.fora[0].linhaFim === 2 && por.fora[0].n === 2 && por.fora[0].informativo === true && /PRESIDENTE/.test(por.fora[0].antes)
      && por.fora[1].id === "fora:15" && /art\. 9º/.test(por.fora[1].antes), "P6 as linhas fora da leitura (o comeco da lei e a linha solta depois do nome), em trechos, so' informativas");
    /* o que o leitor le */
    ok(r.divisoes[0].rotulo === "TÍTULO I — DAS DISPOSIÇÕES GERAIS" && r.divisoes[1].nota === "(Redação dada pela Lei nº 1, de 2001)" && r.artigos[2].numCru === "3º" && r.artigos[3].num === "4",
      "P7 sem recusar: a leitura de sempre (nome sem o link, nota a parte, 3º, art. 4)");
    ok(JSON.stringify(p.leiArtigos(LEI)) === JSON.stringify(p.leiArtigos(LEI, { recusados: {} })) && JSON.stringify(p.leiArtigos(LEI)) === JSON.stringify(r.artigos),
      "P7a sem opcoes ou com recusados vazio, os artigos sao os mesmos de sempre");
  }
  {
    /* recusar cada um */
    const rec = (ids) => { const m = {}; ids.forEach((i) => { m[i] = true; }); return { recusados: m }; };
    const a = p.leiLerLei(LEI, rec(["nota:TITULO I>CAPITULO I"]));
    ok(a.divisoes[1].rotulo === "CAPÍTULO I — (Redação dada pela Lei nº 1, de 2001) Do Começo" && a.divisoes[1].nota === "" && a.ajustes.filter((x) => x.tipo === "nota")[0].recusado === true,
      "P8 manter a nota: ela fica junto do nome, como no texto: " + a.divisoes[1].rotulo);
    ok(a.divisoes[0].rotulo === "TÍTULO I — DAS DISPOSIÇÕES GERAIS" && a.artigos[2].numCru === "3º", "P8a e o resto continua ajustado");
    const b = p.leiLerLei(LEI, rec(["link:TITULO I"]));
    ok(b.divisoes[0].rotulo === "TÍTULO I — DAS DISPOSIÇÕES GERAIS Regulamento" && b.divisoes[1].rotulo === "CAPÍTULO I — Do Começo", "P9 manter o link: o nome fica com 'Regulamento' no fim: " + b.divisoes[0].rotulo);
    const c = p.leiLerLei(LEI, rec(["ordinal:10:3O"]));
    ok(c.artigos[2].numCru === "3O" && c.artigos[2].num === "3" && c.artigos[2].rotulo === "Art. 3O", "P10 manter o ordinal: aparece '3O' e continua sendo o artigo 3: " + c.artigos[2].numCru + "/" + c.artigos[2].num);
    const d = p.leiLerLei(LEI, rec(["sufixo:11:4-A"]));
    ok(d.artigos[3].num === "4-A" && d.artigos[3].numCru === "4-A" && d.artigos.length === 6, "P11 manter o sufixo: o artigo e' o 4-A: " + d.artigos[3].num);
    const e = p.leiLerLei(LEI, rec(["fora:1", "fora:15"]));
    ok(e.ajustes.filter((x) => x.tipo === "fora").every((x) => x.recusado === false) && JSON.stringify(e.artigos) === JSON.stringify(p.leiArtigos(LEI)),
      "P12 'fora da leitura' nao tem o que recusar: continua igual");
    const f = p.leiLerLei(LEI, rec(["nota:TITULO I>CAPITULO I", "link:TITULO I", "ordinal:10:3O", "sufixo:11:4-A"]));
    ok(f.ajustes.filter((x) => x.recusado).length === 4 && f.divisoes[0].rotulo === "TÍTULO I — DAS DISPOSIÇÕES GERAIS Regulamento" && f.artigos[2].numCru === "3O" && f.artigos[3].num === "4-A",
      "P13 recusar todos: a leitura e' o texto como esta");
    ok(f.ajustes.length === 6, "P13a e a lista dos ajustes continua inteira (para poder voltar atras)");
  }
  {
    /* a nota e o nome em linhas seguidas: com a nota recusada o nome nao se perde */
    const T = ["Seção V", "(Redação dada pela Emenda Constitucional nº 92, de 2016)", "Do Tribunal Superior do Trabalho", "Art. 1º Um."].join("\n");
    const ok1 = p.leiLerLei(T);
    const ok2 = p.leiLerLei(T, { recusados: { "nota:SECAO V": true } });
    ok(ok1.divisoes[0].nome === "Do Tribunal Superior do Trabalho" && /Redação/.test(ok1.divisoes[0].nota) && ok1.artigos.length === 1, "P14 padrao: nome depois da nota");
    ok(/^\(Redação dada pela Emenda Constitucional nº 92, de 2016\) Do Tribunal Superior do Trabalho$/.test(ok2.divisoes[0].nome) && ok2.divisoes[0].nota === "" && ok2.artigos.length === 1,
      "P14a nota recusada: a nota e o nome ficam juntos, na ordem do texto, e o artigo nao e' engolido: " + ok2.divisoes[0].nome);
    /* nota junto do nome, na mesma linha */
    const U = ["CAPÍTULO I (Redação dada pela Lei nº 1) Do Começo", "Art. 1º Um."].join("\n");
    const u1 = p.leiLerLei(U);
    ok(/Do Começo/.test(u1.divisoes[0].nome) && u1.ajustes.filter((x) => x.tipo === "nota").length === 1, "P15 nota e nome na MESMA linha tambem e' um ajuste: " + u1.divisoes[0].rotulo);
  }
  {
    /* uma lei limpa nao tem ajuste, e o que parece ajuste mas nao e' nao conta */
    const LIMPA = ["TÍTULO I", "Das Disposições Gerais", "CAPÍTULO I", "Da Vigência", "Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Tres.", "Art. 44-O. Sufixo de verdade.", "Art. 45. Outro.", "TÍTULO V - A", "Art. 46. Mais.", "Art. 1o Um.", "Art. 5° Cinco."].join("\n");
    const r = p.leiLerLei(LIMPA);
    ok(r.ajustes.filter((x) => x.tipo !== "ordinal").length === 0, "P16 lei limpa: nada de nota, link, sufixo ou trecho fora: " + r.ajustes.map((x) => x.id));
    ok(r.ajustes.length === 2 && r.ajustes.every((x) => x.tipo === "ordinal"), "P16a so os ordinais '1o' e '5°' (letra/grau no lugar do º): " + r.ajustes.map((x) => x.id));
    const L2 = ["Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Tres."].join("\n");
    ok(p.leiLerLei(L2).ajustes.length === 0, "P16b uma lei so de artigos nao tem nenhum ajuste");
    ok(p.leiNomeDaDivisao("REFORMA AGRÁRIA Regulamento").link === "Regulamento" && p.leiNomeDaDivisao("Da Vigência").link === "" && p.leiNomeDaDivisao("(Redação dada) Do Começo").nota === "(Redação dada)",
      "P17 leiNomeDaDivisao diz o link tirado e a nota separada");
  }
  {
    /* nada muda o texto guardado, nem o mapa da lei sem a escolha */
    /* o parser so' le: chamar de novo, com ou sem escolha, da o mesmo resultado (nao guarda estado) */
    const a1 = JSON.stringify(p.leiLerLei(LEI).ajustes);
    p.leiLerLei(LEI, { recusados: { "link:TITULO I": true } });
    ok(JSON.stringify(p.leiLerLei(LEI).ajustes) === a1, "P18 a leitura nao guarda estado entre uma chamada e outra");
    const dg = p.leiDiagnosticarLei(LEI);
    const dg2 = p.leiDiagnosticarLei(LEI, { recusados: { "sufixo:11:4-A": true } });
    ok(dg.ajustes.length === 6 && dg2.ajustes.filter((x) => x.recusado).length === 1, "P19 o diagnostico devolve os ajustes e respeita o que foi recusado");
    ok(dg.estrutura.ajustes === dg.ajustes || JSON.stringify(dg.estrutura.ajustes) === JSON.stringify(dg.ajustes), "P19a a estrutura tambem (uma leitura so)");
    ok(p.leiBlocos(LEI, { recusados: { "link:TITULO I": true } })[0].nome === "TÍTULO I — DAS DISPOSIÇÕES GERAIS Regulamento", "P20 os blocos de leitura respeitam a escolha: " + p.leiBlocos(LEI, { recusados: { "link:TITULO I": true } })[0].nome);
    ok(p.leiBlocos(LEI)[0].nome === "TÍTULO I — DAS DISPOSIÇÕES GERAIS", "P20a e sem escolha sao os de sempre");
  }

  /* ==============================================================
   * E: A LEI GUARDADA — a escolha fica na lei e vale onde ela e' lida
   * ============================================================== */
  {
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_aj", nome: "Lei de Ajustes", texto: LEI });
    ok(api.leiOpcDaLei(l).recusados && Object.keys(api.leiOpcDaLei(l).recusados).length === 0 && Object.keys(api.leiOpcDaLei(null).recusados).length === 0, "E1 lei sem escolha: opcoes vazias (e lei nula tambem)");
    ok(api.leiArtigosEfetivos(l)[2].numCru === "3º", "E2 os artigos efetivos: ajustados");
    ok(api.leiAjusteRecusar("lei_aj", "ordinal:10:3O", true) === true && api.leiDe("lei_aj").ajustesRecusados["ordinal:10:3O"] === true, "E3 recusar grava na lei");
    ok(api.leiArtigosEfetivos(api.leiDe("lei_aj"))[2].numCru === "3O" && api.leiDe("lei_aj").texto === LEI, "E4 os artigos efetivos mostram o original, e o TEXTO GUARDADO nao mudou");
    ok(api.leiAjusteRecusar("lei_aj", ["link:TITULO I", "nota:TITULO I>CAPITULO I"], true) && Object.keys(api.leiDe("lei_aj").ajustesRecusados).length === 3, "E5 recusar varios de uma vez");
    api.leiAjusteRecusar("lei_aj", ["ordinal:10:3O"], false);
    ok(!("ordinal:10:3O" in api.leiDe("lei_aj").ajustesRecusados) && api.leiArtigosEfetivos(api.leiDe("lei_aj"))[2].numCru === "3º", "E6 voltar ao ajuste tira a escolha e a leitura volta");
    ok(api.leiAjusteRecusar("lei_inexistente", "x", true) === false && api.leiAjusteRecusar("lei_aj", [], true) === false, "E7 lei que nao existe ou nada a recusar: falso");
    /* a chave do desenho do leitor muda com a escolha (senao o leitor serviria o desenho velho) */
    api.leiGuardar({ id: "lei_aj", ajustesRecusados: {} });
    const k0 = api.leiChavePintura(api.leiDe("lei_aj"), LEI, {});
    api.leiGuardar({ id: "lei_aj", ajustesRecusados: { "ordinal:10:3O": true } });
    const k1 = api.leiChavePintura(api.leiDe("lei_aj"), LEI, {});
    ok(k0 !== k1, "E8 a escolha muda a chave do desenho do leitor (ele repinta)");
    api.leiGuardar({ id: "lei_aj", ajustesVistos: { nota: 1 } });
    ok(api.leiChavePintura(api.leiDe("lei_aj"), LEI, {}) === k1, "E9 mas o registro do que ja foi mostrado ao log NAO derruba o desenho guardado");
  }

  /* ==============================================================
   * U: A TELA
   * ============================================================== */
  {
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_aj", nome: "Lei de Ajustes", texto: LEI });
    api.leiAbrir("Direito", "Testes", l.id);
    api.leiMapaAbrir();
    const cx = api.$("leiMapaAjustes");
    const g = achar(cx, (c) => cls(c, "lei-aj-grupo"))[0];
    ok(cx.children.length === 1 && g && g.open !== true, "U1 um grupo RECOLHIDO, a parte: " + (cx.children.length));
    ok(/O que o app ajustou ao ler \(6\)/.test(achar(g, (c) => String(c.tag || c.tagName).toLowerCase() === "summary")[0].textContent), "U1a o titulo diz quantos: " + g.children[0].textContent);
    const tipos = achar(g, (c) => cls(c, "lei-aj-tipo"));
    ok(tipos.length === 5 && ["nota", "link", "ordinal", "sufixo", "fora"].every((k, i) => cls(tipos[i], "lei-aj-tipo-" + k)) && tipos.every((d) => d.open !== true),
      "U2 um subgrupo recolhido por tipo, na ordem nota, link, ordinal, sufixo, fora: " + tipos.map((d) => d.className));
    const itens = achar(g, (c) => cls(c, "lei-aj-item"));
    ok(itens.length === 6, "U2a seis itens: " + itens.length);
    const tx = (i) => itens[i].children[0].textContent;
    ok(/^linha 7 · CAPÍTULO I: a nota “\(Redação dada pela Lei nº 1, de 2001\)” foi separada do nome \(“Do Começo”\)$/.test(tx(0)), "U3 a nota: " + tx(0));
    ok(/^linha 4 · TÍTULO I: “Regulamento” foi tirado do fim do nome \(“DAS DISPOSIÇÕES GERAIS”\)$/.test(tx(1)), "U3a o link: " + tx(1));
    ok(/^linha 10 · Art\. 3O lido como Art\. 3º$/.test(tx(2)), "U3b o ordinal: " + tx(2));
    ok(/^linha 11 · Art\. 4-A lido como Art\. 4: a letra “A” é o começo do texto, não do número$/.test(tx(3)), "U3c o sufixo: " + tx(3));
    ok(/^linha 1 · 2 linha\(s\) fora da leitura: “Dispõe sobre testes\. O PRESIDENTE DA REPÚBLICA decreta:”$/.test(tx(4)), "U3d o trecho fora da leitura: " + tx(4));
    const botoes = achar(g, (c) => cls(c, "lei-aj-alt"));
    ok(botoes.length === 4 && botoes.every((b) => b.textContent === "manter o original"), "U4 'manter o original' em cada item que tem o que decidir (nao nos 2 de 'fora da leitura'): " + botoes.length);
    ok(achar(g, (c) => cls(c, "lei-aj-todos")).length === 4 && achar(g, (c) => cls(c, "lei-aj-todos")).every((b) => b.textContent === "manter todos no original"), "U4a e 'manter todos no original' por tipo (4 tipos)");
    ok(achar(g, (c) => String(c.tag || c.tagName).toLowerCase() === "details" && /lei-dup-ctx-det/.test(c.className || "")).length === 6, "U5 cada item tem o 'ver no texto' (o trecho com os vizinhos)");
    /* a tela de conferencia nao e' tocada */
    const cf = api.$("leiMapaConferir");
    ok(cf.children.length >= 1 && !achar(cf, (c) => cls(c, "lei-aj-grupo")).length && !/ajust/i.test(cf.textContent), "U6 os ajustes ficam FORA da conferencia (a linha de estado nao muda): " + cf.textContent.slice(0, 80));
  }
  {
    /* manter o original, um a um: grava, repinta, texto intacto, e o leitor le o original */
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_aj", nome: "Lei de Ajustes", texto: LEI });
    api.leiAbrir("Direito", "Testes", l.id);
    api.leiMapaAbrir();
    const acha = () => achar(api.$("leiMapaAjustes"), (c) => cls(c, "lei-aj-item"));
    const btnDe = (i) => achar(acha()[i], (c) => cls(c, "lei-aj-alt"))[0];
    btnDe(2).onclick();          /* o ordinal */
    let lei = api.leiDe("lei_aj");
    ok(lei.ajustesRecusados["ordinal:10:3O"] === true && lei.texto === LEI, "U7 'manter o original' grava a escolha na lei e nao mexe no texto");
    ok(api.leiArtigosEfetivos(lei)[2].numCru === "3O", "U7a e o leitor le '3O'");
    const lidos = () => Array.from(api.$("leiLeitura").querySelectorAll(".lei-art")).map((b) => b._lei && b._lei.numCru);
    ok(lidos().indexOf("3O") >= 0 && lidos().indexOf("3º") < 0 && lidos().length === 6, "U7b o LEITOR tambem se repinta, com o original: " + lidos());
    const it = acha()[2];
    ok(cls(it, "lei-aj-recusado") && /lido como está no texto \(sem virar “3º”\)/.test(it.children[0].textContent) && btnDe(2).textContent === "usar o ajuste",
      "U8 o item se repinta: diz que ficou o original e o botao vira 'usar o ajuste': " + it.children[0].textContent);
    ok(acha().length === 6, "U8a a lista continua com os seis (nada some por ter sido recusado)");
    btnDe(2).onclick();
    lei = api.leiDe("lei_aj");
    ok(!lei.ajustesRecusados["ordinal:10:3O"] && api.leiArtigosEfetivos(lei)[2].numCru === "3º" && btnDe(2).textContent === "manter o original", "U9 'usar o ajuste' volta atras");
    ok(lidos().indexOf("3º") >= 0 && lidos().indexOf("3O") < 0, "U9a e o leitor volta ao ajuste: " + lidos());
    /* a nota recusada aparece no nome do mapa */
    btnDe(0).onclick();
    const raizTit = api.$("leiMapaArvore").children[0];
    if (raizTit.encher) raizTit.encher();
    const arv = api.$("leiMapaArvore").textContent;
    ok(/CAPÍTULO I — \(Redação dada pela Lei nº 1, de 2001\) Do Começo/.test(arv), "U10 a arvore do mapa mostra o nome com a nota, como no texto: " + arv.slice(0, 160));
    /* o estado aberto dos grupos sobrevive ao repintar */
    const g0 = achar(api.$("leiMapaAjustes"), (c) => cls(c, "lei-aj-grupo"))[0];
    g0.open = true; g0.ontoggle();
    const t0 = achar(g0, (c) => cls(c, "lei-aj-tipo-ordinal"))[0];
    t0.open = true; t0.ontoggle();
    btnDe(2).onclick();
    const g1 = achar(api.$("leiMapaAjustes"), (c) => cls(c, "lei-aj-grupo"))[0];
    ok(g1.open === true && achar(g1, (c) => cls(c, "lei-aj-tipo-ordinal"))[0].open === true && achar(g1, (c) => cls(c, "lei-aj-tipo-nota"))[0].open !== true, "U11 o que estava aberto continua aberto depois de decidir");
  }
  {
    /* por tipo: manter todos / usar todos */
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const L = ["Art. 1o Um.", "Art. 2o Dois.", "Art. 3O Tres.", "Art. 4º Quatro."].join("\n");
    const l = api.leiGuardar({ id: "lei_o", nome: "Lei O", texto: L });
    api.leiAbrir("Direito", "Testes", l.id);
    api.leiMapaAbrir();
    const todos = () => achar(api.$("leiMapaAjustes"), (c) => cls(c, "lei-aj-todos"));
    ok(todos().length === 1 && todos()[0].textContent === "manter todos no original", "U12 tres ordinais: um botao 'manter todos'");
    todos()[0].onclick();
    ok(Object.keys(api.leiDe("lei_o").ajustesRecusados).length === 3 && api.leiArtigosEfetivos(api.leiDe("lei_o")).map((a) => a.numCru).join(",") === "1o,2o,3O,4º", "U12a manteve os tres no original: " + api.leiArtigosEfetivos(api.leiDe("lei_o")).map((a) => a.numCru));
    ok(todos().length === 1 && todos()[0].textContent === "usar todos os ajustes", "U12b e o botao vira 'usar todos os ajustes'");
    const regTodos = api.decLer().slice(-1)[0];
    ok(regTodos.regra === "ajuste.ordinal" && regTodos.decisao === "recusou" && regTodos.via === "todos" && regTodos.proposta.n === 3 && regTodos.proposta.linhas.length === 3 && regTodos.ref === "",
      "U12e 'manter todos' e' UM registro com os tres itens, via 'todos': " + JSON.stringify([regTodos.via, regTodos.proposta.n, regTodos.ref]));
    /* recusa parcial: os dois botoes */
    achar(api.$("leiMapaAjustes"), (c) => cls(c, "lei-aj-alt"))[0].onclick();
    ok(todos().length === 2 && todos().map((b) => b.textContent).join("|") === "manter todos no original|usar todos os ajustes", "U12c com um usado e dois mantidos, aparecem os dois botoes");
    todos()[1].onclick();
    ok(Object.keys(api.leiDe("lei_o").ajustesRecusados).length === 0, "U12d 'usar todos' limpa a escolha");
  }
  {
    /* lei limpa: nada na tela; e o grupo some quando nao ha ajuste */
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_l", nome: "Lei Limpa", texto: ["Art. 1º Um.", "Art. 2º Dois.", "Art. 3º Tres."].join("\n") });
    api.leiAbrir("Direito", "Testes", l.id);
    api.leiMapaAbrir();
    ok(api.$("leiMapaAjustes").children.length === 0, "U13 lei sem ajuste: o espaco dos ajustes fica vazio");
    ok(api.decLer().length === 0, "U13a e nada vai para o historico");
    const cf = api.$("leiMapaConferir");
    ok(cf.children.length === 1 && /Nada suspeito/.test(cf.textContent), "U13b a conferencia continua dizendo 'Nada suspeito'");
  }

  /* ==============================================================
   * D: O HISTORICO DE DECISOES
   * ============================================================== */
  {
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_aj", nome: "Lei de Ajustes", texto: LEI });
    api.leiAbrir("Direito", "Testes", l.id);
    api.leiMapaAbrir();
    let d = api.decLer();
    ok(d.length === 5 && d.every((r) => r.area === "ajuste" && r.decisao === "automatico" && r.origem === "app" && r.lei === "Lei de Ajustes" && r.via === "mapa"),
      "D1 a 1ª vez que a pessoa ve: UM registro 'automatico' por tipo (5), da area 'ajuste': " + d.map((r) => r.regra + ":" + r.decisao));
    ok(["nota", "link", "ordinal", "sufixo", "fora"].every((k) => d.some((r) => r.regra === "ajuste." + k)), "D1a as cinco regras: ajuste.nota, .link, .ordinal, .sufixo, .fora");
    const suf = d.filter((r) => r.regra === "ajuste.sufixo")[0], fora = d.filter((r) => r.regra === "ajuste.fora")[0], nota = d.filter((r) => r.regra === "ajuste.nota")[0];
    ok(suf.risco === "alto" && nota.risco === "baixo" && fora.risco === "alto", "D2 o risco: sufixo alto (pode esconder um artigo), nota baixo, e 'fora' alto quando cita um artigo: " + [suf.risco, nota.risco, fora.risco]);
    ok(fora.proposta.n === 2 && fora.proposta.linhas.length === 2 && /PRESIDENTE/.test(fora.proposta.linhas[0].texto) && /art\. 9º/.test(fora.proposta.amostra), "D3 o registro leva as linhas por inteiro: " + JSON.stringify(fora.proposta.linhas));
    ok(nota.proposta.n === 1 && nota.ref === "linha 7" && /Redação dada/.test(nota.proposta.amostra) && /separada do nome/.test(nota.proposta.depois) && /sobre o nome|nota/i.test(nota.motivo), "D4 a nota: linha, o que era e o que virou, e por que: " + JSON.stringify([nota.ref, nota.proposta.depois]));
    ok(api.leiDe("lei_aj").ajustesVistos && Object.keys(api.leiDe("lei_aj").ajustesVistos).length === 5, "D5 a lei lembra o que ja mostrou");
    api.leiMapaAbrir();
    ok(api.decLer().length === 5, "D6 abrir o mapa de novo NAO repete o registro");
    api.leiMapaAbrir(true);
    ok(api.decLer().length === 5, "D6a repintar tambem nao");
    /* decidir */
    const item = (tipo) => achar(api.$("leiMapaAjustes"), (c) => cls(c, "lei-aj-tipo-" + tipo))[0];
    achar(item("ordinal"), (c) => cls(c, "lei-aj-alt"))[0].onclick();
    d = api.decLer();
    const r1 = d[d.length - 1];
    ok(d.length === 6 && r1.regra === "ajuste.ordinal" && r1.decisao === "recusou" && r1.origem === "pessoa" && r1.via === "item" && r1.proposta.n === 1 && r1.ref === "linha 10" && r1.lei === "Lei de Ajustes",
      "D7 recusar UM: um registro novo, 'recusou', pedido pela pessoa, via item, com a linha: " + JSON.stringify([r1.regra, r1.decisao, r1.via, r1.ref]));
    ok(/3O/.test(r1.proposta.linhas[0].texto) && /3º/.test(r1.proposta.linhas[0].texto), "D7a e o que era e o que virou: " + r1.proposta.linhas[0].texto);
    ok(/^Mantido o original em 1 ajuste\(s\)/.test(api.$("toast").textContent), "D7b recusar diz o que fez (aviso acima da janela): " + api.$("toast").textContent);
    achar(item("ordinal"), (c) => cls(c, "lei-aj-alt"))[0].onclick();
    ok(/^Voltou ao ajuste do app em 1 ajuste\(s\)/.test(api.$("toast").textContent), "D7c voltar ao ajuste tambem diz: " + api.$("toast").textContent);
    const ultimo = () => api.decLer().slice(-1)[0];
    const r2 = ultimo();
    ok(r2.regra === "ajuste.ordinal" && r2.decisao === "aceitou" && r2.via === "item", "D8 voltar ao ajuste: 'aceitou'");
    ok(/lido como Art\. 3º/.test(r2.proposta.depois) && !/como está no texto/.test(r2.proposta.depois), "D8a o registro diz o que o APP propos (3O lido como 3º), nao o 'original mantido': " + r2.proposta.depois);
    achar(item("nota"), (c) => cls(c, "lei-aj-todos"))[0].onclick();
    const r3 = ultimo();
    ok(r3.regra === "ajuste.nota" && r3.decisao === "recusou" && r3.via === "item" && r3.proposta.n === 1, "D9 'manter todos' com um item so' e' 'item'");
    achar(item("sufixo"), (c) => cls(c, "lei-aj-alt"))[0].onclick();
    ok(ultimo().risco === "alto" && ultimo().regra === "ajuste.sufixo", "D9a recusar o sufixo e' de risco alto");
    /* a estatistica por regra */
    const st = api.decPorRegra().filter((s) => s.regra === "ajuste.ordinal")[0];
    ok(st.sug === 3 && st.rec === 1 && st.ace === 1 && st.sem === 1 && st.decididas === 2 && Math.abs(st.taxaRecusa - 0.5) < 1e-9, "D10 a taxa de recusa conta so' quem DECIDIU (o 'automatico' fica de fora): " + JSON.stringify(st));
    ok(api.decRiscoDoTexto(["nada"]) === "baixo", "D10a (o risco do texto continua o de sempre)");
    const antesFora = api.decLer().length;
    ok(api.leiAjusteDecidir("lei_aj", ["fora:1", "fora:15"], true) === 0 && api.decLer().length === antesFora && !api.leiDe("lei_aj").ajustesRecusados["fora:1"], "D10b tentar recusar 'fora da leitura' nao faz nada nem registra");
    ok(api.leiAjusteDecidir("lei_aj", ["sufixo:11:4-A"], true) === 0, "D10c recusar de novo o que ja esta recusado: nada muda (0)");
    ok(api.leiAjusteDecidir("lei_aj", ["nao:existe"], true) === 0 && api.leiAjusteDecidir("lei_que_nao_existe", ["x"], true) === 0, "D10d id que nao existe / lei que nao existe: 0");
    /* o relatorio e a tela do historico */
    const rel = api.leiRelatorioFluxo("mapa e conferência");
    ok(/ajustes do leitor: 6 \(recusados: 2\) — /.test(rel) && ["nota 1", "link 1", "ordinal 1", "sufixo 1", "fora 2"].every((k) => rel.indexOf(k) >= 0) && /\[nota\/original mantido\] linha 7/.test(rel), "D11 o relatorio da tela conta os ajustes e os recusados: " + rel.split("\n").filter((x) => /ajustes do leitor/.test(x)).join("|"));
    api.decPintar();
    ok(api.$("btnDecF_area_ajuste") && api.$("btnDecF_decisao_automatico") && api.$("btnDecF_area_ajuste").textContent === "ajustes do leitor" && api.$("btnDecF_decisao_automatico").textContent === "automático",
      "D12 a tela do historico tem os filtros 'ajustes do leitor' e 'automático'");
    ok(api.decTituloDaRegra("ajuste.nota") === "Ajuste do leitor: nota separada do nome" && api.decTituloDaRegra("ajuste.fora") === "Ajuste do leitor: linhas fora da leitura", "D13 cada regra tem titulo legivel: " + api.decTituloDaRegra("ajuste.nota"));
  }
  {
    /* uma lei JA guardada, de antes da E2: abrir o mapa registra e nao quebra */
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const l = api.leiGuardar({ id: "lei_velha", nome: "Lei Velha", texto: LEI, parei: "2", pareiIndice: 1 });
    ok(!l.ajustesRecusados && !l.ajustesVistos, "D14 a lei antiga nao tem os campos novos");
    api.leiAbrir("Direito", "Testes", l.id);
    api.leiMapaAbrir(true);
    ok(api.decLer().length === 0 && !api.leiDe("lei_velha").ajustesVistos, "D14b so' repintar (sem abrir) NAO registra nada nem marca a lei");
    api.leiAbrir("Direito", "Testes", l.id);
    ok(api.leiMapaAbrir() === true && api.decLer().length === 5 && api.leiDe("lei_velha").parei === "2" && api.leiDe("lei_velha").pareiIndice === 1, "D14a abrir o mapa funciona, registra, e nao mexe no 'parei aqui'");
  }

  {
    /* "ir para…" e a numeracao leem com a escolha da lei */
    const api = rodar().api;
    api.matIniciar(); api.leiIniciar();
    const L = [];
    for (let i = 1; i <= 10; i++) L.push(i === 5 ? "Art. 5 - A isenção é concedida." : "Art. " + i + ". Texto " + i + ".");
    const l = api.leiGuardar({ id: "lei_n", nome: "Lei N", texto: L.join("\n") });
    api.leiAbrir("Direito", "Testes", l.id);
    const ir0 = api.leiIrDados();
    ok(ir0.arts.map((a) => a.num).indexOf("5") >= 0 && ir0.arts.map((a) => a.num).indexOf("5-A") < 0 && ir0.est.ajustes.length === 1, "V1 'ir para…' padrao: o art. 5");
    api.leiAjusteRecusar("lei_n", "sufixo:5:5-A", true);
    const ir1 = api.leiIrDados();
    ok(ir1.arts.map((a) => a.num).indexOf("5-A") >= 0 && ir1.arts.map((a) => a.num).indexOf("5") < 0 && ir1.est.ajustes[0].recusado === true, "V2 com o original mantido, 'ir para…' lista o 5-A: " + ir1.arts.map((a) => a.num));
    ok(Object.keys(ir1.alertas).length > Object.keys(ir0.alertas).length, "V3 e os alertas do mapa acompanham (o cache nao serve o resultado velho): " + JSON.stringify([ir0.alertas, ir1.alertas]));
    /* a numeracao: "Art. 40 - A isenção…" no meio de 1 a 9 e' o numero isolado 40, ou o 40-A se o original ficar */
    const M = ["Art. 1. a.", "Art. 2. a.", "Art. 3. a.", "Art. 4. a.", "Art. 5. a.", "Art. 40 - A isenção geral se aplica.", "Art. 6. a.", "Art. 7. a.", "Art. 8. a.", "Art. 9. a."];
    api.leiGuardar({ id: "lei_n2", nome: "Lei N2", texto: M.join("\n") });
    const num0 = JSON.stringify(api.leiNumeracaoDaLei(api.leiDe("lei_n2")));
    api.leiAjusteRecusar("lei_n2", "sufixo:6:40-A", true);
    const num1 = JSON.stringify(api.leiNumeracaoDaLei(api.leiDe("lei_n2")));
    ok(/"numCru":"40"/.test(num0) && /"numCru":"40-A"/.test(num1) && num0 !== num1, "V4 a numeracao da lei tambem (a memoria nao serve a de antes): " + num0.slice(0, 90) + " / " + num1.slice(0, 90));
  }

  /* ==============================================================
   * T: HTML, CSS E TEXTOS
   * ============================================================== */
  {
    const pos = (s) => html.indexOf(s);
    ok(pos('id="leiMapaConferir"') < pos('id="leiMapaAjustes"') && pos('id="leiMapaAjustes"') < pos('class="lei-mapa-como"'), "T1 o espaco dos ajustes fica depois da conferencia e antes da ajuda");
    ok(/\.lei-aj-grupo\{[^}]*border/.test(html) && /\.lei-aj-recusado>\.nota\{color:#f59e0b\}/.test(html) && /\.dec-b-automatico/.test(html), "T2 CSS do grupo, do item recusado e do selo 'automatico'");
    const chaves = ["aj_titulo", "aj_expl", "aj_manter", "aj_usar", "aj_manter_todos", "aj_usar_todos", "aj_mais", "dec_area_ajuste", "dec_d_automatico"]
      .concat(["nota", "link", "ordinal", "sufixo", "fora"].flatMap((k) => ["aj_t_" + k, "aj_p_" + k, "aj_r_" + k, "dec_r_ajuste_" + k]))
      .concat(["nota", "link", "ordinal", "sufixo"].map((k) => "aj_r_" + k + "_orig"));
    const conta = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": ", "g")) || []).length;
    const semPar = chaves.filter((k) => conta(k) !== 2);
    ok(semPar.length === 0, "T3 todas as chaves existem em portugues E em ingles: " + semPar.join(","));
    ok(p.t("aj_titulo", { n: 3 }) === "O que o app ajustou ao ler (3)" && p.t("aj_manter") === "manter o original", "T4 os textos em portugues");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
