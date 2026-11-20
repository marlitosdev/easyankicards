/* =====================================================================
 * (19.182.0) O VÍNCULO LEI ↔ TÓPICO: a lei que o tópico cita e que já está na biblioteca
 *
 * O relato real: o tópico "Licitações públicas e contratos administrativos (Lei 14.133/2021)" abria a lei seca VAZIA,
 * pedindo para colar a lei — e a Lei 14.133/2021 estava na biblioteca havia 11 dias, criada "sem tópico", sem vínculo
 * com nada. O "▶ Estudar" da agenda abria a ficha, cujo "Carregar" ia direto à lei seca; o passo "lei" da trilha também.
 * Só o ⚖ da agenda passava pelas "Leis do edital". E o registro anotava "nenhuma lei ligada ainda", sem dizer que havia
 * uma lei guardada que batia com o tópico. Nos seus editais eram 9 tópicos assim.
 *
 * Por isso:
 *  · AS CANDIDATAS são as leis da biblioteca que o tópico cita PELO NÚMERO (no nome ou nos ramos: "Lei 14.133/2021",
 *    "Lei nº 4.320/64", "Lei 14133 de 2021") — e a Constituição, só quando citada com todas as letras ("Constituição
 *    Federal", "da República", "de 1988"). Pelo nome solto, não: "Constituição do crédito tributário" puxaria a CF e a
 *    sigla "DAS" puxaria o Estatuto das Cidades;
 *  · UMA PORTA SÓ para a lei seca do tópico (a ficha, a trilha, o ⚖): com lei ligada, abre a lei; sem lei, abre as
 *    LEIS DO EDITAL com o tópico em destaque — onde a candidata aparece com "🔗 ligar a este tópico e ler", e onde
 *    também estão "usar uma lei já guardada" e "colar uma lei nova" (pela lei seca do tópico);
 *  · LIGAR E LER: liga e abre a lei PELO TÓPICO (a leitura conta para ele, o que a lei aberta solta não fazia);
 *  · o registro avisa quando a lei seca abre sem lei havendo uma candidata, e o diagnóstico conta os tópicos assim.
 * ===================================================================== */
const LV_CF_RE = /constitui[çc][ãa]o\s+(?:federal|da\s+rep[úu]blica)|\bCF\s*\/?\s*(?:19)?88\b|constitui[çc][ãa]o\s+de\s+1988/i;
function lvEhCF(l) {
  if (!l) return false;
  return /constitui[çc][ãa]o\s+(?:da\s+rep[úu]blica|federal)/i.test(String(l.nome || "") + " " + String(l.apelido || ""));
}
/* as leis da biblioteca que um texto cita PELO NÚMERO (ou a CF com todas as letras): [{ lei, rotulo }] */
function lvCandidatas(texto) {
  const txt = String(texto || "");
  if (!txt.trim() || typeof leisLista !== "function") return [];
  const lista = leisLista().filter((l) => String(l.texto || "").trim());
  const out = [];
  const por = (l, rot) => { if (l && !out.some((o) => o.lei.id === l.id)) out.push({ lei: l, rotulo: rot }); };
  let ments = [];
  try { ments = typeof ledMencoes === "function" ? ledMencoes(txt) : []; } catch (e) { ments = []; }
  ments.filter((m) => /\d/.test(m)).forEach((m) => {
    let l = null;
    try { l = typeof leiCasarRotulo === "function" ? leiCasarRotulo(m, lista) : null; } catch (e) { l = null; }
    por(l, m);
  });
  if (LV_CF_RE.test(txt)) por(lista.find(lvEhCF), "Constituição Federal");
  return out;
}
/* o texto do tópico que vale para achar a lei: o nome, a nota do edital ("+ Crimes :: 3 :: Lei nº 8.137/90") e os ramos
 * (quando não vêm, saem do plano do edital aberto) */
