/* =====================================================================
 * A TELA DO BACKUP
 * Regra que orienta tudo aqui: o usuário nunca deve descobrir o que
 * aconteceu DEPOIS. Cada botão diz o que vai fazer, cada restauração
 * mostra os números dos dois lados, e a data da base fica visível o tempo
 * todo — porque abrir o app num aparelho onde os dados são de três
 * semanas atrás e não perceber é o pior desfecho possível.
 * ===================================================================== */

let bkPendente = null;      /* backup carregado, à espera de confirmação */
let bkPendenteExato = null; /* voltar a uma cópia de antes do restauro: as chaves que ela conhecia (restauro exato) */
let bkPendenteNome = "";   /* o nome do arquivo (ou da cópia) — vai no motivo da cópia de antes do restauro */
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
  /* O SELO MORA NO CABEÇALHO AGORA, e o cabeçalho tem altura medida
   * (medirCabecalho, em app.js) para a barra de modos saber onde grudar
   * por baixo dele. O texto do selo muda de tamanho ("nunca salva" vs
   * "salva há 2 dias" vs um nome de arquivo comprido no title) e pode
   * mudar quantas linhas o cabeçalho ocupa — sem remedir aqui, a barra
   * de modos ficaria por cima do selo ou com um vão embaixo dele. */
  /* (v19.17.0) O BACKUP AUTOMÁTICO TOMA O SELO quando há algo a resolver (pausado, falhou, permissão vencida, backup
   * mais novo de outro aparelho): é o único lugar sempre visível. Tocar abre o painel, onde está o botão que resolve. */
  try {
    const av = typeof bkaAvisoDoSelo === "function" ? bkaAvisoDoSelo() : null;
    if (av) {
      el.textContent = av.txt;
      el.className = "selo-base " + av.cls + " selo-clicavel";
      el.title = av.txt;
      el.onclick = bkAbrirPainel;
    } else el.onclick = null;
  } catch (e) {}
  if (typeof medirCabecalho === "function") {
    try { medirCabecalho(); } catch (e) {}
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
      const mat = (typeof matResumos !== "undefined" && matResumos) || JSON.parse(localStorage.getItem("eac_resumos") || "{}") || {};
      Object.keys(mat).forEach((k) => olha(mat[k] && mat[k].tocado));
    } catch (x) {}
    if (!maisNovo) return;
    localStorage.setItem("eac_backup_em", maisNovo);
    localStorage.setItem("eac_backup_onde", "local");
    reg("BACKUP", "idade da base deduzida dos dados", maisNovo.slice(0, 10));
  } catch (e) {}
}

/* (v19.15.0) ONDE FICOU A BASE: guarda-se o CÓDIGO ("arquivo", "local"…). O restauro e a data deduzida gravavam o texto
 * já traduzido, e a tela traduzia de novo: "em bk_onde_restaurada de arquivo". Quem já tem o texto gravado o vê como está. */
function bkOndeTexto(o) {
  const c = o || "download";
  const tx = t("bk_onde_" + c);
  return tx && tx !== "bk_onde_" + c ? tx : String(c);
}
/* =====================================================================
 * (v19.16.0) O ARQUIVO COMPACTADO
 *
 * O backup de 24/10 tinha 7,4 MB; texto (lei, resumo, questão) comprime muito: com gzip vira ~1,2 MB. A compressão é a
 * do próprio navegador (CompressionStream), sem biblioteca. O CONTEÚDO não muda — é o mesmo JSON, o mesmo formato
 * "backup/1" —, só o embrulho. Por isso:
 *  · RESTAURAR reconhece o arquivo pela ASSINATURA (os 2 primeiros bytes do gzip, 1f 8b), não pela extensão — a
 *    extensão se perde no e-mail, no WhatsApp, num "renomear"; .json antigo continua abrindo como sempre;
 *  · navegador sem CompressionStream grava o .json de sempre (o botão nunca some, só muda o embrulho);
 *  · "baixar sem compactar (.json)" fica à mão: um app velho só abre .json.
 * Nada aqui usa Blob para LER o conteúdo (Response basta) — o mesmo código roda nos testes.
 * ===================================================================== */
