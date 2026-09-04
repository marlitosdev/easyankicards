/* =====================================================================
 * A TELA DO BACKUP
 * Regra que orienta tudo aqui: o usuário nunca deve descobrir o que
 * aconteceu DEPOIS. Cada botão diz o que vai fazer, cada restauração
 * mostra os números dos dois lados, e a data da base fica visível o tempo
 * todo — porque abrir o app num aparelho onde os dados são de três
 * semanas atrás e não perceber é o pior desfecho possível.
 * ===================================================================== */

let bkPendente = null;      /* backup carregado, à espera de confirmação */
let bkPasta = null;         /* handle da pasta escolhida (File System Access) */

function bkMarcarSalvo(onde) {
  try {
    localStorage.setItem("eac_backup_em", new Date().toISOString());
    localStorage.setItem("eac_backup_onde", onde || "");
  } catch (e) {}
  atualizarSeloBase();
}

/* O selo fica no rodapé, sempre visível: "base de hoje" ou "base de 12/08 —
 * há 4 dias". Verde até 7 dias, âmbar até 21, vermelho depois. */
function atualizarSeloBase() {
  const el = $("seloBase");
  if (!el) return;
  bkSemearData();
  const i = idadeBase();
  el.className = "selo-base";
  if (!i) {
    el.textContent = t("bk_selo_nunca");
    el.classList.add("sb-alerta");
  } else {
    const d = new Date(i.quando);
    el.textContent = t("bk_selo", { d: d.toLocaleDateString(), n: i.dias });
    el.classList.add(i.dias <= 7 ? "sb-ok" : (i.dias <= 21 ? "sb-aviso" : "sb-alerta"));
  }
}

/* Quem já usava o app antes do backup existir não tem "eac_backup_em", e o
 * selo dizia "nunca" mesmo com meses de trabalho guardado. A data mais
 * recente em que algo foi tocado responde melhor que "nunca": não é a data
 * de um backup, é a idade dos dados — que é o que o selo quer informar. */
function bkSemearData() {
  try {
    if (localStorage.getItem("eac_backup_em")) return;
    let maisNovo = "";
    const olha = (v) => { if (v && v > maisNovo) maisNovo = v; };
    try {
      (JSON.parse(localStorage.getItem("eac_editais") || "[]") || [])
        .forEach((e) => { olha(e.tocado); olha(e.criado); });
    } catch (x) {}
    try {
      const mat = JSON.parse(localStorage.getItem("eac_resumos") || "{}") || {};
      Object.keys(mat).forEach((k) => olha(mat[k] && mat[k].tocado));
    } catch (x) {}
    if (!maisNovo) return;
    localStorage.setItem("eac_backup_em", maisNovo);
    localStorage.setItem("eac_backup_onde", t("bk_onde_local"));
    reg("BACKUP", "idade da base deduzida dos dados", maisNovo.slice(0, 10));
  } catch (e) {}
}

function bkTextoJson() { return JSON.stringify(montarBackup(), null, 1); }

/* ---------- guardar ---------- */

async function bkSalvarNaNuvem() {
  const json = bkTextoJson();
  const nome = nomeArquivoBackup();

  /* Celular: a folha de compartilhamento do sistema já lista Drive, OneDrive,
   * Dropbox e o que mais estiver instalado. Nenhuma credencial, nenhuma conta,
   * e funciona com a nuvem que a pessoa já usa. */
  try {
    const arq = new File([json], nome, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [arq] })) {
      await navigator.share({ files: [arq], title: "Backup EasyAnkiCards" });
      bkMarcarSalvo("compartilhado");
      reg("BACKUP", "compartilhado pelo sistema", nome);
      return;
    }
  } catch (e) { if (e && e.name === "AbortError") return; }

  /* Computador: escolher UMA vez a pasta do Drive/OneDrive. O programa de
   * sincronização da nuvem faz o resto, e faz melhor do que eu faria. */
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: nome,
        types: [{ description: "Backup EasyAnkiCards",
                  accept: { "application/json": [".json"] } }],
      });
      const w = await h.createWritable();   /* grava em temporário */
      await w.write(json);
      await w.close();                      /* e só aqui troca pelo bom */
      bkPasta = h;
      bkMarcarSalvo(h.name || "pasta");
      reg("BACKUP", "gravado na pasta", h.name || nome);
      uiAlert(t("bk_salvo_pasta", { n: h.name || nome }));
      return;
    } catch (e) { if (e && e.name === "AbortError") return; }
  }

  bkBaixar();
}

function bkBaixar() {
  const json = bkTextoJson();
  const nome = nomeArquivoBackup();
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  bkMarcarSalvo("download");
  reg("BACKUP", "baixado", nome);
  uiAlert(t("bk_baixado", { n: nome }));
}

/* ---------- carregar ---------- */

function bkAbrirArquivo() { $("bkArquivo").click(); }