function lvTextoDoTopico(disciplina, topico, ramos, motivo) {
  let rs = ramos, mot = motivo;
  if (rs == null || mot == null) {
    try {
      const it = typeof edItemDoPlano === "function" ? edItemDoPlano(disciplina, topico) : null;
      if (rs == null) rs = it && it.ramos;
      if (mot == null) mot = it && it.motivo;
    } catch (e) {}
  }
  return [topico, mot || ""].concat((rs || []).map((r) => (r && (r.nome || r.texto)) || String(r || ""))).join(" ; ");
}
/* as candidatas que AINDA não estão ligadas ao tópico */
function lvSugestoesDoTopico(disciplina, topico, ramos, motivo) {
  if (!topico || typeof matChave !== "function") return [];
  const ch = matChave(disciplina, topico);
  const lig = new Set((typeof leisDoTopico === "function" ? leisDoTopico(ch) : []).map((l) => l.id));
  return lvCandidatas(lvTextoDoTopico(disciplina, topico, ramos, motivo)).filter((o) => !lig.has(o.lei.id));
}

/* ---------------- o edital do tópico ---------------- */
function lvEditaisAtivos() {
  const lst = typeof editais !== "undefined" ? editais : [];
  return lst.filter((e) => { try { return typeof edSituacao !== "function" || edSituacao(e).grupo !== "encerrado"; } catch (x) { return true; } });
}
const lvTopicosMemo = new Map();
/* os tópicos de um edital: [{ disciplina, nome, ramos, chave (comparável) }], guardado enquanto o texto não muda */
function lvTopicosDoEdital(e) {
  const k = String(e.id) + "|" + String(e.texto || "").length;
  const m = lvTopicosMemo.get(String(e.id));
  if (m && m.k === k) return m.lista;
  const out = [];
  try {
    const L = lerEdital(e.texto || "");
    (L.disciplinas || []).filter((d) => !d.inativa).forEach((d) => (d.topicos || []).forEach((tp) => {
      out.push({ disciplina: d.nome, nome: tp.nome, ramos: tp.ramos || [], motivo: tp.motivo || "", chave: leisChaveComparavel(matChave(d.nome, tp.nome)) });
    }));
  } catch (x) {}
  lvTopicosMemo.set(String(e.id), { k, lista: out });
  return out;
}
/* de que edital é o tópico: o aberto, se o tem; senão o primeiro ainda em andamento que o tem */
function lvEditalDoTopico(disciplina, topico) {
  if (typeof matChave !== "function" || typeof leisChaveComparavel !== "function") return "";
  const alvo = leisChaveComparavel(matChave(disciplina, topico));
  const tem = (e) => lvTopicosDoEdital(e).some((x) => x.chave === alvo);
  const ativos = lvEditaisAtivos();
  const atual = typeof editalAtual !== "undefined" ? ativos.find((e) => String(e.id) === String(editalAtual)) : null;
  if (atual && tem(atual)) return atual.id;
  const e = ativos.find(tem);
  return e ? e.id : "";
}

