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
/* (19.129.0) além das diárias: uma cópia por semana e uma por mês — perda pequena notada tarde ainda tem cópia boa */
const BKA_SEMANAS = 4;
const BKA_MESES = 6;
const BKA_INTERVALO = 30 * 60 * 1000;
const BKA_PRIMEIRA = 5 * 60 * 1000;
const BKA_PAUSA_SAIR = 2 * 60 * 1000;

let bkaPasta = null;          /* a pasta (FileSystemDirectoryHandle) */
let bkaPermissao = "";        /* "granted" | "prompt" | "denied" | "" */
let bkaGravando = null;       /* uma gravação por vez */
let bkaGravandoDesde = 0;     /* (19.206.0) desde quando a gravação atual roda (para não esperar uma presa para sempre) */
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
/* (19.127.0) A IMPRESSÃO DOS DADOS, SEM O QUE MUDA SOZINHO. Cada edital leva "tocado" (a hora em que foi aberto ou
 * redesenhado), que muda só de abrir o app: com ele na conta, toda abertura virava "os dados mudaram" e uma gravação. */
function bkaImpressao(dados) {
  let s = "";
  try {
    s = JSON.stringify(dados, (k, v) => (k === "eac_editais" && typeof v === "string" ? v.replace(/"tocado":"[^"]*",?/g, "") : v));
  } catch (e) { s = JSON.stringify(dados); }
  return bkaHash(s);
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
/* =====================================================================
 * (19.206.0) A PASTA QUE NÃO RESPONDE NÃO PRENDE MAIS O BACKUP
 *
 * O caso real (26/11): quatro dias sem backup, o balão pedindo "reconectar" e "Salvar agora" sem fazer nada. A pasta
 * fica no Google Drive (G:), e quando o Drive está desconectado ou travado o navegador simplesmente NÃO RESPONDE à
 * pergunta "tenho permissão?" (queryPermission) — a promessa nunca termina. Como a abertura esperava essa resposta
 * antes de agendar os backups, nenhum foi agendado; e "Salvar agora" esperava a mesma resposta, ficava "gravando" para
 * sempre, e cada toque seguinte devolvia a mesma gravação presa. O diagnóstico mostrava "permissão: ?".
 *  · toda espera pela pasta tem PRAZO (bkaComPrazo): permissão, dados, compactar, procurar, gravar, limpar;
 *  · passou do prazo = falha "a pasta não respondeu", com a nova tentativa sozinha (2, 5, 15 min) como as outras;
 *  · a abertura agenda os backups ANTES de perguntar pela permissão;
 *  · "Salvar agora" responde sempre: "Salvando…" enquanto grava e, se não gravou, diz por quê;
 *  · o REGISTRO DAS TENTATIVAS: cada tentativa com as etapas e quanto cada uma levou, no painel e no diagnóstico, com
 *    "copiar relatório do backup".
 * ===================================================================== */
const BKA_PRAZO = { permissao: 10000, pedir: 20000, dados: 30000, procurar: 30000, compactar: 60000, gravar: 60000, limpar: 30000, listar: 30000 };
/* quem agenda o fim do prazo: (fn, ms) → id. Trocável nos testes (lá o setTimeout dispara na hora e venceria tudo) */
let bkaPrazoAgendar = (fn, ms) => setTimeout(fn, ms);
let bkaPrazoCancelar = (id) => clearTimeout(id);
function bkaPrazoDefinir(agendar, cancelar) {
  bkaPrazoAgendar = agendar || ((fn, ms) => setTimeout(fn, ms));
  bkaPrazoCancelar = cancelar || ((id) => clearTimeout(id));
}
function bkaComPrazo(p, etapa) {
  const ms = BKA_PRAZO[etapa] || 30000;
  let timer = null;
  const prazo = new Promise((_, rej) => {
    timer = bkaPrazoAgendar(() => {
      const e = new Error("a pasta não respondeu em " + Math.round(ms / 1000) + " s (" + etapa + ")");
      e.name = "TimeoutError"; e.etapa = etapa;
      rej(e);
    }, ms);
  });
  return Promise.race([Promise.resolve(p), prazo]).finally(() => { if (timer != null) { try { bkaPrazoCancelar(timer); } catch (e) {} } });
}
async function bkaPermitido(pedir) {
  if (!bkaPasta) { bkaPermissao = ""; return ""; }
  const h = bkaPasta;
  let p = "granted";
  try {
    /* (19.207.0) COM O TOQUE DA PESSOA, PEDE DIRETO. No caso real (26/11, Chrome 158) a CONSULTA (queryPermission) da
     * pasta guardada nunca respondia, embora a pasta do Drive estivesse normal no Windows. O pedido (requestPermission)
     * devolve "granted" na hora quando já há permissão, e só mostra o pedido do navegador quando falta — então, havendo
     * toque, a consulta não é necessária. Sem toque (o automático), continua só consultando. */
    if (pedir && typeof bkaPasta.requestPermission === "function") p = await bkaComPrazo(bkaPasta.requestPermission({ mode: "readwrite" }), "pedir");
    else if (typeof bkaPasta.queryPermission === "function") p = await bkaComPrazo(bkaPasta.queryPermission({ mode: "readwrite" }), "permissao");
  } catch (e) { p = e && e.name === "TimeoutError" ? "sem_resposta" : "denied"; }
  /* (19.208.0) a resposta da pasta ANTIGA não vale para a pasta nova escolhida no meio da espera */
  if (bkaPasta !== h) return p || "?";
  bkaPermissao = p || "?";
  return bkaPermissao;
}
/* a permissão VENCEU (o navegador esqueceu: "prompt"/"denied") — "sem_resposta" é a pasta que não respondeu, não isto */
function bkaPermVencida() { return !!bkaPermissao && bkaPermissao !== "granted" && bkaPermissao !== "sem_resposta" && bkaPermissao !== "?"; }
async function bkaEscrever(nome, dados) {
  return bkaComPrazo((async () => {
    const fh = await bkaPasta.getFileHandle(nome, { create: true });
    const w = await fh.createWritable();
    try { await w.write(dados); }
    catch (e) { try { if (w.abort) await w.abort(); } catch (x) {} throw e; }
    await w.close();
  })(), "gravar");
}

/* ---------------- (19.206.0) o registro das tentativas ---------------- */
const BKA_TENT_CHAVE = "eac_bka_tentativas";
const BKA_TENT_MAX = 30;
let bkaTentAtual = null;
function bkaTentativas() {
  try { const l = JSON.parse(localStorage.getItem(BKA_TENT_CHAVE) || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
function bkaTentIni(motivo, gesto) {
  bkaTentAtual = { q: new Date(bkaRelogio()).toISOString(), m: String(motivo || ""), g: !!gesto, e: [], r: "" };
  return bkaTentAtual;
}
function bkaEtapa(nome) {
  const ta = bkaTentAtual;
  if (!ta) return;
  ta.e.push({ n: nome, ms: Math.max(0, bkaRelogio() - new Date(ta.q).getTime()) });
}
function bkaTentFim(ta, res) {
  if (!ta) return res;
  if (bkaTentAtual === ta) bkaTentAtual = null;
  const r = res || {};
  ta.r = r.ok ? (r.igual ? "igual" : "gravou") : (r.razao || "erro");
  if (r.nome) ta.a = r.nome;
  if (r.erro) ta.x = String(r.erro).slice(0, 200);
  ta.ms = Math.max(0, bkaRelogio() - new Date(ta.q).getTime());
  ta.p = bkaPermissao || "?";
  try { localStorage.setItem(BKA_TENT_CHAVE, JSON.stringify([ta].concat(bkaTentativas()).slice(0, BKA_TENT_MAX))); } catch (e) {}
  return res;
}
/* uma linha por tentativa: "26/11 09:14:42 · pedido (toque) · permissão… → sem resposta em 10,0 s" */
function bkaTentLinha(x) {
  const d = new Date(x.q);
  const p2 = (n) => String(n).padStart(2, "0");
  const q = isNaN(d.getTime()) ? "?" : p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
  const seg = (ms) => (Math.round((ms || 0) / 100) / 10).toFixed(1).replace(".", ",") + " s";
  /* quanto CADA etapa levou (até a seguinte começar; a última, até o fim) — não a hora em que começou */
  const es = x.e || [];
  const etapas = es.map((e, i) => e.n + " " + seg((i + 1 < es.length ? es[i + 1].ms : (x.ms || e.ms)) - e.ms)).join(" › ");
  return q + " · " + (x.m || "-") + (x.g ? " (toque)" : "") + " · " + t("bka_tent_r_" + (x.r || "erro")) + " em " + seg(x.ms)
    + (x.a ? " · " + x.a : "") + (x.x ? " · " + x.x : "") + (etapas ? " · etapas: " + etapas : "") + " · permissão: " + (x.p || "?");
}
/* o relatório do backup para colar numa conversa de suporte (sem nada dos dados: só o estado e as tentativas) */
function bkaRelatorio() {
  const est = bkaEstado();
  const L = [];
  L.push("EasyAnkiCards " + (typeof VERSAO !== "undefined" ? VERSAO : "?") + " — relatório do backup automático — " + (typeof diagQuando === "function" ? diagQuando(Date.now()) : new Date().toString()) + (typeof diagFuso === "function" ? " (" + diagFuso() + ")" : ""));
  L.push("navegador: " + String((typeof navigator !== "undefined" && navigator.userAgent) || "?").replace(/^.*?(Chrome\/[\d.]+|Edg\/[\d.]+|Firefox\/[\d.]+).*$/, "$1")
    + " · recurso de pasta: " + (bkaPodeAutomatico() ? "sim" : "não"));
  L.push("automático: " + (est.ligado ? "ligado" : "desligado") + " · pasta: " + (est.pasta || "?") + " · conectada nesta aba: " + (bkaPasta ? "sim" : "não")
    + " · permissão: " + (bkaPermissao || "?") + " · aparelho: " + bkaAparelho());
  L.push("gravando agora: " + (bkaGravando ? "sim, desde " + (bkaGravandoDesde ? Math.round((bkaRelogio() - bkaGravandoDesde) / 1000) + " s" : "?") : "não"));
  const local = (iso) => { const ms = new Date(iso).getTime(); return isNaN(ms) ? String(iso || "?") : (typeof diagQuando === "function" ? diagQuando(ms) : new Date(ms).toLocaleString()); };
  L.push("último backup: " + (est.ultimo && est.ultimo.nome ? local(est.ultimo.quando) + " · " + est.ultimo.nome : "nenhum"));
  const mp = bkaMotivoParado();
  if (mp) L.push("parado: " + mp);
  if (est.erro) L.push("falha: " + (est.erro.cod || "?") + " · " + (est.erro.n || 1) + "ª seguida · " + (est.erro.msg || "") + (est.erro.proxima ? " · próxima tentativa " + local(est.erro.proxima) : ""));
  if (est.pausado) L.push("pausado (encolheu): " + (est.pausado.nome || ""));
  if (est.travado) L.push("travado: há backup mais novo de " + (est.travado.aparelho || "?"));
  const ts = bkaTentativas();
  L.push("tentativas (" + ts.length + ", a mais nova primeiro):");
  ts.forEach((x) => L.push("  " + bkaTentLinha(x)));
  return L.join("\n");
}
async function bkaCopiarRelatorio() {
  const txt = bkaRelatorio();
  try { reg("BACKUP", "relatório do backup copiado", bkaTentativas().length + " tentativa(s)"); } catch (e) {}
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(txt); if (typeof toast === "function") toast("bka_rel_copiado"); return txt; }
  } catch (e) {}
  if (typeof uiTexto === "function") await uiTexto(t("bka_rel_manual"), txt);
  return txt;
}
async function bkaListar() {
  return bkaComPrazo((async () => {
    const out = [];
    for await (const [nome, h] of bkaPasta.entries()) if (h && h.kind !== "directory") out.push([nome, h]);
    return out;
  })(), "listar");
}
/* =====================================================================
 * (19.129.0) RETENÇÃO EM DEGRAUS
 *
 * Só as 7 diárias ficavam. Uma perda que o "encolheu" não vê (pequena, ou de conteúdo) e que a pessoa só nota na
 * segunda semana já não tinha cópia boa na pasta. Agora ficam:
 *  · as 7 cópias diárias mais recentes;
 *  · das mais velhas que essas, a MAIS NOVA de cada semana (segunda a domingo), para as 4 semanas mais recentes;
 *  · e, do que ainda sobrar, a MAIS NOVA de cada mês, para os 6 meses mais recentes.
 * São no máximo 17 arquivos deste aparelho (7 + 4 + 6). A cópia que vira semanal ou mensal é a que já estava na pasta — ninguém
 * regrava arquivo velho. "dias" = ["AAAAMMDD", …] em qualquer ordem; devolve o conjunto dos que FICAM.
 * ===================================================================== */
function bkaSemanaDe(dia) {
  const d = new Date(Number(dia.slice(0, 4)), Number(dia.slice(4, 6)) - 1, Number(dia.slice(6, 8)));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));     /* a segunda-feira da semana */
  return bkaDia(d);
}
function bkaQuaisFicam(dias) {
  const L = [...new Set(dias || [])].sort().reverse();
  const fica = new Set(L.slice(0, BKA_DIAS));
  const resto = L.slice(BKA_DIAS);
  const semanas = new Set(), meses = new Set(), depoisDasSemanas = [];
  resto.forEach((d) => {
    const s = bkaSemanaDe(d);
    /* os outros dias de uma semana já guardada saem: a mensal só olha para o que é MAIS VELHO que as semanais */
    if (semanas.has(s)) return;
    if (semanas.size < BKA_SEMANAS) { semanas.add(s); fica.add(d); } else depoisDasSemanas.push(d);
  });
  depoisDasSemanas.forEach((d) => {
    const m = d.slice(0, 6);
    if (meses.has(m)) return;
    if (meses.size < BKA_MESES) { meses.add(m); fica.add(d); }
  });
  return fica;
}
/* a rotação: arquivos automáticos DESTE aparelho; os diários que a retenção em degraus não guarda e os "encolheu" com
 * mais de 7 dias. Nada de outro aparelho, nada que não tenha o nome do automático. */
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
  const fica = bkaQuaisFicam(diarios.map((x) => x[0]));
  diarios.forEach(([d, nome]) => { if (!fica.has(d)) apagar.push(nome); });
  for (const nome of apagar) { try { await bkaPasta.removeEntry(nome); } catch (e) {} }
  return apagar;
}

/* ---------------- gravar ---------------- */
function bkaGravarAgora(motivo, opc) {
  const o = opc || {};
  /* (19.206.0) uma gravação por vez — mas a pessoa que toca em "Salvar agora" não espera uma presa há mais de 20 s
   * (com os prazos isso não deve acontecer; se acontecer, a nova segue e a velha é ignorada quando terminar) */
  if (bkaGravando && !o.novaPasta && !(o.gesto && bkaRelogio() - bkaGravandoDesde > 20000)) return bkaGravando;
  if (bkaGravando) { try { reg("BACKUP", "gravação anterior presa: abandonada", Math.round((bkaRelogio() - bkaGravandoDesde) / 1000) + " s · " + (motivo || "-")); } catch (e) {} }
  /* (19.40.0) o balão: "salvando…" enquanto grava; depois ✓ por um instante (ou o aviso, se falhou) */
  const est0 = bkaEstado();
  const vaiGravar = !!(est0.ligado && bkaPasta);
  /* (19.127.0) O BALÃO SÓ APARECE QUANDO HÁ O QUE GRAVAR. Ele acendia "salvando…" a cada tentativa — aos 30 minutos e
   * toda vez que a janela perdia o foco —, mesmo quando nada tinha mudado e nada era gravado: parecia backup sem parar.
   * Agora quem acende é bkaGravarDeVerdade, depois de ver que os dados mudaram. */
  bkaGravandoDesde = bkaRelogio();
  const ta = bkaTentIni(motivo, o.gesto);
  const esta = bkaGravarDeVerdade(motivo || "", o)
    .catch((e) => bkaFalhou(bkaEstado(), e))
    .then((r) => { bkaTentFim(ta, r); if (vaiGravar) bkaBolhaPintar(r && r.ok && !r.igual ? "gravou" : ""); return r; })
    .finally(() => { if (bkaGravando === esta) bkaGravando = null; });
  bkaGravando = esta;
  return esta;
}
async function bkaGravarDeVerdade(motivo, o) {
  const est = bkaEstado();
  /* (19.208.0) A TENTATIVA QUE FICOU PARA TRÁS NÃO MEXE EM NADA. No caso de 26/11 um "Salvar agora" ficou 60 s esperando a
   * pasta antiga; no meio, a pessoa escolheu a pasta de novo e o backup GRAVOU; quando a tentativa velha terminou, a falha
   * dela regravou o estado de antes por cima ("último backup: 22/11", "permissão: sem_resposta"). Agora cada tentativa
   * guarda a pasta com que começou: se a pasta mudou, ela sai como "substituída", sem tocar no estado. */
  const pasta = bkaPasta;
  const falhou = (e) => (bkaPasta !== pasta ? { ok: false, razao: "obsoleta" } : bkaFalhou(bkaEstado(), e));
  if (!est.ligado || !bkaPasta) { if (est.ligado) bkaRegistrarNaoTentou("sem_pasta", motivo); return { ok: false, razao: "sem_pasta" }; }
  bkaUltimaTentativa = bkaRelogio();
  bkaEtapa("permissão");
  const perm = await bkaPermitido(!!o.gesto);
  /* (19.206.0) a pasta não respondeu à pergunta da permissão: é falha passageira (Drive fora), não permissão vencida */
  if (perm === "sem_resposta") { const eT = new Error("a pasta não respondeu à pergunta da permissão"); eT.name = "TimeoutError"; return falhou(eT); }
  if (perm !== "granted") { bkaRegistrarNaoTentou("permissao " + (bkaPermissao || "?"), motivo); bkaPintarTudo(); return { ok: false, razao: "permissao", permissao: perm }; }
  let bk;
  bkaEtapa("dados");
  try { await bkaComPrazo(bkEsperarDados(), "dados"); bk = montarBackup(); } catch (e) { return falhou(e); }
  const hash = bkaImpressao(bk.dados);
  if (!o.forcar && est.ultimo && est.ultimo.hash === hash) {
    /* (19.167.0) havia falha: confere se a pasta voltou a responder; se sim, o aviso sai — a última cópia já está em dia */
    if (est.erro) {
      try { await bkaListar(); } catch (e) { return falhou(e); }
      bkaFalhaResolvida(est, "a pasta voltou a responder (nada novo a gravar)");
      bkaEstadoGravar(est);
      bkaPintarTudo();
    }
    return { ok: true, igual: true };
  }
  try { bkaBolhaPintar("gravando"); } catch (e) {}
  /* (19.40.0) NÃO SOBREPOR O MAIS NOVO. Cada aparelho grava o SEU arquivo — nunca apaga o do outro —, mas um aparelho
   * desatualizado que segue gravando deixa o arquivo DELE como o mais novo da pasta, e o outro aparelho passa a ver
   * "backup mais novo" com dados velhos (e pode restaurá-los). Havendo um backup de outro aparelho mais novo que a
   * base daqui, o automático PARA até a pessoa conferir: restaurar o outro, ou dizer "manter os deste aparelho". */
  if (!o.ignorarMaisNovo) {
    bkaEtapa("procurar mais novo");
    try { await bkaComPrazo(bkaProcurarMaisNovo(), "procurar"); } catch (e) {}
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
    const texto = JSON.stringify(typeof bkComRegistro === "function" ? bkComRegistro(bk) : bk, null, 1);
    bkaEtapa("compactar");
    const dados = gz ? await bkaComPrazo(bkGzip(texto), "compactar") : texto;
    bkaEtapa("gravar");
    const enc = o.aceitarEncolhido ? [] : bkaEncolheu(bkaReferencia(est), bk.resumo);
    if (enc.length) {
      const nome = bkaNome(aparelho, agora, true, gz);
      await bkaEscrever(nome, dados);
      est.pausado = { quando: agora.toISOString(), nome, encolheu: enc, hash };
      bkaFalhaResolvida(est, "gravou à parte (encolheu)");
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
    bkaFalhaResolvida(est, "gravou " + nome);
    bkaEstadoGravar(est);
    bkaMarcarSalvo(nome, est.ultimo.quando);
    /* (19.206.0) limpar as cópias antigas não desfaz o que já foi gravado: se a pasta travar aqui, fica para a próxima */
    bkaEtapa("limpar antigas");
    let apagados = [];
    try { apagados = await bkaComPrazo(bkaRodar(agora), "limpar"); } catch (e) { try { reg("BACKUP", "limpeza das cópias antigas não terminou", String((e && e.message) || e)); } catch (x) {} }
    reg("BACKUP", "automático gravado", nome + " · " + motivo + (apagados.length ? " · rotação: " + apagados.join(", ") : ""));
    bkaPintarTudo();
    return { ok: true, nome, apagados };
  } catch (e) { return falhou(e); }
}
/* =====================================================================
 * (19.167.0) A FALHA EXPLICADA, A NOVA TENTATIVA SOZINHA E O ALARME SÓ QUANDO INSISTE
 *
 * O caso real: "recebi notificação sobre backup faltando arquivos". O balão dizia "Backup falhou" e o painel, em
 * inglês, "A requested file or directory could not be found…" — a pasta do Google Drive não respondeu por um instante
 * (desconectado, reiniciando, sincronizando). Nada tinha se perdido, mas a mensagem assustava, não dizia o que fazer, e
 * a próxima tentativa só vinha 30 minutos depois (ou ao trocar de janela). Pior: se nada mudou desde o último backup bom,
 * a tentativa seguinte nem gravava ("igual") e o aviso de falha nunca saía.
 *  · a falha vira CAUSA e AÇÃO em português (pasta que não respondeu, permissão vencida, sem espaço, arquivo em uso pela
 *    sincronização, gravação interrompida), com o texto técnico à parte, para relatar;
 *  · a falha passageira tenta de novo SOZINHA em 2, 5 e depois a cada 15 minutos — com a hora da próxima à vista;
 *  · o alarme (vermelho, "Backup falhou") só a partir da 3ª falha seguida, ou de cara quando não é passageira; antes,
 *    o balão diz "Tentando de novo", em amarelo;
 *  · se a pasta volta a responder e os dados são os mesmos do último backup bom, o aviso sai (a cópia da pasta já está
 *    em dia).
 * ===================================================================== */
const BKA_REPETIR_MIN = [2, 5, 15];
const BKA_REPETIR_MAX = 30;
let bkaRepetirTimer = null;
function bkaErroExplicar(e) {
  const nome = String((e && e.name) || "");
  const msg = String((e && (e.message || e.name)) || e || "");
  const tem = (re) => re.test(nome) || re.test(msg);
  /* (19.206.0) a pasta que não respondeu no prazo (Google Drive desconectado, travado ou sincronizando) */
  if (tem(/Timeout|n[ãa]o respondeu/i)) return { cod: "sem_resposta", transitorio: true, acao: "tentar" };
  if (tem(/NotAllowed|Security|permission|denied/i)) return { cod: "permissao", transitorio: false, acao: "reconectar" };
  if (tem(/QuotaExceeded|quota|no space|not enough space|disk full|disco cheio|espa[çc]o/i)) return { cod: "espaco", transitorio: false, acao: "tentar" };
  if (tem(/NotFound|could not be found|not found|n[ãa]o encontrad/i)) return { cod: "pasta_sumiu", transitorio: true, acao: "" };
  if (tem(/NoModificationAllowed|InvalidState|in use|being used|lock|busy|em uso/i)) return { cod: "ocupado", transitorio: true, acao: "" };
  if (tem(/Abort|interrupt|interrompid/i)) return { cod: "interrompido", transitorio: true, acao: "" };
  return { cod: "outro", transitorio: true, acao: "tentar" };
}
/* a falha guardada (das versões antigas também, que só tinham "msg") com a explicação */
function bkaErroInfo(erro) {
  if (!erro) return null;
  const ex = erro.cod ? Object.assign(bkaErroExplicar({ name: "", message: "" }), { cod: erro.cod, transitorio: ["pasta_sumiu", "ocupado", "interrompido", "outro", "sem_resposta"].indexOf(erro.cod) >= 0, acao: erro.cod === "permissao" ? "reconectar" : erro.cod === "espaco" || erro.cod === "outro" || erro.cod === "sem_resposta" ? "tentar" : "" }) : bkaErroExplicar({ message: erro.msg });
  const n = erro.n || 1;
  return Object.assign({}, ex, { n, grave: !ex.transitorio || n >= 3, texto: t("bka_erro_" + ex.cod), desde: erro.desde || erro.quando, proxima: erro.proxima || "" });
}
function bkaFalhou(est0, e) {
  /* (19.208.0) o estado de AGORA (quem chama pode ter lido antes de uma espera longa): a falha não desfaz o que gravou */
  const est = bkaEstado();
  void est0;
  const ex = bkaErroExplicar(e);
  const ant = est.erro || null;
  const agoraMs = bkaRelogio();
  const n = (ant && ant.n ? ant.n : (ant ? 1 : 0)) + 1;
  const espera = ex.transitorio && n <= BKA_REPETIR_MAX ? BKA_REPETIR_MIN[Math.min(n - 1, BKA_REPETIR_MIN.length - 1)] * 60000 : 0;
  est.erro = { quando: new Date(agoraMs).toISOString(), msg: String((e && (e.message || e.name)) || "?").slice(0, 300), cod: ex.cod, n,
    desde: (ant && (ant.desde || ant.quando)) || new Date(agoraMs).toISOString(), proxima: espera ? new Date(agoraMs + espera).toISOString() : "" };
  bkaEstadoGravar(est);
  try { reg("BACKUP", "automático falhou", ex.cod + " · " + n + "ª seguida · " + est.erro.msg + (espera ? " · nova tentativa em " + Math.round(espera / 60000) + " min" : "")); } catch (x) {}
  if (bkaRepetirTimer) { clearTimeout(bkaRepetirTimer); bkaRepetirTimer = null; }
  if (espera) bkaRepetirTimer = setTimeout(() => { bkaRepetirTimer = null; try { bkaGravarAgora("nova tentativa"); } catch (x) {} }, espera);
  bkaPintarTudo();
  return { ok: false, razao: "erro", erro: est.erro.msg, cod: ex.cod };
}
/* (19.167.0) POR QUE O AUTOMÁTICO NÃO ESTÁ GRAVANDO, sem erro nenhum ("" = está apto) — o diagnóstico e o painel usam */
function bkaMotivoParado() {
  const est = bkaEstado();
  if (!bkaPodeAutomatico() || !est.ligado) return "";
  if (est.pausado) return "pausado porque os dados encolheram — confira no painel do backup";
  if (est.travado) return "há backup mais novo de outro aparelho (" + (est.travado.aparelho || "?") + ") — confira no painel do backup";
  if (!bkaPasta) return "a pasta não está conectada nesta aba (o navegador esqueceu) — toque no balão “Reconectar backup”";
  if (bkaPermVencida()) return "a permissão da pasta venceu (" + bkaPermissao + ") — nada é gravado até tocar no balão “Reconectar backup”";
  if (bkaPermissao === "sem_resposta") return "a pasta não respondeu (Google Drive desconectado ou travado?) — o automático tenta de novo sozinho; com o Drive aberto, toque em “Salvar agora”";
  return "";
}
/* há mudança nos dados que ainda não foi para a pasta? { mudou, tentativa, aberta: desde quando esta aba roda o
 * automático } (null se não dá para saber) */
function bkaMudancasSemCopia() {
  const est = bkaEstado();
  if (!est.ultimo || !est.ultimo.hash || typeof montarBackup !== "function") return null;
  try { return { mudou: bkaImpressao(montarBackup().dados) !== est.ultimo.hash, tentativa: bkaUltimaTentativa || 0, aberta: bkaIniciadoEm || 0 }; } catch (e) { return null; }
}
/* (19.167.1) O AUTOMÁTICO QUE NEM TENTA GRAVAR era calado: sem pasta nesta aba ou com a permissão vencida, ele voltava
 * sem deixar rastro — no dia 17/11 passaram 14 horas de uso sem nenhum evento de backup, e não dava para saber por quê.
 * Agora fica UM registro por motivo em cada sessão (sem repetir a cada 30 minutos). */
const bkaNaoTentouVistos = new Set();
function bkaRegistrarNaoTentou(razao, motivo) {
  if (bkaNaoTentouVistos.has(razao)) return false;
  bkaNaoTentouVistos.add(razao);
  try { reg("BACKUP", "automático não gravou", razao + " · " + (motivo || "-")); } catch (e) {}
  return true;
}
/* a gravação deu certo (ou a pasta voltou e não havia o que gravar): a falha sai, e o registro diz depois de quantas */
function bkaFalhaResolvida(est, como) {
  if (bkaRepetirTimer) { clearTimeout(bkaRepetirTimer); bkaRepetirTimer = null; }
  if (!est.erro) return false;
  const n = est.erro.n || 1;
  delete est.erro;
  try { reg("BACKUP", "backup automático voltou a funcionar", como + " · depois de " + n + " falha(s)"); } catch (x) {}
  return true;
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
    try { mudou = !est.ultimo || est.ultimo.hash !== bkaImpressao(montarBackup().dados); } catch (e) {}
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
  try { await bkaComPrazo(bkaPastaLoja().gravar(h), "dados"); } catch (e) { /* sem guardar a pasta, vale só nesta sessão */ }
  const est = bkaEstado();
  est.ligado = true;
  est.pasta = h.name || "";
  delete est.erro;
  bkaEstadoGravar(est);
  bkaPermissao = "granted";
  reg("BACKUP", "pasta do automático escolhida", est.pasta);
  /* (19.208.0) novaPasta: não reaproveita uma gravação presa na pasta antiga */
  const r = await bkaGravarAgora("ao escolher a pasta", { gesto: true, forcar: true, novaPasta: true });
  try { await bkaComPrazo(bkaProcurarMaisNovo(), "procurar"); } catch (e) {}
  return r;
}
/* (19.208.0) "Escolher a pasta de novo": a janela de escolher (com o toque ainda valendo), grava e DIZ o resultado */
async function bkaEscolherDeNovo() {
  let r;
  try { r = await bkaConectar(); } catch (e) { r = { ok: false, razao: "erro", erro: String((e && e.message) || e) }; }
  bkaPintarTudo();
  if (r && r.ok) await uiAlert(t("bka_muda_ok", { n: r.nome || (bkaEstado().ultimo || {}).nome || "" }));
  else if (r && r.razao !== "cancelado" && r.razao !== "erro") await uiAlert(bkaPorQueNaoGravou(r) + "\n\n" + t("bka_muda_nao_abriu"));
  return r;
}
async function bkaReconectar() {
  if ((await bkaPermitido(true)) !== "granted") { bkaPintarTudo(); return { ok: false, razao: "permissao" }; }
  const r = await bkaGravarAgora("ao reconectar", { gesto: true });
  await bkaProcurarMaisNovo();
  return r;
}
/* (19.208.0) A PASTA MUDA: o navegador deixou de responder pela pasta guardada (nem a consulta nem o pedido de
 * permissão respondem). No caso de 26/11 foram 4 tentativas, a última de 60 s com o toque da pessoa. Daí em diante só
 * escolher a pasta de novo resolve (o navegador ganha uma ligação nova) — então é isso que o app oferece, direto. */
function bkaPastaMuda() {
  const est = bkaEstado();
  return !!(est.ligado && bkaPasta && (bkaPermissao === "sem_resposta" || (est.erro && est.erro.cod === "sem_resposta")));
}
async function bkaGravarPedido() {
  /* com a pasta muda, "Salvar agora" abre a escolha da pasta (ANTES de qualquer espera: o navegador só abre a janela
   * com o toque ainda valendo) e grava em seguida — em vez de esperar 60 s por uma resposta que não vem */
  if (bkaPastaMuda()) {
    try { reg("BACKUP", "salvar agora com a pasta muda: escolher a pasta de novo", (bkaEstado().erro && bkaEstado().erro.n || 0) + " falha(s) seguidas"); } catch (e) {}
    return bkaEscolherDeNovo();
  }
  if (bkaMaisNovo) {
    const ok = await uiConfirm(t("bka_conf_sobrepor", { a: bkaMaisNovo.aparelho }));
    if (!ok) return { ok: false, razao: "cancelado" };
    return bkaManterDesteAparelho();
  }
  /* (19.206.0) O BOTÃO RESPONDE SEMPRE: "Salvando…" enquanto grava, e o porquê quando não grava (antes só o sucesso
   * tinha aviso — a falha só repintava o painel, e parecia que o botão não fazia nada) */
  try { reg("BACKUP", "salvar agora tocado", bkaGravando ? "havia gravação em andamento há " + Math.round((bkaRelogio() - bkaGravandoDesde) / 1000) + " s" : "-"); } catch (e) {}
  const bt = $("btnBkaGravar");
  if (bt) { bt.disabled = true; try { if (typeof bkBotaoRotulo === "function") bkBotaoRotulo(bt, t("bka_salvando"), t("bka_salvando_sub")); else bt.textContent = t("bka_salvando"); } catch (e) {} }
  let r;
  try { r = await bkaGravarAgora("pedido", { gesto: true, forcar: true }); }
  catch (e) { r = { ok: false, razao: "erro", erro: String((e && e.message) || e) }; }
  finally { bkaPintarTudo(); }
  r = r || { ok: false, razao: "erro" };
  if (r.ok) await uiAlert(t("bka_gravado", { n: r.nome }));
  else if (r.razao !== "cancelado") await uiAlert(bkaPorQueNaoGravou(r));
  return r;
}
/* a explicação, em português, de uma gravação pedida que não aconteceu */
function bkaPorQueNaoGravou(r) {
  const est = bkaEstado();
  let porque;
  if (r.razao === "permissao") porque = t("bka_nao_permissao");
  else if (r.razao === "sem_pasta") porque = t("bka_nao_sem_pasta");
  else if (r.razao === "mais_novo") porque = t("bka_nao_mais_novo", { a: r.aparelho || "?" });
  else if (r.razao === "encolheu") porque = t("bka_nao_encolheu");
  else if (est.erro) porque = bkaErroInfo(est.erro).texto;
  else porque = String(r.erro || r.razao || "?");
  return t("bka_nao_gravou", { p: porque });
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
/* =====================================================================
 * (19.127.0) O QUE ENCOLHEU, À VISTA — antes de a pessoa responder "fui eu"
 *
 * O aviso era um parágrafo: "tópicos marcados caiu de 62 para 9. Isso costuma ser…" e um botão vermelho. Não dava para
 * avaliar: caiu ONDE? o resto está inteiro? o que acontece se eu apertar? Agora o painel mostra, com números e barra,
 * cada item que caiu; diz quantos itens ficaram iguais (com a tabela inteira a um toque); abre a última cópia boa da
 * pasta para dizer EM QUAL EDITAL foi; e põe as duas saídas lado a lado, cada uma com a sua consequência.
 * ===================================================================== */
function bkaComparacao(est) {
  const e = est || bkaEstado();
  const antes = bkaReferencia(e) || {};
  let agora = {};
  try { agora = resumoAtual(); } catch (x) { agora = {}; }
  const graves = {};
  ((e.pausado && e.pausado.encolheu) || []).forEach((x) => { graves[x.chave] = x; });
  const linhas = Object.keys(BK_ROTULOS).map((k) => {
    const de = Number(antes[k]) || 0, para = Number(agora[k]) || 0;
    return { chave: k, rotulo: BK_ROTULOS[k], de, para, dif: para - de, pct: de ? Math.round((para - de) * 100 / de) : 0,
      tipo: graves[k] && para < de ? "caiu" : para < de ? "menos" : para > de ? "mais" : "igual" };
  });
  return { linhas, caiu: linhas.filter((l) => l.tipo === "caiu"), menos: linhas.filter((l) => l.tipo === "menos"),
    mais: linhas.filter((l) => l.tipo === "mais"), iguais: linhas.filter((l) => l.tipo === "igual") };
}
/* a última cópia BOA, lida da pasta: { nome, quando, editais:[{nome, de, para, sumiu}] } — ou null se não der para ler */
async function bkaOndeEncolheu(est) {
  const e = est || bkaEstado();
  if (!bkaPasta || !e.ultimo || !e.ultimo.nome) return null;
  try {
    const fh = await bkaPasta.getFileHandle(e.ultimo.nome);
    const f = await fh.getFile();
    const obj = JSON.parse(await bkTextoDoArquivo({ name: e.ultimo.nome, arrayBuffer: () => f.arrayBuffer(), text: () => f.text() }));
    const lista = (dados) => { try { const L = JSON.parse((((dados || {}).edital || {}).eac_editais) || "[]"); return Array.isArray(L) ? L : []; } catch (x) { return []; } };
    const A = lista(obj.dados), B = lista(montarBackup().dados);
    const n = (x) => Object.keys((x && x.progresso) || {}).length;
    const editais = A.map((a) => { const b = B.find((y) => y.id === a.id); return { nome: a.nome || a.id, de: n(a), para: b ? n(b) : 0, sumiu: !b }; });
    return { nome: e.ultimo.nome, quando: e.ultimo.quando, editais };
  } catch (x) { return null; }
}
/* abre a conferência de restauração com a última cópia boa (nada é trocado sem a confirmação de lá) */
async function bkaVerBoa() {
  const est = bkaEstado();
  if (!bkaPasta || !est.ultimo || !est.ultimo.nome) return false;
  try {
    const fh = await bkaPasta.getFileHandle(est.ultimo.nome);
    const f = await fh.getFile();
    await bkLerArquivo({ name: est.ultimo.nome, arrayBuffer: () => f.arrayBuffer(), text: () => f.text() });
    return true;
  } catch (e) {
    await uiAlert(t("bka_enc_sem_boa", { n: est.ultimo.nome }));
    return false;
  }
}
function bkaPainelEncolheu(cx, est) {
  const c = bkaComparacao(est);
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt !== undefined) x.textContent = txt; return x; };
  const p = el("div", "bka-enc");
  p.id = "bkaEnc";
  p.append(el("div", "bka-enc-tit", t("bka_enc_tit", { q: est.ultimo && est.ultimo.quando ? bkQuandoCurto(est.ultimo.quando) : t("bka_enc_ref_manual") })));
  const num = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
  c.caiu.forEach((l) => {
    const it = el("div", "bka-enc-item");
    const topo = el("div", "bka-enc-topo");
    topo.append(el("span", "bka-enc-rot", l.rotulo), el("span", "bka-enc-nums", l.de + " → " + l.para),
      el("span", "bka-enc-selo", "▼ " + num(l.dif) + " (" + num(l.pct) + "%)"));
    const trilho = el("div", "bka-enc-trilho");
    const fica = el("div", "bka-enc-fica");
    fica.style.width = Math.max(0, Math.min(100, l.de ? Math.round(l.para * 100 / l.de) : 0)) + "%";
    trilho.append(fica);
    trilho.title = t("bka_enc_barra", { f: l.para, s: l.de - l.para });
    it.append(topo, trilho);
    p.append(it);
  });
  /* EM QUAL EDITAL — vem da última cópia boa, lida da pasta (chega depois; sem ela, a linha não aparece) */
  const onde = el("div", "bka-enc-onde");
  onde.id = "bkaEncOnde";
  onde.hidden = true;
  p.append(onde);
  if (c.caiu.some((l) => l.chave === "progresso" || l.chave === "editais")) {
    bkaOndeEncolheu(est).then((r) => {
      if (!r || !onde.isConnected && typeof onde.isConnected === "boolean") return;
      const mud = r.editais.filter((x) => x.sumiu || x.para < x.de), iguais = r.editais.length - mud.length;
      if (!mud.length) return;
      onde.append(el("div", "bka-enc-sub", t("bka_enc_onde")));
      mud.forEach((x) => onde.append(el("div", "bka-enc-ed", x.sumiu ? t("bka_enc_ed_sumiu", { e: x.nome, de: x.de }) : t("bka_enc_ed", { e: x.nome, de: x.de, para: x.para }))));
      if (iguais) onde.append(el("div", "bka-enc-ed-ok", t("bka_enc_ed_iguais", { n: iguais })));
      onde.hidden = false;
    }).catch(() => {});
  }
  /* o resto: quantos ficaram iguais (o que tranquiliza), e a tabela inteira a um toque */
  const resto = el("div", "bka-enc-resto");
  resto.append(el("span", "bka-enc-ok", "✓ " + t("bka_enc_iguais", { n: c.iguais.length, t: c.linhas.length })));
  if (c.mais.length) resto.append(el("span", "bka-enc-mais", "▲ " + t("bka_enc_mais", { n: c.mais.length })));
  if (c.menos.length) resto.append(el("span", "bka-enc-menos", "▽ " + t("bka_enc_menos", { n: c.menos.length })));
  p.append(resto);
  const det = el("details", "bka-enc-det");
  det.append(el("summary", "", t("bka_enc_tabela")));
  const tab = el("table", "bk-tab bka-enc-tab");
  c.linhas.forEach((l) => {
    const tr = el("tr", l.tipo === "caiu" || l.tipo === "menos" ? "bk-perde" : l.tipo === "mais" ? "bk-ganha" : "bk-igual");
    tr.append(el("td", "", l.rotulo), el("td", "bk-num", String(l.de)), el("td", "bk-num", String(l.para)),
      el("td", "bk-dif", l.dif ? (l.dif < 0 ? "▼ " : "▲ ") + num(l.dif) : "="));
    tab.append(tr);
  });
  det.append(tab);
  p.append(det);
  cx.append(p);
  return c;
}

/* (19.127.0) "FUI EU" PEDE CONFIRMAÇÃO, COM O QUE SE PERDE ESCRITO. Um toque no botão vermelho fazia o backup passar a
 * gravar o estado encolhido como o bom — e, em 7 dias, a rotação levava embora a última cópia com os dados. */
async function bkaAceitarPedido() {
  const est = bkaEstado();
  let c = null, onde = null;
  try { c = bkaComparacao(est); } catch (e) { c = null; }
  try { onde = await bkaOndeEncolheu(est); } catch (e) { onde = null; }
  const linhas = ((c && c.caiu) || []).map((l) => "· " + t("bka_conf_item", { r: l.rotulo, de: l.de, para: l.para, n: l.de - l.para }));
  ((onde && onde.editais) || []).filter((x) => x.sumiu || x.para < x.de)
    .forEach((x) => linhas.push("   " + (x.sumiu ? t("bka_enc_ed_sumiu", { e: x.nome, de: x.de }) : t("bka_enc_ed", { e: x.nome, de: x.de, para: x.para }))));
  const msg = t("bka_conf_tit") + "\n\n" + (linhas.length ? linhas.join("\n") : t("bka_conf_sem_lista")) + "\n\n" + t("bka_conf_efeito", { d: BKA_DIAS });
  let sim = false;
  try { sim = await uiConfirm(msg); } catch (e) { sim = false; }
  if (!sim) { try { reg("BACKUP", "'fui eu' cancelado na confirmação", linhas.join(" ").slice(0, 200)); } catch (e) {} return { ok: false, razao: "cancelado" }; }
  try { reg("BACKUP", "'fui eu' confirmado", linhas.join(" ").slice(0, 200)); } catch (e) {}
  return bkaAceitarEncolhido();
}
/* (19.127.0) AS ÚLTIMAS CÓPIAS, RESUMIDAS: quando, por onde, e o que mudou em relação à anterior */
function bkaUltimasCopias(n) {
  const L = bkHistorico().slice(0, (n || 3) + 1);
  return L.slice(0, n || 3).map((x, k) => {
    const ant = L[k + 1], mud = [];
    if (ant && ant.resumo && x.resumo) Object.keys(BK_ROTULOS).forEach((c) => {
      const d = (Number(x.resumo[c]) || 0) - (Number(ant.resumo[c]) || 0);
      if (d) mud.push((d > 0 ? "+" : "−") + Math.abs(d) + " " + BK_ROTULOS[c]);
    });
    return { quando: x.quando, onde: x.onde, nome: x.nome, mudou: mud, primeira: !ant };
  });
}
function bkaPintarUltimas(cx) {
  const L = bkaUltimasCopias(3);
  if (!L.length) return;
  const cxh = document.createElement("div");
  cxh.className = "bka-hist";
  cxh.id = "bkaHist";
  const tit = document.createElement("div");
  tit.className = "bka-hist-tit";
  tit.textContent = t("bka_hist_tit");
  cxh.append(tit);
  L.forEach((x) => {
    const li = document.createElement("div");
    li.className = "bka-hist-lin";
    li.title = x.nome || "";
    const q = document.createElement("span"); q.className = "bka-hist-q"; q.textContent = bkQuandoCurto(x.quando);
    const o = document.createElement("span"); o.className = "bka-hist-o"; o.textContent = t(x.onde === "auto" ? "bka_hist_auto" : "bka_hist_manual");
    const m = document.createElement("span");
    m.className = "bka-hist-m" + (x.mudou.some((s) => s.charAt(0) === "−") ? " caiu" : "");
    m.textContent = x.primeira ? t("bka_hist_primeira") : x.mudou.length ? x.mudou.slice(0, 4).join(" · ") + (x.mudou.length > 4 ? " …" : "") : t("bka_hist_igual");
    li.append(q, o, m);
    cxh.append(li);
  });
  cx.append(cxh);
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
  try { if (typeof bkPintarSituacao === "function") bkPintarSituacao(); } catch (e) {}
  try { if (typeof atualizarSeloBase === "function") atualizarSeloBase(); } catch (e) {}
}
/* o que o selo do topo precisa dizer (null = nada a dizer, fica o selo de sempre) */
function bkaAvisoDoSelo() {
  const est = bkaEstado();
  if (!est.ligado) return null;
  if (est.pausado) return { txt: t("bka_selo_pausado"), cls: "sb-alerta" };
  /* (19.208.0) a pasta muda não se resolve sozinha: alarme, e o texto já diz o que fazer */
  if (bkaPastaMuda()) return { txt: t("bka_selo_muda"), cls: "sb-alerta" };
  /* (19.167.0) a falha passageira, nas primeiras vezes, é aviso ("tentando de novo"); o alarme é quando insiste */
  if (est.erro) { const ie = bkaErroInfo(est.erro); return ie.grave ? { txt: t("bka_selo_erro"), cls: "sb-alerta" } : { txt: t("bka_selo_tentando"), cls: "sb-aviso" }; }
  if (!bkaPasta || (bkaPermVencida())) return { txt: t("bka_selo_reconectar"), cls: "sb-aviso" };
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
  /* (19.42.0) cada botão com o que faz, embaixo do nome */
  const botao = (onde, txt, fn, cls, id, tip, sub) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = (cls || "btn btn-cinza") + " bk-bt";
    if (typeof bkBotaoRotulo === "function") bkBotaoRotulo(b, txt, sub); else b.textContent = txt;
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
  } else if (bkaPermVencida()) {
    nota(t("bka_permissao"), "bk-aviso grave");
    botao(linha(), t("bka_reconectar"), bkaReconectar, "btn btn-verde", "btnBkaReconectar", "", t("bka_reconectar_sub"));
  }
  if (est.pausado) {
    const itens = (est.pausado.encolheu || []).map((x) => t("bka_pausado_item", { r: x.rotulo, de: x.de, para: x.para })).join("; ");
    nota(t("bka_pausado", { lista: itens, n: est.pausado.nome }), "bk-aviso grave bka-pausado");
    /* (19.127.0) os números à vista, e as duas saídas com a consequência de cada uma */
    try { bkaPainelEncolheu(cx, est); } catch (e) {}
    nota(t("bka_enc_pergunta"), "bka-enc-pergunta");
    const ls = linha();
    if (bkaPasta && est.ultimo && est.ultimo.nome) botao(ls, t("bka_enc_ver_boa"), bkaVerBoa, "btn btn-azul", "btnBkaVerBoa", "", t("bka_enc_ver_boa_sub", { q: bkQuandoCurto(est.ultimo.quando) }));
    botao(ls, t("bka_aceitar"), bkaAceitarPedido, "btn btn-perigo", "btnBkaAceitar", t("bka_aceitar_tip"), t("bka_aceitar_sub"));
  }
  /* (19.208.0) A PASTA MUDA, em destaque: o que aconteceu em uma frase, há quanto tempo não há backup, e as duas saídas
   * — escolher a mesma pasta de novo (resolve) e baixar uma cópia agora (garante). O "não funcionou?" fica dobrado. */
  const muda = bkaPastaMuda();
  if (muda) {
    const card = document.createElement("div");
    card.className = "bka-muda";
    card.id = "bkaMuda";
    const tit = document.createElement("div");
    tit.className = "bka-muda-tit";
    tit.textContent = t("bka_muda_tit");
    card.append(tit);
    const tx = document.createElement("div");
    tx.className = "bka-muda-txt";
    tx.textContent = t("bka_muda_txt", { q: est.ultimo && est.ultimo.quando ? bkQuandoCurto(est.ultimo.quando) : t("bka_muda_nunca") });
    card.append(tx);
    const lb = document.createElement("div");
    lb.className = "btn-linha";
    card.append(lb);
    botao(lb, t("bka_escolher_de_novo"), bkaEscolherDeNovo, "btn btn-azul", "btnBkaEscolherDeNovo", "", t("bka_escolher_de_novo_sub", { p: est.pasta || "?" }));
    if (typeof bkBaixar === "function") botao(lb, t("bka_muda_baixar"), () => bkBaixar(), "btn btn-cinza", "btnBkaMudaBaixar", "", t("bka_muda_baixar_sub"));
    const dn = document.createElement("details");
    dn.className = "bka-muda-mais";
    const sn = document.createElement("summary");
    sn.textContent = t("bka_muda_nao_funcionou");
    dn.append(sn);
    const pn = document.createElement("div");
    pn.className = "nota";
    pn.textContent = t("bka_muda_nao_abriu");
    dn.append(pn);
    card.append(dn);
    cx.append(card);
  }
  /* (19.167.0) a falha explicada: a causa e o que fazer, desde quando, a próxima tentativa sozinha, "tentar agora" e o
   * texto técnico à parte. (19.208.0) Com a pasta muda, o cartão acima já diz tudo: aqui só o texto técnico. */
  if (est.erro && muda) nota(t("bka_erro_tecnico", { m: est.erro.msg }), "nota bka-erro-tec");
  else if (est.erro) {
    const ie = bkaErroInfo(est.erro);
    nota(t(ie.grave ? "bka_erro" : "bka_erro_tentando", { e: ie.texto }), "bk-aviso " + (ie.grave ? "grave" : "") + " bka-erro");
    const hm = (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    nota(t("bka_erro_quando", { d: bkQuandoCurto(ie.desde), n: ie.n }) + " · " + (ie.proxima ? t("bka_erro_proxima", { h: hm(ie.proxima) }) : t("bka_erro_sozinho_nao")), "nota bka-erro-quando");
    const le = linha();
    if (ie.acao === "reconectar") botao(le, t("bka_reconectar"), bkaReconectar, "btn btn-verde", "btnBkaErroReconectar");
    else if (bkaPasta) botao(le, t("bka_erro_tentar"), bkaGravarPedido, "btn btn-verde", "btnBkaErroTentar");
    nota(t("bka_erro_tecnico", { m: est.erro.msg }), "nota bka-erro-tec");
  }
  if (bkaMaisNovo) {
    const d = new Date(bkaMaisNovo.quando);
    nota(t("bka_mais_novo", { a: bkaMaisNovo.aparelho, q: bkQuandoCurto(d.toISOString()) }) + (bkaMaisNovo.localMudou ? " " + t("bka_mais_novo_local") : ""), "bk-aviso bka-mais-novo");
    if (est.travado) nota(t("bka_travado", { a: bkaMaisNovo.aparelho }), "bk-aviso grave bka-travado");
    const lm = linha();
    botao(lm, t("bka_ver_mais_novo"), bkaVerMaisNovo, "btn btn-azul", "btnBkaVerMaisNovo");
    botao(lm, t("bka_manter_deste"), bkaManterDesteAparelho, "btn btn-cinza", "btnBkaManterDeste", t("bka_manter_deste_tip"));
  }
  nota(est.ultimo && est.ultimo.nome ? t("bka_ultimo", { q: bkQuandoCurto(est.ultimo.quando), n: est.ultimo.nome }) : t("bka_ainda_nao"), "bk-txt bka-ultimo");
  try { bkaPintarUltimas(cx); } catch (e) {}
  /* com a pasta muda, a ação principal está no cartão do topo: o "Salvar agora" daqui não repete o pedido que não vem */
  if (bkaPasta && !muda) botao(linha(), t("bka_gravar_agora"), bkaGravarPedido, "btn btn-azul", "btnBkaGravar", "", t("bka_gravar_agora_sub"));
  /* (19.206.0) O REGISTRO DAS TENTATIVAS: cada uma com o motivo, o resultado, as etapas e o tempo — e o relatório para
   * colar numa conversa de suporte */
  const rg = document.createElement("details");
  rg.className = "bka-registro";
  rg.id = "bkaRegistro";
  const ts = bkaTentativas();
  const rs = document.createElement("summary");
  rs.textContent = t("bka_reg_tit", { n: ts.length });
  rg.append(rs);
  const lista = document.createElement("div");
  lista.className = "bka-reg-lista";
  if (!ts.length) { const p0 = document.createElement("div"); p0.className = "nota"; p0.textContent = t("bka_reg_vazio"); lista.append(p0); }
  ts.slice(0, 10).forEach((x) => {
    const d = document.createElement("div");
    d.className = "bka-reg-lin" + (x.r === "gravou" || x.r === "igual" ? "" : " bka-reg-falha");
    d.textContent = bkaTentLinha(x);
    lista.append(d);
  });
  rg.append(lista);
  const lr = document.createElement("div");
  lr.className = "btn-linha";
  rg.append(lr);
  botao(lr, t("bka_rel_copiar"), bkaCopiarRelatorio, "btn btn-cinza", "btnBkaRelatorio", t("bka_rel_tip"));
  cx.append(rg);
  /* (19.42.0) O QUE É RARO fica recolhido: nome do aparelho, mudar a pasta, desligar */
  const aj = document.createElement("details");
  aj.className = "bka-ajustes";
  const sm = document.createElement("summary");
  sm.textContent = t("bka_ajustes");
  aj.append(sm);
  const l = document.createElement("div");
  l.className = "btn-linha";
  aj.append(l);
  cx.append(aj);
  botao(l, t("bka_renomear"), bkaRenomearAparelho, "btn btn-cinza", "btnBkaRenomear", "", t("bka_renomear_sub"));
  botao(l, t("bka_trocar"), bkaConectar, "btn btn-cinza", "btnBkaTrocar", "", t("bka_trocar_sub"));
  botao(l, t("bka_desligar"), bkaDesligar, "btn btn-cinza", "btnBkaDesligar", "", t("bka_desligar_sub"));
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
    if (!i) return { k: "manual", ic: "💾", rot: t("bka_rot_sem"), txt: t("bka_bolha_manual_nunca"), cls: "bb-alerta" };
    if (i.dias >= BKA_BOLHA_DIAS_MANUAL) return { k: "manual", ic: "💾", rot: t("bka_rot_dias", { n: i.dias }), txt: t("bka_bolha_manual", { n: i.dias }), cls: i.dias > 7 ? "bb-alerta" : "bb-aviso" };
    return null;
  }
  const est = bkaEstado();
  if (bkaBolhaMomento === "gravando") return { k: "gravando", ic: "💾", rot: t("bka_rot_gravando"), txt: t("bka_bolha_gravando"), cls: "bb-grav" };
  const av = bkaAvisoDoSelo();
  if (av) {
    /* (19.41.0) a LEGENDA curta embaixo do círculo diz o problema sem precisar parar o mouse em cima */
    const rot = est.pausado ? t("bka_rot_pausado") : bkaPastaMuda() ? t("bka_rot_muda") : est.erro ? t(bkaErroInfo(est.erro).grave ? "bka_rot_erro" : "bka_rot_tentando")
      : (!bkaPasta || (bkaPermVencida())) ? t("bka_rot_reconectar")
      : est.travado ? t("bka_rot_travado") : t("bka_rot_mais_novo");
    return { k: "problema", ic: "!", rot, txt: av.txt, cls: av.cls === "sb-alerta" ? "bb-alerta" : "bb-aviso" };
  }
  if (!est.ligado) return { k: "desligado", ic: "💾", rot: t("bka_rot_off"), txt: t("bka_bolha_desligado"), cls: "bb-desl" };
  if (bkaBolhaMomento === "gravou") return { k: "gravou", ic: "✓", rot: t("bka_rot_salvo"), txt: t("bka_bolha_gravou"), cls: "bb-ok" };
  return null;
}
function bkaBolhaPosLer() {
  try { const p = JSON.parse(localStorage.getItem(BKA_BOLHA_POS) || "null"); if (p && isFinite(p.x) && isFinite(p.y)) return p; } catch (e) {}
  return { x: 1, y: 1 };              /* fração da área livre: canto de baixo, à direita */
}
const BKA_BOLHA_MEDIDAS = { tam: 46, mx: 44, my: 12, rodape: 36 };
function bkaBolhaPosicionar(el, p) {
  const w = (typeof window !== "undefined" && window.innerWidth) || 1024, h = (typeof window !== "undefined" && window.innerHeight) || 768;
  /* (19.41.0) a área livre desconta a LEGENDA embaixo do círculo (mais larga que ele): no canto ela não é cortada */
  const { tam, mx, my, rodape } = BKA_BOLHA_MEDIDAS;
  const x = Math.max(0, Math.min(1, p.x)), y = Math.max(0, Math.min(1, p.y));
  el.style.left = Math.round(mx + x * Math.max(0, w - tam - 2 * mx)) + "px";
  el.style.top = Math.round(my + y * Math.max(0, h - tam - my - rodape)) + "px";
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
  /* a legenda: "Backup auto OFF", "Reconectar", "Salvando…" — embaixo do círculo */
  const rot = document.createElement("span");
  rot.className = "bka-bolha-rot";
  rot.setAttribute("aria-hidden", "true");
  el.append(ic, rot);
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
      const w = window.innerWidth, h = window.innerHeight;
      const { tam, mx, my, rodape } = BKA_BOLHA_MEDIDAS;
      const p = { x: (el.offsetLeft - mx) / Math.max(1, w - tam - 2 * mx), y: (el.offsetTop - my) / Math.max(1, h - tam - my - rodape) };
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
  const st = bkaBolhaEstado() || {};
  try { reg("BACKUP", "balão do backup tocado", (st.k || "-") + (st.rot ? " · " + st.rot : "")); } catch (e) {}
  /* (19.42.0) RECONECTAR A UM TOQUE: com a pasta guardada e só a permissão vencida, o toque no balão é o gesto que o
   * navegador exige — o pedido dele abre direto, sem passar pelo painel (eram três toques) */
  const est = bkaEstado();
  if (st.k === "problema" && est.ligado && bkaPasta && bkaPermVencida() && !est.pausado && !est.erro) {
    return bkaReconectar();
  }
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
  if (el.children[1]) el.children[1].textContent = st.rot || "";
  el.title = st.txt + (st.k === "gravando" ? "" : " · " + t("bka_bolha_tocar"));
  el.setAttribute("aria-label", el.title);
  return st;
}

