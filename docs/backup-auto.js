/* =====================================================================
 * BACKUP AUTOMÁTICO NUMA PASTA (v19.17.0 — Fase 2 do plano de backup)
 *
 * O PEDIDO: acabar com o ritual de baixar e carregar o arquivo — sem perder o backup manual, que continua igual
 * ("Baixar arquivo", "Salvar", "Restaurar"): este é um caminho A MAIS.
 *
 * COMO: no computador (Chrome/Edge), a pessoa escolhe UMA vez uma pasta — de preferência dentro do OneDrive/Drive/
 * Dropbox, cujo programa leva os arquivos aos outros aparelhos. O app grava ali sozinho:
 *  · UMA CÓPIA POR DIA ("easyankicards-auto-<aparelho>-AAAAMMDD.json.gz"), regravada ao longo do dia, e guarda os
 *    últimos 7 dias — backup único é backup que se sobrescreve com a versão estragada;
 *  · a cada 30 minutos de uso e ao sair, SÓ SE ALGO MUDOU (impressão dos dados, sem a hora de gerar);
 *  · o nome do APARELHO vai no nome do arquivo: dois computadores na mesma pasta não gravam um por cima do outro.
 *
 * AS PROTEÇÕES (a avaliação do plano apontou como o automático poderia PERDER dados):
 *  1. ENCOLHEU, NÃO SOBRESCREVE. Se uma contagem (questões, resumos, leis, cartões…) caiu muito desde a última cópia
 *     — o retrato de um app que abriu "vazio" (IndexedDB apagado, cota, migração que falhou) —, a gravação vai para um
 *     arquivo À PARTE ("…-encolheu.json.gz"), as cópias boas não são tocadas e o automático PAUSA até a pessoa dizer
 *     "fui eu". Sem isso, sete gravações de 30 minutos trocariam os sete dias bons por sete cópias vazias.
 *  2. A ROTAÇÃO SÓ APAGA o que ela mesma criou: arquivos automáticos DESTE aparelho, além dos 7 dias. Nunca um backup
 *     manual, nunca o de outro aparelho.
 *  3. GRAVAÇÃO ATÔMICA: createWritable grava num temporário e só troca no close() — cortada no meio, a cópia anterior
 *     fica.
 *  4. NUNCA RESTAURA SOZINHO. Um backup mais novo de OUTRO aparelho na pasta vira um aviso ("há um backup mais novo
 *     do notebook — ver e restaurar"), que passa pela mesma conferência de sempre; se este aparelho também mudou
 *     desde o último backup, o aviso diz que restaurar troca essas mudanças.
 *  5. NADA FALHA CALADO. Permissão vencida (o navegador pede de novo depois de fechar), erro de gravação e pausa
 *     aparecem no selo do topo e no painel, com o botão que resolve.
 *
 * O ESTADO ("eac_bk_auto", "eac_aparelho") é DESTE aparelho e não vai no backup, como "eac_backup_hist".
 * ===================================================================== */
const BKA_CHAVE = "eac_bk_auto";
const BKA_APARELHO = "eac_aparelho";
const BKA_DIAS = 7;
const BKA_INTERVALO = 30 * 60 * 1000;
const BKA_PRIMEIRA = 5 * 60 * 1000;
const BKA_PAUSA_SAIR = 2 * 60 * 1000;

let bkaPasta = null;          /* a pasta (FileSystemDirectoryHandle) */
let bkaPermissao = "";        /* "granted" | "prompt" | "denied" | "" */
let bkaGravando = null;       /* uma gravação por vez */
let bkaUltimaTentativa = 0;
let bkaMaisNovo = null;       /* {aparelho, quando, nome, handle, localMudou} */
let bkaRelogio = () => Date.now();
let bkaPastaLojaUsada = null; /* {ler(): Promise<handle|null>, gravar(handle|null): Promise} — trocável nos testes */