/* ---------------- A PORTA ÚNICA ---------------- */
function lvAbrirLeiDoTopico(disciplina, topico, opc) {
  const o = opc || {};
  const ch = typeof matChave === "function" ? matChave(disciplina, topico) : "";
  const temLei = !!ch && ((typeof leisDoTopico === "function" && leisDoTopico(ch).length > 0) || (typeof leiTem === "function" && leiTem(ch)));
  if (temLei) return leiAbrir(disciplina, topico);
  const ed = o.editalId || lvEditalDoTopico(disciplina, topico);
  if (ed && typeof ledAbrir === "function") {
    try { reg("LEI", "lei seca do tópico sem lei: abre as leis do edital", topico + (o.origem ? " · " + o.origem : "")); } catch (e) {}
    if (ledAbrir(ed, { disciplina, topico })) return true;
  }
  return leiAbrir(disciplina, topico);
}
/* LIGAR E LER: o vínculo e a leitura pelo tópico */
function lvLigarEAbrir(disciplina, topico, leiId, origem) {
  const ch = matChave(disciplina, topico);
  const l = typeof leiDe === "function" ? leiDe(leiId) : null;
  if (!l || !leiLigar(leiId, ch)) return false;
  try { reg("LEI", "lei ligada pela sugestão (número citado no tópico)", l.nome + " · " + ch + (origem ? " · " + origem : "")); } catch (e) {}
  try { if (typeof matRender === "function") matRender(); } catch (e) {}
  leiAbrir(disciplina, topico, leiId);
  return true;
}
/* ligar uma lei a vários tópicos de uma vez (as "Leis citadas no edital"): devolve quantos vínculos novos */
function lvLigarVarios(pares, origem) {
  let n = 0;
  (pares || []).forEach((p) => {
    const ch = matChave(p.disciplina, p.nome);
    const ja = (typeof leisDoTopico === "function" ? leisDoTopico(ch) : []).some((l) => l.id === p.leiId);
    if (!ja && leiLigar(p.leiId, ch)) n++;
  });
  try { reg("LEI", "leis ligadas aos tópicos que as citam", n + " vínculo(s)" + (origem ? " · " + origem : "")); } catch (e) {}
  try { if (typeof matRender === "function") matRender(); } catch (e) {}
  return n;
}

/* ---------------- o que ainda está sem vínculo (diagnóstico e biblioteca) ---------------- */
/* os tópicos dos editais em andamento que citam pelo número uma lei da biblioteca sem estar ligados a ela */
let lvPendMemo = null;
function lvPendencias() {
  /* guardado enquanto nada muda: a biblioteca pergunta isto para cada lei da lista */
  const ass = lvEditaisAtivos().map((e) => e.id + ":" + String(e.texto || "").length).join(",") + "|"
    + (typeof leisLista === "function" ? leisLista().map((l) => l.id + ":" + (l.topicos || []).length + ":" + String(l.texto || "").length).join(",") : "");
  if (lvPendMemo && lvPendMemo.ass === ass) return lvPendMemo.lista;
  const out = [], vistos = new Set();
  lvEditaisAtivos().forEach((e) => lvTopicosDoEdital(e).forEach((tp) => {
    if (vistos.has(tp.chave)) return;
    vistos.add(tp.chave);
    const sug = lvSugestoesDoTopico(tp.disciplina, tp.nome, tp.ramos, tp.motivo);
    if (sug.length) out.push({ edital: e.nome, editalId: e.id, disciplina: tp.disciplina, topico: tp.nome, leis: sug });
  }));
  lvPendMemo = { ass, lista: out };
  return out;
}
/* os tópicos que citam UMA lei e não estão ligados a ela (a biblioteca: "ligar aos N tópicos que a citam") */
function lvTopicosQueCitam(leiId) {
  return lvPendencias().filter((p) => p.leis.some((o) => o.lei.id === leiId)).map((p) => ({ disciplina: p.disciplina, nome: p.topico, edital: p.edital, leiId }));
}
/* a linha do diagnóstico */
function lvLinhaDiagnostico() {
  let P = [];
  try { P = lvPendencias(); } catch (e) { return { tipo: "info", txt: "Vínculos de lei: não deu para conferir (" + (e && e.message) + ")" }; }
  if (!P.length) return { tipo: "ok", txt: "Vínculos de lei: nenhum tópico dos editais em andamento cita lei da biblioteca sem estar ligado a ela" };
  return { tipo: "aviso", txt: "Vínculos de lei: " + P.length + " tópico(s) citam lei da biblioteca sem vínculo — "
    + P.slice(0, 8).map((p) => p.topico.slice(0, 50) + " → " + p.leis.map((o) => o.lei.nome).join(", ") + " (" + p.edital + ")").join("; ")
    + (P.length > 8 ? "; …" : "") + " · ligue pelas Leis do edital (\"ligar todas\")" };
}
