/* =====================================================================
 * A AGENDA MAIS ENXUTA (19.190.0)
 *
 * Antes da primeira tarefa havia 10 faixas: o subtítulo "49 h/semana · 2 edital(is) em vista (3 oculto(s))", a Reta
 * final, um aviso por pré-edital, "disciplinas (7 de 7)", "3 edital(is) fora desta agenda", os chips, a gaveta dos
 * ajustes, "25 tópicos · 23h53 · de 2 editais…" e o medidor.
 *
 * O QUE PRECISA SER VERDADE:
 *  E1. o cabeçalho tem "⚙ N de M editais · H h/semana", um botão que abre os ajustes; a faixa "N fora desta agenda" saiu;
 *  E2. dois pré-editais ou mais (ou a Reta final no ar) viram UM chip que abre a lista, com os mesmos avisos e botões;
 *  E3. "disciplinas", os chips de aviso e "⚙ ajustes" ficam numa linha só;
 *  E4. "25 tópicos" entra no medidor; a frase "ordenados por peso…" vai para o balão dele.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const ano = new Date().getFullYear() + 1;
  const achar = (raiz, f, acc) => { const out = acc || []; if (!raiz) return out; if (f(raiz)) out.push(raiz); Array.from(raiz.children || []).forEach((c) => achar(c, f, out)); return out; };
  const cls = (el, c) => (" " + String((el && el.className) || "") + " ").indexOf(" " + c + " ") >= 0;

  const { api } = rodar();
  api.matIniciar(); api.edIniciar();
  const pub = api.edCriar("SEFAZ", "# SEFAZ-AL | prova: " + ano + "-05-10 | horas: 20\n@ Contabilidade :: 5\n+ PCASP :: 5\n+ Balanço :: 4\n@ Português :: 3\n+ Crase :: 3");
  const prev1 = api.edCriar("ISS Recife", "# ISS Recife | previsto: " + ano + "-03.." + ano + "-06 | horas: 15\n@ Tributário :: 5\n+ ISS :: 5");
  const prev2 = api.edCriar("TCE-PE", "# TCE-PE | previsto: " + ano + "-09 | horas: 10\n@ Controle Externo :: 5\n+ Fiscalização :: 5");
  api.hubVoltar(); api.hubRender();
  /* um edital fora da agenda (o filtro) */
  api.hubEdAlternar(prev2.id);
  api.hubPintarAgenda();
  const topo = api.$("edAgendaTopo");
  const caixa = () => { const cs = achar(topo, (x) => cls(x, "ed-agenda-cx")); return cs[cs.length - 1]; };

  /* E1 */
  const horas = achar(caixa(), (x) => cls(x, "ed-agenda-horas"))[0];
  ok(horas && /⚙ 2 de 3 editais · \d+ h\/semana/.test(horas.textContent) && cls(horas, "ed-agenda-horas-bt"), "E1 o cabeçalho: '⚙ 2 de 3 editais · N h/semana': " + (horas && horas.textContent));
  ok(!achar(caixa(), (x) => /fora desta agenda/.test(x.textContent || "") && cls(x, "ed-ag-aviso")).length, "E1a a faixa 'N edital(is) fora desta agenda' saiu");
  api.loja.removeItem("eac_ag_ajustes_aberto");
  horas.onclick();
  ok(api.loja.getItem("eac_ag_ajustes_aberto") === "1" && api.$("hubAjustes").open === true, "E1b tocar no '⚙ editais' abre os ajustes da agenda (onde se escolhem os editais)");

  /* E2 */
  const lote = api.$("edPrevLote");
  ok(lote && lote.open === false && /📅 2 pré-edital\(is\) esperando a virada/.test(lote.children[0].textContent), "E2 os dois pré-editais viram um chip fechado: " + (lote && lote.children[0].textContent));
  const av1 = api.$("edPrevAviso_" + prev1.id);
  ok(av1 && achar(lote, (x) => x === av1).length === 1 && api.$("btnEdPrevVirada_" + prev1.id) && typeof api.$("btnEdPrevVirada_" + prev1.id).onclick === "function",
    "E2a os avisos e o botão da virada continuam, dentro do chip");

  /* E3 */
  const linha = api.$("hubLinhaCtrl");
  ok(linha && achar(linha, (x) => cls(x, "ed-disc-caixa")).length === 1 && achar(linha, (x) => x.id === "hubAjustes").length === 1,
    "E3 'disciplinas' e '⚙ ajustes' na mesma linha de controles");
  const avisos = api.$("hubAvisos");
  ok(!avisos || achar(linha, (x) => x === avisos).length === 1, "E3a os chips de aviso (quando há) moram na mesma linha");

  /* E4 */
  const med = achar(caixa(), (x) => cls(x, "ag-medidor"))[0];
  const rot = med && achar(med, (x) => cls(x, "ag-med-rot"))[0];
  ok(rot && /\d+ tópicos/.test(rot.textContent) && /Ordenados por peso/.test(med.title || ""), "E4 os tópicos no medidor; o 'ordenados por peso' no balão: " + (rot && rot.textContent));
  ok(!achar(caixa(), (x) => cls(x, "ed-caixa-sub") && /Ordenados por peso/.test(x.textContent || "")).length, "E4a a linha solta 'N tópicos · … · ordenados por peso' saiu");

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