function bkaRelogioDefinir(f) { bkaRelogio = f || (() => Date.now()); }
function bkaPastaLojaDefinir(l) { bkaPastaLojaUsada = l; }
function bkaPastaLoja() {
  return bkaPastaLojaUsada || (bkaPastaLojaUsada = {
    ler: () => bkIdbTx("pasta", "readonly", (l) => l.get("pasta")).then((v) => v || null),
    gravar: (h) => bkIdbTx("pasta", "readwrite", (l) => { if (h) l.put(h, "pasta"); else l.delete("pasta"); return null; }),
  });
}
function bkaPodeAutomatico() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/* ---------------- estado deste aparelho ---------------- */
function bkaEstado() {
  try { const o = JSON.parse(localStorage.getItem(BKA_CHAVE) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
  catch (e) { return {}; }
}
function bkaEstadoGravar(o) { try { localStorage.setItem(BKA_CHAVE, JSON.stringify(o || {})); } catch (e) {} }

function bkaSlug(s) {
  const x = String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/g, "");
  return x || "aparelho";
}
function bkaAparelhoPadrao() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const tipo = /iPad|Tablet/i.test(ua) ? "tablet" : /Android|iPhone|Mobile/i.test(ua) ? "celular" : "pc";
  return tipo + "-" + Math.random().toString(36).slice(2, 5);
}
function bkaAparelho() {
  let a = "";
  try { a = localStorage.getItem(BKA_APARELHO) || ""; } catch (e) {}
  if (!a) { a = bkaAparelhoPadrao(); try { localStorage.setItem(BKA_APARELHO, a); } catch (e) {} }
  return a;
}
function bkaAparelhoDefinir(nome) {
  const n = String(nome || "").trim().slice(0, 40);
  if (!n) return bkaAparelho();
  try { localStorage.setItem(BKA_APARELHO, n); } catch (e) {}
  return n;
}

/* ---------------- nomes dos arquivos ---------------- */
function bkaDia(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
}
function bkaNome(aparelho, data, encolheu, gz) {
  const p = (n) => String(n).padStart(2, "0");
  return "easyankicards-auto-" + bkaSlug(aparelho) + "-" + bkaDia(data)
    + (encolheu ? "-" + p(data.getHours()) + p(data.getMinutes()) + "-encolheu" : "") + (gz ? ".json.gz" : ".json");
}
const BKA_NOME_RE = /^easyankicards-auto-([a-z0-9-]+?)-(\d{8})(?:-(\d{4})-encolheu)?\.json(?:\.gz)?$/;
function bkaLerNome(nome) {
  const m = String(nome || "").match(BKA_NOME_RE);
  return m ? { aparelho: m[1], dia: m[2], encolheu: !!m[3] } : null;
}

/* ---------------- o motor (puro) ---------------- */
/* FNV-1a de 32 bits: muda quando os dados mudam — só para saber se vale gravar */
function bkaHash(s) {
  let h = 0x811c9dc5;
  const x = String(s);
  for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16) + "." + x.length.toString(36);
}
/* o que caiu MUITO entre dois resumos: zerou, ou perdeu ≥ 20% e ≥ 5 itens. Apagar três cartões não pausa nada. */
function bkaEncolheu(antes, novo) {
  const A = antes || {}, N = novo || {};
  const out = [];
  Object.keys(BK_ROTULOS).forEach((k) => {
    const de = Number(A[k]) || 0, para = Number(N[k]) || 0;
    if (de > 0 && para < de && (para === 0 || de - para >= Math.max(5, Math.ceil(de * 0.2)))) out.push({ chave: k, rotulo: BK_ROTULOS[k], de, para });
  });
  return out;
}
/* com que se compara: a última cópia automática; sem ela, a última cópia manual registrada */
function bkaReferencia(est) {
  if (est.ultimo && est.ultimo.resumo) return est.ultimo.resumo;
  try { const h = bkHistorico(); if (h[0] && h[0].resumo) return h[0].resumo; } catch (e) {}
  return null;
}

/* ---------------- a pasta ---------------- */
async function bkaPermitido(pedir) {
  if (!bkaPasta) { bkaPermissao = ""; return ""; }
  let p = "granted";
  try {
    if (typeof bkaPasta.queryPermission === "function") p = await bkaPasta.queryPermission({ mode: "readwrite" });
    if (p !== "granted" && pedir && typeof bkaPasta.requestPermission === "function") p = await bkaPasta.requestPermission({ mode: "readwrite" });
  } catch (e) { p = "denied"; }
  bkaPermissao = p;
  return p;
}
async function bkaEscrever(nome, dados) {
  const fh = await bkaPasta.getFileHandle(nome, { create: true });
  const w = await fh.createWritable();
  try { await w.write(dados); }
  catch (e) { try { if (w.abort) await w.abort(); } catch (x) {} throw e; }
  await w.close();
}
async function bkaListar() {
  const out = [];
  for await (const [nome, h] of bkaPasta.entries()) if (h && h.kind !== "directory") out.push([nome, h]);
  return out;
}
/* a rotação: arquivos automáticos DESTE aparelho; os diários além dos 7 dias mais recentes e os "encolheu" com mais
 * de 7 dias. Nada de outro aparelho, nada que não tenha o nome do automático. */