/* ---------------- começar ---------------- */
/* (19.167.1) quando esta aba começou a cuidar do automático: a primeira gravação espera BKA_PRIMEIRA, e o diagnóstico não
 * deve chamar de "não gravou" o que ainda não teve a vez */
let bkaIniciadoEm = 0;
async function bkaIniciar() {
  bkaIniciadoEm = bkaRelogio();
  bkaPintar();
  try { bkaBolhaPintar(); } catch (e) {}
  if (!bkaPodeAutomatico() || !bkaEstado().ligado) return;
  /* (19.206.0) OS BACKUPS SÃO AGENDADOS ANTES de perguntar pela pasta: se ela não responder, a abertura não fica presa
   * e o automático continua tentando (cada tentativa com o seu prazo).
   * A primeira gravação espera uns minutos de uso: o app acabou de abrir, e o que abriu estragado não deve ir para a
   * pasta antes de alguém olhar (a proteção do "encolheu" vale de todo jeito) */
  setTimeout(() => bkaGravarAgora("ao abrir"), BKA_PRIMEIRA);
  setInterval(() => { if (document.visibilityState !== "hidden") bkaGravarAgora("periódico"); }, BKA_INTERVALO);
  /* ao sair (aba escondida): tentativa de boa vontade — o navegador pode cortá-la; a periódica cobre o resto */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && bkaRelogio() - bkaUltimaTentativa > BKA_PAUSA_SAIR) bkaGravarAgora("ao sair");
  });
  try { bkaPasta = await bkaComPrazo(bkaPastaLoja().ler(), "permissao"); } catch (e) { bkaPasta = null; }
  if (bkaPasta) await bkaPermitido(false);
  if (bkaPermissao === "sem_resposta") { try { reg("BACKUP", "a pasta não respondeu ao abrir", "permissão sem resposta em " + Math.round(BKA_PRAZO.permissao / 1000) + " s"); } catch (e) {} }
  bkaPintarTudo();
  if (bkaPermissao === "granted") bkaProcurarMaisNovo();
}
