/* =====================================================================
 * MATERIAL DE ESTUDO
 * O terceiro modo deixa de ser esqueleto. Ele guarda o CONTEÚDO de cada
 * tópico do edital, indexado pela MESMA chave do progresso — sem tabela de
 * ligação, sem id novo: se a chave serve para dizer "estudei isto", serve
 * para dizer "e o que eu estudei foi isto aqui".
 *
 * O ciclo que isso fecha:
 *   edital decide o assunto → material guarda o conteúdo → cartões fixam
 * ===================================================================== */

let matResumos = {};
let matAtual = null;      /* chave em edição */

function matCarregar() {
  try { matResumos = JSON.parse(localStorage.getItem("eac_resumos") || "{}"); }
  catch (e) { matResumos = {}; }
  if (!matResumos || typeof matResumos !== "object") matResumos = {};
}

function matSalvar() {
  try { localStorage.setItem("eac_resumos", JSON.stringify(matResumos)); }
  catch (e) {}
}

function matChave(disciplina, topico) {
  return (disciplina + "›" + topico).toLowerCase();
}

function matTem(chave) {
  const r = matResumos[chave];
  return !!(r && (String(r.texto || "").trim() || String(r.cartoes || "").trim()));
}

function matObter(chave) { return matResumos[chave] || null; }

function matGravar(chave, texto, meta) {
  const limpo = String(texto || "").trim();
  if (!limpo) { delete matResumos[chave]; matSalvar(); return null; }
  const antigo = matResumos[chave] || {};
  matResumos[chave] = {
    texto: limpo,
    disciplina: (meta && meta.disciplina) || antigo.disciplina || "",
    topico: (meta && meta.topico) || antigo.topico || "",
    /* de qual concurso este material nasceu. Um resumo de Direito Financeiro
     * escrito para o TCE-PE serve para o TCU — mas só dá para dizer isso
     * depois se a origem tiver sido gravada na hora. */
    concurso: (meta && meta.concurso) || antigo.concurso
      || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
    criado: antigo.criado || new Date().toISOString(),
    tocado: new Date().toISOString(),
  };
  matSalvar();
  return matResumos[chave];
}

/* Estatísticas para o cabeçalho do modo e para o backup. */
/* Os cartões gerados a partir do tópico ficam guardados JUNTO do resumo: o
 * material de um assunto é o texto mais as perguntas que ele gerou. Campo
 * próprio, não emendado no texto, para poder voltar à bancada intacto. */
function matGravarCartoes(chave, texto, meta) {
  const limpo = String(texto || "").trim();
  const antigo = matResumos[chave] || {};
  matResumos[chave] = Object.assign({}, antigo, {
    texto: antigo.texto || "",
    cartoes: limpo,
    disciplina: (meta && meta.disciplina) || antigo.disciplina || "",
    topico: (meta && meta.topico) || antigo.topico || "",
    concurso: (meta && meta.concurso) || antigo.concurso
      || (typeof concursoAtual === "function" ? concursoAtual().nome : ""),
    criado: antigo.criado || new Date().toISOString(),
    tocado: new Date().toISOString(),
  });
  matSalvar();
  return matResumos[chave];
}