async function bkaRodar(agora) {
  const meu = bkaSlug(bkaAparelho());
  const limite = bkaDia(new Date(agora.getTime() - BKA_DIAS * 86400000));
  const diarios = [], apagar = [];
  for (const [nome] of await bkaListar()) {
    const m = bkaLerNome(nome);
    if (!m || m.aparelho !== meu) continue;
    if (m.encolheu) { if (m.dia <= limite) apagar.push(nome); }
    else diarios.push([m.dia, nome]);
  }
  diarios.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  diarios.slice(BKA_DIAS).forEach(([, nome]) => apagar.push(nome));
  for (const nome of apagar) { try { await bkaPasta.removeEntry(nome); } catch (e) {} }
  return apagar;
}

/* ---------------- gravar ---------------- */
function bkaGravarAgora(motivo, opc) {
  if (bkaGravando) return bkaGravando;
  /* (19.40.0) o balão: "salvando…" enquanto grava; depois ✓ por um instante (ou o aviso, se falhou) */
  const est0 = bkaEstado();
  const vaiGravar = !!(est0.ligado && bkaPasta);
  if (vaiGravar) bkaBolhaPintar("gravando");
  bkaGravando = bkaGravarDeVerdade(motivo || "", opc || {})
    .then((r) => { if (vaiGravar) bkaBolhaPintar(r && r.ok && !r.igual ? "gravou" : ""); return r; })
    .finally(() => { bkaGravando = null; });
  return bkaGravando;
}
async function bkaGravarDeVerdade(motivo, o) {
  const est = bkaEstado();
  if (!est.ligado || !bkaPasta) return { ok: false, razao: "sem_pasta" };
  bkaUltimaTentativa = bkaRelogio();
  if ((await bkaPermitido(!!o.gesto)) !== "granted") { bkaPintarTudo(); return { ok: false, razao: "permissao" }; }
  let bk;
  try { await bkEsperarDados(); bk = montarBackup(); } catch (e) { return bkaFalhou(est, e); }
  const hash = bkaHash(JSON.stringify(bk.dados));
  if (!o.forcar && est.ultimo && est.ultimo.hash === hash) return { ok: true, igual: true };
  /* (19.40.0) NÃO SOBREPOR O MAIS NOVO. Cada aparelho grava o SEU arquivo — nunca apaga o do outro —, mas um aparelho
   * desatualizado que segue gravando deixa o arquivo DELE como o mais novo da pasta, e o outro aparelho passa a ver
   * "backup mais novo" com dados velhos (e pode restaurá-los). Havendo um backup de outro aparelho mais novo que a
   * base daqui, o automático PARA até a pessoa conferir: restaurar o outro, ou dizer "manter os deste aparelho". */
  if (!o.ignorarMaisNovo) {
    try { await bkaProcurarMaisNovo(); } catch (e) {}
    if (bkaMaisNovo) {
      if (!est.travado || est.travado.nome !== bkaMaisNovo.nome) {
        est.travado = { nome: bkaMaisNovo.nome, aparelho: bkaMaisNovo.aparelho, quando: new Date(bkaMaisNovo.quando).toISOString() };
        bkaEstadoGravar(est);
        reg("BACKUP", "automático parado: há backup mais novo de outro aparelho", bkaMaisNovo.aparelho + " · " + bkaMaisNovo.nome);
      }
      bkaPintarTudo();
      return { ok: false, razao: "mais_novo", aparelho: bkaMaisNovo.aparelho };
    }
    if (est.travado) { delete est.travado; bkaEstadoGravar(est); }
  }
  /* a mesma situação que já pausou: não grava outro "encolheu" a cada 30 minutos */
  if (!o.aceitarEncolhido && est.pausado && est.pausado.hash === hash) return { ok: false, razao: "encolheu", jaGravado: true };
  const agora = new Date(bkaRelogio());
  const aparelho = bkaAparelho();
  try {
    const gz = bkPodeCompactar();
    const texto = JSON.stringify(bk, null, 1);
    const dados = gz ? await bkGzip(texto) : texto;
    const enc = o.aceitarEncolhido ? [] : bkaEncolheu(bkaReferencia(est), bk.resumo);
    if (enc.length) {
      const nome = bkaNome(aparelho, agora, true, gz);
      await bkaEscrever(nome, dados);
      est.pausado = { quando: agora.toISOString(), nome, encolheu: enc, hash };
      delete est.erro;
      bkaEstadoGravar(est);
      reg("BACKUP", "automático pausado: os dados encolheram", enc.map((x) => x.rotulo + " " + x.de + "→" + x.para).join(", ") + " · " + nome);
      bkaPintarTudo();
      return { ok: false, razao: "encolheu", nome, encolheu: enc };
    }
    const nome = bkaNome(aparelho, agora, false, gz);
    await bkaEscrever(nome, dados);
    est.ultimo = { quando: agora.toISOString(), nome, hash, resumo: bk.resumo };
    est.base = est.ultimo.quando;
    delete est.pausado;
    delete est.erro;
    bkaEstadoGravar(est);
    bkaMarcarSalvo(nome, est.ultimo.quando);
    const apagados = await bkaRodar(agora);
    reg("BACKUP", "automático gravado", nome + " · " + motivo + (apagados.length ? " · rotação: " + apagados.join(", ") : ""));
    bkaPintarTudo();
    return { ok: true, nome, apagados };
  } catch (e) { return bkaFalhou(est, e); }
}
function bkaFalhou(est, e) {
  est.erro = { quando: new Date(bkaRelogio()).toISOString(), msg: (e && (e.message || e.name)) || "?" };
  bkaEstadoGravar(est);
  try { reg("BACKUP", "automático falhou", est.erro.msg); } catch (x) {}
  bkaPintarTudo();
  return { ok: false, razao: "erro", erro: est.erro.msg };
}
/* a data da base (selo do topo) e a lista de cópias — sem encher a lista a cada 30 minutos: o arquivo do dia é um só */
function bkaMarcarSalvo(nome, quando) {
  try {
    localStorage.setItem("eac_backup_em", quando);
    localStorage.setItem("eac_backup_onde", "auto");
    localStorage.setItem("eac_backup_arq", nome);
  } catch (e) {}
  try {
    const L = bkHistorico();
    if (L[0] && L[0].nome === nome) {
      L[0] = Object.assign({}, L[0], { quando, resumo: resumoAtual() });
      localStorage.setItem(BK_HIST_CHAVE, JSON.stringify(L));
    } else bkRegistrarCopia("auto", nome, quando);
  } catch (e) {}
}

