/* =====================================================================
 * LEIS DO EDITAL (19.138.0)
 *
 * O PEDIDO: do ⚖ de um tópico na agenda, chegar às leis do edital, separadas por disciplina e na ordem do peso para a
 * prova, e ver o que ainda falta ler.
 *
 * DUAS DECISÕES:
 *  · o ⚖ do tópico abre ESTA tela com o tópico em destaque no topo ("Neste tópico"): quem tocou num tópico quer a lei
 *    dele, e ela fica a um toque; o resto do edital vem logo abaixo, por disciplina;
 *  · "o que falta" é medido pelos ARTIGOS QUE O EDITAL COBRA, não pela lei inteira. O ISS cita o CTN 74 vezes, quase
 *    sempre com o artigo ("arts. 129 a 133 do CTN"); ninguém precisa dos 218 artigos dele para essa prova. Um artigo
 *    cobrado está lido quando o marcador "onde parei" já passou dele ou quando ele foi marcado como visto. Lei ligada
 *    a um tópico sem artigo citado nenhum é medida inteira, pelo marcador (o mesmo número da biblioteca).
 *
 * De onde vêm as leis de um tópico: as LIGADAS a ele (lei.topicos) e as CITADAS no texto dele no edital (nome, nota e
 * ramos) que estão na biblioteca. Nada aqui grava: é uma vista do que já existe.
 * ===================================================================== */

let ledCtx = { edId: "", disciplina: "", topico: "" };
let ledFiltro = "todas";
let ledUltimo = null;

function ledEdital(id) {
  const lista = typeof editais !== "undefined" ? editais : [];
  return lista.find((e) => String(e.id) === String(id)) || null;
}

/* o texto do tópico no edital: nome, nota e os ramos com as notas deles */
function ledTextoDoTopico(tp) {
  const partes = [tp.nome, tp.motivo];
  (tp.ramos || []).forEach((r) => { partes.push(r.nome, r.nota); });
  return partes.filter(Boolean).join(" \n ");
}

/* As citações "art. N da lei" do texto, com as FAIXAS abertas: "arts. 129 a 133 do CTN" vira 129, 130, 131, 132, 133.
 * leiCitacoesNoTexto devolve só as pontas da faixa (é para virar link); aqui o miolo conta. */
function ledCitacoes(texto) {
  const s = String(texto || "");
  let cs = [];
  try { cs = leiCitacoesNoTexto(s); } catch (e) { cs = []; }
  const out = [];
  cs.forEach((c, i) => {
    out.push(c);
    const prev = cs[i - 1];
    if (!prev || !c.lista || c.itemDaLista !== prev.itemDaLista + 1) return;
    if (!/^\s*(?:a|ao|at[ée])\s+$/i.test(s.slice(prev.fim, c.ini))) return;
    const a = Number(prev.num), b = Number(c.num);
    if (!(a > 0 && b > a && b - a <= 400) || !/^\d+$/.test(prev.num) || !/^\d+$/.test(c.num)) return;
    for (let n = a + 1; n < b; n++) out.push(Object.assign({}, c, { num: String(n), numCru: String(n), meioDaFaixa: true }));
  });
  return out;
}

