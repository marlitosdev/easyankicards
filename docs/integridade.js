/* =====================================================================
 * (19.128.0) O RETRATO NA ABERTURA E A CONFERÊNCIA DE INTEGRIDADE
 *
 * O INCIDENTE DE 14/11/2026: o app abriu, uma gravação zerou as 53 marcações de um edital, e nada na tela nem no
 * registro disse isso. Quem percebeu foi o backup automático, minutos depois — e só porque a queda era grande. O
 * diagnóstico tinha uma pista ("0 disciplinas" às 08:31:59) por acaso: nenhum evento dizia quanto havia ao abrir.
 *
 * AGORA, A CADA ABERTURA (alguns segundos depois de a tela assentar, com os dados do IndexedDB já chegados):
 *  1. O RETRATO: um evento "ABERTURA" no registro, com a versão e os totais (editais, marcações, questões, resumos…).
 *     Qualquer diagnóstico passa a mostrar com o que cada sessão começou — e quando a versão mudou.
 *  2. A CONFERÊNCIA: os totais são comparados com os do fim da ÚLTIMA sessão deste aparelho. Algo zerou, ou caiu muito
 *     (a mesma régua do backup automático: perdeu ≥ 20% e ≥ 5 itens)? O aviso sai NA HORA, com os números e o caminho
 *     para a cópia boa — antes de a pessoa estudar em cima do estrago.
 *  3. A BANCADA VAZIA: edital aberto com texto guardado e a caixa do edital em branco é a marca daquele incidente; vai
 *     para o registro.
 * O retrato de referência é regravado quando a janela sai de vista (fim da sessão): apagar de propósito durante o uso
 * não vira alarme na abertura seguinte. É DESTE aparelho ("eac_integridade") e não vai no backup.
 * ===================================================================== */
const INT_CHAVE = "eac_integridade";
const INT_ESPERA = 4000;
let intUltima = null;      /* a conferência desta abertura: { quando, antes, agora, caiu, semReferencia, erro } */

function intLer() {
  try { const o = JSON.parse(localStorage.getItem(INT_CHAVE) || "null"); return o && typeof o === "object" && o.resumo ? o : null; }
  catch (e) { return null; }
}
function intGravar(resumo, quando) {
  try {
    localStorage.setItem(INT_CHAVE, JSON.stringify({ quando: quando || new Date().toISOString(), versao: typeof VERSAO !== "undefined" ? VERSAO : "", resumo }));
    return true;
  } catch (e) { return false; }
}
/* os totais numa linha, para o registro: só o que não é zero */
function intLinha(resumo) {
  return Object.keys(BK_ROTULOS).filter((k) => Number((resumo || {})[k]) > 0).map((k) => BK_ROTULOS[k] + " " + resumo[k]).join(" · ");
}
/* o que caiu entre o fim da última sessão e agora: [{chave, rotulo, de, para}] (a régua do backup automático) */
function intQuedas(antes, agora) {
  return typeof bkaEncolheu === "function" ? bkaEncolheu(antes, agora) : [];
}
/* a conferência; devolve o que achou (e o guarda em intUltima, que o diagnóstico lê) */
async function intConferir(opc) {
  const o = opc || {};
  const r = { quando: new Date().toISOString(), antes: null, agora: null, caiu: [], semReferencia: false, erro: "" };
  try { if (typeof bkEsperarDados === "function") await bkEsperarDados(); }
  catch (e) {
    r.erro = (e && e.message) || "?";
    try { reg("INTEGRIDADE", "os dados não carregaram a tempo da conferência", r.erro); } catch (x) {}
    intUltima = r;
    return r;
  }
  try { r.agora = resumoAtual(); } catch (e) { r.erro = (e && e.message) || "?"; intUltima = r; return r; }
  const ref = intLer();
  const v = typeof VERSAO !== "undefined" ? VERSAO : "?";
  try { reg("ABERTURA", "versão " + v + (ref && ref.versao && ref.versao !== v ? " (a sessão anterior foi na " + ref.versao + ")" : ""), intLinha(r.agora) || "sem dados"); } catch (e) {}
  /* a bancada em branco com um edital aberto que TEM texto: a marca do incidente */
  try {
    const ab = typeof edAberto === "function" ? edAberto() : null;
    const cx = typeof $ === "function" ? $("editalTexto") : null;
    if (ab && String(ab.texto || "").trim() && cx && !String(cx.value || "").trim())
      reg("INTEGRIDADE", "bancada em branco com edital aberto", (ab.nome || ab.id) + " · o texto guardado tem " + String(ab.texto).length + " caracteres");
  } catch (e) {}
  if (!ref) {
    r.semReferencia = true;
    intGravar(r.agora);
    intUltima = r;
    return r;
  }
  r.antes = { quando: ref.quando, versao: ref.versao || "", resumo: ref.resumo };
  r.caiu = intQuedas(ref.resumo, r.agora);
  intUltima = r;
  if (r.caiu.length) {
    const lista = r.caiu.map((x) => x.rotulo + " " + x.de + " → " + x.para).join("; ");
    try { reg("INTEGRIDADE", "ao abrir, os dados estão menores que no fim da última sessão", lista + " · última sessão: " + ref.quando + (ref.versao ? " (v" + ref.versao + ")" : "")); } catch (e) {}
    if (!o.semAviso) { try { intAvisar(r); } catch (e) {} }
    /* a referência boa FICA até o fim desta sessão: reabrir a página agora repete o aviso */
    return r;
  }
  intGravar(r.agora);
  return r;
}
function intAvisar(r) {
  if (typeof uiAlert !== "function" || typeof t !== "function") return;
  const linhas = r.caiu.map((x) => "· " + t("int_item", { r: x.rotulo, de: x.de, para: x.para, n: x.de - x.para })).join("\n");
  let quando = r.antes.quando;
  try { if (typeof bkQuandoCurto === "function") quando = bkQuandoCurto(r.antes.quando); } catch (e) {}
  uiAlert(t("int_aviso", { q: quando, lista: linhas }));
}
/* a linha do resumo do diagnóstico */
function intLinhaDiagnostico() {
  const r = intUltima;
  if (!r) return { tipo: "info", txt: "Integridade: a conferência da abertura ainda não rodou nesta sessão" };
  if (r.erro) return { tipo: "aviso", txt: "Integridade: não deu para conferir ao abrir (" + r.erro + ")" };
  if (r.semReferencia) return { tipo: "info", txt: "Integridade: primeira abertura com a conferência — o retrato de agora vira a referência" };
  const q = (() => { try { return typeof diagQuando === "function" ? diagQuando(new Date(r.antes.quando).getTime()) : r.antes.quando; } catch (e) { return r.antes.quando; } })();
  if (r.caiu.length) return { tipo: "aviso", txt: "Integridade: ao abrir, MENOS dados que no fim da última sessão (" + q + "): " + r.caiu.map((x) => x.rotulo + " " + x.de + " → " + x.para).join("; ") };
  return { tipo: "ok", txt: "Integridade: ao abrir, nada menor que no fim da última sessão (" + q + ")" };
}
/* o fim da sessão: o retrato de agora passa a ser a referência da próxima abertura */
function intFecharSessao() {
  try { if (!intUltima || intUltima.erro) return false; return intGravar(resumoAtual()); } catch (e) { return false; }
}
function intIniciar() {
  if (typeof document === "undefined") return;
  setTimeout(() => { intConferir().catch(() => {}); }, INT_ESPERA);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") intFecharSessao(); });
}
