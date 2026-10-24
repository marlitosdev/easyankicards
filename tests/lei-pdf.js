/* =====================================================================
 * LER A LEI DIRETO DO PDF (v19.3.0) — com páginas REAIS dos PDFs de Caruaru (tests/pdf/caruaru-paginas.json:
 * o texto e os traços que o PDF.js 3.11.174 entrega para as págs. 1, 2, 8, 122 e 275 da LC 15/2009 e a 1 da LC 112).
 *
 * O QUE PRECISA SER VERDADE:
 *  1. a redação RISCADA no PDF sai riscada (~~…~~): arts. 3º, 8º e 38 antigos, o art. 349 revogado, itens do Anexo VIII;
 *     a redação nova NÃO;
 *  2. o PDF picotado (LC 112: "1"+"12,", "Certid"+"ã"+"o") sai sem espaço no meio — e sem número de artigo partido;
 *  3. separado o riscado, os artigos 3, 8 e 38 deixam de ser "repetidos";
 *  4. PDF sem texto (escaneado), leitor que não carrega e PDF inválido dizem o motivo;
 *  5. o arquivo .pdf entra pelo mesmo leitor de arquivo de lei (leiLerArquivoLei).
 * ===================================================================== */
const { rodar } = require("./fumaca.js");
const fs = require("fs");
const path = require("path");

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, "pdf", "caruaru-paginas.json"), "utf8"));

