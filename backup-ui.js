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

function bkMarcarSalvo(onde, nome) {
  const q = new Date().toISOString();
  try {
    localStorage.setItem("eac_backup_em", q);
    localStorage.setItem("eac_backup_onde", onde || "");
    localStorage.setItem("eac_backup_arq", nome || "");
  } catch (e) {}
  /* O NOME DO ARQUIVO É O QUE IDENTIFICA A CÓPIA. Ele traz hora e
   * minuto, e é o que aparece na pasta de downloads — sem ele, três
   * cópias do mesmo dia são indistinguíveis. */
  try { bkRegistrarCopia(onde, nome, q); } catch (e) {}
  atualizarSeloBase();
  /* O PAINEL AINDA ESTÁ ABERTO quando se salva. Sem repintar, a lista
   * de cópias fica sem a que acabou de ser feita — e a pessoa aperta de
   * novo achando que não funcionou. */
  try { bkPintarPainel(); } catch (e) {}
}

/* QUE HORAS ERAM, e não só que dia foi.
 *
 * "base de 04/09/2026 · há 0d" era a informação errada em dois sentidos:
 * a data sozinha não separa três cópias do mesmo dia, e "há 0d" ocupa
 * espaço para dizer "hoje" de um jeito que ninguém fala. */
function bkQuandoCurto(iso, dias) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  /* CALCULA O DIA AQUI, sem confiar no que veio de fora: "hoje" é uma
   * afirmação sobre o calendário, e quem chama pode passar uma idade em
   * horas — foi assim que uma cópia de ontem às 20:47 apareceu como
   * "hoje, 20:47" às 15:44. */
  const n = bkDiasDeCalendario(iso);
  if (n <= 0) return t("bk_quando_hoje", { h: hora });
  if (n === 1) return t("bk_quando_ontem", { h: hora });
  return t("bk_quando_antes", {
    d: d.toLocaleDateString([], { day: "2-digit", month: "2-digit" }),
    h: hora, n: n });
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
    el.textContent = t("bk_selo", { q: bkQuandoCurto(i.quando, i.dias) });
    /* O NOME DO ARQUIVO NO TÍTULO: é o que se compara com a pasta de
     * downloads quando há mais de uma cópia do mesmo dia. */
    const arq = localStorage.getItem("eac_backup_arq") || "";
    el.title = arq ? t("bk_selo_arq", { a: arq }) : t("bk_selo_ajuda_curta");
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

/* =====================================================================
 * O QUE ESTE NAVEGADOR SABE FAZER
 *
 * "Salvar na nuvem" e "Baixar arquivo" pareciam dois botões para a
 * mesma coisa — e às vezes ERAM. O primeiro tenta três caminhos em
 * ordem: a folha de compartilhamento do celular, o seletor de pasta do
 * computador, e — se nenhum dos dois existe — cai calado no download.
 * Num navegador sem esses recursos, os dois botões faziam exatamente a
 * mesma coisa sem nada na tela dizendo isso.
 *
 * Perguntar antes resolve: onde há só download, há um botão só.
 * ===================================================================== */
function bkPodeCompartilhar() {
  return !!(typeof navigator !== "undefined" && navigator.share
    && navigator.canShare);
}

function bkPodeEscolherPasta() {
  return !!(typeof window !== "undefined" && window.showSaveFilePicker);
}

function bkModoDeGuardar() {
  if (bkPodeCompartilhar()) return "compartilhar";
  if (bkPodeEscolherPasta()) return "pasta";
  return "download";
}

/* A pasta escolhida nesta sessão. Guardá-la evita reescolher a cada
 * cópia — e reescrever o MESMO arquivo é a melhor resposta para "salvei
 * três vezes hoje e não sei qual é qual": passa a haver um. */
function bkPastaNome() { return bkPasta ? (bkPasta.name || "") : ""; }

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
      bkMarcarSalvo("compartilhado", nome);
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
      bkMarcarSalvo("pasta", h.name || nome);
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
  bkMarcarSalvo("download", nome);
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

function bkPintarPainel() {
  const r = resumoAtual();
  if ($("bkAgora")) {
    $("bkAgora").textContent = t("bk_agora", {
      c: r.cartoes, d: r.disciplinas, t: r.topicos, p: r.progresso,
      di: r.diario, re: r.resumos });
  }
  const i = idadeBase();
  if ($("bkUltimo")) {
    /* COM HORA E COM O NOME DO ARQUIVO. A data por extenso já estava
     * aqui; o que faltava era o nome, que é o que se procura na pasta
     * de downloads quando há mais de uma cópia do mesmo dia. */
    const arq = localStorage.getItem("eac_backup_arq") || "";
    $("bkUltimo").textContent = i
      ? t(arq ? "bk_ultimo_arq" : "bk_ultimo", {
          d: bkQuandoCurto(i.quando, i.dias),
          o: t("bk_onde_" + (localStorage.getItem("eac_backup_onde") || "download")),
          a: arq })
      : t("bk_ultimo_nunca");
  }
  bkPintarHistorico();
  bkPintarBotoes();
}