function matContarCartoes(chave) {
  const r = matResumos[chave];
  if (!r || !r.cartoes) return 0;
  return (r.cartoes.match(/^[^\n#@+].*::/gm) || []).length;
}

function matResumo() {
  const ks = Object.keys(matResumos);
  const chars = ks.reduce((a, k) => a + String(matResumos[k].texto || "").length, 0);
  const discs = new Set(ks.map((k) => (matResumos[k].disciplina || "").trim()).filter(Boolean));
  const ccs = new Set(ks.map((k) => (matResumos[k].concurso || "").trim()).filter(Boolean));
  const cartoes = ks.reduce((a, k) => a + matContarCartoes(k), 0);
  return { total: ks.length, caracteres: chars, disciplinas: discs.size,
           concursos: ccs.size, cartoes };
}

/* Lista para a aba, agrupada por disciplina e ordenada pelo que foi mexido
 * por último — quem abre o Material quer continuar de onde parou. */
function matLista() {
  return Object.keys(matResumos).map((k) => Object.assign({ chave: k }, matResumos[k]))
    .sort((a, b) => String(b.tocado || "").localeCompare(String(a.tocado || "")));
}

/* ------------------------------------------------------------------
 * MARCAÇÃO LEVE
 * O texto guardado continua sendo TEXTO — nada de HTML no armazenamento.
 * A formatação são quatro marcas que a pessoa já conhece de qualquer editor,
 * e a conversão para HTML acontece só na hora de ler. Guardar HTML seria
 * amarrar o material ao navegador de hoje e abrir porta para o que for
 * colado de fora.
 * ------------------------------------------------------------------ */
function matEscapar(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------------
 * COLAGEM DE FORA (NotebookLM, Gemini, ChatGPT)
 *
 * O que vem de lá é markdown com hábitos próprios: três e quatro níveis de
 * título, bolinhas em vez de hífen, itálico com asterisco simples, e — a
 * marca registrada do NotebookLM — referências numeradas [1] [2, 3] no meio
 * das frases, que só fazem sentido dentro dele.
 *
 * Converter na colagem, e não na hora de exibir, é deliberado: o material
 * fica guardado no formato do app, legível e editável, em vez de carregar
 * para sempre a sintaxe de quem o gerou.
 * ------------------------------------------------------------------ */
function matLimparColagem(txt) {
  let s = String(txt || "").replace(/\r\n?/g, "\n");
  /* referências do NotebookLM: [1], [2, 3], [1-4] — fora do começo da linha,
   * para não comer uma lista escrita como "[1] Conceito" */
  s = s.replace(/(\S)\s*\[\d+(?:\s*[,\-–]\s*\d+)*\]/g, "$1");
  /* títulos de qualquer profundidade viram os dois níveis que o app tem */
  s = s.replace(/^\s*#{3,}\s+/gm, "## ");
  s = s.replace(/^\s*#\s+/gm, "# ");
  /* bolinhas e travessões de lista */
  s = s.replace(/^\s*[•‣▪◦·–—]\s+/gm, "- ");
  s = s.replace(/^\s*\*\s+/gm, "- ");
  /* itálico com asterisco simples vira o sublinhado do app, sem tocar no
     negrito: o passo anterior já removeu os "* " de lista */
  s = s.replace(/(^|[^*])\*([^*\n]{1,200})\*(?!\*)/g, "$1_$2_");
  /* negrito com sublinhado duplo (hábito de alguns modelos) */
  s = s.replace(/__([^_\n]{1,200})__/g, "**$1**");
  /* tabelas simples viram linhas legíveis, em vez de canos soltos */
  s = s.replace(/^\s*\|(.+)\|\s*$/gm, (l, meio) => {
    if (/^[\s|:-]+$/.test(meio)) return "";      /* linha separadora */
    return "- " + meio.split("|").map((c) => c.trim()).filter(Boolean).join(" — ");
  });
  s = s.replace(/[ \t]+$/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function matParaHtml(txt) {
  const linhas = matEscapar(txt).split(/\r?\n/);
  const saida = [];
  let emLista = false;
  const inline = (s) => s
    .replace(/\*\*([^*\n]{1,200})\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])_([^_\n]{1,200})_(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>")
    .replace(/==([^=\n]{1,200})==/g, "<mark>$1</mark>");
  linhas.forEach((l) => {
    const s = l.trim();
    const fecharLista = () => { if (emLista) { saida.push("</ul>"); emLista = false; } };
    if (/^##\s+/.test(s)) { fecharLista(); saida.push("<h4>" + inline(s.replace(/^##\s+/, "")) + "</h4>"); return; }
    if (/^#\s+/.test(s)) { fecharLista(); saida.push("<h3>" + inline(s.replace(/^#\s+/, "")) + "</h3>"); return; }
    if (/^[-*]\s+/.test(s)) {
      if (!emLista) { saida.push("<ul>"); emLista = true; }
      saida.push("<li>" + inline(s.replace(/^[-*]\s+/, "")) + "</li>");
      return;
    }
    /* lista numerada: chega em toda colagem de fora e virava parágrafo solto,
     * perdendo a ordem — que num resumo de etapas é a informação principal */
    if (/^\d+[.)]\s+/.test(s)) {
      fecharLista();
      saida.push("<div class='mat-num'><b>" + s.match(/^\d+/)[0] + ".</b> "
        + inline(s.replace(/^\d+[.)]\s+/, "")) + "</div>");
      return;
    }
    if (/^-{3,}$/.test(s)) { fecharLista(); saida.push("<hr>"); return; }
    if (!s) { fecharLista(); return; }
    fecharLista();
    saida.push("<p>" + inline(s) + "</p>");
  });
  if (emLista) saida.push("</ul>");
  return saida.join("\n");
}

/* Aplica a marca em volta da seleção. Se nada estiver selecionado, insere as
 * marcas e deixa o cursor no meio — quem clicou em "negrito" quer digitar em
 * negrito, não receber "****" e ter de se virar. */
function matEnvolver(ini, fim) {
  const ta = $("matTexto");
  const a = ta.selectionStart || 0, b = ta.selectionEnd || 0;
  const sel = ta.value.slice(a, b);
  ta.value = ta.value.slice(0, a) + ini + sel + (fim === undefined ? ini : fim)
    + ta.value.slice(b);
  const pos = a + ini.length + sel.length;
  ta.focus();
  ta.setSelectionRange(sel ? pos + (fim === undefined ? ini : fim).length : pos, 
                       sel ? pos + (fim === undefined ? ini : fim).length : pos);
}

function matPrefixo(marca) {
  const ta = $("matTexto");
  const a = ta.selectionStart || 0;
  const ini = ta.value.lastIndexOf("\n", a - 1) + 1;
  ta.value = ta.value.slice(0, ini) + marca + ta.value.slice(ini);
  ta.focus();
  ta.setSelectionRange(a + marca.length, a + marca.length);
}

/* =====================================================================
 * A TELA
 * ===================================================================== */

let matModo = "editar";       /* editar | ler */
let matFonte = 15;            /* px do modo leitura */
let matAmpliado = false;

function matAbrirEditor(item, comoLer) {
  matAtual = { chave: matChave(item.disciplina, item.nome),
               disciplina: item.disciplina, topico: item.nome };
  const r = matObter(matAtual.chave);
  $("matTitulo").textContent = item.nome;
  $("matSub").textContent = item.disciplina
    + (r ? " · " + t("mat_tocado", { d: new Date(r.tocado).toLocaleDateString() })
         : " · " + t("mat_novo"))
    + (r && r.concurso ? " · " + r.concurso : "");
  $("matTexto").value = (r && r.texto) || "";
  try {
    matFonte = Number(localStorage.getItem("eac_mat_fonte")) || 15;
    matAmpliado = localStorage.getItem("eac_mat_amplo") === "1";
  } catch (e) {}
  /* material que já existe abre para LER; material novo abre para escrever.
   * Quem clica num tópico que já tem resumo quer relê-lo, não editá-lo. */
  matTrocarModo(comoLer || (r ? "ler" : "editar"));
  $("dlgMaterial").showModal();
  if (matModo === "editar") $("matTexto").focus();
}

function matTrocarModo(modo) {
  matModo = modo;
  const lendo = modo === "ler";
  $("matTexto").hidden = lendo;
  $("matBarra").hidden = lendo;
  $("matLeitura").hidden = !lendo;
  $("matCtrlLeitura").hidden = !lendo;
  $("btnMatSalvar").hidden = lendo;
  $("btnMatLerReg").hidden = !lendo;
  $("btnMatModo").textContent = t(lendo ? "mat_modo_editar" : "mat_modo_ler");
  $("dlgMaterial").classList.toggle("mat-amplo", matAmpliado);
  if (lendo) {
    $("matLeitura").innerHTML = matParaHtml($("matTexto").value)
      || "<p class='nota'>" + t("mat_vazio_leitura") + "</p>";
    $("matLeitura").style.fontSize = matFonte + "px";
  }
}

function matFonteMudar(d) {
  matFonte = Math.max(12, Math.min(28, matFonte + d));
  $("matLeitura").style.fontSize = matFonte + "px";
  $("matFonteVal").textContent = matFonte + "px";
  try { localStorage.setItem("eac_mat_fonte", String(matFonte)); } catch (e) {}
}

function matAmpliar() {
  matAmpliado = !matAmpliado;
  $("dlgMaterial").classList.toggle("mat-amplo", matAmpliado);
  $("btnMatAmpliar").textContent = t(matAmpliado ? "mat_reduzir" : "mat_ampliar");
  try { localStorage.setItem("eac_mat_amplo", matAmpliado ? "1" : "0"); } catch (e) {}
}

/* Ler é estudar. Registrar a leitura fecha o buraco entre "tenho o material"
 * e "usei o material" — sem isto o resumo vira um arquivo morto que ninguém
 * sabe se foi aberto. O tempo sugerido vem do tamanho do texto: cerca de 200
 * palavras por minuto, com piso de 5 minutos. */
function matRegistrarLeitura() {
  if (!matAtual) return;
  const txt = $("matTexto").value;
  const palavras = (txt.match(/\S+/g) || []).length;
  const min = Math.max(5, Math.round(palavras / 200));
  const item = { disciplina: matAtual.disciplina, nome: matAtual.topico,
                 chave: matAtual.chave, minutos: min, bruto: 0 };
  if (typeof edMarcar === "function") {
    /* releitura de material é REVISÃO quando o tópico já foi estudado */
    const jaEstudado = typeof edProgresso !== "undefined"
      && edProgresso[matAtual.chave];
    edMarcar(item, jaEstudado ? "revisado" : "feito",
      { minutos: min, formas: ["resumo"], humor: "media" });
  }
  reg("MATERIAL", "leitura registrada: " + matAtual.topico,
      min + " min, " + palavras + " palavras");
  uiAlert(t("mat_lido", { n: min }));
}

/* Colar já limpo. Duas portas: a área de transferência (um clique) e uma
 * caixa para colar à mão, porque ler a área de transferência exige permissão
 * e no Firefox e no Safari ela simplesmente não existe. */
async function matColarDeFora() {
  let txt = "";
  try {
    if (navigator.clipboard && navigator.clipboard.readText)
      txt = await navigator.clipboard.readText();
  } catch (e) { txt = ""; }
  if (!txt) {
    /* sem acesso à área de transferência: pede para colar na caixa */
    $("matColarTexto").value = "";
    $("dlgMatColar").showModal();
    $("matColarTexto").focus();
    return;
  }
  matAplicarColagem(txt);
}

function matAplicarColagem(txt) {
  const limpo = matLimparColagem(txt);
  if (!limpo) { uiAlert(t("mat_colar_vazio")); return; }
  const ta = $("matTexto");
  const antes = ta.value.trim();
  ta.value = antes ? antes + "\n\n" + limpo : limpo;
  $("dlgMatColar").close();
  reg("MATERIAL", "colagem limpa", txt.length + " → " + limpo.length + " caracteres");
  uiAlert(t("mat_colado", { n: limpo.split(/\n/).length }));
}

function matGravarEditor() {
  if (!matAtual) return;
  matGravar(matAtual.chave, $("matTexto").value,
    { disciplina: matAtual.disciplina, topico: matAtual.topico });
  reg("MATERIAL", "resumo salvo: " + matAtual.topico,
      matAtual.disciplina + " · " + $("matTexto").value.length + " caracteres");
  $("dlgMaterial").close();
  matAtual = null;
  matRender();
  if (typeof edRender === "function") edRender();
}

/* O botão que fecha o ciclo: o resumo vira material do prompt de cartões,
 * já com a disciplina como etiqueta. Sem isto o resumo seria um depósito. */
function matVirarCartoes() {
  if (!matAtual) return;
  const txt = $("matTexto").value;
  matGravar(matAtual.chave, txt, { disciplina: matAtual.disciplina, topico: matAtual.topico });
  const etiqueta = matAtual.disciplina.toLowerCase().replace(/\s+/g, "_");
  $("dlgMaterial").close();
  trocarModo("cartoes");
  abrirGerar(matAtual.topico + "\n\n" + txt + "\n\n[tags sugeridas: " + etiqueta + "]",
    { disciplina: matAtual.disciplina, topico: matAtual.topico });
  reg("MATERIAL", "resumo virou prompt de cartões", matAtual.topico);
  matAtual = null;
}

/* Agrupa concurso → disciplina → tópico. Com dezenas de resumos de dois ou
 * três concursos, uma lista plana ordenada por data vira um monte: o usuário
 * sabe o que procura (a matéria), não quando escreveu. */
function matAgrupado(filtro) {
  const f = (filtro || "").trim().toLowerCase();
  const casa = (x) => !f || (x.topico + " " + x.disciplina + " "
    + (x.concurso || "") + " " + x.texto).toLowerCase().includes(f);
  const arv = new Map();
  matLista().filter(casa).forEach((x) => {
    const cc = x.concurso || "";
    if (!arv.has(cc)) arv.set(cc, new Map());
    const d = x.disciplina || "";
    if (!arv.get(cc).has(d)) arv.get(cc).set(d, []);
    arv.get(cc).get(d).push(x);
  });
  return arv;
}

let matFiltro = "";
let matFechados = {};

function matRender() {
  const box = $("matLista");
  if (!box) return;
  box.innerHTML = "";
  const r = matResumo();
  $("matContagem").textContent = r.total
    ? t("mat_contagem", { n: r.total, d: r.disciplinas,
        c: Math.round(r.caracteres / 1000) })
    : t("mat_vazio_curto");

  if (!r.total) {
    const p = document.createElement("div");
    p.className = "esq-vazio"; p.textContent = t("mat_vazio");
    box.append(p);
    return;
  }

  const arv = matAgrupado(matFiltro);
  let achou = 0;
  arv.forEach((discs, cc) => {
    const grupo = document.createElement("div");
    grupo.className = "mat-grupo";
    const cab = document.createElement("div");
    cab.className = "mat-cc";
    cab.textContent = cc || t("mat_sem_concurso");
    grupo.append(cab);

    discs.forEach((itens, disc) => {
      achou += itens.length;
      const bl = document.createElement("div");
      bl.className = "mat-disc";
      const chave = cc + "›" + disc;
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "mat-disc-cab";
      bt.textContent = (matFechados[chave] ? "▸ " : "▾ ") + (disc || "—")
        + "  (" + itens.length + ")";
      bt.onclick = () => { matFechados[chave] = !matFechados[chave]; matRender(); };
      bl.append(bt);
      if (!matFechados[chave]) {
        itens.forEach((x) => {
          const li = document.createElement("div");
          li.className = "mat-item";
          const esq = document.createElement("div");
          esq.className = "mat-item-txt";
          const nm = document.createElement("div");
          nm.className = "mat-nome"; nm.textContent = x.topico || x.chave;
          const sub = document.createElement("div");
          sub.className = "mat-sub";
          sub.textContent = t("mat_tamanho", { c: String(x.texto || "").length })
            + " · " + new Date(x.tocado).toLocaleDateString();
          esq.append(nm, sub);
          const ler = botaoMini("mat_abrir", "btn-cinza",
            () => matAbrirEditor({ disciplina: x.disciplina, nome: x.topico }, "ler"));
          li.append(esq, ler);
          bl.append(li);
        });
      }
      grupo.append(bl);
    });
    box.append(grupo);
  });

  if (!achou) {
    const p = document.createElement("div");
    p.className = "esq-vazio";
    p.textContent = t("mat_sem_resultado", { f: matFiltro });
    box.append(p);
  }
}

function matIniciar() {
  matCarregar();
  if (!$("matTexto")) return;
  $("btnMatSalvar").onclick = matGravarEditor;
  $("btnMatColar").onclick = matColarDeFora;
  $("btnMatColarOk").onclick = () => matAplicarColagem($("matColarTexto").value);
  $("btnMatColarFechar").onclick = () => $("dlgMatColar").close();
  $("btnMatModo").onclick = () => {
    if (matModo === "editar") matGravar(matAtual.chave, $("matTexto").value,
      { disciplina: matAtual.disciplina, topico: matAtual.topico });
    matTrocarModo(matModo === "editar" ? "ler" : "editar");
  };
  $("btnMatAmpliar").onclick = matAmpliar;
  $("btnMatMaior").onclick = () => matFonteMudar(1);
  $("btnMatMenor").onclick = () => matFonteMudar(-1);
  $("btnMatLerReg").onclick = matRegistrarLeitura;
  [["btnFmtB", () => matEnvolver("**")], ["btnFmtI", () => matEnvolver("_")],
   ["btnFmtM", () => matEnvolver("==")], ["btnFmtH", () => matPrefixo("## ")],
   ["btnFmtL", () => matPrefixo("- ")], ["btnFmtHr", () => matPrefixo("---\n")]]
    .forEach(([id, fn]) => { if ($(id)) $(id).onclick = fn; });
  $("btnMatCartoes").onclick = matVirarCartoes;
  $("btnMatFechar").onclick = () => { $("dlgMaterial").close(); matAtual = null; };
  if ($("matBusca")) {
    $("matBusca").addEventListener("input", () => {
      matFiltro = $("matBusca").value; matRender();
    });
  }
  matRender();
}