/* um PDF.js de mentira que entrega as páginas reais guardadas */
function libDe(doc, pags) {
  const d = FX.docs[doc];
  const lista = pags || Object.keys(d.paginas).map(Number);
  return {
    OPS: FX.OPS,
    getDocument: () => ({ promise: Promise.resolve({
      numPages: lista.length,
      getPage: async (n) => {
        const pg = d.paginas[lista[n - 1]];
        return { getTextContent: async () => ({ items: pg.items }), getOperatorList: async () => pg.ops };
      },
    }) }),
  };
}

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api: a, janela: J } = rodar();
  const linhasDe = (doc, p) => a.leiPdfLinhas(FX.docs[doc].paginas[p].items, a.leiPdfTracos(FX.docs[doc].paginas[p].ops, FX.OPS));
  const txt = (ln) => ln.runs.map((x) => x.t).join("").replace(/\s+/g, " ").trim();
  const riscada = (ln) => { const t = ln.runs.filter((x) => x.r).map((x) => x.t).join("").trim(); return t.length > txt(ln).length * 0.5; };
  const achar = (doc, p, re) => linhasDe(doc, p).filter((ln) => re.test(txt(ln)));

  /* ---- 1: o riscado ---- */
  {
    const a3 = achar("lc15", 1, /^Art\. 3º/);
    ok(a3.length === 2 && riscada(a3[0]) && /subordinado/.test(txt(a3[0])) && !riscada(a3[1]) && /Compreendem/.test(txt(a3[1])),
      "D1 art. 3º: a redação antiga riscada, a nova não: " + a3.map((l) => (riscada(l) ? "R " : "- ") + txt(l).slice(0, 50)).join(" | "));
    const a8 = achar("lc15", 2, /^Art\. 8º/);
    ok(a8.length === 2 && riscada(a8[0]) && !riscada(a8[1]), "D1a art. 8º idem");
    const a38 = achar("lc15", 8, /^Art\. 38\b/);
    ok(a38.length === 2 && riscada(a38[0]) && /Caruaru\.$/.test(txt(a38[0])) && !riscada(a38[1]), "D1b art. 38 idem");
    const a349 = achar("lc15", 122, /^Art\. 349\b/);
    ok(a349.length === 1 && riscada(a349[0]), "D1c art. 349 lido inteiro (não 'Art. 3 49') e riscado (revogado): " + a349.map(txt).join(" | "));
    const p275 = linhasDe("lc15", 275);
    const r275 = p275.filter(riscada).map(txt);
    ok(r275.some((t) => /^f\) publicidade através de out door/.test(t)) && r275.some((t) => /^b\) instalado no espaço público/.test(t)) && r275.indexOf("24,0") >= 0,
      "D1d Anexo VIII: os itens riscados no PDF saem riscados: " + r275.join(" | "));
    ok(!p275.filter((l) => /^a\) publicidade conduzida/.test(txt(l))).some(riscada) && r275.length <= 6,
      "D1e os itens vigentes do anexo NÃO (a borda da tabela não é risco): " + r275.length + " riscadas");
  }

  /* ---- 2: o picotado ---- */
  {
    const L = linhasDe("lc112", 1).map(txt);
    ok(L[0] === "LEI COMPLEMENTAR Nº 112, DE 09 DE JUNHO DE 2023", "D2 o título picotado sai inteiro: " + L[0]);
    const tudo = L.join("\n");
    ok(!/\bD ívida\b|\bD í vida\b|\b1 12\b/.test(tudo) && /inscrito em Dívida Ativa/.test(tudo) && /Procuradoria-/.test(tudo),
      "D2a nenhuma palavra partida no meio ('D'+'í'+'vida' → Dívida)");
    ok(!linhasDe("lc15", 122).some((l) => /^Art\.?\s*\d{1,3} \d{1,3}\b/.test(txt(l))), "D2b nenhum 'Art. 3 49'");
    ok(linhasDe("lc112", 1).every((l) => !riscada(l)), "D2c a LC 112 não tem riscado (nenhum falso)");
  }

  /* ---- 3: ponta a ponta, e os repetidos que somem ---- */
  {
    const r = await a.leiTextoDePdf(new Uint8Array([37, 80, 68, 70]), { pdfjsLib: libDe("lc15", [1, 2, 8]) });
    ok(!r.motivo && r.paginas === 3 && r.n >= 3 && /~~Art\. 3º O Código Tributário Municipal é subordinado:~~/.test(r.texto)
      && /\nArt\. 3º\. Compreendem/.test(r.texto), "D3 o PDF vira texto com ~~ no riscado (o formato do .docx/.htm): n=" + r.n + " · " + r.texto.slice(0, 200));
    const vivo = r.texto.split("\n").map((l) => a.leiTirarTachado(l, true)).join("\n");
    const rep = (tx) => a.leiDuplicados(tx).filter((g) => !g.intra).map((g) => g.num);
    ok(rep(r.texto.replace(/~~/g, "")).length >= 3 && rep(vivo).length === 0,
      "D3a com o risco, os arts. 3, 8 e 38 deixam de ser 'repetidos': sem risco " + rep(r.texto.replace(/~~/g, "")).join(",") + " · com risco " + rep(vivo).join(","));
  }

  /* ---- 4: os motivos ---- */
  {
    const vazio = { OPS: FX.OPS, getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: async () => ({ getTextContent: async () => ({ items: [] }), getOperatorList: async () => ({ fnArray: [], argsArray: [] }) }) }) }) };
    ok((await a.leiTextoDePdf(new Uint8Array(4), { pdfjsLib: vazio })).motivo === "pdf_sem_texto", "D4 PDF de imagem: pdf_sem_texto");
    ok((await a.leiTextoDePdf(new Uint8Array(4), { carregar: () => Promise.reject(new Error("off")) })).motivo === "pdf_sem_leitor", "D4a sem o leitor: pdf_sem_leitor");
    const quebrado = { OPS: FX.OPS, getDocument: () => ({ promise: Promise.reject(new Error("bad")) }) };
    ok((await a.leiTextoDePdf(new Uint8Array(4), { pdfjsLib: quebrado })).motivo === "pdf_invalido", "D4b PDF danificado: pdf_invalido");
    ["lei_pdf_lendo", "lei_pdf_sem_texto", "lei_pdf_sem_leitor", "lei_pdf_invalido"].forEach((k) => ["pt", "en"].forEach((l) => {
      a.setLanguage(l); ok(a.t(k) && a.t(k) !== k, "D4c falta " + k + " em " + l);
    }));
    a.setLanguage("pt");
  }

  /* ---- 6: as regras, uma a uma (pedaços sintéticos, letra de 10 pt) ---- */
  {
    const it = (str, x, y, w, eol) => ({ str, transform: [10, 0, 0, 10, x, y], width: w, height: 10, hasEOL: !!eol });
    const junta = (items, tr) => a.leiPdfLinhas(items, tr || []).map((l) => l.runs.map((x) => x.t).join(""));
    /* espaço: só com distância de verdade (> ~2 pt numa letra de 10); o kerning de 1,5 pt não separa a palavra */
    ok(junta([it("Certid", 100, 500, 30), it("ã", 131.5, 500, 5), it("o", 138, 500, 5)])[0] === "Certidão", "D6 1,5 pt de folga não vira espaço: " + junta([it("Certid", 100, 500, 30), it("ã", 131.5, 500, 5), it("o", 138, 500, 5)])[0]);
    ok(junta([it("Art.", 100, 500, 18), it("5º", 123, 500, 9)])[0] === "Art. 5º", "D6a 5 pt de folga, sem espaço no PDF: põe o espaço");
    ok(junta([it("Art.", 100, 500, 18), it(" ", 118, 500, 2), it("5º", 123, 500, 9)])[0] === "Art. 5º", "D6b com o espaço do PDF, não dobra");
    /* linhas: pela altura e pela marca de fim de linha */
    ok(junta([it("primeira", 100, 500, 40), it("segunda", 100, 486, 40)]).length === 2, "D6c outra altura = outra linha (sem marca de fim)");
    ok(junta([it("primeira", 100, 500, 40, true), it("segunda", 300, 500, 40)]).length === 2, "D6d a marca de fim de linha separa mesmo na mesma altura");
    /* risco: traço no miolo cobrindo mais da metade; um pedaço do traço não basta */
    const tr = (x0, x1, y) => [{ x0, x1, y }];
    ok(a.leiPdfRiscado(it("revogado", 100, 500, 100), tr(100, 200, 504)), "D6e traço no miolo cobrindo tudo: riscado");
    ok(!a.leiPdfRiscado(it("vigente", 100, 500, 100), tr(100, 130, 504)), "D6f traço cobrindo 30%: não");
    ok(!a.leiPdfRiscado(it("sublinhado", 100, 500, 100), tr(100, 200, 499)), "D6g traço abaixo da linha de base (sublinhado): não");
    ok(!a.leiPdfRiscado(it("borda", 100, 500, 100), tr(100, 200, 510)), "D6h traço acima da letra (borda de tabela): não");
    /* o traço desenhado num sistema deslocado (save/transform/restore) cai no lugar certo da página */
    const O = FX.OPS;
    const ops = { fnArray: [O.save, O.transform, O.constructPath, O.restore, O.constructPath],
      argsArray: [null, [1, 0, 0, 1, 100, 500], [[O.rectangle], [0, 4, 100, 0.8]], null, [[O.moveTo, O.lineTo], [0, 0, 50, 0]]] };
    const tt = a.leiPdfTracos(ops, O);
    ok(tt.length === 2 && Math.abs(tt[0].x0 - 100) < 0.01 && Math.abs(tt[0].y - 504.4) < 0.01 && Math.abs(tt[1].y) < 0.01 && Math.abs(tt[1].x1 - 50) < 0.01,
      "D6i a transformação vale só entre save e restore: " + JSON.stringify(tt));
    /* só número de página (o carimbo de um PDF escaneado): é sem texto */
    const soNum = { OPS: O, getDocument: () => ({ promise: Promise.resolve({ numPages: 3, getPage: async (n) => ({ getTextContent: async () => ({ items: [it(String(n), 500, 30, 5)] }), getOperatorList: async () => ({ fnArray: [], argsArray: [] }) }) }) }) };
    ok((await a.leiTextoDePdf(new Uint8Array(4), { pdfjsLib: soNum })).motivo === "pdf_sem_texto", "D6j só o número da página: conta como escaneado");
  }

  /* ---- 7: o módulo está na página e no pacote offline (o teste carrega pela lista própria: sem isto, faltar a
   * linha no index.html passava despercebido — e passou, na primeira montagem desta versão) ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "docs", "sw.js"), "utf8");
    ok(/<script src="lei-ui\.js"><\/script>\s*<script src="lei-nova\.js"><\/script>\s*<script src="lei-pdf\.js"><\/script>/.test(html), "D7 o index.html carrega lei-pdf.js (depois de lei-ui.js)");
    ok(/"lei-pdf\.js"/.test(sw), "D7a o sw.js guarda lei-pdf.js para o uso offline");
  }

  /* ---- 8: a guia de pontos das tabelas não faz a lei consolidada "parecer uma lei que altera" ---- */
  {
    const tabela = "Art. 1º Esta Lei institui o Código.\nArmazéns e Frigoríficos ........................ 86,0\n1. Acupunturista .............................\n2. Advogado ..................................\na) Profissionais autônomos de nível universitário............200,00 UFM";
    ok(a.leiPareceAlteradora(tabela).sim === false, "D8 as guias de pontos de tabela (anexos da LC 15) não são trecho omitido: " + JSON.stringify(a.leiPareceAlteradora(tabela).sinais));
    const alt = "Art. 1º A Lei Complementar nº 015 fica assim:\n“Art. 9º ..............................\nI - texto novo;\n..................................... ”\n“§ 2º ........................";
    ok(a.leiPareceAlteradora(alt).sinais.indexOf("omitidos") >= 0, "D8a o trecho omitido de verdade (logo depois de 'Art. 9º', '§ 2º' ou linha só de pontos) continua contando");
    ok(a.leiPareceAlteradora("Art. 1º Texto [...] e mais [...].").sinais.indexOf("omitidos") >= 0, "D8b '[...]' conta sempre");
    const remissao = "Art. 1º Esta Lei institui o Código.\nServiços previstos no art. 12 ................ 40,0\nAtividades do inciso II - ................ 25,0";
    ok(a.leiPareceAlteradora(remissao).sim === false, "D8c remissão no MEIO da linha de tabela ('… no art. 12 ……') não é trecho omitido");
    const soPontos = "Art. 1º O art. 9º passa a ter:\n“Art. 9º O imposto incide:\n.........................................\nI - novo;\n.........................................”";
    ok(a.leiPareceAlteradora(soPontos).sinais.indexOf("omitidos") >= 0, "D8d as linhas só de pontos (entre dispositivos citados) contam");
  }

  /* ---- 5: pelo leitor de arquivo de lei ---- */
  {
    J.pdfjsLib = libDe("lc15", [1]);
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 53]);   /* "%PDF-1.5" */
    const lido = await a.leiLerArquivoLei({ name: "LC 15 de 2009.pdf", type: "application/pdf", arrayBuffer: async () => bytes.buffer });
    ok(lido && lido.tipo === "pdf" && /~~Art\. 3º O Código/.test(lido.r.texto), "D5 o .pdf entra pelo leitor de arquivo de lei, com o riscado");
    ok(/arquivo \.pdf convertido: 1 página/.test(a.registroTexto()), "D5a fica no registro");
    J.pdfjsLib = { OPS: FX.OPS, getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [] }), getOperatorList: async () => ({}) }) }) }) };
    const nada = await a.leiLerArquivoLei({ name: "escaneado.pdf", arrayBuffer: async () => bytes.buffer });
    ok(nada === null && /arquivo \.pdf: pdf_sem_texto/.test(a.registroTexto()), "D5b o escaneado é recusado com o motivo no registro");
    delete J.pdfjsLib;
  }
  return falhas;
}

module.exports = { testes };