/* ---------------------------------------------------------------------
 * AS ÚLTIMAS CÓPIAS
 *
 * A lista existe para uma pergunta só: "salvei três vezes hoje — a que
 * está carregada é qual?". A resposta é a linha marcada como ATUAL, e o
 * nome ao lado é o arquivo que se procura na pasta.
 * ------------------------------------------------------------------ */
function bkPintarHistorico() {
  const cx = $("bkHist");
  if (!cx) return;
  cx.innerHTML = "";
  const L = bkHistorico();
  const atual = localStorage.getItem("eac_backup_em") || "";
  cx.hidden = L.length < 2;
  if (cx.hidden) return;

  const tit = document.createElement("div");
  tit.className = "bk-rot";
  tit.textContent = t("bk_hist_rot");
  cx.append(tit);

  L.forEach((x) => {
    const li = document.createElement("div");
    li.className = "bk-hist-li" + (x.quando === atual ? " atual" : "");
    const d = new Date(x.quando);
    const quando = document.createElement("b");
    quando.textContent = d.toLocaleDateString([], { day: "2-digit", month: "2-digit" })
      + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    li.append(quando);
    const onde = document.createElement("span");
    onde.className = "bk-hist-onde";
    onde.textContent = t("bk_onde_" + (x.onde || "download"));
    li.append(onde);
    if (x.nome) {
      const nm = document.createElement("span");
      nm.className = "bk-hist-arq";
      nm.textContent = x.nome;
      li.append(nm);
    }
    if (x.quando === atual) {
      const selo = document.createElement("span");
      selo.className = "bk-hist-selo";
      selo.textContent = t("bk_hist_atual");
      li.append(selo);
    }
    cx.append(li);
  });
}

function bkAbrirPainel() {
  bkPintarPainel();
  abrirModal("dlgBackup");
}

/* Os botões dizem o que VAI acontecer, e o que não pode acontecer
 * simplesmente não aparece. */
function bkPintarBotoes() {
  const modo = bkModoDeGuardar();
  const bn = $("btnBkSalvarNuvem");
  const bb = $("btnBkBaixar");
  const exp = $("bkGuardarExp");
  const bre = $("btnBkRegravar");

  if (bn) {
    /* SÓ APARECE QUANDO FAZ ALGO DIFERENTE de baixar. */
    bn.hidden = modo === "download";
    bn.textContent = t(modo === "compartilhar" ? "bk_nuvem" : "bk_pasta");
  }
  if (bb) bb.textContent = t("bk_baixar");
  if (exp) exp.textContent = t("bk_guardar_exp_" + modo);
  if (bre) {
    /* REGRAVAR NA MESMA PASTA: existe só depois de haver uma pasta
     * escolhida, e some ao recarregar a página — o navegador não deixa
     * guardar a permissão sozinho. */
    const nome = bkPastaNome();
    bre.hidden = !nome;
    bre.textContent = t("bk_regravar", { n: nome });
  }
}

async function bkRegravar() {
  if (!bkPasta) return;
  try {
    const w = await bkPasta.createWritable();
    await w.write(bkTextoJson());
    await w.close();
    bkMarcarSalvo("pasta", bkPasta.name || "");
    bkPintarPainel();
    await uiAlert(t("bk_regravado", { n: bkPasta.name || "" }));
  } catch (e) {
    /* PERMISSÃO PERDIDA é o caso comum: o navegador a revoga sozinho
     * depois de um tempo. Cair de volta no caminho que pergunta é
     * melhor do que um erro que a pessoa não pode resolver. */
    bkPasta = null;
    bkPintarBotoes();
    await bkSalvarNaNuvem();
  }
}

function bkIniciar() {
  const b = $("btnBackup");
  if (!b) return;
  b.onclick = bkAbrirPainel;
  $("btnBkSalvarNuvem").onclick = bkSalvarNaNuvem;
  $("btnBkBaixar").onclick = bkBaixar;
  if ($("btnBkRegravar")) $("btnBkRegravar").onclick = bkRegravar;
  $("btnBkCarregar").onclick = bkAbrirArquivo;
  $("btnBkFechar").onclick = () => $("dlgBackup").close();
  $("bkArquivo").onchange = (e) => bkLerArquivo(e.target.files && e.target.files[0]);
  $("btnBkConfAplicar").onclick = bkConfirmarRestauro;
  $("btnBkConfCancelar").onclick = () => { bkPendente = null; $("dlgBkConf").close(); };
  dicaLigar("btnSeloAjuda", "bk_selo_ajuda");
  atualizarSeloBase();
}