/* A lei nomeada SEM artigo ("LC 116/03", "Lei nº 4.320/64", "CTN"): conta como lei do tópico se estiver na biblioteca. */
const LED_RE_MENCAO = /(?:^|[^\wÀ-ú])((?:Constitui[çc][ãa]o(?:\s+Federal)?|CF(?:\/88)?|CRFB|Lei\s+Complementar\s*[nN]?\.?\s*[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?|LC\s*[nN]?\.?\s*[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?|Decreto[\s-]?Lei\s*[nN]?\.?\s*[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?|Emenda\s+Constitucional\s*[nN]?\.?\s*[ºo°]?\.?\s*\d{1,4}(?:\s*\/\s*\d{2,4})?|EC\s*[nN]?\.?\s*[ºo°]?\.?\s*\d{1,4}(?:\s*\/\s*\d{2,4})?|Lei\s*[nN]?\.?\s*[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?|Decreto\s*[nN]?\.?\s*[ºo°]?\.?\s*\d[\d.]{0,8}(?:\s*\/\s*\d{2,4})?|[A-Z]{3,6}))(?![\wÀ-ú])/g;
function ledMencoes(texto) {
  const out = [];
  const re = new RegExp(LED_RE_MENCAO.source, "g");
  let m;
  while ((m = re.exec(String(texto || ""))) !== null) out.push(m[1]);
  return out;
}

/* OS ARTIGOS DE UMA LEI, guardados enquanto o texto não muda: ler a CF e o CTM artigo por artigo custava ~800 ms a cada
 * abertura da tela. Mover o marcador ou marcar um artigo como visto não muda os artigos — só o texto e as alterações. */
const ledArtsMemo = new Map();
function ledArtigos(l) {
  const marca = String(l.texto || "").length + "|" + Object.keys(l.alteracoes || {}).length + "|" + (l.anexos || []).length + "|" + (l.versao || "");
  const ja = ledArtsMemo.get(l.id);
  if (ja && ja.marca === marca) return ja.arts;
  let arts = [];
  try { arts = leiArtigosEfetivos(l); } catch (e) { arts = []; }
  ledArtsMemo.set(l.id, { marca, arts });
  return arts;
}

/* A LEITURA DE UMA LEI diante do que o edital cobra dela */
function ledLeitura(l, cobSet) {
  const arts = ledArtigos(l);
  const i = leiIndiceDoMarcador(l, arts);
  const vistos = l.artVistos || {};
  const pos = {};
  arts.forEach((a, k) => { if (pos[a.num] === undefined) pos[a.num] = k; });
  const lido = (n) => (i >= 0 && pos[n] <= i) || !!vistos[n];
  const cobrados = Array.from(cobSet || []).filter((n) => pos[n] !== undefined && !leiArtigoRevogado(arts[pos[n]]))
    .sort((x, y) => pos[x] - pos[y]);
  if (!cobrados.length) {
    /* a lei inteira, pelo marcador — a mesma conta de leiProgresso, sobre os artigos já lidos acima */
    const vivosIdx = [];
    arts.forEach((a, k) => { if (!leiArtigoRevogado(a)) vivosIdx.push(k); });
    const lidosN = i < 0 ? 0 : vivosIdx.filter((k) => k <= i).length;
    const kp = vivosIdx.find((k) => k > i);
    const total = vivosIdx.length;
    return { modo: "lei", total, lidos: lidosN, pct: total ? Math.round((lidosN / total) * 100) : 0, cobrados: [], lido,
      prox: lidosN >= total || kp === undefined ? null : { num: arts[kp].num, indice: kp, numCru: arts[kp].numCru || arts[kp].num },
      comecou: lidosN > 0 };
  }
  const lidos = cobrados.filter(lido).length;
  const pn = cobrados.find((n) => !lido(n));
  return { modo: "cobrados", total: cobrados.length, lidos, pct: Math.round((lidos / cobrados.length) * 100), cobrados, lido,
    prox: pn ? { num: pn, indice: pos[pn], numCru: arts[pos[pn]].numCru || pn } : null, comecou: lidos > 0,
    numCru: (n) => (arts[pos[n]] && arts[pos[n]].numCru) || n, pos };
}

/* a leitura de um PEDAÇO do que é cobrado (uma disciplina, um tópico); sem artigo dele na lei, a leitura geral */
function ledLeituraParcial(leit, nums) {
  if (!leit || leit.modo !== "cobrados") return leit;
  const ns = Array.from(new Set(nums || [])).filter((n) => leit.pos[n] !== undefined && leit.cobrados.indexOf(n) >= 0)
    .sort((a, b) => leit.pos[a] - leit.pos[b]);
  if (!ns.length) return leit;
  const lidos = ns.filter(leit.lido).length;
  const pn = ns.find((n) => !leit.lido(n));
  return Object.assign({}, leit, { total: ns.length, lidos, pct: Math.round((lidos / ns.length) * 100), cobrados: ns,
    prox: pn ? { num: pn, indice: leit.pos[pn], numCru: leit.numCru(pn) } : null, comecou: lidos > 0 });
}

/* "3–4, 16, 77, 81, 101–106": os artigos em faixas, na ordem da lei (consecutivos pela POSIÇÃO na lei) */
function ledFaixas(nums, leit, max) {
  const lim = max || 10;
  const pos = leit.pos || {};
  const cru = leit.numCru || ((n) => n);
  const fx = [];
  nums.forEach((n) => {
    const u = fx[fx.length - 1];
    /* junta o vizinho na lei OU o número seguinte: entre o 170 e o 171 do CTN há o 170-A, que o edital não cita */
    const base = (x) => parseInt(String(x), 10);
    if (u && (pos[n] === pos[u.fim] + 1 || (/^\d+$/.test(n) && /^\d+$/.test(u.fim) && base(n) === base(u.fim) + 1))) u.fim = n;
    else fx.push({ ini: n, fim: n });
  });
  const txt = fx.map((f) => f.ini === f.fim ? cru(f.ini) : cru(f.ini) + "–" + cru(f.fim));
  return txt.length > lim ? txt.slice(0, lim).join(", ") + " …" : txt.join(", ");
}

/* O MODELO: as disciplinas (pela ordem do peso) com as leis de cada uma (pelo peso dos tópicos em que aparecem) */
function ledModelo(edId) {
  const e = ledEdital(edId);
  if (!e) return null;
  const L = lerEdital(e.texto || "");
  const lista = leisLista();
  const porLei = {};
  const discs = [];
  /* MEMÓRIA DA MONTAGEM: o edital do ISS tem 409 linhas e cita o CTN 74 vezes; reconhecer o mesmo rótulo a cada vez
   * custava 1,6 s com a biblioteca real. Cada rótulo é reconhecido uma vez. */
  const casados = new Map();
  const casar = (rot) => {
    const k = String(rot || "");
    if (!casados.has(k)) { let l = null; try { l = leiCasarRotulo(k, lista); } catch (x) { l = null; } casados.set(k, l); }
    return casados.get(k);
  };
  (L.disciplinas || []).filter((d) => !d.inativa).forEach((d, ordem) => {
    const D = { nome: d.nome, peso: d.peso || 0, abs: d.abs || 0, ordem, leis: {} };
    (d.topicos || []).forEach((tp) => {
      const ch = typeof matChaveViva === "function" ? matChaveViva(d.nome, tp.nome) : matChave(d.nome, tp.nome);
      const dt = leisDoTopico(ch);
      const achadas = {};
      dt.forEach((l) => { achadas[l.id] = new Set(); });
      const txt = ledTextoDoTopico(tp);
      ledCitacoes(txt).forEach((c) => {
        /* o caminho comum (o rótulo casa com uma lei que tem o artigo) pela memória; o resto, pela regra inteira */
        let lei = c.rotulo ? casar(c.rotulo) : null;
        if (!lei || !leiTemArtigo(lei, c.num)) {
          let r = null;
          try { r = leiResolverCitacao(c, lista, dt); } catch (x) { r = null; }
          lei = r && r.lei;
        }
        if (!lei || !leiTemArtigo(lei, c.num)) return;
        (achadas[lei.id] = achadas[lei.id] || new Set()).add(leiNumNormal(c.num));
      });
      ledMencoes(txt).forEach((rot) => {
        const l = casar(rot);
        if (l && !achadas[l.id]) achadas[l.id] = new Set();
      });
      Object.keys(achadas).forEach((id) => {
        const T = { disciplina: d.nome, nome: tp.nome, chave: ch, peso: tp.peso || 0, nums: Array.from(achadas[id]), ligada: dt.some((x) => x.id === id) };
        const DL = D.leis[id] = D.leis[id] || { id, peso: 0, topicos: [] };
        DL.topicos.push(T); DL.peso += T.peso;
        const P = porLei[id] = porLei[id] || { id, cob: new Set(), topicos: [], disciplinas: [] };
        T.nums.forEach((n) => P.cob.add(n));
        P.topicos.push(T);
        if (P.disciplinas.indexOf(d.nome) < 0) P.disciplinas.push(d.nome);
      });
    });
    D.lista = Object.keys(D.leis).map((k) => D.leis[k]).filter((x) => leiDe(x.id))
      .sort((a, b) => b.peso - a.peso || String(leiDe(a.id).nome).localeCompare(String(leiDe(b.id).nome)));
    if (D.lista.length) discs.push(D);
  });
  discs.sort((a, b) => b.peso - a.peso || b.abs - a.abs || a.ordem - b.ordem);
  let tot = 0, lid = 0;
  Object.keys(porLei).forEach((id) => {
    const l = leiDe(id);
    if (!l) { delete porLei[id]; return; }
    porLei[id].lei = l;
    porLei[id].leit = ledLeitura(l, porLei[id].cob);
    /* o total do edital só soma ARTIGOS COBRADOS: uma lei ligada sem artigo citado (medida inteira) não entra — os 400
     * artigos de uma lei solta engoliriam o número */
    if (porLei[id].leit.modo === "cobrados") { tot += porLei[id].leit.total; lid += porLei[id].leit.lidos; }
  });
  /* CADA LEI DENTRO DA DISCIPLINA mede o que ESTA disciplina cobra dela: a CF em Tributário são os arts. 145 a 162, não
   * a CF inteira. Sem artigo citado nesta disciplina, vale a leitura geral da lei. */
  discs.forEach((D) => {
    let t2 = 0, l2 = 0;
    D.lista = D.lista.filter((x) => porLei[x.id]);
    D.lista.forEach((x) => {
      x.leit = ledLeituraParcial(porLei[x.id].leit, [].concat(...x.topicos.map((T) => T.nums)));
      if (x.leit.modo === "cobrados") { t2 += x.leit.total; l2 += x.leit.lidos; }
    });
    D.total = t2; D.lidos = l2; D.pct = t2 ? Math.round((l2 / t2) * 100) : 0;
  });
  return { edId: e.id, nome: (L.cfg && L.cfg.concurso) || e.nome || "", disciplinas: discs, leis: porLei,
    total: tot, lidos: lid, pct: tot ? Math.round((lid / tot) * 100) : 0, n: Object.keys(porLei).length };
}

function ledEstado(leit) {
  if (!leit || !leit.total) return "nao";
  if (leit.lidos >= leit.total) return "ok";
  return leit.lidos ? "lendo" : "nao";
}

/* as leis de UM tópico (o destaque do topo), com o que dele está lido */
function ledDoTopico(M, disciplina, topico) {
  if (!M || !topico) return [];
  const alvo = leisChaveComparavel(matChave(disciplina, topico));
  const out = [];
  M.disciplinas.forEach((D) => D.lista.forEach((x) => x.topicos.forEach((T) => {
    if (leisChaveComparavel(matChave(T.disciplina, T.nome)) !== alvo) return;
    if (out.some((o) => o.id === x.id)) return;
    const P = M.leis[x.id];
    if (!P) return;
    const leit = T.nums.length ? ledLeituraParcial(P.leit, T.nums) : P.leit;
    out.push({ id: x.id, T, P, leit, nums: leit.modo === "cobrados" && T.nums.length ? leit.cobrados : [] });
  })));
  return out;
}

/* ---------------- abrir a lei ---------------- */
/* Com um tópico ligado à lei, abre pelo tópico (registrar leitura, cartões e a fila de leis dele funcionam); sem tópico
 * ligado, abre a lei solta, como a biblioteca. O artigo, quando há, manda; sem artigo, a lei retoma no marcador. */
function ledLer(id, prox, T) {
  const P = ledUltimo && ledUltimo.leis[id];
  const lig = T && T.ligada ? T : (P ? P.topicos.find((x) => x.ligada && (!prox || x.nums.indexOf(prox.num) >= 0)) || P.topicos.find((x) => x.ligada) : null);
  try { reg("LEI", "leis do edital: abrir", ((P && P.lei && P.lei.nome) || id) + (prox ? " · art. " + prox.numCru : "")); } catch (e) {}
  if (lig) {
    if (prox) return leiAbrirNoArtigo(lig.disciplina, lig.nome, id, prox.num);
    return leiAbrir(lig.disciplina, lig.nome, id);
  }
  if (prox) return leiContinuarLei(id, prox);
  return leiAbrir("", "", id);
}

/* ---------------- a tela ---------------- */
function ledAbrir(edId, opc) {
  const o = opc || {};
  const id = edId || (typeof edAberto === "function" && edAberto() ? edAberto().id : "") || (typeof editalAtual !== "undefined" ? editalAtual : "");
  if (!ledEdital(id)) return false;
  ledCtx = { edId: id, disciplina: o.disciplina || "", topico: o.topico || "" };
  ledFiltro = "todas";
  /* a janela abre antes da lista: a primeira montagem lê os artigos de cada lei (a CF, o CTM…) e pode levar um instante */
  if ($("ledCorpo")) { $("ledCorpo").innerHTML = ""; $("ledCorpo").append(ledEl("p", "nota", t("led_carregando"))); }
  const ed0 = ledEdital(id);
  if ($("ledSub")) $("ledSub").textContent = (ed0 && ed0.nome) || "";
  abrirModal("dlgLeisEd");
  const montar = () => { try { ledPintar(); } catch (e) { try { reg("ERRO", "leis do edital: falha ao montar", (e && e.message) || ""); } catch (x) {} } };
  /* LOGO DEPOIS DE ABRIR O APP as leis ainda estão chegando do IndexedDB (idb-leis.js): montar agora dava "0 leis".
   * Espera a leitura terminar; sem IndexedDB (ou já lidas), monta no próximo instante. */
  const lendo = typeof _leisCache !== "undefined" && _leisCache === null && typeof leisIdbSuportado === "function" && leisIdbSuportado()
    && typeof leisIdbMigrar === "function";
  if (lendo) Promise.resolve(leisIdbMigrar()).then(montar, montar);
  else setTimeout(montar, 0);
  try { ledCheiaTrocar(localStorage.getItem("eac_led_cheia") === "1", false); } catch (e) {}
  try { reg("LEI", "leis do edital abertas", (ledUltimo ? ledUltimo.nome + " · " + ledUltimo.n + " leis" : id) + (o.topico ? " · tópico " + o.topico : "")); } catch (e) {}
  return true;
}

function ledCheiaTrocar(sim, lembrar) {
  const dlg = $("dlgLeisEd");
  if (!dlg) return false;
  const quer = sim === undefined ? !dlg.classList.contains("lb-cheia") : !!sim;
  dlg.classList.toggle("lb-cheia", quer);
  const b = $("btnLedCheia");
  if (b) { b.textContent = t(quer ? "dom_cheia_sair" : "dom_cheia"); b.setAttribute("aria-pressed", String(quer)); }
  if (lembrar) { try { localStorage.setItem("eac_led_cheia", quer ? "1" : "0"); } catch (e) {} }
  return quer;
}

function ledEl(tag, cls, txt) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (txt != null) el.textContent = txt;
  return el;
}

/* o anel do progresso: um círculo cheio até a porcentagem (CSS conic-gradient) */
function ledAnel(pct, estado, titulo) {
  const a = ledEl("span", "led-anel led-" + estado);
  a.style.setProperty("--p", String(Math.max(0, Math.min(100, pct || 0))));
  a.setAttribute("role", "img");
  a.setAttribute("aria-label", titulo);
  a.title = titulo;
  const i = ledEl("span", "led-anel-n", estado === "ok" ? "✓" : String(pct || 0));
  a.append(i);
  return a;
}

function ledBotaoLer(id, leit, T, idBt) {
  const b = ledEl("button", "btn-min" + (leit.prox ? " btn-min-ok" : ""));
  b.type = "button";
  b.id = idBt;
  b.textContent = leit.prox ? t(leit.comecou ? "led_continuar" : "led_comecar", { a: leit.prox.numCru }) : t("led_abrir");
  b.onclick = () => ledLer(id, leit.prox, T);
  return b;
}

function ledPintar() {
  const M = ledModelo(ledCtx.edId);
  ledUltimo = M;
  if (!M || !$("ledCorpo")) return M;
  $("ledSub").textContent = M.nome;
  const corpo = $("ledCorpo");
  corpo.innerHTML = "";

  /* o resumo do edital: quanto do que ele cobra já foi lido */
  const rs = ledEl("div", "led-resumo");
  rs.id = "ledResumo";
  rs.append(ledEl("span", "led-resumo-txt", t("led_resumo", { n: M.n, l: M.lidos, t: M.total, p: M.pct })));
  const barra = ledEl("span", "led-barra");
  const fill = ledEl("span", "led-barra-fill");
  fill.style.width = M.pct + "%";
  barra.append(fill);
  rs.append(barra);
  corpo.append(rs);

  /* NESTE TÓPICO: o que o ⚖ da agenda pediu */
  if (ledCtx.topico) {
    const fc = ledEl("section", "led-foco");
    fc.id = "ledFoco";
    fc.append(ledEl("div", "led-foco-tit", t("led_foco_tit")));
    fc.append(ledEl("div", "led-foco-sub", t("led_foco_sub", { t: ledCtx.topico, d: ledCtx.disciplina })));
    const doT = ledDoTopico(M, ledCtx.disciplina, ledCtx.topico);
    if (!doT.length) {
      fc.append(ledEl("p", "nota", t("led_foco_vazio")));
      const b = ledEl("button", "btn-min btn-min-ok", t("led_foco_abrir"));
      b.type = "button"; b.id = "btnLedFocoAbrir";
      b.onclick = () => leiAbrir(ledCtx.disciplina, ledCtx.topico);
      fc.append(b);
    }
    doT.forEach((x) => {
      const lin = ledEl("div", "led-foco-lin");
      lin.id = "ledFoco_" + x.id;
      const est = ledEstado(x.leit);
      lin.append(ledAnel(x.leit.pct, est, t("led_anel_aj", { p: x.leit.pct })));
      const tx = ledEl("div", "led-lei-txt");
      tx.append(ledEl("div", "led-lei-nome", x.P.lei.nome));
      tx.append(ledEl("div", "led-lei-meta", x.nums.length
        ? t("led_foco_nums", { f: ledFaixas(x.nums, x.P.leit, 12), l: x.leit.lidos, t: x.leit.total })
        : t("led_foco_sem_art")));
      lin.append(tx);
      const acF = ledEl("div", "led-lei-acoes");
      acF.append(ledBotaoLer(x.id, x.leit, x.T, "btnLedFocoLer_" + x.id));
      lin.append(acF);
      fc.append(lin);
    });
    corpo.append(fc);
  }

  /* os filtros: todas · falta ler · concluídas */
  /* os filtros contam LEIS (uma lei em duas disciplinas conta uma vez); "falta ler" vale se falta em alguma delas */
  const ids = Object.keys(M.leis);
  const falta = new Set();
  M.disciplinas.forEach((D) => D.lista.forEach((x) => { if (ledEstado(x.leit) !== "ok") falta.add(x.id); }));
  const nFalta = falta.size;
  const nOk = ids.length - nFalta;
  const fi = ledEl("div", "pas-fileira led-filtros");
  fi.setAttribute("role", "group");
  [["todas", t("led_f_todas", { n: ids.length })], ["falta", t("led_f_falta", { n: nFalta })], ["ok", t("led_f_ok", { n: nOk })]].forEach(([k, rot]) => {
    const b = ledEl("button", "btn-min pas-chip" + (ledFiltro === k ? " mat-ligado" : ""), rot);
    b.type = "button"; b.id = "btnLedF_" + k;
    b.setAttribute("aria-pressed", String(ledFiltro === k));
    b.onclick = () => { ledFiltro = k; ledPintar(); };
    fi.append(b);
  });
  corpo.append(fi);

  if (!M.disciplinas.length) corpo.append(ledEl("p", "nota", t("led_vazio")));
  let mostrou = 0;
  M.disciplinas.forEach((D, k) => {
    const itens = D.lista.filter((x) => {
      const e = ledEstado(x.leit);
      return ledFiltro === "todas" || (ledFiltro === "ok" ? e === "ok" : e !== "ok");
    });
    if (!itens.length) return;
    mostrou++;
    const sec = ledEl("details", "led-disc");
    sec.id = "ledDisc_" + k;
    sec.open = true;
    const sm = ledEl("summary", "led-disc-cab");
    sm.append(ledEl("span", "led-disc-nome", D.nome));
    sm.append(ledEl("span", "led-disc-meta", t("led_disc_meta", { p: D.peso, n: D.lista.length, pc: D.pct })));
    sec.append(sm);
    itens.forEach((x) => {
      const P = M.leis[x.id];
      const L2 = x.leit;
      const est = ledEstado(L2);
      const card = ledEl("div", "led-lei led-lei-" + est);
      card.id = "ledLei_" + k + "_" + x.id;
      card.append(ledAnel(L2.pct, est, t("led_anel_aj", { p: L2.pct })));
      const tx = ledEl("div", "led-lei-txt");
      const nm = ledEl("div", "led-lei-nome", P.lei.nome);
      if (!P.topicos.some((T) => T.ligada)) nm.append(ledEl("span", "led-tag", t("led_nao_ligada")));
      tx.append(nm);
      const meta = [L2.modo === "cobrados" ? t("led_cob", { t: L2.total, l: L2.lidos }) : t("led_cob_lei", { t: L2.total, l: L2.lidos }),
        t("led_em_topicos", { n: x.topicos.length })];
      const outras = P.disciplinas.filter((n) => n !== D.nome);
      if (outras.length) meta.push(t("led_tambem", { d: outras.join(", ") }));
      tx.append(ledEl("div", "led-lei-meta", meta.join(" · ")));
      if (L2.modo === "cobrados" && L2.cobrados.length) tx.append(ledEl("div", "led-lei-arts", t("led_arts", { f: ledFaixas(L2.cobrados, P.leit, 14) })));
      const det = ledEl("details", "led-lei-tops");
      det.append(ledEl("summary", "", t("led_topicos_n", { n: x.topicos.length })));
      x.topicos.slice().sort((a, b) => b.peso - a.peso).forEach((T) => {
        const li = ledEl("div", "led-top");
        li.append(ledEl("span", "led-top-peso", String(T.peso)));
        li.append(ledEl("span", "led-top-nome", T.nome + (T.nums.length ? " · " + t("led_arts", { f: ledFaixas(T.nums.filter((n) => P.leit.pos && P.leit.pos[n] !== undefined).sort((a, b) => P.leit.pos[a] - P.leit.pos[b]), P.leit, 6) }) : "")));
        det.append(li);
      });
      tx.append(det);
      card.append(tx);
      const ac = ledEl("div", "led-lei-acoes");
      ac.append(ledBotaoLer(x.id, L2, x.topicos.find((T) => T.ligada) || null, "btnLedLer_" + k + "_" + x.id));
      card.append(ac);
      sec.append(card);
    });
    corpo.append(sec);
  });
  if (M.disciplinas.length && !mostrou) corpo.append(ledEl("p", "nota", t("led_vazio_filtro")));
  return M;
}

function ledIniciar() {
  if (typeof document === "undefined" || !$("dlgLeisEd")) return;
  if ($("btnLedX")) $("btnLedX").onclick = () => $("dlgLeisEd").close();
  if ($("btnLedCheia")) $("btnLedCheia").onclick = () => ledCheiaTrocar(undefined, true);
  if ($("btnEdLeis")) $("btnEdLeis").onclick = () => ledAbrir();
  /* voltar da leitura repinta: o marcador e os vistos mudaram */
  const dl = $("dlgLeiSeca");
  if (dl && dl.addEventListener) dl.addEventListener("close", () => { if ($("dlgLeisEd") && $("dlgLeisEd").open) ledPintar(); });
}