function bkPodeCompactar() {
  return typeof CompressionStream === "function" && typeof Response === "function";
}
function bkPodeDescompactar() {
  return typeof DecompressionStream === "function" && typeof Response === "function";
}
/* texto → bytes gzip (Uint8Array) */
async function bkGzip(texto) {
  const st = new Response(String(texto)).body.pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
function bkEhGzip(bytes) { return !!bytes && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b; }
/* bytes do arquivo → texto do backup (descompacta se for gzip; senão lê como UTF-8, como sempre) */
async function bkTextoDosBytes(bytes) {
  if (bkEhGzip(bytes)) {
    if (!bkPodeDescompactar()) { const e = new Error("sem_gzip"); e.semGzip = true; throw e; }
    const st = new Response(bytes).body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(st).text();
  }
  return new Response(bytes).text();
}
/* o arquivo escolhido → texto. Arquivo sem arrayBuffer (só text) é lido como texto. */
async function bkTextoDoArquivo(file) {
  if (file && typeof file.arrayBuffer === "function") return bkTextoDosBytes(new Uint8Array(await file.arrayBuffer()));
  return file.text();
}
/* o backup de agora, embrulhado: {dados (string ou Uint8Array), nome, tipo, gz} */
async function bkEmbrulhar(semCompactar) {
  await bkEsperarDados();
  const json = bkTextoJson();
  const nome = nomeArquivoBackup();
  if (!semCompactar && bkPodeCompactar()) {
    try { return { dados: await bkGzip(json), nome: nome + ".gz", tipo: "application/gzip", gz: true }; }
    catch (e) { reg("BACKUP", "compactar falhou — vai .json", (e && e.message) || ""); }
  }
  return { dados: json, nome, tipo: "application/json", gz: false };
}
function bkEntregarDownload(emb) {
  const url = URL.createObjectURL(new Blob([emb.dados], { type: emb.tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = emb.nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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
  let emb;
  try { emb = await bkEmbrulhar(); } catch (e) { await uiAlert(t("bk_erro_montar", { e: (e && e.message) || "?" })); return; }
  const nome = emb.nome;

  /* Celular: a folha de compartilhamento do sistema já lista Drive, OneDrive,
   * Dropbox e o que mais estiver instalado. Nenhuma credencial, nenhuma conta,
   * e funciona com a nuvem que a pessoa já usa. */
  /* (v19.16.0) a folha de compartilhamento aceita poucos tipos de arquivo, e a lista muda de sistema para sistema: se
   * recusar o .gz, vai o .json de sempre — nunca menos do que antes */
  try {
    const opcoes = [emb];
    if (emb.gz) opcoes.push({ dados: bkTextoJson(), nome: nomeArquivoBackup(), tipo: "application/json", gz: false });
    for (const o of opcoes) {
      const arq = new File([o.dados], o.nome, { type: o.tipo });
      if (navigator.canShare && navigator.canShare({ files: [arq] })) {
        await navigator.share({ files: [arq], title: "Backup EasyAnkiCards" });
        bkMarcarSalvo("compartilhado", o.nome);
        reg("BACKUP", "compartilhado pelo sistema", o.nome);
        return;
      }
    }
  } catch (e) { if (e && e.name === "AbortError") return; }

  /* Computador: escolher UMA vez a pasta do Drive/OneDrive. O programa de
   * sincronização da nuvem faz o resto, e faz melhor do que eu faria. */
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: nome,
        types: [{ description: "Backup EasyAnkiCards",
                  accept: emb.gz ? { "application/gzip": [".gz"] } : { "application/json": [".json"] } }],
      });
      const w = await h.createWritable();   /* grava em temporário */
      await w.write(emb.dados);
      await w.close();                      /* e só aqui troca pelo bom */
      bkPasta = h;
      bkMarcarSalvo("pasta", h.name || nome);
      reg("BACKUP", "gravado na pasta", h.name || nome);
      uiAlert(t("bk_salvo_pasta", { n: h.name || nome }));
      return;
    } catch (e) { if (e && e.name === "AbortError") return; }
  }

  return bkBaixar();
}

