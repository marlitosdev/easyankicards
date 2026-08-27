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
  { id: "material", secao: "secResumos", icone: "📚", rotulo: "modo_material", pronto: true },
  { id: "questoes", secao: "secQuestoes", icone: "❓", rotulo: "modo_questoes", pronto: true },
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
  /* O rodapé de exportação é da bancada de CARTÕES: "Baixar .txt" e "Baixar
   * .apkg" não significam nada no edital, e botão que não faz sentido no
   * contexto é botão que ensina o usuário a desconfiar da tela. */
  const rod = document.getElementById("rodapeExportar");
  if (rod) rod.hidden = id !== "cartoes";
  if (typeof medirRodape === "function") medirRodape();
  try { localStorage.setItem("eac_modo", id); } catch (e) {}
  if (typeof reg === "function") reg("MODO", "modo " + id);
}

/* =====================================================================
 * A BARRA TEM NOME, E PODE ENCOLHER
 *
 * A faixa nunca se apresentou. "Cartões, Edital, Material de estudos,
 * Questões, Ferramentas" são cinco lugares diferentes do aplicativo, e
 * quem chega não tem como saber que aquilo é a navegação — parecia uma
 * fileira de botões soltos acima do conteúdo.
 *
 * E ela custa caro em tela pequena: cinco rótulos por extenso comem uma
 * faixa inteira antes de o conteúdo começar. Recolhida, fica só o ícone;
 * o nome vira dica do botão, e a escolha fica guardada — quem trabalha
 * num monitor pequeno não quer refazer isso toda manhã.
 * ================================================================== */
const MODOS_CHAVE_RECOLHIDA = "eac_modos_recolhida";
let modosRecolhida = false;

function modosCarregarEstado() {
  try { modosRecolhida = localStorage.getItem(MODOS_CHAVE_RECOLHIDA) === "1"; }
  catch (e) { modosRecolhida = false; }
  return modosRecolhida;
}

function modosRecolher(sim) {
  modosRecolhida = sim === undefined ? !modosRecolhida : !!sim;
  try {
    localStorage.setItem(MODOS_CHAVE_RECOLHIDA, modosRecolhida ? "1" : "0");
  } catch (e) {}
  modosPintarRecolhida();
  if (typeof reg === "function") {
    reg("MODO", modosRecolhida ? "barra de modos recolhida" : "barra de modos aberta");
  }
  return modosRecolhida;
}

function modosPintarRecolhida() {
  const cx = document.getElementById("modosCaixa");
  if (cx && cx.classList) cx.classList.toggle("modos-min", modosRecolhida);
  const b = document.getElementById("btnModosRecolher");
  if (b) {
    b.textContent = modosRecolhida ? "»" : "«";
    b.title = typeof t === "function"
      ? t(modosRecolhida ? "modos_abrir_ajuda" : "modos_recolher_ajuda") : "";
    b.setAttribute("aria-expanded", modosRecolhida ? "false" : "true");
  }
  /* RECOLHIDA, O RÓTULO VIRA DICA — não some.
   * Um ícone sozinho é um enigma para quem ainda não decorou; o nome
   * continua alcançável parando o mouse em cima, e o leitor de tela
   * continua lendo o botão inteiro. */
  const nav = document.getElementById("barraModos");
  if (nav) {
    (Array.from(nav.children || [])).forEach((b2) => {
      const m = MODOS.filter((x) => x.id === (b2.dataset && b2.dataset.modo))[0];
      if (!m) return;
      const nome = typeof t === "function" ? t(m.rotulo) : m.id;
      b2.title = modosRecolhida ? nome : "";
      b2.setAttribute("aria-label", nome);
    });
  }
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
  const b = document.getElementById("btnModosRecolher");
  if (b) b.onclick = () => modosRecolher();
  modosCarregarEstado();
  modosPintarRecolhida();

  let guardado = "cartoes";
  try { guardado = localStorage.getItem("eac_modo") || "cartoes"; } catch (e) {}
  trocarModo(guardado);
}