/* ---------------- o backup mais novo de OUTRO aparelho ---------------- */
async function bkaProcurarMaisNovo() {
  bkaMaisNovo = null;
  const est = bkaEstado();
  if (!est.ligado || !bkaPasta || bkaPermissao !== "granted") { bkaPintarTudo(); return null; }
  const meu = bkaSlug(bkaAparelho());
  const base = Date.parse(est.base || "") || Date.parse(localStorage.getItem("eac_backup_em") || "") || 0;
  let melhor = null;
  try {
    for (const [nome, h] of await bkaListar()) {
      const m = bkaLerNome(nome);
      if (!m || m.encolheu || m.aparelho === meu) continue;
      const f = await h.getFile();
      if (est.ignorado && est.ignorado.nome === nome && f.lastModified <= est.ignorado.quando) continue;
      if (f.lastModified > base + 60000 && (!melhor || f.lastModified > melhor.quando)) melhor = { aparelho: m.aparelho, quando: f.lastModified, nome, handle: h };
    }
  } catch (e) { melhor = null; }
  if (melhor) {
    let mudou = true;
    try { mudou = !est.ultimo || est.ultimo.hash !== bkaHash(JSON.stringify(montarBackup().dados)); } catch (e) {}
    melhor.localMudou = mudou;
  }
  bkaMaisNovo = melhor;
  bkaPintarTudo();
  return melhor;
}
/* abre a conferência com o arquivo do outro aparelho — restaurar continua sendo decisão da pessoa */
async function bkaVerMaisNovo() {
  if (!bkaMaisNovo) return false;
  const f = await bkaMaisNovo.handle.getFile();
  const arq = { name: bkaMaisNovo.nome, arrayBuffer: () => f.arrayBuffer(), text: () => f.text() };
  await bkLerArquivo(arq);
  return true;
}
/* restaurar muda a referência: a próxima cópia compara com o que veio do arquivo, e esse arquivo não é "mais novo" */
function bkaDepoisDeRestaurar(bk) {
  const est = bkaEstado();
  est.base = new Date(bkaRelogio()).toISOString();
  est.ultimo = Object.assign({}, est.ultimo || {}, { hash: null, resumo: resumirBackup((bk && bk.dados) || {}) });
  delete est.pausado;
  bkaEstadoGravar(est);
  bkaMaisNovo = null;
}

