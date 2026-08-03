/* =====================================================================
 * TESTE DE FUMAÇA
 * Carrega os quatro arquivos do app num DOM mínimo (feito à mão, sem
 * nenhuma dependência) só para responder a uma pergunta: "o app inicia
 * sem lançar erro?". Pega engano de ordem de declaração, id que não
 * existe no HTML e função ausente — coisas que o "node --check" não vê,
 * porque são erros de execução, não de sintaxe.
 * Roda junto com tests/rodar.js.
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const ARQUIVOS = ["i18n.js", "parser.js", "anki.js", "app.js"];

/* Elemento de mentira: aceita tudo que o app costuma fazer com um nó. */
function novoEl(id) {
  const el = {
    id, value: "", textContent: "", placeholder: "",
    checked: false, disabled: false, readOnly: false, open: false,
    children: [], dataset: {}, options: [], files: [], firstChild: null, parentNode: null, scrollTop: 0, selectionStart: 0, selectionEnd: 0,
    // style aceita leitura, escrita e os métodos de CSS custom property
    style: new Proxy({ setProperty() {}, removeProperty() {}, getPropertyValue: () => "" },
      { get: (o, k) => (k in o ? o[k] : ""), set: () => true }),
    classList: {
      add() {}, remove() {}, toggle: () => false, contains: () => false,
    },
    append(...ns) { ns.forEach((n) => n && el.children.push(n)); },
    appendChild(n) { el.children.push(n); return n; },
    prepend() {}, remove() {},
    insertBefore() {}, removeChild() {}, replaceChildren() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    querySelector: () => novoEl("?css"), querySelectorAll: () => [],
    showModal() { this.open = true; }, show() { this.open = true; },
    close() { this.open = false; },
    focus() {}, blur() {}, select() {}, click() {},
    setSelectionRange() {}, scrollIntoView() {},
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    cloneNode: () => novoEl(id),
  };
  // innerHTML = "" é como o app limpa um container: zera os filhos também,
  // senão a contagem de cartões na tela fica errada
  let html = "";
  Object.defineProperty(el, "innerHTML", {
    get: () => html,
    set: (v) => { html = v; if (!v) el.children.length = 0; },
  });
  return el;
}

/* Só devolve elemento para os ids que existem de verdade no index.html —
 * assim um $("idErrado") vira null e o app quebra aqui, não no usuário. */
function montarDocumento(html) {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const cache = new Map();
  const pegar = (id) => {
    if (!cache.has(id)) cache.set(id, novoEl(id));
    return cache.get(id);
  };
  return {
    ids,
    doc: {
      getElementById: (id) => (ids.has(id) ? pegar(id) : null),
      createElement: (tag) => novoEl("<" + tag + ">"),
      createTextNode: () => novoEl("#texto"),
      createDocumentFragment: () => novoEl("#frag"),
      // devolve um elemento genérico: o alvo aqui é o getElementById,
      // que é onde o app se liga aos ids reais do HTML
      querySelector: () => novoEl("?css"), querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {},
      body: novoEl("body"), documentElement: novoEl("html"),
      head: novoEl("head"), title: "", readyState: "complete",
    },
  };
}

function rodar() {
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const { doc, ids } = montarDocumento(html);
  const falhas = [];

  const janela = {
    document: doc,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: {
      language: "pt-BR", userAgent: "node", platform: "node",
      clipboard: { writeText: async () => {}, readText: async () => "" },
      serviceWorker: {
        register: async () => ({}), addEventListener() {},
        controller: null, getRegistration: async () => null,
      },
    },
    matchMedia: () => ({
      matches: false, addListener() {}, removeListener() {},
      addEventListener() {}, removeEventListener() {},
    }),
    location: { href: "https://exemplo.test/", origin: "https://exemplo.test" },
    // executa o callback na hora: o objetivo é justamente percorrer o código
    setTimeout: (f) => { try { if (typeof f === "function") f(); } catch (e) {} return 0; },
    clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: (f) => { try { f(0); } catch (e) {} return 0; },
    addEventListener() {}, removeEventListener() {},
    alert() {}, confirm: () => true, prompt: () => null,
    fetch: async () => ({ ok: false, text: async () => "" }),
    URL: { createObjectURL: () => "blob:", revokeObjectURL() {} },
    Blob: function () {}, FileReader: function () {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
    IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
    console: { log() {}, warn() {}, error() {}, info() {} },
  };
  janela.window = janela;
  janela.self = janela;

  const codigo = ARQUIVOS
    .map((f) => fs.readFileSync(path.join(RAIZ, "docs", f), "utf8")).join("\n;\n");
  const nomes = Object.keys(janela);
  // devolve o que os testes funcionais precisam manipular. Os "let" do app
  // viram getters/setters para o teste ver o estado ao vivo.
  const exportar = `return {
    $, preview, entrarRevisao, sairRevisao, chaveRev, chave, parseAtual,
    get revisados() { return revisados; },
    get ocultos() { return ocultosRevisao; },
    get modoRevisao() { return modoRevisao; },
  };`;
  let api = null;
  try {
    api = new Function(...nomes, codigo + "\n" + exportar)(...nomes.map((n) => janela[n]));
  } catch (e) {
    falhas.push("o app não carregou: " + e.message);
    if (process.env.PILHA) console.log(e.stack);
  }
  return { falhas, ids: ids.size, api, doc };
}

module.exports = { rodar };

if (require.main === module) {
  const r = rodar();
  r.falhas.forEach((f) => console.log("  FALHA  " + f));
  console.log(r.falhas.length
    ? "\nfumaça: FALHOU\n"
    : `\nfumaça: o app carrega sem erro (${r.ids} ids no HTML)\n`);
  process.exit(r.falhas.length ? 1 : 0);
}
