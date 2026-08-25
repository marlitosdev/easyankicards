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
const ARQUIVOS = ["i18n.js", "parser.js", "anki.js", "app.js",
                  "backup.js", "backup-ui.js", "material.js",
                  "questoes.js", "rascunho.js", "questoes-ui.js",
                  "fora-da-agenda.js", "edital.js", "editais.js", "vinculos.js", "pre-edital.js", "cartoes-material.js", "edital-hub.js", "edital-ui.js", "modos.js"];

/* Seletor de pobre: entende "tag" e "tag[attr=valor]", que é tudo que o
 * app usa. Sem isso não dá para testar tela em lista (a bandeja de
 * recortes marca as caixas por querySelectorAll). */
function casa(el, sel) {
  /* aceita "tag", ".classe", "tag.classe" e "[attr=valor]".
   * ".classe" faltava, e sem ela nenhum teste conseguia perguntar se a
   * leitura do resumo desenhou o bloco certo — só dava para contar <mark>. */
  const m = String(sel).trim()
    .match(/^([a-zA-Z]*)((?:\.[\w-]+)*)(?:\[([\w-]+)=([^\]]+)\])?$/);
  if (!m) return false;
  const [, tag, classes, attr, valor] = m;
  if (tag && (el.tag || "").toLowerCase() !== tag.toLowerCase()) return false;
  if (classes) {
    const tem = String(el.className || "").split(/\s+/).filter(Boolean);
    for (const c of classes.split(".").filter(Boolean)) {
      if (!tem.includes(c)) return false;
    }
  }
  if (attr && String(el[attr] || "") !== valor.replace(/^["']|["']$/g, "")) return false;
  return true;
}

/* =====================================================================
 * INTERPRETADOR DE HTML
 *
 * O app monta pedaços da tela escrevendo innerHTML (a leitura do resumo é
 * assim). Enquanto o stub só guardava a string, nenhum teste conseguia
 * perguntar "o gabarito virou bloco .mat-gab?" — dava para checar a string
 * com expressão regular, mas isso testa a minha regex, não o desenho.
 * jsdom resolveria, mas leva 66s para carregar neste ambiente.
 *
 * Cobre o que o app de fato gera: tags com class/id, texto, e as entidades
 * que matEscapar produz. Não é um navegador; é o suficiente para perguntar
 * sobre estrutura em vez de sobre string.
 * ===================================================================== */
const VAZIAS = new Set(["br", "hr", "img", "input", "meta", "link"]);
function desescapar(s) {
  return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
function interpretarHtml(txt, fazerEl) {
  const raiz = { children: [] };
  const pilha = [raiz];
  /* atributos COM e SEM valor: <details open> é HTML corriqueiro, e
   * enquanto o "open" não era aceito a etiqueta inteira não casava e virava
   * texto — a dica recolhível "sumia" do DOM sem nenhum erro. */
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:\s*=\s*"[^"]*")?)*)\s*(\/?)>/g;
  let pos = 0, m;
  const texto = (s) => {
    if (!s) return;
    const no = fazerEl("", "#text");
    no._texto = desescapar(s);
    pilha[pilha.length - 1].children.push(no);
  };
  while ((m = re.exec(txt)) !== null) {
    texto(txt.slice(pos, m.index));
    pos = m.index + m[0].length;
    const [, fecha, tag, attrs, sozinha] = m;
    if (fecha) {
      /* fecha o mais recente com essa tag; ignora fechamento sem par */
      for (let i = pilha.length - 1; i > 0; i--) {
        if ((pilha[i].tag || "").toLowerCase() === tag.toLowerCase()) {
          pilha.length = i; break;
        }
      }
      continue;
    }
    const el = fazerEl("", tag.toLowerCase());
    [...attrs.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)]
      .filter(([todo]) => todo.trim())
      .forEach(([, k, v]) => {
        const val = v === undefined ? true : v;  /* <details open> => open:true */
        if (k === "class") el.className = val === true ? "" : val;
        else if (k === "id") el.id = val === true ? "" : val;
        else el[k] = val;
      });
    pilha[pilha.length - 1].children.push(el);
    if (!sozinha && !VAZIAS.has(tag.toLowerCase())) pilha.push(el);
  }
  texto(txt.slice(pos));
  return raiz.children;
}
function descendentes(el, saida) {
  (el.children || []).forEach((f) => { saida.push(f); descendentes(f, saida); });
  return saida;
}

/* Elemento de mentira: aceita tudo que o app costuma fazer com um nó. */
function novoEl(id, tag) {
  const el = {
    id, tag: tag || "", value: "", _texto: "", placeholder: "",
    checked: false, disabled: false, readOnly: false, open: false,
    children: [], dataset: {}, _attrs: {}, options: [], files: [], firstChild: null, parentNode: null, scrollTop: 0, selectionStart: 0, selectionEnd: 0,
    // style aceita leitura, escrita e os métodos de CSS custom property
    style: new Proxy({ setProperty() {}, removeProperty() {}, getPropertyValue: () => "" },
      { get: (o, k) => (k in o ? o[k] : ""), set: (o, k, v) => { o[k] = v; return true; } }),
    /* classList de verdade, apoiada em className. Enquanto era no-op,
     * qualquer comportamento baseado em classe passava no teste sem ser
     * exercido — foi assim que o botao "Ampliar" leu o proprio estado do
     * DOM e ninguem viu. */
    /* textContent DE VERDADE: no navegador ele soma o texto de todos os
     * descendentes; aqui devolvia so o do proprio no, e com isso qualquer
     * verificacao sobre o conteudo de um painel montado por partes passava
     * lendo string vazia. Foi assim que "a agenda mostra horario?" ficou
     * sem resposta possivel. Escrever continua limpando os filhos. */
    get textContent() {
      if (el.children.length)
        return el._texto + el.children.map((c) => (c && c.textContent) || "").join("");
      return el._texto;
    },
    set textContent(v) { el._texto = v == null ? "" : String(v); el.children = []; },
    classList: {
      _l: () => (el.className || "").split(/\s+/).filter(Boolean),
      _set(v) { el.className = v.join(" "); },
      contains(c) { return this._l().includes(c); },
      add(...cs) { const l = this._l(); cs.forEach((c) => { if (!l.includes(c)) l.push(c); }); this._set(l); },
      remove(...cs) { this._set(this._l().filter((x) => !cs.includes(x))); },
      toggle(c, force) {
        const tem = this.contains(c);
        const q = force === undefined ? !tem : !!force;
        if (q) this.add(c); else this.remove(c);
        return q;
      },
    },
    append(...ns) { ns.forEach((n) => n && el.children.push(n)); },
    appendChild(n) { el.children.push(n); return n; },
    prepend() {}, remove() {},
    insertBefore() {}, removeChild() {}, replaceChildren() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    /* atributos DE VERDADE: eram no-op, e getAttribute devolvia sempre null.
     * Qualquer coisa guardada em atributo — aria-pressed, data-*, role —
     * ficava invisível para o teste, que então nao conseguia perguntar
     * "este botao esta marcado como ligado?". */
    setAttribute(k, v) { el._attrs[k] = String(v); },
    removeAttribute(k) { delete el._attrs[k]; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k); },
    getAttribute(k) {
      if (Object.prototype.hasOwnProperty.call(el._attrs, k)) return el._attrs[k];
      /* propriedades espelham atributos no navegador para alguns nomes */
      if (k === "class") return el.className || null;
      if (k === "id") return el.id || null;
      return el[k] === undefined ? null : String(el[k]);
    },
    querySelector: (sel) => descendentes(el, []).find((f) => casa(f, sel)) || null,
    querySelectorAll: (sel) => descendentes(el, []).filter((f) => casa(f, sel)),
    /* O NAVEGADOR LANÇA ERRO ao chamar showModal() num <dialog> JÁ ABERTO
     * (InvalidStateError no Chrome). Enquanto o stub aceitava calado, dois
     * botões das dúvidas pareciam "não funcionar" para o usuário e passavam
     * verdes aqui: "abrir onde está" reabria dlgMaterial já aberto, e
     * "resolvida" reabria dlgDuvidas já aberto. */
    showModal() {
      if (this.open) {
        const e = new Error("InvalidStateError: showModal num <dialog> ja aberto ("
          + (this.id || this.tagName || "?") + ")");
        e.name = "InvalidStateError";
        throw e;
      }
      this.open = true;
    },
    show() { this.open = true; },
    close() { this.open = false; },
    focus() {}, blur() {}, select() {}, click() {},
    /* setSelectionRange era no-op, e com isso "abriu e selecionou o trecho"
     * ficava indistinguível de "abriu e não fez nada" — a sabotagem que
     * removia a seleção passava verde. Agora guarda o intervalo, que é o
     * que o usuário enxerga como o texto realçado na caixa. */
    setSelectionRange(a, b) { el.selectionStart = a; el.selectionEnd = b; },
    scrollIntoView() { el._rolouAte = true; },
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    cloneNode: () => novoEl(id),
    /* TELA DE DESENHO DE VERDADE (o bastante).
     * Enquanto o canvas era um no mudo, "desenhei e apareceu" era
     * indemonstravel: o teste so podia olhar a lista de tracos, que e
     * exatamente a parte que nao quebra. Este contexto anota o que foi
     * pedido, entao da para exigir que a caneta vermelha pinte de
     * vermelho e que "limpar" limpe a tela, e nao so o vetor. */
    width: 300, height: 150,
    getContext(tipo) {
      if (tipo !== "2d") return null;
      if (!el._ctx) {
        const ops = [];
        el._ctx = {
          ops, strokeStyle: "", lineWidth: 0, lineCap: "", lineJoin: "",
          clearRect(...a2) { ops.push(["clear", ...a2]); },
          beginPath() { ops.push(["begin"]); },
          moveTo(x, y) { ops.push(["move", x, y]); },
          lineTo(x, y) { ops.push(["line", x, y]); },
          stroke() { ops.push(["stroke", el._ctx.strokeStyle, el._ctx.lineWidth]); },
        };
      }
      return el._ctx;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0,
      width: el.width || 300, height: el.height || 150 }),
    setPointerCapture() {}, releasePointerCapture() {},
  };
  /* innerHTML de verdade: escrever monta os nós filhos, como no navegador.
   * Antes só guardava a string, e "" zerava os filhos — meio caminho que
   * deixava querySelectorAll cego para tudo que o app desenha por HTML. */
  let html = "";
  Object.defineProperty(el, "innerHTML", {
    get: () => html,
    set: (v) => {
      html = v == null ? "" : String(v);
      el.children.length = 0;
      el._texto = "";
      if (html) interpretarHtml(html, novoEl).forEach((n) => el.children.push(n));
    },
  });
  return el;
}