/* ---------------- os gestos da pessoa ---------------- */
async function bkaConectar() {
  if (!bkaPodeAutomatico()) return { ok: false, razao: "sem_suporte" };
  let h;
  try { h = await window.showDirectoryPicker({ id: "easyankicards-backup", mode: "readwrite" }); }
  catch (e) {
    if (e && e.name === "AbortError") return { ok: false, razao: "cancelado" };
    await uiAlert(t("bka_erro", { e: (e && e.message) || "?" }));
    return { ok: false, razao: "erro" };
  }
  bkaPasta = h;
  try { await bkaPastaLoja().gravar(h); } catch (e) { /* sem guardar a pasta, vale só nesta sessão */ }
  const est = bkaEstado();
  est.ligado = true;
  est.pasta = h.name || "";
  delete est.erro;
  bkaEstadoGravar(est);
  bkaPermissao = "granted";
  reg("BACKUP", "pasta do automático escolhida", est.pasta);
  const r = await bkaGravarAgora("ao escolher a pasta", { gesto: true, forcar: true });
  await bkaProcurarMaisNovo();
  return r;
}
async function bkaReconectar() {
  if ((await bkaPermitido(true)) !== "granted") { bkaPintarTudo(); return { ok: false, razao: "permissao" }; }
  const r = await bkaGravarAgora("ao reconectar", { gesto: true });
  await bkaProcurarMaisNovo();
  return r;
}
async function bkaGravarPedido() {
  if (bkaMaisNovo) {
    const ok = await uiConfirm(t("bka_conf_sobrepor", { a: bkaMaisNovo.aparelho }));
    if (!ok) return { ok: false, razao: "cancelado" };
    return bkaManterDesteAparelho();
  }
  const r = await bkaGravarAgora("pedido", { gesto: true, forcar: true });
  if (r.ok) await uiAlert(t("bka_gravado", { n: r.nome }));
  return r;
}
/* A PESSOA CONFERIU e quer seguir com os dados DESTE aparelho: o arquivo do outro fica (nada é apagado), deixa de ser
 * "mais novo" para este aparelho, e o automático volta a gravar */
async function bkaManterDesteAparelho() {
  const est = bkaEstado();
  if (bkaMaisNovo) est.ignorado = { nome: bkaMaisNovo.nome, quando: bkaMaisNovo.quando };
  delete est.travado;
  bkaEstadoGravar(est);
  try { reg("BACKUP", "mantidos os dados deste aparelho", bkaMaisNovo ? bkaMaisNovo.aparelho + " · " + bkaMaisNovo.nome : ""); } catch (e) {}
  bkaMaisNovo = null;
  const r = await bkaGravarAgora("mantidos os deste aparelho", { gesto: true, forcar: true, ignorarMaisNovo: true });
  bkaPintarTudo();
  return r;
}
async function bkaAceitarEncolhido() {
  return bkaGravarAgora("encolhido confirmado", { gesto: true, forcar: true, aceitarEncolhido: true });
}
async function bkaDesligar() {
  const est = bkaEstado();
  est.ligado = false;
  delete est.pausado; delete est.erro;
  bkaEstadoGravar(est);
  bkaPasta = null; bkaPermissao = ""; bkaMaisNovo = null;
  try { await bkaPastaLoja().gravar(null); } catch (e) {}
  reg("BACKUP", "automático desligado", "");
  bkaPintarTudo();
  await uiAlert(t("bka_desligado"));
}
async function bkaRenomearAparelho() {
  const v = await uiPrompt(t("bka_renomear_pergunta"), bkaAparelho());
  if (typeof v === "string" && v.trim()) { bkaAparelhoDefinir(v); bkaPintarTudo(); }
}

