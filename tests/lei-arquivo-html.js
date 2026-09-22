/* =====================================================================
 * ABRIR O ARQUIVO .htm SALVO DA PÁGINA DA LEI (etapa 4 da estratégia de revogados)
 *
 * Colar com formatação depende da área de transferência do navegador. Salvar a página (Ctrl+S, "somente HTML") e
 * abrir o arquivo no app entrega o mesmo — o risco do texto antigo, as tabelas, os acentos — de forma completa.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O charset vem da tag <meta> (o Planalto salva em windows-1252: decodificar como UTF-8 troca "ç" por lixo).
 *     Sem <meta>: UTF-8 se for válido, senão windows-1252. Charset desconhecido não derruba a leitura.
 *  2. O HTML vira texto como o navegador o mostra: parágrafo = linha em branco, linha de tabela = linha, célula =
 *     tab, <br> = quebra, espaço/quebra do código = um espaço; head, style, script e comentário ficam de fora.
 *  3. O risco entra como no colar com formatação (~~trecho~~): as duas versões saem do MESMO HTML, então o
 *     alinhamento é exato; tirando as marcas, volta-se ao texto puro.
 *  4. Vai para o campo no lugar do cursor, com aviso (quantos trechos riscados, ou "nenhum"), e fica no registro.
 *     Arquivo vazio ou ilegível: avisa e não mexe no campo.
 *  5. O botão só aparece onde se pode editar (criar lei / nova versão) e o seletor de arquivo está ligado.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const i18n = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  const p = iniciar();
  const bytesDe = (s, enc) => { const b = Buffer.from(s, enc || "utf8"); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };

  /* uma página no formato do Planalto */
  const PAG = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252"><title>Lcp214 compilado</title><style>p{margin:0}</style></head><body>\n'
    + '<!-- StartFragment -->\n'
    + '<p class="MsoNormal"><b><span>CAP&Iacute;TULO II</span></b></p>\n'
    + '<p><span style="font-family:Arial; text-decoration:line-through"><font size="2">II \n\t\t&nbsp;- texto antigo do <i>caput</i> fim.</font></span></p>\n'
    + '<p><font size="2">II - texto novo. <span>(Reda&ccedil;&atilde;o dada pela Lei Complementar n&ordm; 227, de 2026)</span></font></p>\n'
    + '<script>var x = "<s>nao</s>";</script>\n'
    + '<table><tr><td><s>3,50%</s></td><td><s>15,60%</s></td></tr><tr><td>Faixa 2</td><td>4,00%</td></tr></table>\n'
    + '</body></html>';

  /* ---- 1: o charset ---- */
  {
    ok(p.leiCharsetDoHtml(bytesDe('<meta charset="utf-8">')) === "utf-8" && p.leiCharsetDoHtml(bytesDe('<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">')) === "windows-1252" && p.leiCharsetDoHtml(bytesDe("<meta charset='ISO-8859-1'>")) === "iso-8859-1" && p.leiCharsetDoHtml(bytesDe("<p>sem meta</p>")) === "", "S1 o charset vem da <meta>, em qualquer das formas (ou vazio)");
    const latin = bytesDe('<meta http-equiv="Content-Type" content="text/html; charset=windows-1252"><p>Redação, ação, “aspas” e § 5º</p>', "latin1");
    ok(new Uint8Array(latin).indexOf(0xE7) > 0, "S2 (o arquivo de teste tem mesmo o byte 0xE7 de 'ç' em windows-1252)");
    const dec = p.leiDecodificarArquivoHtml(latin);
    ok(/Redação, ação/.test(dec) && /§ 5º/.test(dec), "S3 windows-1252 declarado: 'ç', 'ã', '§' e 'º' saem certos: " + dec.slice(-40));
    ok(/Redação/.test(p.leiDecodificarArquivoHtml(bytesDe('<meta charset="utf-8"><p>Redação</p>'))), "S4 utf-8 declarado");
    ok(/Redação/.test(p.leiDecodificarArquivoHtml(bytesDe("<p>Redação</p>"))), "S5 sem <meta>, UTF-8 valido e' lido como UTF-8");
    ok(/Redação/.test(p.leiDecodificarArquivoHtml(bytesDe("<p>Redação</p>", "latin1"))), "S6 sem <meta> e sem ser UTF-8 valido: windows-1252");
    ok(/Redação/.test(p.leiDecodificarArquivoHtml(bytesDe('<meta charset="charset-que-nao-existe"><p>Redação</p>'))), "S7 charset desconhecido nao derruba a leitura");
    const bom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from("<p>Redação</p>")]);
    ok(p.leiDecodificarArquivoHtml(bom.buffer.slice(bom.byteOffset, bom.byteOffset + bom.length)) === "<p>Redação</p>", "S8 a marca BOM do UTF-8 nao vai para o texto");
  }

  /* ---- 2: o HTML como texto ---- */
  {
    const t = p.leiHtmlParaTexto(PAG);
    ok(t === "CAPÍTULO II\n\nII - texto antigo do caput fim.\n\nII - texto novo. (Redação dada pela Lei Complementar nº 227, de 2026)\n\n3,50%\t15,60%\nFaixa 2\t4,00%", "T1 o texto sai como o navegador mostraria: " + JSON.stringify(t));
    ok(p.leiHtmlParaTexto("<p>a</p><p>b</p>") === "a\n\nb" && p.leiHtmlParaTexto("a<br>b") === "a\nb" && p.leiHtmlParaTexto("<div>a</div><div>b</div>") === "a\nb", "T2 <p> = linha em branco, <br> e <div> = quebra");
    ok(p.leiHtmlParaTexto("<p>a \n   b\t\tc &amp; d &nbsp; e</p>") === "a b c & d e", "T3 espaco, quebra e tab do codigo valem UM espaco; entidades decodificadas: " + JSON.stringify(p.leiHtmlParaTexto("<p>a \n   b\t\tc &amp; d &nbsp; e</p>")));
    ok(p.leiHtmlParaTexto("<head><title>T</title></head><style>x{}</style><script>alert(1)</script><!-- c --><p>ok</p>") === "ok", "T4 head, style, script e comentario ficam de fora");
    ok(p.leiHtmlParaTexto("") === "" && p.leiHtmlParaTexto("<p> </p>") === "", "T5 vazio");
    ok(p.leiHtmlParaTexto("<p>a</p><p></p><p></p><p></p><p>b</p>") === "a\n\nb", "T6 nunca mais de uma linha em branco seguida");
    ok(p.leiHtmlParaTexto("<ul><li>um</li><li>dois</li></ul>") === "um\ndois", "T7 itens de lista");
  }

  /* ---- 3: o risco ---- */
  {
    const r = p.leiTextoDeArquivoHtml(bytesDe(PAG, "latin1"));
    ok(r.n === 2 && r.motivo === "" && /^CAPÍTULO II\n\n~~II - texto antigo do caput fim\.~~\n\nII - texto novo\./.test(r.texto) && /\n~~3,50%\t15,60%~~\nFaixa 2\t4,00%$/.test(r.texto), "R1 2 trechos riscados (o inciso antigo e a linha da tabela) e o resto intacto: " + JSON.stringify(r.texto));
    ok(r.texto.replace(/~~/g, "") === p.leiHtmlParaTexto(PAG) && r.texto.split("\n").length === p.leiHtmlParaTexto(PAG).split("\n").length, "R2 sem as marcas, e' exatamente o texto puro (mesmo numero de linhas)");
    const sem = p.leiTextoDeArquivoHtml(bytesDe("<p>Art. 1º Texto.</p><p>Art. 2º Dois.</p>"));
    ok(sem.n === 0 && sem.texto === "Art. 1º Texto.\n\nArt. 2º Dois." && sem.motivo === "sem_tachado", "R3 sem riscado: so' o texto: " + JSON.stringify(sem));
    ok(p.leiTextoDeArquivoHtml(bytesDe("<html><head></head><body> </body></html>")).texto === "" && p.leiTextoDeArquivoHtml(bytesDe("")).motivo === "vazio", "R4 arquivo sem texto");
    /* o resultado entra na revisao da colagem como qualquer colar com formatacao */
    const pre = p.leiPreprocessar(["Art. 1º Um.", "Art. 2º Dois.", r.texto].join("\n"));
    ok(pre.mudancas.filter((m) => m.grupo === "tachado").length === 2, "R5 os 2 trechos viram itens do grupo 'tachado' na revisao: " + pre.mudancas.map((m) => m.grupo));
    /* uma pagina que so' tem riscado de estilo */
    ok(p.leiTextoDeArquivoHtml(bytesDe('<p><span style="text-decoration:line-through">x y</span> z</p>')).texto === "~~x y~~ z", "R6 <span style> riscado no meio da linha");
  }

  /* ---- 4: o campo, o aviso e o registro ---- */
  {
    const api = iniciar();
    api.leiAbrir("Direito", "T");
    const ta = api.$("leiTexto");
    const arquivo = (nome, buf) => ({ name: nome, arrayBuffer: async () => buf });
    ta.value = "ANTES|DEPOIS"; ta.selectionStart = ta.selectionEnd = 6;
    const ok1 = await api.leiArquivoHtmlLido(arquivo("lcp214.htm", bytesDe(PAG, "latin1")), "leiTexto");
    const marcado = p.leiTextoDeArquivoHtml(bytesDe(PAG, "latin1")).texto;
    ok(ok1 === true && ta.value === "ANTES|" + marcado + "DEPOIS" && ta.selectionStart === 6 + marcado.length, "A1 entra na posicao do cursor e mantem o resto do campo");
    ok(/Arquivo lido: 2 trecho\(s\) tachado\(s\) identificado\(s\)\. Você decide o que fazer com eles na revisão\./.test(api.$("toast").textContent), "A2 avisa quantos trechos riscados: " + api.$("toast").textContent);
    ok(/arquivo \.htm lido: \d+ caractere\(s\), 2 trecho\(s\) riscado\(s\)/.test(api.leiRelatorioFluxo("revisar a colagem")) && /lcp214\.htm/.test(api.leiRelatorioFluxo("revisar a colagem")), "A3 fica no registro do fluxo, com o nome do arquivo");
    ta.value = "";
    ok(await api.leiArquivoHtmlLido(arquivo("simples.htm", bytesDe("<p>Art. 1º Um.</p>")), "leiTexto") === true && ta.value === "Art. 1º Um." && /Arquivo lido: 11 caracteres, nenhum trecho tachado\./.test(api.$("toast").textContent), "A4 sem riscado: o texto entra e o aviso diz 'nenhum': " + api.$("toast").textContent);
    ta.value = "fica";
    ok(await api.leiArquivoHtmlLido(arquivo("vazio.htm", bytesDe("<html></html>")), "leiTexto") === false && ta.value === "fica" && /O arquivo não tem texto\./.test(api.$("toast").textContent), "A5 arquivo sem texto: avisa e NAO mexe no campo");
    ok(await api.leiArquivoHtmlLido({ name: "x.htm", arrayBuffer: async () => { throw new Error("falhou"); } }, "leiTexto") === false && ta.value === "fica" && /Não foi possível ler o arquivo/.test(api.$("toast").textContent), "A6 arquivo ilegivel: avisa e NAO mexe no campo");
    ok(await api.leiArquivoHtmlLido(null, "leiTexto") === false && await api.leiArquivoHtmlLido(arquivo("a.htm", bytesDe("<p>x</p>")), "campoQueNaoExiste") === false, "A7 sem arquivo ou sem campo: nada");
    /* a nova versao (atualizar) */
    const up = api.$("leiUpdTexto"); up.value = "";
    ok(await api.leiArquivoHtmlLido(arquivo("nova.htm", bytesDe(PAG, "latin1")), "leiUpdTexto") === true && /~~II - texto antigo/.test(up.value), "A8 tambem entra no campo da nova versao");
  }

  /* ---- 5: o botao e o seletor ---- */
  {
    const api = iniciar();
    api.leiAbrir("Direito", "T");
    const box = api.$("leiArquivoBox");
    api.leiTrocarModo("editar");
    ok(box.hidden === false, "B1 criando uma lei (campo editavel), o botao aparece");
    api.leiTrocarModo("ler");
    ok(box.hidden === true, "B2 no modo de leitura, some");
    const l = api.leiGuardar({ nome: "Lei 1/2020", texto: "Art. 1º Um.\nArt. 2º Dois." });
    api.leiAbrir("Direito", "T", l.id);
    api.leiTrocarModo("editar");
    ok(box.hidden === true, "B3 com a lei ja gravada o campo e' so' de leitura: o botao nao aparece");
    const el = api.$("leiArquivoHtml"), elU = api.$("leiUpdArquivoHtml");
    ok(((el._ouv || {}).change || []).length === 1 && ((elU._ouv || {}).change || []).length === 1, "B4 o seletor de arquivo esta ligado nos dois campos (uma vez so'): " + [((el._ouv || {}).change || []).length, ((elU._ouv || {}).change || []).length]);
    let clicou = 0; el.click = () => { clicou++; }; elU.click = () => { clicou += 10; };
    api.$("btnLeiArquivo").onclick(); api.$("btnLeiUpdArquivo").onclick();
    ok(clicou === 11, "B5 os dois botoes abrem o seletor de arquivo: " + clicou);
    /* o seletor disparado com um arquivo */
    api.leiTrocarModo("ler");
    const nova = iniciar();
    nova.leiAbrir("Direito", "T");
    const seletor = nova.$("leiArquivoHtml");
    seletor.files = [{ name: "a.htm", arrayBuffer: async () => bytesDe("<p>Art. 1º Um.</p>") }];
    seletor._ouv.change[0]();
    await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
    ok(nova.$("leiTexto").value === "Art. 1º Um." , "B6 escolher o arquivo no seletor coloca o texto no campo: " + JSON.stringify(nova.$("leiTexto").value));
    ok(/<input type="file" id="leiArquivoHtml" accept="\.htm,\.html,text\/html" hidden>/.test(html) && /<input type="file" id="leiUpdArquivoHtml" accept="\.htm,\.html,text\/html" hidden>/.test(html), "B7 os dois seletores aceitam .htm/.html e ficam escondidos atras do botao");
    ok(/\.lei-arq\{display:flex/.test(html), "B8 a caixa tem estilo");
  }

  /* ---- 6: os textos ---- */
  {
    const chaves = ["lei_arq_btn", "lei_arq_ajuda", "lei_arq_ok", "lei_arq_ok0", "lei_arq_erro", "lei_arq_vazio"];
    const linhas = (k) => (i18n.match(new RegExp("\\n  \"" + k + "\": (.*),\\r?\\n", "g")) || []);
    const campos = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
    ok(chaves.every((k) => linhas(k).length === 2 && campos(linhas(k)[0]) === campos(linhas(k)[1])), "I1 as frases existem em portugues e em ingles, com os mesmos campos");
    ok(/data-i18n="lei_arq_btn"/.test(html) && /data-i18n="lei_arq_ajuda"/.test(html), "I2 o botao e a ajuda usam as chaves de traducao");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
