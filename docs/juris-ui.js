/* =====================================================================
 * A TELA DA JURISPRUDÊNCIA
 *
 * Uma gaveta por tópico, aberta dos três lugares em que se decide o que
 * estudar: a agenda da semana, o material e o próprio resumo.
 *
 * O gesto que ela existe para servir é um só e é curto: você está lendo
 * o resumo, encontra a frase que o tribunal decidiu, seleciona e guarda.
 * Tudo o mais — colar a ementa inteira, preencher tribunal e número —
 * é para quem está montando o material antes de estudar.
 * ===================================================================== */

let jurTopicoAtual = null;      /* {disciplina, nome, chave} */
let jurEditando = "";           /* id em edição, "" para novo */

function jurAbrir(disciplina, topico) {
  const chave = (typeof matChave === "function")
    ? matChave(disciplina, topico) : (disciplina + "›" + topico);
  jurTopicoAtual = { disciplina, nome: topico, chave };
  jurEditando = "";
  const sub = $("jurSub");
  if (sub) sub.textContent = t("jur_sub", { d: disciplina, t: topico });
  jurLimparForm();
  jurPintarLista();
  abrirModal("dlgJuris");
  reg("JURIS", "gaveta aberta", disciplina + " › " + topico);
}

function jurLimparForm() {
  ["jurColar", "jurTese", "jurTribunal", "jurClasse", "jurNumero",
   "jurData", "jurOrgao", "jurFonte"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  jurEditando = "";
  const av = $("jurColarAviso");
  if (av) { av.hidden = true; av.textContent = ""; }
  jurBotaoSalvar();
}

function jurBotaoSalvar() {
  const b = $("btnJurSalvar");
  if (b) b.textContent = t(jurEditando ? "jur_salvar_edicao" : "jur_salvar");
}

/* ------------------------------------------------------------------
 * COLAR COM FORMATAÇÃO
 *
 * O bloco cru do sítio do tribunal entra numa caixa e sai nos campos.
 * O que o app reconheceu fica ESCRITO na tela antes de qualquer coisa
 * ser salva — extrair em silêncio e mostrar formulário preenchido faria
 * a pessoa confiar num palpite sem saber que houve palpite.
 * ------------------------------------------------------------------ */
function jurColar() {
  const bruto = String(($("jurColar") || {}).value || "");
  if (!bruto.trim()) { jurReagirBtn("btnJurColar", t("jur_colar_vazio")); return; }
  const a = jurIdentificar(bruto);
  const põe = (id, v) => { if ($(id) && v) $(id).value = v; };
  põe("jurTribunal", a.tribunal);
  põe("jurClasse", a.classe);
  põe("jurNumero", a.numero);
  põe("jurData", a.data);
  põe("jurOrgao", a.orgao);
  /* a tese só é sugerida quando o campo está vazio: quem já escreveu a
   * sua não pode perdê-la para um palpite */
  if ($("jurTese") && !$("jurTese").value.trim() && a.tese) {
    $("jurTese").value = a.tese;
  }

  const achou = ["tribunal", "classe", "numero", "data", "orgao"]
    .filter((k) => a[k]);
  const av = $("jurColarAviso");
  if (av) {
    av.hidden = false;
    av.className = "ed-mud" + (achou.length ? "" : " aviso");
    av.textContent = achou.length
      ? t("jur_colou_achou", { n: achou.length,
          c: achou.map((k) => t("jur_c_" + k)).join(", ") })
      : t("jur_colou_nada");
  }
  reg("JURIS", "ementa colada",
      achou.length + " campos reconhecidos de " + bruto.length + " caracteres");
  jurReagirBtn("btnJurColar", t("jur_colou_btn", { n: achou.length }));
}

/* a mesma reação curta dos outros botões do app */
function jurReagirBtn(id, txt) {
  if (typeof vkReagir === "function") vkReagir($(id), txt);
}

async function jurSalvar() {
  if (!jurTopicoAtual) return;
  const v = (id) => String(($(id) || {}).value || "").trim();
  const tese = v("jurTese");
  const texto = v("jurColar");
  /* SEM TESE E SEM TEXTO não há o que guardar. Um julgado só com o
   * número é uma etiqueta que não se revisa. */
  if (!tese && !texto) { await uiAlert(t("jur_falta")); return; }

  const j = jurGravar({
    id: jurEditando || undefined,
    tribunal: v("jurTribunal"), classe: v("jurClasse"),
    numero: v("jurNumero"), data: v("jurData"), orgao: v("jurOrgao"),
    fonte: v("jurFonte"), tese, texto,
    topicos: jurEditando ? undefined : [jurTopicoAtual.chave],
  });
  if (!j) { await uiAlert(t("jur_nao_salvou")); return; }
  if (jurEditando) jurLigar(j.id, jurTopicoAtual.chave);

  reg("JURIS", jurEditando ? "julgado editado" : "julgado guardado",
      jurTitulo(j) + " · " + jurTopicoAtual.nome);
  jurLimparForm();
  jurPintarLista();
  jurRepintarTelas();
  jurReagirBtn("btnJurSalvar", t("jur_salvou"));
}

/* Depois de guardar, a agenda e o material precisam mostrar o selo novo
 * — senão o julgado existe e não aparece em lugar nenhum até um F5. */
function jurRepintarTelas() {
  try { if (typeof edRender === "function") edRender(); } catch (e) {}
  try { if (typeof matRender === "function") matRender(); } catch (e) {}
  try { if (typeof hubPintarAgenda === "function") hubPintarAgenda(); } catch (e) {}
}

function jurEditar(id) {
  const j = jurDe(id);
  if (!j) return;
  jurEditando = id;
  const põe = (idc, v) => { if ($(idc)) $(idc).value = v || ""; };
  põe("jurTribunal", j.tribunal); põe("jurClasse", j.classe);
  põe("jurNumero", j.numero); põe("jurData", j.data);
  põe("jurOrgao", j.orgao); põe("jurFonte", j.fonte);
  põe("jurTese", j.tese); põe("jurColar", j.texto);
  jurBotaoSalvar();
  if ($("jurTese") && $("jurTese").focus) $("jurTese").focus();
}

async function jurTirar(id) {
  if (!jurTopicoAtual) return;
  const j = jurDe(id);
  /* DESLIGAR NÃO É APAGAR, e a diferença precisa estar na pergunta: o
   * mesmo julgado costuma servir a meia dúzia de tópicos. */
  const outros = ((j && j.topicos) || []).length - 1;
  if (!(await uiConfirm(t(outros > 0 ? "jur_tirar_conf_varios"
                                     : "jur_tirar_conf"),
        { t: jurTitulo(j), n: outros }))) return;
  jurDesligar(id, jurTopicoAtual.chave);
  reg("JURIS", "julgado desligado do topico",
      jurTitulo(j) + " · " + jurTopicoAtual.nome);
  jurPintarLista();
  jurRepintarTelas();
}

function jurPintarLista() {
  const box = $("jurLista");
  if (!box || !jurTopicoAtual) return;
  box.innerHTML = "";
  const lista = jurDoTopico(jurTopicoAtual.chave);
  const conta = $("jurConta");
  if (conta) {
    conta.textContent = lista.length
      ? t("jur_conta", { n: lista.length }) : t("jur_conta_zero");
  }
  if (!lista.length) return;

  lista.forEach((j) => {
    const li = document.createElement("div");
    li.className = "jur-item";

    const cab = document.createElement("div");
    cab.className = "jur-cab";
    const tit = document.createElement("b");
    tit.textContent = jurTitulo(j);
    cab.append(tit);
    if (j.data) {
      const d = document.createElement("span");
      d.className = "jur-data";
      d.textContent = String(j.data).split("-").reverse().join("/");
      cab.append(d);
    }
    if (j.orgao) {
      const o = document.createElement("span");
      o.className = "jur-orgao";
      o.textContent = j.orgao;
      cab.append(o);
    }
    li.append(cab);

    if (j.tese) {
      const p = document.createElement("div");
      p.className = "jur-tese";
      p.textContent = j.tese;
      li.append(p);
    }

    /* EM QUANTOS TÓPICOS ELE ESTÁ. É o que impede o susto de "tirei
     * daqui e sumiu de lá também" — e mostra que a mesma tese está
     * fazendo trabalho em mais de um lugar. */
    const n = (j.topicos || []).length;
    if (n > 1) {
      const em = document.createElement("div");
      em.className = "jur-em";
      em.textContent = t("jur_em_varios", { n });
      li.append(em);
    }

    const acoes = document.createElement("div");
    acoes.className = "jur-acoes";
    const bt = (rot, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn-min" + (cls ? " " + cls : "");
      b.textContent = rot;
      b.onclick = fn;
      acoes.append(b);
      return b;
    };
    bt(t("jur_editar"), "", () => jurEditar(j.id));
    bt(t("jur_copiar"), "", async () => {
      const ok = await edColarCopiarTexto(jurTexto([j]), "", null);
      jurReagirBtn(null, "");
      if (ok) toast("toast_copied");
    });
    bt(t("jur_tirar"), "btn-min-perigo", () => jurTirar(j.id));
    li.append(acoes);
    box.append(li);
  });
}

/* ------------------------------------------------------------------
 * DO RESUMO, COM O TEXTO SELECIONADO
 *
 * O gesto principal: lendo o resumo, você encontra a frase que o
 * tribunal decidiu, seleciona e guarda como tese. Sem isso, guardar
 * jurisprudência exigiria sair da leitura, abrir outra tela e redigitar
 * — e ninguém faz isso no meio de um estudo.
 * ------------------------------------------------------------------ */
function jurDaSelecao() {
  if (typeof matLembrarSelecao === "function") matLembrarSelecao("matLeitura");
  /* O TÓPICO É O QUE ESTÁ ABERTO NO EDITOR, e a seleção é a que o
   * material acabou de guardar. Os dois já existem — reimplementá-los
   * aqui criaria uma segunda leitura da mesma coisa, que é como as
   * divergências nascem. */
  const trecho = (typeof matSelGuardadaAtual === "function")
    ? matSelGuardadaAtual() : "";
  const alvo = (typeof matAtualAtual === "function") ? matAtualAtual() : null;
  if (!alvo || !alvo.disciplina) { uiAlert(t("jur_sem_topico")); return; }
  jurAbrir(alvo.disciplina, alvo.topico || alvo.nome);
  if (trecho && $("jurTese")) {
    $("jurTese").value = trecho;
    const av = $("jurColarAviso");
    if (av) {
      av.hidden = false;
      av.className = "ed-mud";
      av.textContent = t("jur_da_selecao", { n: trecho.length });
    }
  }
}

function jurIniciarTela() {
  const liga = (id, fn) => { if ($(id)) $(id).onclick = fn; };
  liga("btnJurColar", jurColar);
  liga("btnJurSalvar", jurSalvar);
  liga("btnJurLimpar", () => {
    jurLimparForm();
    jurReagirBtn("btnJurLimpar", t("jur_limpou"));
  });
  liga("btnJurFechar", () => $("dlgJuris").close());
  liga("btnJurFecharTopo", () => $("dlgJuris").close());
  liga("btnMatJuris", jurDaSelecao);
}