/* Só devolve elemento para os ids que existem de verdade no index.html —
 * assim um $("idErrado") vira null e o app quebra aqui, não no usuário. */
function montarDocumento(html) {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

  /* O QUE O ELEMENTO JA E QUANDO A PAGINA ABRE.
   * Antes daqui todo elemento nascia em branco, e "hidden" no HTML nao
   * chegava ao teste: qualquer painel que devia comecar escondido
   * parecia certo mesmo se o codigo nunca o escondesse — e o contrario
   * tambem, um painel que o HTML deixa visivel passava por escondido.
   * Agora o estado inicial vem do HTML, como no navegador. */
  const iniciais = new Map();
  [...html.matchAll(/<([\w-]+)([^>]*\bid="([^"]+)"[^>]*)>/g)].forEach((m) => {
    const attrs = m[2], id = m[3];
    const o = { tag: m[1].toLowerCase() };
    [...attrs.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)]
      .forEach(([, k, v]) => {
        if (k === "id") return;
        if (["hidden", "open", "disabled", "checked", "readonly", "multiple"]
            .includes(k.toLowerCase())) o[k === "readonly" ? "readOnly" : k.toLowerCase()] = true;
        else if (k === "class") o.className = v || "";
        else if (["value", "placeholder", "type", "title"].includes(k)) o[k] = v || "";
      });
    if (!iniciais.has(id)) iniciais.set(id, o);
  });

  const cache = new Map();
  const pegar = (id) => {
    if (!cache.has(id)) {
      const el = novoEl(id, (iniciais.get(id) || {}).tag);
      const ini = iniciais.get(id);
      if (ini) Object.keys(ini).forEach((k) => { if (k !== "tag") el[k] = ini[k]; });
      cache.set(id, el);
    }
    return cache.get(id);
  };
  return {
    ids,
    doc: {
      getElementById: (id) => (ids.has(id) ? pegar(id) : null),
      createElement: (tag) => novoEl("<" + tag + ">", tag),
      /* createTextNode devolvia um nó VAZIO: todo texto acrescentado com
         document.createTextNode(...) sumia da leitura do teste. Foi assim
         que a marca de histórico na linha da agenda ficou invisível para o
         AD8, apesar de estar sendo desenhada. */
      createTextNode: (txt) => { const n = novoEl("#texto"); n.textContent = txt == null ? "" : String(txt); return n; },
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

/* DATA RELATIVA para os testes
 *
 * Havia 86 datas escritas à mão nos testes. As que servem de "estudei
 * recentemente" têm prazo de validade: "2026-08-14" era 6 dias atrás na
 * véspera e virou 7 no dia seguinte, caindo fora da janela de 7 dias — a
 * suíte ficou vermelha sozinha, sem ninguém mexer no aplicativo.
 * Pior: o contrário também acontece, e um teste pode ficar verde por a
 * data ter entrado na janela, não por o código estar certo.
 * Quem quer dizer "faz pouco tempo" usa isto. */
function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

let _adiados = null;

function rodar() {
  const html = fs.readFileSync(path.join(RAIZ, "docs", "index.html"), "utf8");
  const { doc, ids } = montarDocumento(html);
  const falhas = [];

  const janela = { __area: "" };
  Object.assign(janela, {
    document: doc,
    /* localStorage de verdade, em memória. Enquanto era um no-op, tudo que
     * depende de persistência passava no teste sem nunca ser exercido — e
     * agora backup, resumos e progresso do edital dependem dele. */
    localStorage: (() => {
      const loja = {};
      return {
        get length() { return Object.keys(loja).length; },
        key: (i) => Object.keys(loja)[i] || null,
        getItem: (k) => (k in loja ? loja[k] : null),
        setItem: (k, v) => { loja[k] = String(v); },
        removeItem: (k) => { delete loja[k]; },
        clear: () => { Object.keys(loja).forEach((k) => delete loja[k]); },
      };
    })(),
    navigator: {
      language: "pt-BR", userAgent: "node", platform: "node",
      // controlável pelos testes: janela.__area guarda o "conteúdo copiado"
      clipboard: {
        writeText: async (v) => { janela.__area = v; },
        readText: async () => janela.__area || "",
      },
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
    /* setTimeout do stub rodava SEMPRE na hora, e com isso "faz agora" e
     * "faz daqui a pouco" ficavam indistinguíveis: uma sabotagem que adiava
     * um redesenho passava despercebida. Agora dá para segurar as chamadas
     * adiadas e verificar o que acontece SEM elas. */
    setTimeout: (f, ms) => {
      if (_adiados) { _adiados.push(f); return _adiados.length; }
      try { if (typeof f === "function") f(); } catch (e) {}
      return 0;
    },
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
    /* console silenciado para não poluir a saída dos testes — mas com
     * DEBUG=1 ele passa direto, senão depurar o app daqui é impossível:
     * um console.log dentro do bundle simplesmente sumia. */
    console: process.env.DEBUG
      ? console
      : { log() {}, warn() {}, error() {}, info() {} },
  });
  janela.window = janela;
  janela.self = janela;

  const codigo = ARQUIVOS
    .map((f) => fs.readFileSync(path.join(RAIZ, "docs", f), "utf8")).join("\n;\n");
  const nomes = Object.keys(janela);
  // devolve o que os testes funcionais precisam manipular. Os "let" do app
  // viram getters/setters para o teste ver o estado ao vivo.
  const exportar = `return {
    $, preview, entrarRevisao, sairRevisao, chaveRev, chave,
    get revisados() { return revisados; },
    get ocultos() { return ocultosRevisao; },
    get modoRevisao() { return modoRevisao; },
    abrirPromptCorrecao, montarFixPrompt, limparConferencia, registroTexto, reg,
    atualizarContagemRevisao, recortarCartao, excluirCartao, colarRecortes,
    _uiFechar, uiEscolha, uiAlert, uiConfirm, uiEscolhaLimpar, parseText, matTirarMarca, matPorMarcador, matIrMarcador,
    matRepararChaves, matPintarMarcador,
    matModoAtual: () => matModo, matTrocarModo,
    matCartoesIniciar, matCartoesAbrir, matCartoesPrompt, matCartoesConferir,
    matCartoesSalvar, matCartoesVer, matEtiquetasTopico, matContarCartoes, parseAtual, gruposDuplicados, recortarDuplicados, renderRecortes,
    abrirFoco, fecharFoco, mostrarFoco, blocoMarcado, problemasNavegaveis,
    renderSugestoes, detectoresAtivos, resumoTexto, t, correcaoDeTudo,
    cartoesDependentes, MODOS, trocarModo, montarBarraModos, montarDiagnostico,
    lerEdital, priorizar, montarPlano, semanaAtual, semanasAte, edDetectores,
    temPesosIguais, ritmoDoPlano, agendar, edPintarRitmo,
    panoramaDisciplinas, lacunasCriticas, edMudarPeso, edTrocarVista, edPintarPainel, diagnosticoPlano,
    edConferirColagem, edAplicarColagem, edSimular, edMudarHoras, edMarcar,
    abrirDiario, apagarDoDiario, edDesfazerUltimoRegistro, edMostrarDesfazer, estatisticasDiario, edPorque,
    abrirRegistro, edDespedir, edMarcarLinhasSaindo,
    lojaLer: (k) => localStorage.getItem(k),
    edMarcarTeste: (i, e, d, sr) => edMarcar(i, e, d, sr),
    ultimaDespedida: () => edUltimaDespedida,
    /* segurarAdiados/soltarAdiados NÃO ficam aqui: este texto é avaliado
     * DENTRO do bundle, onde "_adiados" não existe. A atribuição criava uma
     * global solta no sandbox e o par nunca segurou nada — passava verde
     * sem adiar uma única chamada. Agora são presos lá embaixo, no escopo
     * do módulo, onde o setTimeout do stub de fato lê a fila. */
    confirmarRegistroTeste: (e) => confirmarRegistro(e),
    semanaAtualTeste: () => {
      const r = lerEdital($("editalTexto").value);
      const p = montarPlano(r, { horas: Number($("edHoras").value) || r.cfg.horas,
        prova: $("edProva").value, feitos: edProgresso });
      return semanaAtual(p);
    },
    abrirDiagPlano, abrirRegistro, confirmarRegistro, completarDiario,
    abrirDisciplina, edPintarRitmo, copiarPlano, verPlano, gerarPromptDoDiag,
    montarBackup, restaurarBackup, compararBackup, validarBackup, resumoAtual,
    matCarregar, matGravar, matTem, matChave, matResumo, matLista, matRender,
    matChaveViva, matChaveNormal,
    matObter, concursoAtual, matParaHtml, matAgrupado, matTrocarModo,
    matLimparColagem, matGravarCartoes, matContarCartoes, matAplicarColagem,
    matReg, matLogTexto, matLogAbrir, matLogLimpar, matLogCarregar,
    matAgrupado, matTiposDe, matAlternarLei, matRender,
    matLixoNosCartoes, matLimparLixoCartoes, matSelosDe,
    matNegritoQuebrado, matConsertarNegrito,
    matGravarDica, matDicaDe, matIncorporarDica, uiTexto, abrirModal,
    matGravarQuestao, matQuestaoDe, matIncorporarQuestao,
    matConsertarPlano, matConsertarLinha, matConsertarAbrir, matPintarConserto,
    matAlternarDicas, matLinhaTorta, matNegritoQuebrado, matConsertarNegrito,
    matEquilibrar, matTemConteudo, matLimitesDaLinha, matResolverDuvida,
    matLimparMarcas, matMarcasNoTexto,
    qsUiPintarConf,
    qsSemelhante, qsParecenca,
    qsUiRegistrarEstudo, regDeQuestoes,
    qsUiCartoesDaQuestao, qsPromptCartao, matCartoesLer,
    matCartoesPrompt, matCartoesAbrir,
    mcEstudarAbrir, mcEstudarDireto, mcCartoesSalvos, mcEstMostraAtual: () => mcEstMostra,
    qsUiVoltarASessao,
    qsAndar, qsSessaoAtual, qsJaRespondida,
    qsSessaoRetomavel, qsSessaoRetomar, qsSessaoAcrescentar, qsSessaoApagar,
    qsEmbaralharRestantes, qsPular, qsPendentes, qsSessaoLer,
    qsDefeitos, QS_DEFEITOS, qsSubstituir,
    qsUiMelhorarAbrir, qsUiMelhorarConferir, qsUiMelhorarAplicar,
    qsFiltroFalhas, qsFiltroFalhasLigado, qsQuantasFalhas, qsInteressaNoFiltro,
    regFormasAtual: () => regFormas,
    regDeLeitura, regSugerir, matRegistrarLeitura,
    regQuestoesDoFormulario, regPintarQuestoes, edItemDoPlano,
    ndAbrir, ndAplicarIA, ndLerRespostaIA, ndMontarPrompt, edExplicarCor,
    edProximoDa, faTirar, faVoltar, faDe, faEstaFora, faDispensados, faAdiados,
    faMinutosDispensados, faAbrir, faConfirmar, faListaAbrir, faMotivo,
    FA_MOTIVOS, FA_CHAVE, edEstaFora,
    /* a gaveta crua: alguns testes precisam simular o TEMPO passando
     * (um adiamento que vence), e nao ha como fazer isso pela porta da
     * frente sem esperar dias de verdade */
    loja: localStorage, hubPintarAgenda, faDispensadosDaSemana, hubFiltroDisciplina, hubDiscEscolhidas, hubDiscTudoOculto, hubDiscOcultas, hubEditaisNaVista,
    registroFiltrado, regDentroDoPeriodo, diagPintarPeriodos,
    regPeriodoPor: (p) => { regPeriodo = p; },
    qsUiRefazerPrompt, qsUiFonteAtual, qsUiEncerrarComPlacar,
    qsGravarDica, qsDicaDeQuestao,
    matDicasDoResumo, matDicasContar, matDicaSalvar, matNegritoNaCaixa,
    matMarcasDe, matContarMarcas, matDuvidas, matLinhaTorta, matConsertarPlano,
    matPainelMarcas, matPintarContadores, matTirarMarcaDe, matEditarMarca,
    matMenuDaMarca, matMarcaSobPonteiro, matTrocarCorDaMarca, matTirarMarca,
    matDicasListaAbrir, matPintarDicasLista, matDicaPrompt,
    matDicaLimparColagem,
    matSalvarDicasPendentes,
    matLogAlternarHoje, matLogDoDia, matLogFiltrado,
    matLerColagemFormatada, matHtmlParaMarcas, qsUiCaixaDica,
    edLinhaAgendaTeste: (i) => edLinhaTopico(i, false),
    matAlternarProva, matProvaBlocos, matProvaEstaLigada, matProvaResponder,
    matPintarProvaBotao, qsNoTexto, qsDeBlocos,
    qsUiIniciar, qsUiCriarAbrir, qsUiConferir, qsUiAplicar, qsUiRender,
    qsUiResponderAbrir, qsUiResponderDireto, qsUiPintarSessao, qsUiPintarBotaoResumo, qsUiVirarSelecao,
    qsUiSelecaoViva,
    rsIniciar, rsPrepararPara, rsRecolher, rsAberto, rsMesmaQuestao,
    rsComecar, rsMover, rsSoltar, rsApagarEm, rsDesfazer, rsLimpar,
    rsSalvarNaQuestao, rsApagarSalvo, rsGuardarSeSair, rsDaQuestao,
    rsQuantosSalvos, rsPintar, rsFerramenta, rsPrecisaPerguntar, RS_CANETAS,
    qsUiResponderDoTopico, qsUiDesfazer, qsUiLerFiltros,
    qsLerResposta, qsAplicar, qsFiltrar, qsTodas, qsCarregar, qsAtual, qsPlacar,
    qsContarPorChave, qsSessaoIniciar, qsResponder, qsPrompt, qsDesempenho,
    matTextoVivo, matAplicarTexto, matEditorAberto, matIrPara,
    matDuvidas, matResolverDuvida, matDuvidasAbrir, matPintarDuvidas,
    leiIniciar, leiAbrir, leiGravar, leiTem, leiFechar, leiRegistrarLeitura,
    leiTrocarModo, leiModoAtual: () => leiModo, leiSujoAtual: () => leiSujo,
    mcEstudoIniciar, mcEstudarAbrir, mcEstudarDireto, mcApontarTopico,
    mcEstAndar, mcApagarCartao, mcCartoesSalvos, mcEstPintar,
    mcEstIdxAtual: () => mcEstIdx, mcEstMostraAtual: () => mcEstMostra,
    matListaTeste: () => matLista(),
    matFiltroEditalTeste: (v) => { matFEdital = v; if (matFDisc) { matFDisc = ""; } matRender(); },
    matFiltroDiscTeste: (v) => { matFDisc = v; matRender(); },
    matFiltroDiscAtual: () => matFDisc,
    matFiltroTiposTeste: (a) => { matFTipos = a; matRender(); },
    matLogAtual: () => matLog,
    matHtmlParaMarcas, matMarcarSelecao, matLimparMarcas,
    guardarCartoesNoMaterial, abrirGerar,
    matRegistrarLeitura, matEnvolver,
    matAbrirEditor, matIniciar,
    bkIniciar, bkAbrirPainel, bkMostrarConferencia, atualizarSeloBase, idadeBase,
    get edDiario() { return edDiario; },
    registroTexto, faixaDe,
    edCorrecaoDeTudo, edRender, edIniciar, edParaTexto, horasTexto,
    /* hub dos editais (8.68): sem exportar, nada do modo novo e testavel */
    hubIniciar, hubRender, hubNovo, hubVoltar, hubRenomear, hubAbrirEdital,
    hubPintarLista, hubPintarAgenda, hubGravarAberto,
    hubPref, hubPrefGravar, bancAlternar, bancAplicar,
    /* H5 — busca, filtros e lote (8.72) */
    edLoteAplicar, edPintarLote,
    limparProgressoTeste: () => { edProgresso = {}; edSalvar(); },
    trocarVistaTeste: (v) => edTrocarVista(v),
    buscarTeste: (q) => { edBusca = q; edRender(); },
    filtroTeste: (k) => { edFiltro = k; edRender(); },
    selecionarTeste: (n) => {
      edSelecao.clear();
      const r = lerEdital($("editalTexto").value);
      let posto = 0;
      r.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
        if (posto++ < n) edSelecao.add((d.nome + "›" + tp.nome).toLowerCase());
      }));
      edPintarLote();
    },
    /* auditoria do registro (8.70) */
    t, editaisLista: () => editais, guardar, registroTexto,
    guardarCartoesNoMaterial,
    genOrigemTeste: (o) => { genOrigem = o; },
    validar, cmIniciarTela, cmAbrir, cmPintar, cmRecalcular, cmGravarTudo, cmTudoGeral,
    cmConferirColagem, cmAplicarColagem, cmGerarPrompt, CM_GERAL,
    cmUsarSugestoes, cmLimpar, cmDesfazerUltimo, cmParaGerais,
    cmItensAtuais: () => cmItens, cmPlanoAtual: () => cmPlano,
    matResumosAtual: () => matResumos,
    limparMaterialTeste: () => { Object.keys(matResumos).forEach((k) => delete matResumos[k]); },

    vkCarregar, vkEstudados, vkIdenticos, vkAplicar, vkHistorico, vkChave,
    vkAbrir, vkPintarTriagem, vkTodos, vkAplicarTriagem, vkGerarPrompt,
    vkConferirColagem, vkAplicarColagem, vkPendentesDoEdital,
    vkTriagemAtual: () => vkTriagem,
    diarioPor: (d) => { edDiario = d; },
    diarioAtual: () => edDiario, medirArmazenamento, falhasGravacaoLista: () => falhasGravacao,
    estadoArmazenTexto: () => estadoArmazen,
    hubRenomearTeste: (id, nome) => {
      const e = editais.find((x) => x.id === id);
      if (!e) return; const antes = e.nome; e.nome = nome; e.renomeado = true;
      edSalvarLista(); reg("EDITAL", "edital renomeado", antes + " → " + e.nome);
    },
    edMarcar, edProgressoAtual: () => edProgresso,
    /* material: marca-texto, rascunho e o fechar que pergunta (8.69) */
    matGravar, matObter, matAbrirEditor, matMarcarSelecao, matLembrarSelecao,
    matSalvarEstado, matFechar, matLimparMarcas, matMapear, matNormalizar,
    matEstaSujo: () => matSujo,
    matPorSelecao: (s) => { matSelGuardada = s; },
    matSelGuardadaTeste: () => matSelGuardada,
    matTextoAtual: () => $("matTexto").value,
    uiModalResponder: (v) => { if (_uiResolve) { const r = _uiResolve; _uiResolve = null; r(v); } },
    /* "esta perguntando alguma coisa agora?" — sem isto nao da para
     * exigir que uma acao NAO pergunte, so que ela pergunte. */
    uiPerguntando: () => !!_uiResolve,
    edJanela, edDataPlanejada, preComparar, preCarimbarDiario, preOrfaos,
    preAplicar, preConfiancaDe, preNaAgenda,
    vrIniciar, vrAbrir, vrConferir, vrAplicar, vrAtualizarBotao, vrEhPrevisto,
    vrOrfaosAtuais: () => vrOrfaos,
    preMaterialOrfao, preDestinos, preRemanejarMaterial, preRemanejarEstudo,
    edCarregarLista, edSalvarLista, edCriar, edApagar, edDuplicar,
    edAbrir, edAberto, edAgrupados, edSituacao, edUrgencia,
    get edProgresso() { return edProgresso; },
    montarPainelDiag, abrirDiagnostico, podarRegistro, pintarDiagnostico,
    get diagTexto() { return diagTexto; },
    get SESSAO() { return SESSAO; },
    get modoAtual() { return modoAtual; },
    guardarVersao, restaurarVersao, abrirHistorico, autoSalvar,
    get historico() { return historico; },
    get correcaoPendente() { return correcaoPendente; },
    get focoLista() { return focoLista; },
    get focoAtual() { return focoAtual; },
    get recortes() { return recortes; },
    get fixPendente() { return fixPendente; },
    get fixBlocos() { return fixBlocos; },
    get fixModo() { return fixModo; },
  };`;
  let api = null;
  try {
    api = new Function(...nomes, codigo + "\n" + exportar)(...nomes.map((n) => janela[n]));
  } catch (e) {
    falhas.push("o app não carregou: " + e.message);
    if (process.env.PILHA) console.log(e.stack);
  }
  if (api) {
    api.segurarAdiados = () => { _adiados = []; };
    api.soltarAdiados = () => {
      const fila = _adiados || []; _adiados = null;
      fila.forEach((fn) => { try { fn(); } catch (e) {} });
      return fila.length;
    };
    /* quantas chamadas estão presas agora — para um teste poder afirmar
     * que algo foi ADIADO, e não apenas que aconteceu */
    api.adiadosPresos = () => (_adiados ? _adiados.length : -1);
  }
  return { falhas, ids: ids.size, api, doc, janela };
}

/* o espelho de diasAtras: "daqui a N dias", para datas de prova */
function emDias(n) { return diasAtras(-n); }

module.exports = { rodar, diasAtras, emDias };

if (require.main === module) {
  const r = rodar();
  r.falhas.forEach((f) => console.log("  FALHA  " + f));
  console.log(r.falhas.length
    ? "\nfumaça: FALHOU\n"
    : `\nfumaça: o app carrega sem erro (${r.ids} ids no HTML)\n`);
  process.exit(r.falhas.length ? 1 : 0);
}
