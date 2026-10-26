/* =====================================================================
 * ARTIGO SEM O "Art.", SEQUÊNCIA DE §§ REPETIDA E RODAPÉ DA IMPRESSÃO DO NAVEGADOR (v19.27.0)
 *
 * O RELATO (relatórios de 26/10, LC 15/2009 de Caruaru e LC 95/2022):
 *  · o PDF traz "210-A. A reunião de processos…" sem o "Art."; os §§ 1º a 5º do 210-A caíram no Art. 210 e a tela de
 *    artigos repetidos sugeria (com confiança FORTE, pela nota "Redação dada…" dos §§ do 210) apagar os do 210-A — a
 *    lei foi gravada sem eles;
 *  · a LC 95/2022 impressa do leis.org tem, em cada página, o endereço + "9/20"; o rodapé ficava no texto e a remissão
 *    colava o "Art. 16. O art. 433-E…" nele.
 *
 * O QUE PRECISA SER VERDADE:
 *  S1 "NNN-A." logo depois do Art. NNN vira "Art. NNN-A." (grafia, motivo sem_art), e o artigo sai com os seus §§;
 *  S2 sem casar à toa: item numerado de tabela, número de outro artigo, minúscula depois do ponto;
 *  S3 recusando, a linha fica como veio;
 *  S4 §§ repetidos em sequência (3 ou mais, a segunda leva toda depois da primeira): sem sugestão de apagar; um § só
 *     repetido com nota de redação continua com a sugestão forte;
 *  S5 rodapé "endereço … N/M" repetido sai como cabeçalho; o artigo de baixo não vira "parte de frase";
 *  S6 um endereço solto (sem contador repetido) fica.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api } = rodar();

  const base = [
    "Art. 209. Texto do artigo duzentos e nove, completo.",
    "Art. 210. O processo administrativo-tributário formar-se-á: (Redação dada pela Lei Complementar 018, de 09 de outubro de 2009).",
    "§ 1º. O processo será organizado com folhas numeradas. (Redação dada pela Lei Complementar 018, de 09 de outubro de 2009).",
    "§2º. Os processos de apuração serão iniciados na repartição. (Redação dada pela Lei Complementar 023/10).",
    "§3º. Constitui embaraço à fiscalização dificultar a entrega. (Redação dada pela Lei Complementar 018, de 09 de outubro de 2009).",
    "210-A. A reunião de processos far-se-á por anexação ou apensação. (Incluído pela Lei Complementar 018 de 2009).",
    "§1º. A anexação consiste na juntada, em caráter permanente, de dois ou mais processos.",
    "§2º. No caso deste artigo, será acrescido à autuação do primeiro processo o número do processo anexado.",
    "§3º. A apensação ocorre toda vez que houver necessidade de se juntar um processo a outro.",
    "Art. 211. A Autoridade Fazendária poderá apreender bens e documentos."];
  const texto = base.join("\n\n");

  /* ---- S1 ---- */
  const pre = api.leiPreprocessar(texto);
  const sa = pre.mudancas.filter((m) => m.motivo === "sem_art");
  ok(sa.length === 1 && sa[0].grupo === "grafia" && /^Art\. 210-A\. A reunião/.test(sa[0].depois), "S1 '210-A.' vira cabeçalho do Art. 210-A: " + JSON.stringify(sa));
  const ap = api.leiAplicarPreprocesso(texto, pre.mudancas, {});
  const a210A = api.leiArtigo(ap.texto, "210-A");
  ok(a210A && (a210A.texto.match(/§\s*\d/g) || []).length === 3 && /apensação ocorre/.test(a210A.texto), "S1a o Art. 210-A sai com os seus 3 §§");
  ok((api.leiArtigo(ap.texto, "210").texto.match(/§\s*\d/g) || []).length === 3, "S1b o Art. 210 fica só com os dele");
  ok(!api.leiDuplicados(ap.texto).length, "S1c nada repetido para conferir: " + JSON.stringify(api.leiDuplicados(ap.texto).map((g) => g.rotulo)));
  ok(api.leiArtigos(ap.texto).map((a) => a.num).join(",") === "209,210,210-A,211", "S1d a sequência dos artigos");

  /* ---- S2 ---- */
  const nada = (tx) => !api.leiPreprocessar(tx).mudancas.some((m) => m.motivo === "sem_art");
  ok(nada("Art. 5. Tabela:\n1. Comércio em geral 100 UFM\n2. Indústria 200 UFM"), "S2 item numerado de tabela não vira artigo");
  ok(nada("Art. 4. Texto.\n5-A. Outro texto qualquer da tabela."), "S2a número de OUTRO artigo (5-A depois do 4) não casa");
  ok(nada("Art. 210. Texto.\n210-A. a minúscula continua a frase."), "S2b minúscula depois do ponto não casa");

  /* ---- S3 ---- */
  const ap2 = api.leiAplicarPreprocesso(texto, pre.mudancas, { [sa[0].id]: false });
  ok(/^210-A\. A reunião/m.test(ap2.texto) && !api.leiArtigo(ap2.texto, "210-A"), "S3 recusando, a linha fica como veio");

  /* ---- S4: sem a correção, os §§ do 210-A caem no 210 — a tela não pode sugerir apagar ---- */
  const gs = api.leiDuplicados(ap2.texto).filter((g) => g.intra && /^210#/.test(g.num));
  ok(gs.length === 3 && gs.every((g) => g.confianca === "fraca" && g.motivo === "sequencia"), "S4 sequência repetida: nenhuma sugestão forte de apagar: " + JSON.stringify(gs.map((g) => g.rotulo + " " + g.confianca + "/" + g.motivo)));
  const um = ["Art. 300. Caput do artigo.", "§2º. Texto antigo do parágrafo.", "§2º. Texto novo do parágrafo. (Redação dada pela Lei Complementar 018, de 09 de outubro de 2009).", "Art. 301. Outro."].join("\n");
  const g1 = api.leiDuplicados(um).filter((g) => g.intra);
  ok(g1.length === 1 && g1[0].confianca === "forte" && g1[0].motivo === "redacao", "S4a um § só, com nota de redação: continua a sugestão forte: " + JSON.stringify(g1.map((g) => g.confianca + "/" + g.motivo)));
  /* compilada: §§ antigo e novo INTERCALADOS (§1º velho, §1º novo, §2º velho…) — isso é redação, a sugestão forte fica */
  const inter = ["Art. 400. Caput.", "§1º. Velho um.", "§1º. Novo um. (Redação dada pela Lei Complementar 018, de 09 de outubro de 2009).",
    "§2º. Velho dois.", "§2º. Novo dois. (Redação dada pela Lei Complementar 018, de 09 de outubro de 2009).",
    "§3º. Velho três.", "§3º. Novo três. (Redação dada pela Lei Complementar 018, de 09 de outubro de 2009).", "Art. 401. Outro."].join("\n");
  const gi = api.leiDuplicados(inter).filter((g) => g.intra);
  ok(gi.length === 3 && gi.every((g) => g.confianca === "forte" && g.motivo === "redacao"), "S4c §§ intercalados (antigo/novo) continuam com a sugestão forte: " + JSON.stringify(gi.map((g) => g.confianca + "/" + g.motivo)));
  /* na tela, o motivo próprio */
  api.leiDuplicadosAbrir({ modo: "criar", texto: ap2.texto, grupos: api.leiDuplicados(ap2.texto), aoConfirmar: () => {} });
  api.setLanguage("pt");
  ok(/OUTRO ARTIGO cujo cabeçalho o PDF não trouxe/.test(api.$("leiDupLista").textContent), "S4b a tela explica por que as duas ficam");

  /* ---- S5 / S6 ---- */
  const url = (n) => "https://leis.org/municipais/pe/caruaru/lei/lei-complementar/2022/95/lei-complementar-n-95-2022-altera-de-… " + n + "/3";
  const lc95 = ["Art. 15. O art. 433-D da Lei Complementar nº 015 passa a vigorar com a seguinte redação:", "Art. 433-D A Taxa de Fiscalização será determinada no Anexo XIII desta Lei Complementar. (NR)",
    url(1), "Art. 16. O art. 433-E da Lei Complementar nº 015 de 05 de janeiro de 2009, passa a vigorar:", "\"Art. 433-E A Taxa será recolhida. (NR)\"",
    url(2), "Art. 17. Esta Lei entra em vigor na data de sua publicação.", url(3)].join("\n\n");
  const p95 = api.leiPreprocessar(lc95, { semAnexos: true, semNumeracao: true });
  const cab = p95.mudancas.filter((m) => m.grupo === "cabecalho");
  ok(cab.length === 1 && cab[0].ocorrencias === 3 && /leis\.org/.test(cab[0].antes), "S5 o rodapé com endereço e contador sai como cabeçalho: " + JSON.stringify(cab));
  ok(!p95.mudancas.some((m) => m.grupo === "remissao"), "S5a o 'Art. 16' de baixo não vira parte de frase");
  const r95 = api.leiAplicarPreprocesso(lc95, p95.mudancas, {});
  ok(!/leis\.org/.test(r95.texto) && /^Art\. 16\. O art\. 433-E/m.test(r95.texto), "S5b o texto limpo, com o Art. 16 no começo da linha");
  const solto = "Art. 1. Ver https://leis.org/a.\n\nhttps://leis.org/municipais/pe/caruaru/lei/x 1/5\n\nArt. 2. Fim.";
  ok(!api.leiPreprocessar(solto).mudancas.some((m) => m.grupo === "cabecalho"), "S6 um endereço solto fica");

  ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t("lei_dup_seq_intra") !== "lei_dup_seq_intra", "X falta lei_dup_seq_intra em " + l); });
  api.setLanguage("pt");
  return falhas;
}

module.exports = { testes };
