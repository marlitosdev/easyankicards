/* =====================================================================
 * ABRIR UM ARQUIVO DO WORD (.docx) — a lei que só existe em PDF (v18.63.0)
 *
 * O caso: o Código Tributário de Caruaru (e as leis que o alteram) só
 * existe em PDF; copiado do leitor de PDF, chega numa linha só. O caminho
 * proposto: abrir o PDF no Google Documentos ou no Word, salvar como .docx
 * e abrir aqui. O QUE PRECISA SER VERDADE:
 *  1. cada parágrafo do Word vira uma linha (linha em branco entre eles,
 *     como no .htm); o texto riscado (w:strike/w:dstrike) vira ~~…~~;
 *  2. não entram: texto apagado em "controlar alterações", a cópia de
 *     reserva das caixas de texto, o risco do SINAL de parágrafo;
 *     w:strike w:val="0" não risca;
 *  3. tabela: linha = linha, célula = tab;
 *  4. o arquivo errado (PDF, .doc antigo) diz o caminho, sem mexer no campo;
 *  5. o botão "💡 Está em PDF?" existe nas duas telas e explica em passos.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const iniciar = () => { const r = rodar(); r.api.matIniciar(); r.api.leiIniciar(); return r.api; };
  const p = iniciar();
  const W = (corpo) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="x" xmlns:mc="y"><w:body>' + corpo + "</w:body></w:document>";
  const par = (...runs) => "<w:p><w:pPr><w:rPr><w:strike/></w:rPr></w:pPr>" + runs.join("") + "</w:p>";
  const run = (tx, rpr) => "<w:r>" + (rpr ? "<w:rPr>" + rpr + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + tx + "</w:t></w:r>";
  const DOC = W(
    par(run("CAPÍTULO I")) +
    par(run("Art. 1º Este Código dispõe sobre o sistema tributário do Município de Caruaru.")) +
    par(run("Art. 2º ", ""), run("O imposto incide sobre &quot;serviços&quot; &amp; obras.", "<w:b/>")) +
    par(run("§ 1º A alíquota é de 2%.", "<w:strike/>"), run(" "), run("(Revogado pela LC 95/2022)")) +
    par(run("§ 1º A alíquota é de 3%. ", ""), run("(Redação dada pela LC 95/2022)", '<w:strike w:val="0"/>')) +
    par(run("texto riscado duplo", "<w:dstrike/>")) +
    "<w:p><w:r><w:t>Art. 3º Em</w:t></w:r><w:r><w:tab/><w:t>vigor.</w:t></w:r><w:del w:id=\"1\"><w:r><w:delText>APAGADO</w:delText></w:r></w:del></w:p>" +
    '<w:p><w:r><mc:AlternateContent><mc:Choice><w:drawing><w:txbxContent><w:p><w:r><w:t>caixa</w:t></w:r></w:p></w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:t>caixa</w:t></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>' +
    "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Faixa 1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:strike/></w:rPr><w:t>3,50%</w:t></w:r></w:p></w:tc></w:tr>" +
    "<w:tr><w:tc><w:p><w:r><w:t>Faixa 2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>4,00%</w:t></w:r></w:p></w:tc></w:tr></w:tbl>" +
    "<w:p><w:r><w:t>Linha um</w:t><w:br/><w:t>Linha dois</w:t></w:r></w:p>");

  /* ---- 1 a 3: o XML do Word como texto ---- */
  {
    const r = p.leiTextoDeArquivoHtml(p.leiDocxXmlParaHtml(DOC));
    const L = r.texto.split("\n").filter((x) => x.trim());
    ok(L[0] === "CAPÍTULO I" && L[1] === "Art. 1º Este Código dispõe sobre o sistema tributário do Município de Caruaru.", "D1 um parágrafo por linha: " + JSON.stringify(L.slice(0, 2)));
    ok(L[2] === 'Art. 2º O imposto incide sobre "serviços" & obras.', "D1a os trechos (runs) se juntam e as entidades viram caracteres: " + L[2]);
    ok(L[3] === "~~§ 1º A alíquota é de 2%.~~ (Revogado pela LC 95/2022)", "D2 o trecho riscado vira ~~…~~ (o risco do sinal de parágrafo não conta): " + L[3]);
    ok(L[4] === "§ 1º A alíquota é de 3%. (Redação dada pela LC 95/2022)", "D2a w:strike w:val=\"0\" não risca: " + L[4]);
    ok(L[5] === "~~texto riscado duplo~~", "D2b risco duplo também é risco");
    ok(L[6] === "Art. 3º Em vigor." && r.texto.indexOf("APAGADO") < 0, "D2c tab vira espaço; o texto apagado (controlar alterações) fica de fora: " + L[6]);
    ok((r.texto.match(/caixa/g) || []).length === 1, "D2d a caixa de texto entra UMA vez (sem a cópia de reserva)");
    ok(L.indexOf("Faixa 1\t~~3,50%~~") >= 0 && L.indexOf("Faixa 2\t4,00%") >= 0, "D3 tabela: linha = linha, célula = tab, risco na célula: " + JSON.stringify(L.slice(8, 10)));
    ok(L.indexOf("Linha um") >= 0 && L.indexOf("Linha dois") >= 0, "D3a quebra de linha manual (w:br) vale");
    ok(r.n === 3, "D3b conta 3 trechos riscados: " + r.n);
    ok(p.leiArtigos(r.texto.replace(/~~/g, "")).length >= 3, "D3c o leitor da lei enxerga os artigos (cada um no começo de uma linha)");
  }

  /* ---- o pacote .docx (com um JSZip de mentira) ---- */
  {
    const Zip = (arquivos) => ({ loadAsync: async () => ({ file: (n) => (n in arquivos ? { async: async () => arquivos[n] } : null) }) });
    const r = await p.leiTextoDeDocx(new ArrayBuffer(4), Zip({ "word/document.xml": DOC }));
    ok(/^CAPÍTULO I\n/.test(r.texto) && r.n === 3, "Z1 o .docx é lido pelo word/document.xml");
    ok((await p.leiTextoDeDocx(new ArrayBuffer(4), Zip({ "outra/coisa.xml": "x" }))).motivo === "nao_docx", "Z2 pacote sem word/document.xml = não é .docx");
    ok((await p.leiTextoDeDocx(new ArrayBuffer(4), { loadAsync: async () => { throw new Error("x"); } })).motivo === "nao_docx", "Z3 arquivo que não abre = não é .docx");
    ok((await p.leiTextoDeDocx(new ArrayBuffer(4), Zip({ "word/document.xml": W("") }))).motivo === "vazio", "Z4 .docx sem texto = vazio");
    const pk = new Uint8Array([0x50, 0x4b, 3, 4]).buffer, htm = new TextEncoder().encode("<p>").buffer;
    ok(p.leiTipoDeArquivo("CTM.DOCX") === "docx" && p.leiTipoDeArquivo("lei.htm") === "htm" && p.leiTipoDeArquivo("lei.pdf") === "pdf" && p.leiTipoDeArquivo("x.doc") === "doc"
       && p.leiTipoDeArquivo("sem-extensao", pk) === "docx" && p.leiTipoDeArquivo("sem-extensao", htm) === "htm", "Z5 o tipo vem do nome; sem extensão, da assinatura (PK = .docx)");
  }

  /* ---- 4: a tela: abrir o arquivo ---- */
  {
    const rr = rodar(); rr.api.matIniciar(); rr.api.leiIniciar();
    const api = rr.api;
    const ta = api.$("leiTexto");
    ta.value = "";
    const toasts = [];
    const arq = (nome, bytes) => ({ name: nome, arrayBuffer: async () => bytes });
    /* (v19.3.0) o PDF agora é LIDO (lei-pdf.js): um PDF danificado é recusado com o motivo, sem mexer no campo */
    rr.janela.pdfjsLib = { OPS: {}, getDocument: () => ({ promise: Promise.reject(new Error("danificado")) }) };
    const r1 = await api.leiArquivoHtmlLido(arq("CTM Caruaru.pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer), "leiTexto");
    ok(r1 === false && ta.value === "", "T1 PDF danificado não é lido e o campo fica como estava");
    ok(/arquivo \.pdf: pdf_invalido/.test(api.registroTexto()) && /danificado/.test(api.t("lei_pdf_invalido")), "T1a o motivo fica no registro e a mensagem diz o que houve");
    delete rr.janela.pdfjsLib;
    const r2 = await api.leiArquivoHtmlLido(arq("velho.doc", new ArrayBuffer(4)), "leiTexto");
    ok(r2 === false && ta.value === "", "T2 .doc antigo também não");
    /* .htm continua lendo como antes */
    const r3 = await api.leiArquivoHtmlLido(arq("lei.htm", new TextEncoder().encode("<p>Art. 1º Texto.</p>").buffer), "leiTexto");
    ok(r3 === true && /Art\. 1º Texto\./.test(ta.value), "T3 o .htm continua sendo lido: " + ta.value);
    void toasts;
  }

  /* ---- 5: o botão de dica e os textos ---- */
  {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
    ok(/id="btnLeiArqDica"[^>]*data-i18n="lei_arq_dica_btn"/.test(html) && /id="btnLeiUpdArqDica"[^>]*data-i18n="lei_arq_dica_btn"/.test(html), "B1 o botão '💡 Está em PDF?' está na criação e na atualização");
    /* (v18.67.0) três: criar a lei, atualizar a lei e a fila das leis que alteram */
    /* (v19.3.0) e o .pdf, também no assistente "Incluir lei" */
    ok(["leiArquivoHtml", "leiUpdArquivoHtml", "leiAltFilaArquivo", "leiNovaArq", "leiNovaAltArq"].every((id) => new RegExp('id="' + id + '"[^>]*accept="\\.pdf,\\.docx,\\.htm[^"]*application/pdf').test(html)),
      "B2 os seletores de arquivo (criar, atualizar, fila, assistente) aceitam .pdf e .docx");
    const api = iniciar();
    let visto = null;
    const orig = api.dicaMostrar;
    ok(typeof api.$("btnLeiArqDica").onclick === "function" && typeof api.$("btnLeiUpdArqDica").onclick === "function", "B3 os dois botões estão ligados");
    void orig; void visto;
    const txt = api.t("lei_arq_dica_txt"), upd = api.t("lei_arq_dica_txt_upd");
    /* (v19.3.0) a dica agora diz que o PDF abre direto; o caminho pelo Google Documentos fica só para o PDF escaneado */
    ok(/Abra o PDF direto/.test(txt) && /escaneado/.test(txt) && /Documentos Google/.test(txt) && /RISCO/.test(txt) && txt.length < 700, "B4 a dica é curta e diz que o PDF abre direto: " + txt.length + " caracteres");
    ok(/ALTERA esta/.test(upd), "B5 na atualização, a dica diz qual opção marcar para a lei que altera");
    ["lei_arq_btn", "lei_arq_ajuda", "lei_arq_dica_btn", "lei_arq_dica_tip", "lei_arq_dica_txt", "lei_arq_dica_txt_upd", "lei_arq_pdf", "lei_arq_tipo", "lei_arq_erro_docx", "lei_arq_ok0_docx"].forEach((k) => {
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "B6 falta " + k + " em " + l); });
    });
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