/* ---------------- a tela ---------------- */
function bkaPintarTudo() {
  try { bkaPintar(); } catch (e) {}
  try { bkaBolhaPintar(); } catch (e) {}
  try { if (typeof atualizarSeloBase === "function") atualizarSeloBase(); } catch (e) {}
}
/* o que o selo do topo precisa dizer (null = nada a dizer, fica o selo de sempre) */
function bkaAvisoDoSelo() {
  const est = bkaEstado();
  if (!est.ligado) return null;
  if (est.pausado) return { txt: t("bka_selo_pausado"), cls: "sb-alerta" };
  if (est.erro) return { txt: t("bka_selo_erro"), cls: "sb-alerta" };
  if (!bkaPasta || (bkaPermissao && bkaPermissao !== "granted")) return { txt: t("bka_selo_reconectar"), cls: "sb-aviso" };
  if (bkaMaisNovo) return { txt: t(est.travado ? "bka_selo_travado" : "bka_selo_mais_novo", { a: bkaMaisNovo.aparelho }), cls: est.travado ? "sb-alerta" : "sb-aviso" };
  return null;
}
function bkaPintar() {
  const cx = $("bkaCorpo");
  if (!cx) return;
  cx.innerHTML = "";
  const est = bkaEstado();
  const nota = (txt, cls) => { const p = document.createElement("div"); p.className = cls || "nota"; p.textContent = txt; cx.append(p); return p; };
  const linha = () => { const d = document.createElement("div"); d.className = "btn-linha"; cx.append(d); return d; };
  const botao = (onde, txt, fn, cls, id, tip) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = cls || "btn btn-cinza"; b.textContent = txt;
    if (id) b.id = id;
    if (tip) b.title = tip;
    b.onclick = () => fn();
    onde.append(b);
    return b;
  };
  if (!bkaPodeAutomatico()) { nota(t("bka_sem_suporte")); return; }
  if (!est.ligado) {
    nota(t("bka_exp"));
    botao(linha(), t("bka_conectar"), bkaConectar, "btn btn-verde", "btnBkaConectar");
    return;
  }
  nota(t("bka_pasta", { p: est.pasta || (bkaPasta && bkaPasta.name) || "?", a: bkaAparelho() }), "bk-txt");
  if (!bkaPasta) {
    nota(t("bka_pasta_perdida"), "bk-aviso grave");
    botao(linha(), t("bka_conectar"), bkaConectar, "btn btn-verde", "btnBkaConectar");
  } else if (bkaPermissao && bkaPermissao !== "granted") {
    nota(t("bka_permissao"), "bk-aviso grave");
    botao(linha(), t("bka_reconectar"), bkaReconectar, "btn btn-verde", "btnBkaReconectar");
  }
  if (est.pausado) {
    const itens = (est.pausado.encolheu || []).map((x) => t("bka_pausado_item", { r: x.rotulo, de: x.de, para: x.para })).join("; ");
    nota(t("bka_pausado", { lista: itens, n: est.pausado.nome }), "bk-aviso grave bka-pausado");
    botao(linha(), t("bka_aceitar"), bkaAceitarEncolhido, "btn btn-perigo", "btnBkaAceitar", t("bka_aceitar_tip"));
  }
  if (est.erro) nota(t("bka_erro", { e: est.erro.msg }), "bk-aviso grave");
  if (bkaMaisNovo) {
    const d = new Date(bkaMaisNovo.quando);
    nota(t("bka_mais_novo", { a: bkaMaisNovo.aparelho, q: bkQuandoCurto(d.toISOString()) }) + (bkaMaisNovo.localMudou ? " " + t("bka_mais_novo_local") : ""), "bk-aviso bka-mais-novo");
    if (est.travado) nota(t("bka_travado", { a: bkaMaisNovo.aparelho }), "bk-aviso grave bka-travado");
    const lm = linha();
    botao(lm, t("bka_ver_mais_novo"), bkaVerMaisNovo, "btn btn-azul", "btnBkaVerMaisNovo");
    botao(lm, t("bka_manter_deste"), bkaManterDesteAparelho, "btn btn-cinza", "btnBkaManterDeste", t("bka_manter_deste_tip"));
  }
  nota(est.ultimo && est.ultimo.nome ? t("bka_ultimo", { q: bkQuandoCurto(est.ultimo.quando), n: est.ultimo.nome }) : t("bka_ainda_nao"), "bk-txt bka-ultimo");
  const l = linha();
  if (bkaPasta) botao(l, t("bka_gravar_agora"), bkaGravarPedido, "btn btn-cinza", "btnBkaGravar");
  botao(l, t("bka_renomear"), bkaRenomearAparelho, "btn btn-cinza", "btnBkaRenomear");
  botao(l, t("bka_trocar"), bkaConectar, "btn btn-cinza", "btnBkaTrocar");
  botao(l, t("bka_desligar"), bkaDesligar, "btn btn-cinza", "btnBkaDesligar");
}

