/* =====================================================================
 * CONVERSÃO DE HTML COLADO
 * O texto copiado de uma PÁGINA (NotebookLM, Gemini) não traz "**" nem
 * "##": a formatação viaja como text/html. Esta conversão é o que impede
 * o resumo de chegar achatado.
 *
 * Precisa de um DOM de verdade. Se o jsdom não estiver instalado, o teste
 * se anuncia como pulado em vez de dar falso verde — teste que não rodou
 * não pode parecer teste que passou.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");

function testes() {
  let JSDOM = null;
  try { JSDOM = require("jsdom").JSDOM; } catch (e) { JSDOM = null; }
  if (!JSDOM) return { pulado: true, falhas: [] };

  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const src = fs.readFileSync(path.join(__dirname, "..", "docs", "material.js"), "utf8");
  const M = new Function("localStorage", "document", "window",
    src + "; return {matHtmlParaMarcas,matLimparColagem,matParaHtml};")(
    { getItem: () => null, setItem() {} }, dom.window.document, dom.window);

  const f = [];
  const ok = (c, m) => { if (!c) f.push(m); };

  const html = "<h3>Achado de auditoria</h3>"
    + "<p>O achado é a <b>constatação</b> do <i>auditor</i>.</p>"
    + "<ul><li>Elemento <strong>crítico</strong></li><li>Outro item</li></ul>"
    + "<ol><li>Primeiro</li><li>Segundo</li></ol>"
    + "<table><tbody><tr><td>Critério</td><td>a norma</td></tr></tbody></table>"
    + "<p>Fim.</p>";
  const out = M.matHtmlParaMarcas(html);

  ok(/^## Achado de auditoria/m.test(out), "C1 o cabeçalho não virou título do app");
  ok(/\*\*constatação\*\*/.test(out), "C2 o negrito da página se perdeu");
  ok(/_auditor_/.test(out), "C3 o itálico da página se perdeu");
  ok(/^- Elemento \*\*crítico\*\*/m.test(out), "C4 a lista não virou lista");
  ok(/^1\. Primeiro/m.test(out) && /^2\. Segundo/m.test(out),
     "C5 a lista numerada perdeu a ordem");
  ok(/Critério — a norma/.test(out), "C6 a tabela não virou linha legível");
  /* o parágrafo não pode sair duas vezes — uma pelo pai e outra pelo filho */
  ok((out.match(/Fim\./g) || []).length === 1,
     "C7 o texto saiu duplicado (pai e filho emitindo o mesmo conteúdo)");
  ok(!/<[a-z]/i.test(out), "C8 sobrou HTML no resultado");

  /* ida e volta: o que sai da conversão tem de renderizar de volta */
  const volta = M.matParaHtml(out);
  ok(/<h4>Achado de auditoria<\/h4>/.test(volta) || /<h3>/.test(volta),
     "C9 o título convertido não voltou a ser título na leitura");
  ok(/<b>constatação<\/b>/.test(volta), "C10 o negrito não sobreviveu à ida e volta");

  return { pulado: false, falhas: f };
}

module.exports = { testes };

if (require.main === module) {
  const r = testes();
  if (r.pulado) { console.log("\ncolagem: PULADO (jsdom não instalado)\n"); process.exit(0); }
  r.falhas.forEach((x) => console.log("  FALHA  " + x));
  console.log(r.falhas.length ? `\ncolagem: ${r.falhas.length} FALHA(S)\n`
    : "\ncolagem: HTML colado vira marcação do app\n");
  process.exit(r.falhas.length ? 1 : 0);
}
