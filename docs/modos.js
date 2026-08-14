/* =====================================================================
 * MODOS — o registro
 *
 * A barra lateral não é um menu com um "if" para cada botão: é um
 * REGISTRO. Acrescentar um modo novo é acrescentar uma entrada aqui e
 * uma <section data-modo="..."> no HTML. Nada mais muda — nem o app.js,
 * nem o parser, nem os modos que já existem.
 *
 * Três decisões que sustentam isso (ver PLANO-edital.md):
 *  - o modo atual mora em localStorage, então reabrir volta onde estava;
 *  - cada modo usa o seu próprio prefixo de armazenamento
 *    (eac_edital_*, eac_resumo_*): nada compartilhado por acidente;
 *  - trocar de modo NÃO recarrega a página nem toca no editor — o texto
 *    dos cartões continua intacto quando você volta.
 * ===================================================================== */

/* Cada entrada diz onde MORA a sua seção. Poderia procurar por
 * "[data-modo]", mas então o registro deixaria de ser a única fonte da
 * verdade: quem lê esta lista sabe tudo sobre os modos sem abrir o HTML. */
const MODOS = [
  { id: "cartoes", secao: "secCartoes", icone: "🗂", rotulo: "modo_cartoes", pronto: true },
  { id: "edital", secao: "secEdital", icone: "📋", rotulo: "modo_edital", pronto: true },
  { id: "resumos", secao: "secResumos", icone: "📝", rotulo: "modo_resumos", pronto: false },
  { id: "ferramentas", secao: "secFerramentas", icone: "🧰", rotulo: "modo_ferramentas", pronto: true },
];

let modoAtual = "cartoes";

function trocarModo(id) {
  if (!MODOS.some((m) => m.id === id)) id = "cartoes";
  modoAtual = id;
  MODOS.forEach((m) => {
    const s = document.getElementById(m.secao);
    if (s) s.hidden = m.id !== id;
  });
  const nav = document.getElementById("barraModos");
  if (nav) Array.from(nav.children || []).forEach(marcar);
  function marcar(b) {
    const meu = b.dataset.modo === id;
    b.classList.toggle("ativo", meu);
    b.setAttribute("aria-selected", meu ? "true" : "false");
  }
  try { localStorage.setItem("eac_modo", id); } catch (e) {}
  if (typeof reg === "function") reg("MODO", "modo " + id);
}

function montarBarraModos() {
  const nav = document.getElementById("barraModos");
  if (!nav) return;
  nav.innerHTML = "";
  MODOS.forEach((m) => {
    const b = document.createElement("button");
    b.className = "modo-btn" + (m.pronto ? "" : " modo-breve");
    b.dataset.modo = m.id;
    b.type = "button";
    b.setAttribute("role", "tab");
    const ic = document.createElement("span");
    ic.className = "modo-ic";
    ic.textContent = m.icone;
    const rot = document.createElement("span");
    rot.className = "modo-rot";
    rot.textContent = typeof t === "function" ? t(m.rotulo) : m.id;
    b.append(ic, rot);
    if (!m.pronto) {
      const selo = document.createElement("span");
      selo.className = "modo-selo";
      selo.textContent = typeof t === "function" ? t("modo_em_breve") : "em breve";
      b.append(selo);
    }
    b.onclick = () => trocarModo(m.id);
    nav.append(b);
  });
  let guardado = "cartoes";
  try { guardado = localStorage.getItem("eac_modo") || "cartoes"; } catch (e) {}
  trocarModo(guardado);
}