async function bkLerArquivo(file) {
  if (!file) return;
  let obj = null;
  try { obj = JSON.parse(await file.text()); }
  catch (e) { uiAlert(t("bk_erro_json")); return; }
  const erro = validarBackup(obj);
  if (erro) { uiAlert(t("bk_erro_valido", { e: erro })); return; }
  bkPendente = obj;
  bkMostrarConferencia(file.name);
}

/* O passo que não pode faltar: mostrar, item por item, o que o app tem AGORA
 * e o que o backup traz — e destacar em vermelho o que vai encolher. */
function bkMostrarConferencia(nomeArq) {
  const cmp = compararBackup(bkPendente);
  const g = new Date(bkPendente.gerado || Date.now());
  $("bkConfArquivo").textContent = t("bk_conf_arquivo", {
    n: nomeArq, d: g.toLocaleString(), v: bkPendente.versao_app || "?" });

  const tb = $("bkConfTabela");
  tb.innerHTML = "";
  cmp.linhas.forEach((l) => {
    const tr = document.createElement("tr");
    if (l.perde) tr.className = "bk-perde";
    const td = (txt, cls) => {
      const c = document.createElement("td");
      c.textContent = txt; if (cls) c.className = cls; return c;
    };
    tr.append(td(l.rotulo), td(String(l.agora), "bk-num"),
              td(String(l.backup), "bk-num"),
              td(l.perde ? t("bk_dif_perde", { n: l.agora - l.backup })
                 : (l.ganha ? t("bk_dif_ganha", { n: l.backup - l.agora })
                            : t("bk_dif_igual")), "bk-dif"));
    tb.append(tr);
  });

  const av = $("bkConfAviso");
  av.className = "bk-aviso " + (cmp.perdeAlgo ? "grave" : "ok");
  av.textContent = cmp.perdeAlgo ? t("bk_conf_perde") : t("bk_conf_seguro");
  abrirModal("dlgBkConf");
}

async function bkConfirmarRestauro() {
  if (!bkPendente) return;
  const cmp = compararBackup(bkPendente);
  if (cmp.perdeAlgo && !(await uiConfirm(t("bk_conf_confirma")))) return;
  /* o estado atual vira uma versão no histórico ANTES de qualquer troca:
   * restaurar o backup errado não pode ser o fim da linha */
  try { guardarVersao("antes de restaurar backup"); } catch (e) {}
  try {
    const gerado = bkPendente.gerado;
    const n = restaurarBackup(bkPendente);
    /* A DATA DA BASE VEM DO ARQUIVO.
     * "eac_backup_em" só era escrito ao SALVAR. Quem restaurava uma base
     * num aparelho novo via "sem base" logo depois de carregar uma — e o
     * selo existe justamente para dizer de quando é o que está ali. O
     * arquivo carrega a hora em que foi gerado ("gerado"), e essa é a
     * resposta certa: a base é daquele momento, não de agora. */
    try {
      localStorage.setItem("eac_backup_em", gerado || new Date().toISOString());
      localStorage.setItem("eac_backup_onde", t("bk_onde_arquivo"));
    } catch (x) {}
    reg("BACKUP", "restaurado", n + " chaves, de " + (gerado || "?"));
    bkPendente = null;
    $("dlgBkConf").close();
    await uiAlert(t("bk_restaurado"));
    location.reload();     /* recarregar é o jeito honesto: tudo relê do zero */
  } catch (e) {
    uiAlert(t("bk_erro_restaurar", { e: e.message }));
  }
}

function bkAbrirPainel() {
  const r = resumoAtual();
  $("bkAgora").textContent = t("bk_agora", {
    c: r.cartoes, d: r.disciplinas, t: r.topicos, p: r.progresso,
    di: r.diario, re: r.resumos });
  const i = idadeBase();
  $("bkUltimo").textContent = i
    ? t("bk_ultimo", { d: new Date(i.quando).toLocaleString(), n: i.dias,
        o: localStorage.getItem("eac_backup_onde") || "?" })
    : t("bk_ultimo_nunca");
  abrirModal("dlgBackup");
}

function bkIniciar() {
  const b = $("btnBackup");
  if (!b) return;
  b.onclick = bkAbrirPainel;
  $("btnBkSalvarNuvem").onclick = bkSalvarNaNuvem;
  $("btnBkBaixar").onclick = bkBaixar;
  $("btnBkCarregar").onclick = bkAbrirArquivo;
  $("btnBkFechar").onclick = () => $("dlgBackup").close();
  $("bkArquivo").onchange = (e) => bkLerArquivo(e.target.files && e.target.files[0]);
  $("btnBkConfAplicar").onclick = bkConfirmarRestauro;
  $("btnBkConfCancelar").onclick = () => { bkPendente = null; $("dlgBkConf").close(); };
  dicaLigar("btnSeloAjuda", "bk_selo_ajuda");
  atualizarSeloBase();
}
