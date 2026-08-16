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
  return !!(r && String(r.texto || "").trim());
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
function matResumo() {
  const ks = Object.keys(matResumos);
  const chars = ks.reduce((a, k) => a + String(matResumos[k].texto || "").length, 0);
  const discs = new Set(ks.map((k) => (matResumos[k].disciplina || "").trim()).filter(Boolean));
  const ccs = new Set(ks.map((k) => (matResumos[k].concurso || "").trim()).filter(Boolean));
  return { total: ks.length, caracteres: chars, disciplinas: discs.size,
           concursos: ccs.size };
}

/* Lista para a aba, agrupada por disciplina e ordenada pelo que foi mexido
 * por último — quem abre o Material quer continuar de onde parou. */
function matLista() {
  return Object.keys(matResumos).map((k) => Object.assign({ chave: k }, matResumos[k]))
    .sort((a, b) => String(b.tocado || "").localeCompare(String(a.tocado || "")));
}

/* =====================================================================
 * A TELA
 * ===================================================================== */

function matAbrirEditor(item) {
  matAtual = { chave: matChave(item.disciplina, item.nome),
               disciplina: item.disciplina, topico: item.nome };
  const r = matObter(matAtual.chave);
  $("matTitulo").textContent = item.nome;
  $("matSub").textContent = item.disciplina
    + (r ? " · " + t("mat_tocado", { d: new Date(r.tocado).toLocaleDateString() })
         : " · " + t("mat_novo"));
  $("matTexto").value = (r && r.texto) || "";
  $("btnMatCartoes").hidden = !r;
  $("dlgMaterial").showModal();
  $("matTexto").focus();
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
  abrirGerar(matAtual.topico + "\n\n" + txt + "\n\n[tags sugeridas: " + etiqueta + "]");
  reg("MATERIAL", "resumo virou prompt de cartões", matAtual.topico);
  matAtual = null;
}

function matRender() {
  const box = $("matLista");
  if (!box) return;
  box.innerHTML = "";
  const r = matResumo();
  $("matContagem").textContent = r.total
    ? t("mat_contagem", { n: r.total, d: r.disciplinas,
        c: Math.round(r.caracteres / 1000) })
    : t("mat_vazio_curto");
  const lista = matLista();
  if (!lista.length) {
    const p = document.createElement("div");
    p.className = "esq-vazio";
    p.textContent = t("mat_vazio");
    box.append(p);
    return;
  }
  lista.forEach((x) => {
    const li = document.createElement("div");
    li.className = "mat-item";
    const esq = document.createElement("div");
    esq.className = "mat-item-txt";
    const nm = document.createElement("div");
    nm.className = "mat-nome"; nm.textContent = x.topico || x.chave;
    const sub = document.createElement("div");
    sub.className = "mat-sub";
    sub.textContent = (x.disciplina || "") + " · "
      + t("mat_tamanho", { c: String(x.texto || "").length })
      + " · " + new Date(x.tocado).toLocaleDateString()
      + (x.concurso ? " · " + x.concurso : "");
    esq.append(nm, sub);
    const bt = botaoMini("mat_abrir", "btn-cinza",
      () => matAbrirEditor({ disciplina: x.disciplina, nome: x.topico }));
    li.append(esq, bt);
    box.append(li);
  });
}

function matIniciar() {
  matCarregar();
  if (!$("matTexto")) return;
  $("btnMatSalvar").onclick = matGravarEditor;
  $("btnMatCartoes").onclick = matVirarCartoes;
  $("btnMatFechar").onclick = () => { $("dlgMaterial").close(); matAtual = null; };
  matRender();
}