/* ---------------- (19.40.0) o balão ----------------
 * Um círculo pequeno, por cima de tudo, que a pessoa arrasta para onde quiser (a posição fica guardada):
 *  · aparece por um instante enquanto o backup automático grava ("salvando…" girando) e depois ✓;
 *  · fica à vista enquanto há algo a resolver — desligado, pasta perdida, permissão vencida, pausado, falhou, outro
 *    aparelho mais novo — na cor do problema;
 *  · tocar (sem arrastar) abre o painel do backup, onde se configura, liga, reconecta ou ajusta.
 * Sem o recurso no navegador (iPhone, Firefox), não aparece: não há o que configurar.
 * ------------------------------------------------------ */
const BKA_BOLHA_POS = "eac_bka_bolha_pos";
let bkaBolhaTimer = null;
let bkaBolhaMomento = "";           /* "gravando" | "gravou" | "" */
/* o que o balão diz agora: null = some */
const BKA_BOLHA_DIAS_MANUAL = 3;    /* sem o automático: depois de quantos dias sem backup o balão aparece */
function bkaBolhaEstado() {
  if (!bkaPodeAutomatico()) {
    /* NO CELULAR (e no Firefox) o navegador não deixa gravar sozinho numa pasta: o balão cuida do backup MANUAL —
     * aparece quando ele envelhece, e tocar abre o painel (baixar / mandar para a nuvem) */
    let i = null;
    try { i = typeof idadeBase === "function" ? idadeBase() : null; } catch (e) { i = null; }
    if (!i) return { k: "manual", ic: "💾", txt: t("bka_bolha_manual_nunca"), cls: "bb-alerta" };
    if (i.dias >= BKA_BOLHA_DIAS_MANUAL) return { k: "manual", ic: "💾", txt: t("bka_bolha_manual", { n: i.dias }), cls: i.dias > 7 ? "bb-alerta" : "bb-aviso" };
    return null;
  }
  const est = bkaEstado();
  if (bkaBolhaMomento === "gravando") return { k: "gravando", ic: "💾", txt: t("bka_bolha_gravando"), cls: "bb-grav" };
  const av = bkaAvisoDoSelo();
  if (av) return { k: "problema", ic: "!", txt: av.txt, cls: av.cls === "sb-alerta" ? "bb-alerta" : "bb-aviso" };
  if (!est.ligado) return { k: "desligado", ic: "💾", txt: t("bka_bolha_desligado"), cls: "bb-desl" };
  if (bkaBolhaMomento === "gravou") return { k: "gravou", ic: "✓", txt: t("bka_bolha_gravou"), cls: "bb-ok" };
  return null;
}
function bkaBolhaPosLer() {
  try { const p = JSON.parse(localStorage.getItem(BKA_BOLHA_POS) || "null"); if (p && isFinite(p.x) && isFinite(p.y)) return p; } catch (e) {}
  return { x: 1, y: 1 };              /* fração da área livre: canto de baixo, à direita */
}
function bkaBolhaPosicionar(el, p) {
  const w = (typeof window !== "undefined" && window.innerWidth) || 1024, h = (typeof window !== "undefined" && window.innerHeight) || 768;
  const tam = 46, m = 12;
  const x = Math.max(0, Math.min(1, p.x)), y = Math.max(0, Math.min(1, p.y));
  el.style.left = Math.round(m + x * Math.max(0, w - tam - 2 * m)) + "px";
  el.style.top = Math.round(m + y * Math.max(0, h - tam - 2 * m)) + "px";
}
function bkaBolhaCriar() {
  let el = $("bkaBolha");
  if (el) return el;
  if (typeof document === "undefined" || !document.body) return null;
  el = document.createElement("button");
  el.type = "button";
  el.id = "bkaBolha";
  el.className = "bka-bolha";
  el.hidden = true;
  const ic = document.createElement("span");
  ic.className = "bka-bolha-ic";
  ic.setAttribute("aria-hidden", "true");
  el.append(ic);
  document.body.append(el);
  bkaBolhaPosicionar(el, bkaBolhaPosLer());
  /* ARRASTAR × TOCAR: andou mais de 5px, é arrasto (e não abre nada); senão, é toque e abre o painel */
  let ini = null, moveu = false;
  el.addEventListener("pointerdown", (ev) => {
    ini = { x: ev.clientX, y: ev.clientY, l: el.offsetLeft, t: el.offsetTop };
    moveu = false;
    try { el.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  el.addEventListener("pointermove", (ev) => {
    if (!ini) return;
    const dx = ev.clientX - ini.x, dy = ev.clientY - ini.y;
    if (!moveu && Math.abs(dx) + Math.abs(dy) < 5) return;
    moveu = true;
    el.classList.add("arrastando");
    el.style.left = (ini.l + dx) + "px";
    el.style.top = (ini.t + dy) + "px";
  });
  const soltar = () => {
    if (!ini) return;
    if (moveu) {
      const w = window.innerWidth, h = window.innerHeight, tam = 46, m = 12;
      const p = { x: (el.offsetLeft - m) / Math.max(1, w - tam - 2 * m), y: (el.offsetTop - m) / Math.max(1, h - tam - 2 * m) };
      p.x = Math.max(0, Math.min(1, p.x)); p.y = Math.max(0, Math.min(1, p.y));
      try { localStorage.setItem(BKA_BOLHA_POS, JSON.stringify(p)); } catch (e) {}
      bkaBolhaPosicionar(el, p);
    }
    el.classList.remove("arrastando");
    ini = null;
  };
  el.addEventListener("pointerup", soltar);
  el.addEventListener("pointercancel", soltar);
  el.addEventListener("click", (ev) => {
    if (moveu) { moveu = false; ev.preventDefault(); return; }
    bkaBolhaTocar();
  });
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", () => bkaBolhaPosicionar(el, bkaBolhaPosLer()));
  }
  return el;
}
function bkaBolhaTocar() {
  try { reg("BACKUP", "balão do backup tocado", (bkaBolhaEstado() || {}).k || "-"); } catch (e) {}
  if (typeof bkAbrirPainel === "function") bkAbrirPainel();
}
/* momento: "gravando" | "gravou" | "" (só repinta) */
function bkaBolhaPintar(momento) {
  if (momento !== undefined) {
    bkaBolhaMomento = momento;
    if (bkaBolhaTimer) { clearTimeout(bkaBolhaTimer); bkaBolhaTimer = null; }
    /* o ✓ fica só um instante */
    if (momento === "gravou") bkaBolhaTimer = setTimeout(() => { bkaBolhaMomento = ""; bkaBolhaPintar(); }, 2500);
  }
  const el = bkaBolhaCriar();
  if (!el) return null;
  if (!el.classList.contains("arrastando")) bkaBolhaPosicionar(el, bkaBolhaPosLer());
  const st = bkaBolhaEstado();
  el.hidden = !st;
  if (!st) return null;
  el.className = "bka-bolha " + st.cls;
  el.firstChild.textContent = st.ic;
  el.title = st.txt + (st.k === "gravando" ? "" : " · " + t("bka_bolha_tocar"));
  el.setAttribute("aria-label", el.title);
  return st;
}

/* ---------------- começar ---------------- */
async function bkaIniciar() {
  bkaPintar();
  try { bkaBolhaPintar(); } catch (e) {}
  if (!bkaPodeAutomatico() || !bkaEstado().ligado) return;
  try { bkaPasta = await bkaPastaLoja().ler(); } catch (e) { bkaPasta = null; }
  if (bkaPasta) await bkaPermitido(false);
  bkaPintarTudo();
  if (bkaPermissao === "granted") bkaProcurarMaisNovo();
  /* a primeira gravação espera uns minutos de uso: o app acabou de abrir, e o que abriu estragado não deve ir para a
   * pasta antes de alguém olhar (a proteção do "encolheu" vale de todo jeito) */
  setTimeout(() => bkaGravarAgora("ao abrir"), BKA_PRIMEIRA);
  setInterval(() => { if (document.visibilityState !== "hidden") bkaGravarAgora("periódico"); }, BKA_INTERVALO);
  /* ao sair (aba escondida): tentativa de boa vontade — o navegador pode cortá-la; a periódica cobre o resto */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && bkaRelogio() - bkaUltimaTentativa > BKA_PAUSA_SAIR) bkaGravarAgora("ao sair");
  });
}