/* semCompactar: o link "baixar sem compactar (.json)" */
async function bkBaixar(semCompactar) {
  let emb;
  try { emb = await bkEmbrulhar(semCompactar === true); } catch (e) { await uiAlert(t("bk_erro_montar", { e: (e && e.message) || "?" })); return; }
  const nome = emb.nome;
  bkEntregarDownload(emb);
  bkMarcarSalvo("download", nome);
  reg("BACKUP", "baixado", nome);
  uiAlert(t("bk_baixado", { n: nome }));
}

/* ---------- carregar ---------- */

function bkAbrirArquivo() { $("bkArquivo").click(); }

async function bkLerArquivo(file) {
  if (!file) return;
  let obj = null;
  try { obj = JSON.parse(await bkTextoDoArquivo(file)); }
  catch (e) { uiAlert(t(e && e.semGzip ? "bk_erro_sem_gzip" : "bk_erro_json")); return; }
  const erro = validarBackup(obj);
  if (erro) { uiAlert(t("bk_erro_valido", { e: erro })); return; }
  bkPendente = obj;
  bkPendenteExato = null;
  bkMostrarConferencia(file.name);
}

/* O passo que não pode faltar: mostrar, item por item, o que o app tem AGORA
 * e o que o backup traz — e destacar em vermelho o que vai encolher. */
function bkMostrarConferencia(nomeArq) {
  bkPendenteNome = nomeArq || "";
  const cmp = compararBackup(bkPendente);
  const g = new Date(bkPendente.gerado || Date.now());
  $("bkConfArquivo").textContent = t("bk_conf_arquivo", {
    n: nomeArq, d: g.toLocaleString(), v: bkPendente.versao_app || "?" });

  const tb = $("bkConfTabela");
  tb.innerHTML = "";
  cmp.linhas.forEach((l) => {
    const tr = document.createElement("tr");
    /* A DIREÇÃO DA MUDANÇA É A LINHA INTEIRA, não só uma palavra na última
     * coluna: quem escolhe qual arquivo restaurar varre a tabela de
     * relance, e "perde 3" em cinza no fim da linha se lê tanto quanto o
     * "sem mudança" das outras. Verde para o que o backup ACRESCENTA,
     * vermelho para o que ENCOLHE, neutro para o que fica igual — e a
     * cor nunca vai sozinha: seta e número dizem o mesmo (acessibilidade
     * e impressão em preto e branco). */
    const dir = l.perde ? "perde" : (l.ganha ? "ganha" : "igual");
    tr.className = "bk-" + dir;
    const td = (txt, cls) => {
      const c = document.createElement("td");
      c.textContent = txt; if (cls) c.className = cls; return c;
    };
    const dif = document.createElement("td");
    dif.className = "bk-dif bk-dif-" + dir;
    if (dir !== "igual") {
      const seta = document.createElement("span");
      seta.className = "bk-seta bk-seta-" + dir;
      seta.setAttribute("aria-hidden", "true");
      seta.textContent = dir === "perde" ? "▼" : "▲";
      dif.append(seta, document.createTextNode(" "));
    }
    dif.append(document.createTextNode(l.perde
      ? t("bk_dif_perde", { n: l.agora - l.backup })
      : (l.ganha ? t("bk_dif_ganha", { n: l.backup - l.agora })
                 : t("bk_dif_igual"))));
    tr.append(td(l.rotulo), td(String(l.agora), "bk-num"),
              td(String(l.backup), "bk-num"), dif);
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
  /* (v19.15.0) A CÓPIA COMPLETA DE ANTES. Restaurar o arquivo errado não pode ser o fim da linha — e a versão da
   * bancada (abaixo) só cobria o texto dos cartões. Sem conseguir guardar a cópia, a pessoa decide sabendo disso. */
  try { await bkGuardarAntes(t("bk_antes_motivo", { a: bkPendenteNome || "?" })); }
  catch (e) {
    reg("BACKUP", "cópia de antes do restauro falhou", (e && e.message) || "");
    if (!(await uiConfirm(t("bk_antes_falhou", { e: (e && e.message) || "?" }), { perigo: true, ok: t("bk_antes_falhou_ok") }))) return;
  }
  try { guardarVersao("antes de restaurar backup"); } catch (e) {}
  try {
    const gerado = bkPendente.gerado;
    const n = restaurarBackup(bkPendente, bkPendenteExato ? { exato: bkPendenteExato } : null);
    /* (v19.17.0) o automático passa a comparar com o que veio do arquivo */
    try { if (typeof bkaDepoisDeRestaurar === "function") bkaDepoisDeRestaurar(bkPendente); } catch (x) {}
    /* A DATA DA BASE VEM DO ARQUIVO.
     * "eac_backup_em" só era escrito ao SALVAR. Quem restaurava uma base
     * num aparelho novo via "sem base" logo depois de carregar uma — e o
     * selo existe justamente para dizer de quando é o que está ali. O
     * arquivo carrega a hora em que foi gerado ("gerado"), e essa é a
     * resposta certa: a base é daquele momento, não de agora. */
    try {
      localStorage.setItem("eac_backup_em", gerado || new Date().toISOString());
      localStorage.setItem("eac_backup_onde", "arquivo");
    } catch (x) {}
    reg("BACKUP", "restaurado", n + " chaves, de " + (gerado || "?"));
    bkPendente = null;
    bkPendenteExato = null;
    $("dlgBkConf").close();
    /* leis, decisões e julgados vão para o IndexedDB em segundo plano: recarregar antes de terminar perderia o que veio do
     * arquivo — espera (é rápido) */
    try { await bkAguardarGravacoes(); } catch (x) {}
    await uiAlert(t("bk_restaurado"));
    location.reload();     /* recarregar é o jeito honesto: tudo relê do zero */
  } catch (e) {
    /* tudo-ou-nada (restaurarBackup): o normal é ter desfeito tudo; se nem o desfazer deu certo, a pessoa precisa
     * saber que o app ficou misturado — e onde está a volta */
    reg("BACKUP", "restauro recusado", ((e && e.chave) || "") + " · " + ((e && e.message) || ""));
    try { bkPintarPainel(); } catch (x) {}
    uiAlert(t(e && e.desfeito === false ? "bk_erro_restaurar_parcial" : "bk_erro_restaurar", { e: (e && e.message) || "?" }));
  }
}

/* ---------------------------------------------------------------------
 * (v19.15.0) AS CÓPIAS DE ANTES DO RESTAURO
 * "Voltar" passa pela MESMA tabela de conferência de um arquivo (e o estado de agora também ganha a sua cópia).
 * "Baixar" entrega a cópia como um backup comum — sem marcar como "salvo": não é o estado de agora.
 * ------------------------------------------------------------------ */
function bkCarimbo(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}
function bkBaixarCopia(c) {
  const nome = "easyankicards-antes-de-restaurar-" + bkCarimbo(c.quando) + ".json";
  const url = URL.createObjectURL(new Blob([JSON.stringify(c.bk, null, 1)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  reg("BACKUP", "cópia de antes do restauro baixada", nome);
  return nome;
}
function bkVoltarACopia(c) {
  bkPendente = c.bk;
  bkPendenteExato = Array.isArray(c.chaves) ? c.chaves : null;
  const d = new Date(c.quando);
  bkMostrarConferencia(t("bk_antes_nome", { d: d.toLocaleDateString([], { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
}
async function bkPintarAntes() {
  const cx = $("bkAntes");
  if (!cx) return 0;
  const L = await bkAntesLer();
  cx.innerHTML = "";
  cx.hidden = !L.length;
  if (!L.length) return 0;
  const tit = document.createElement("div");
  tit.className = "bk-rot";
  tit.textContent = t("bk_antes_rot");
  const exp = document.createElement("div");
  exp.className = "nota";
  exp.textContent = t("bk_antes_exp");
  cx.append(tit, exp);
  L.forEach((c) => {
    const li = document.createElement("div");
    li.className = "bk-hist-li bk-antes-li";
    const d = new Date(c.quando);
    const quando = document.createElement("b");
    quando.textContent = d.toLocaleDateString([], { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const motivo = document.createElement("span");
    motivo.className = "bk-hist-onde";
    motivo.textContent = c.motivo || "";
    const r = resumirBackup((c.bk && c.bk.dados) || {});
    const conta = document.createElement("span");
    conta.className = "bk-hist-arq";
    conta.textContent = t("bk_antes_conta", { c: r.cartoes, q: r.questoes, r: r.resumos });
    const bv = document.createElement("button");
    bv.type = "button"; bv.className = "btn-min btn-min-ok bk-antes-voltar";
    bv.textContent = t("bk_antes_voltar"); bv.title = t("bk_antes_tip_voltar");
    bv.onclick = () => bkVoltarACopia(c);
    const bb = document.createElement("button");
    bb.type = "button"; bb.className = "btn-min bk-antes-baixar";
    bb.textContent = t("bk_antes_baixar"); bb.title = t("bk_antes_tip_baixar");
    bb.onclick = () => bkBaixarCopia(c);
    li.append(quando, motivo, conta, bv, bb);
    cx.append(li);
  });
  return L.length;
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
          o: bkOndeTexto(localStorage.getItem("eac_backup_onde")),
          a: arq })
      : t("bk_ultimo_nunca");
  }
  bkPintarHistorico();
  bkPintarAntes().catch(() => {});
  try { if (typeof bkaPintar === "function") bkaPintar(); } catch (e) {}
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
    onde.textContent = bkOndeTexto(x.onde);
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
  const bj = $("btnBkBaixarJson");
  if (bj) bj.hidden = !bkPodeCompactar();
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
  /* o arquivo escolhido é .json.gz ou .json: regravar no mesmo formato do NOME (um .json com gzip dentro
   * enganaria quem abre o arquivo). Montar o backup falhar (as questões não chegaram) não é perder a permissão:
   * avisa e mantém a pasta. */
  let emb;
  try { emb = await bkEmbrulhar(!/\.gz$/i.test(bkPasta.name || "")); }
  catch (e) { await uiAlert(t("bk_erro_montar", { e: (e && e.message) || "?" })); return; }
  try {
    const w = await bkPasta.createWritable();
    await w.write(emb.dados);
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
  $("btnBkBaixar").onclick = () => bkBaixar();
  if ($("btnBkBaixarJson")) $("btnBkBaixarJson").onclick = () => bkBaixar(true);
  if ($("btnBkRegravar")) $("btnBkRegravar").onclick = bkRegravar;
  $("btnBkCarregar").onclick = bkAbrirArquivo;
  $("btnBkFechar").onclick = () => $("dlgBackup").close();
  $("bkArquivo").onchange = (e) => bkLerArquivo(e.target.files && e.target.files[0]);
  $("btnBkConfAplicar").onclick = bkConfirmarRestauro;
  $("btnBkConfCancelar").onclick = () => { bkPendente = null; bkPendenteExato = null; $("dlgBkConf").close(); };
  dicaLigar("btnSeloAjuda", "bk_selo_ajuda");
  atualizarSeloBase();
}
