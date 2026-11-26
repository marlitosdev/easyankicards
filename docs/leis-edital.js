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
 *
 * (19.204.0) NÃO É MAIS UMA JANELA: é a vista "por disciplina" da pasta 📋 do edital na Biblioteca de leis (veja "a
 * tela", abaixo). ledAbrir continua sendo a porta: abre a biblioteca nessa pasta.
 * ===================================================================== */

let ledCtx = { edId: "", disciplina: "", topico: "" };
let ledUltimo = null;
let ledPorCimaDaLeitura = false;

/* O EDITAL DE UM TÓPICO (o da leitura não diz de qual edital veio): o aberto, se tiver o tópico; senão o primeiro com
 * prova por vir; senão qualquer um. "" quando nenhum edital tem esse tópico. */
function ledEditalDoTopico(disciplina, topico) {
  if (!topico || typeof pasEdIndice !== "function") return "";
  const ch = typeof pasNormChave === "function" ? pasNormChave(matChave(disciplina, topico)) : matChave(disciplina, topico);
  let ix = null;
  try { ix = pasEdIndice(); } catch (e) { ix = null; }
  const com = ((ix && ix.lista) || []).filter((e) => e.chaves && e.chaves.has(ch));
  if (!com.length) return "";
  const aberto = typeof edAberto === "function" && edAberto() ? String(edAberto().id) : (typeof editalAtual !== "undefined" && editalAtual ? String(editalAtual) : "");
  return (com.find((e) => e.id === aberto) || com.find((e) => !e.encerrado) || com[0]).id;
}

/* (19.159.0) os temas de discursiva guardados do edital, com o texto onde moram os fundamentos (espelho e modelo) */
function ledNormDisc(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function ledDiscursivas(edId) {
  if (typeof dsPropostas !== "function") return [];
  let ps = [];
  try { ps = dsPropostas(edId) || []; } catch (e) { ps = []; }
  return ps.filter((p) => p && (p.espelho || p.modelo))
    .map((p) => ({ id: p.id, tema: p.tema || "", disc: p.disc || "", txt: [p.espelho, p.modelo].filter(Boolean).join("\n") }));
}

/* =====================================================================
 * (19.164.0) A INTEGRIDADE DA LISTA "FALTAM NA BIBLIOTECA"
 *
 * "Abri e havia 2 leis pendentes; abri de novo e havia 4. Qual o critério, e como não deixar nada de fora?"
 * O que se viu no edital do ISS: a lista mudava sem dizer por quê (uma lei incluída saiu, três das discursivas
 * entraram); "LGPD" num tópico de Informática não contava (sigla solta não vira lacuna); "LEF" não se ligava à Lei
 * 6.830 que estava na biblioteca; e a EC 131/2023 aparecia como "falta" mas já está dentro da Constituição consolidada.
 *  · O CATÁLOGO (abaixo): siglas e nomes populares das leis mais cobradas, com espécie e número. Uma menção pelo nome
 *    ("LGPD", "Estatuto da Cidade", "Lei de Improbidade") vale como a lei: casa com a da biblioteca ou vira lacuna;
 *  · A LEI QUE SÓ ALTERA OUTRA: se uma lei da biblioteca traz "(Redação dada pela EC 131/2023)" (ou a fila de
 *    alterações tem a norma), a EC fica em "já dentro de leis que você tem", e não em "faltam";
 *  · A ORIGEM DE CADA ITEM (edital, discursiva, IA, sigla) e "O QUE MUDOU DESDE A ÚLTIMA VEZ" (entrou / saiu e por quê).
 * ===================================================================== */
const LED_CATALOGO = [
  ["Lei 13.709/2018", ["LGPD", "Lei Geral de Proteção de Dados", "Lei Geral de Proteção aos Dados"]],
  ["Lei 6.830/1980", ["LEF", "Lei de Execução Fiscal", "Lei de Execuções Fiscais"]],
  ["Lei Complementar 101/2000", ["LRF", "Lei de Responsabilidade Fiscal"]],
  ["Lei 8.429/1992", ["LIA", "Lei de Improbidade Administrativa", "Lei de Improbidade"]],
  ["Lei 5.172/1966", ["CTN", "Código Tributário Nacional"]],
  ["Lei 13.105/2015", ["CPC", "Código de Processo Civil"]],
  ["Decreto-Lei 3.689/1941", ["CPP", "Código de Processo Penal"]],
  ["Decreto-Lei 2.848/1940", ["Código Penal"]],
  ["Lei 10.406/2002", ["Código Civil"]],
  ["Decreto-Lei 5.452/1943", ["CLT", "Consolidação das Leis do Trabalho"]],
  ["Lei 8.078/1990", ["CDC", "Código de Defesa do Consumidor"]],
  ["Lei 8.069/1990", ["ECA", "Estatuto da Criança e do Adolescente"]],
  ["Decreto-Lei 4.657/1942", ["LINDB", "Lei de Introdução às Normas do Direito Brasileiro"]],
  ["Lei 10.257/2001", ["Estatuto da Cidade"]],
  ["Lei 14.133/2021", ["Nova Lei de Licitações", "Lei de Licitações e Contratos Administrativos", "Lei de Licitações"]],
  ["Lei 9.784/1999", ["Lei do Processo Administrativo", "Lei de Processo Administrativo"]],
  ["Lei 12.527/2011", ["LAI", "Lei de Acesso à Informação"]],
  ["Lei 12.846/2013", ["Lei Anticorrupção"]],
  ["Lei Complementar 123/2006", ["Estatuto da Microempresa", "Lei do Simples Nacional", "Lei Geral da Microempresa"]],
  ["Lei Complementar 87/1996", ["Lei Kandir"]],
  ["Lei Complementar 116/2003", ["Lei Geral do ISS"]],
  ["Lei 8.987/1995", ["Lei de Concessões", "Lei das Concessões"]],
  ["Lei 4.717/1965", ["Lei da Ação Popular", "Lei de Ação Popular"]],
  ["Lei 7.347/1985", ["LACP", "Lei da Ação Civil Pública"]],
  ["Lei 13.869/2019", ["Lei de Abuso de Autoridade"]],
  ["Lei 9.613/1998", ["Lei de Lavagem de Dinheiro"]],
  ["Lei 8.137/1990", ["Lei dos Crimes contra a Ordem Tributária"]],
  ["Lei 7.210/1984", ["LEP", "Lei de Execução Penal"]],
  ["Lei 12.965/2014", ["Marco Civil da Internet"]],
  ["Lei 12.016/2009", ["Lei do Mandado de Segurança"]],
  ["Lei 8.112/1990", ["Regime Jurídico dos Servidores Públicos Civis da União"]],
  ["Lei 9.503/1997", ["CTB", "Código de Trânsito Brasileiro"]],
  ["Lei 6.404/1976", ["Lei das Sociedades Anônimas", "Lei das S.A."]],
  ["Lei 9.504/1997", ["Lei das Eleições"]],
  ["Lei 8.906/1994", ["Estatuto da Advocacia", "Estatuto da OAB"]],
  ["Lei 4.504/1964", ["Estatuto da Terra"]],
];
function ledSemAcento(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
const ledCatIdx = (() => {
  const siglas = new Map(), nomes = [];
  LED_CATALOGO.forEach(([canon, ns]) => ns.forEach((x) => {
    if (/^[A-Z]{2,6}$/.test(x)) siglas.set(x, canon); else nomes.push([ledSemAcento(x), canon, x]);
  }));
  nomes.sort((a, b) => b[0].length - a[0].length);
  return { siglas, nomes };
})();
/* a lei do catálogo para um rótulo ("LGPD", "Estatuto da Cidade", "a Lei de Improbidade") — "" se não for nenhuma */
function ledCanon(rot) {
  const s = String(rot || "").trim();
  if (ledCatIdx.siglas.has(s)) return ledCatIdx.siglas.get(s);
  const n = ledSemAcento(s).replace(/^(a|da|na|pela|nova)\s+/, "");
  const x = ledCatIdx.nomes.find(([k]) => k === n || k === "nova " + n);
  return x ? x[1] : "";
}
/* as menções do catálogo num texto: siglas exatas (maiúsculas) e nomes (sem diferenciar acento/caixa) */
function ledCatalogoNoTexto(texto) {
  const s = String(texto || "");
  const out = [], vistos = new Set();
  const por = (achado, canon) => { if (vistos.has(canon + "|" + achado)) return; vistos.add(canon + "|" + achado); out.push({ achado, canon }); };
  ledCatIdx.siglas.forEach((canon, sg) => { if (new RegExp("(?:^|[^A-Za-zÀ-ú])" + sg + "(?![A-Za-zÀ-ú])").test(s)) por(sg, canon); });
  const sa = ledSemAcento(s);
  const tomados = [];
  ledCatIdx.nomes.forEach(([k, canon, orig]) => {
    let i = sa.indexOf(k);
    while (i >= 0) {
      const fim = i + k.length;
      const antes = i === 0 || /[^a-z0-9]/.test(sa[i - 1]), depois = fim >= sa.length || /[^a-z0-9]/.test(sa[fim]);
      /* um nome mais longo já tomou este trecho ("Nova Lei de Licitações" antes de "Lei de Licitações") */
      if (antes && depois && !tomados.some(([a, b]) => i >= a && fim <= b)) { tomados.push([i, fim]); por(orig, canon); }
      i = sa.indexOf(k, i + 1);
    }
  });
  return out;
}
/* o rótulo da lacuna: o número oficial e, entre parênteses, como o texto a chamou */
function ledRotuloLacuna(rot) {
  const c = ledCanon(rot);
  return c ? c + " (" + String(rot).trim() + ")" : rot;
}
/* (item 2) as lacunas que JÁ ESTÃO DENTRO de uma lei da biblioteca (a norma alterou essa lei, e o texto consolidado
 * dela já traz a mudança): saem de "faltam" e vão para M.cobertas, com o nome da lei que as contém */
function ledSepararCobertas(M, lista) {
  if (!M || typeof leiAlteradorasDe !== "function" || typeof leiChaveDeEspecieNumero !== "function") { if (M) M.cobertas = M.cobertas || []; return M; }
  const por = new Map();
  (lista || []).forEach((l) => {
    let ks = null;
    try { ks = leiAlteradorasDe(l); } catch (e) { ks = null; }
    (ks || new Set()).forEach((k) => { if (!por.has(k)) por.set(k, []); por.get(k).push({ id: l.id, nome: l.nome }); });
  });
  const cob = [];
  M.lacunas = (M.lacunas || []).filter((G) => {
    const k = leiChaveDeEspecieNumero(String(G.rotulo).replace(/\s*\([^)]*\)\s*$/, ""));
    const dentro = k ? por.get(k) : null;
    if (!dentro || !dentro.length) return true;
    G.dentroDe = dentro;
    cob.push(G);
    return false;
  });
  M.cobertas = cob;
  return M;
}
/* (item 3) de onde veio cada item */
function ledOrigens(G) {
  const o = [];
  if ((G.topicos || []).length) o.push("edital");
  if ((G.ds || []).length) o.push("discursiva");
  if (G.ia || G.soIa) o.push("ia");
  if ((G.apelidos || []).length) o.push("sigla");
  if (G.porNome) o.push("nome");
  return o;
}
/* (item 3) O QUE MUDOU DESDE A ÚLTIMA VEZ que a tela foi aberta: as lacunas que entraram e as que saíram, com o motivo */
const LED_VISTO_CH = "eac_led_visto";   /* {edId: {em, itens: {chave: {r: rótulo, o: [origens]}}}} */
let ledDif = null;
function ledDiferenca(M) {
  if (!M) return null;
  const todos = ledLerMapa(LED_VISTO_CH);
  const ant = todos[String(M.edId)] || null;
  const cur = {};
  (M.lacunas || []).filter((G) => !G.dispensada).forEach((G) => { cur[G.chave] = { r: G.rotulo, o: ledOrigens(G) }; });
  todos[String(M.edId)] = { em: new Date().toISOString(), itens: cur };
  ledGravarMapa(LED_VISTO_CH, todos);
  if (!ant || !ant.itens) return null;
  const lista = typeof leisLista === "function" ? leisLista() : [];
  const entraram = Object.keys(cur).filter((k) => !ant.itens[k]).map((k) => ({ chave: k, rotulo: cur[k].r, origens: cur[k].o }));
  const sairam = Object.keys(ant.itens).filter((k) => !cur[k]).map((k) => {
    const r = ant.itens[k].r;
    let motivo = "nao_citada";
    const cobre = (M.cobertas || []).find((G) => G.chave === k);
    const dispensada = (M.lacunas || []).find((G) => G.chave === k && G.dispensada);
    let lei = null;
    try { lei = leiCasarRotulo(String(r).replace(/\s*\([^)]*\)\s*$/, ""), lista) || leiCasarRotulo(r, lista); } catch (e) { lei = null; }
    if (!lei && /^nome:/.test(k)) lei = ledCasarPorNome(r, lista);
    if (cobre) motivo = "coberta"; else if (dispensada) motivo = "dispensada"; else if (lei) motivo = "incluida";
    return { chave: k, rotulo: r, motivo, lei: lei ? lei.nome : (cobre && cobre.dentroDe[0] ? cobre.dentroDe[0].nome : "") };
  });
  if (!entraram.length && !sairam.length) return { em: ant.em, entraram, sairam, igual: true };
  return { em: ant.em, entraram, sairam };
}
function ledDifEl(D) {
  if (!D || D.igual) return null;
  const box = ledEl("div", "led-dif");
  box.id = "ledDif";
  const d = String(D.em || "").slice(0, 10).split("-").reverse().join("/");
  box.append(ledEl("div", "led-dif-tit", t("led_dif_tit", { d })));
  D.entraram.forEach((x) => box.append(ledEl("div", "led-dif-lin led-dif-mais", "＋ " + x.rotulo + " — " + x.origens.map((o) => t("led_orig_" + o)).join(", "))));
  D.sairam.forEach((x) => box.append(ledEl("div", "led-dif-lin led-dif-menos", "− " + x.rotulo + " — " + t("led_dif_saiu_" + x.motivo, { l: x.lei || "" }))));
  return box;
}
/* (item 2) a seção "já dentro de leis que você tem" (recolhida) */
function ledCobertasEl(M) {
  const cob = (M && M.cobertas) || [];
  if (!cob.length) return null;
  const det = ledEl("details", "led-lig led-cob");
  det.id = "ledCob";
  det.append(ledEl("summary", "led-lig-tit", t("led_cob_tit", { n: cob.length })));
  det.append(ledInfo(t("led_cob_expl")));
  cob.forEach((G) => {
    const lin = ledEl("div", "led-lac-lin");
    lin.id = "ledCob_" + ledIdSeguro(G.chave);
    const tx = ledEl("div", "led-lei-txt");
    tx.append(ledEl("div", "led-lei-nome", G.rotulo));
    tx.append(ledEl("div", "led-lei-meta", t("led_cob_dentro", { l: G.dentroDe.map((x) => x.nome).join("; ") })
      + " · " + ledOrigens(G).map((o) => t("led_orig_" + o)).join(", ")));
    lin.append(tx);
    det.append(lin);
  });
  return det;
}

/* =====================================================================
 * (19.164.0) A LEI CITADA PELO NOME, MESMO SEM NÚMERO
 *
 * "A recomendação das leis deve citar as leis que foram citadas nominalmente no edital." No ISS: "Código Tributário
 * Municipal" (a LC 15/2009 de Caruaru está na biblioteca com esse nome, e o tópico não se ligava a ela). Edital
 * municipal e estadual cita assim: "Lei Orgânica do Município", "Estatuto dos Servidores Públicos do Município",
 * "Código de Obras", "Constituição do Estado de Pernambuco" — sem número nenhum.
 *  · o NOME: "Código …", "Estatuto …", "Lei Orgânica …", "Lei Geral …", "Lei de/da/do …", "Regimento Interno …",
 *    "Constituição do Estado …" seguidos de palavras com maiúscula (o nome próprio). "lei municipal", "lei específica",
 *    "constituição do crédito" não são nome de lei e ficam de fora;
 *  · casa com a biblioteca pelo NOME da lei (e o apelido e o começo do texto): todas as palavras do nome citado têm de
 *    estar lá; havendo mais de uma, a de nome mais justo; empate, não liga;
 *  · sem lei com esse nome: lacuna "citada pelo nome" (chave "nome:…").
 * ===================================================================== */
const LED_RE_NOME_LEI = /(?:^|[^A-Za-zÀ-ú])((?:C[óo]digo|Estatuto|Lei\s+Org[âa]nica|Lei\s+Geral|Lei\s+(?:de|da|do|das|dos)|Regimento\s+Interno|Constitui[çc][ãa]o\s+(?:do\s+Estado|Estadual))(?:\s+(?:de|da|do|das|dos|e|para|à|ao|aos|às)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ú]+){1,7})/g;
const LED_NOME_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "para", "a", "o", "as", "os", "ao", "aos", "lei"]);
/* (19.166.0) "Lei de Direito Material" não é nome de lei: em "Lei de/da/do …" pelo menos uma palavra tem de ser própria */
const LED_NOME_GENERICAS = new Set(["direito", "material", "processual", "geral", "especial", "federal", "estadual", "municipal",
  "complementar", "ordinaria", "nova", "vigente", "especifica", "regencia", "publico", "publica", "privado", "privada"]);
function ledNomesNoTexto(texto) {
  const out = [];
  const re = new RegExp(LED_RE_NOME_LEI.source, "g");
  let m;
  while ((m = re.exec(String(texto || ""))) !== null) {
    /* "Código Tributário Municipal e Lei Orgânica do Município": o "e" antes de outro nome de lei separa os dois
     * (e "Estatuto da Criança e do Adolescente" continua um nome só) */
    m[1].replace(/\s+/g, " ").trim().split(/\s+e\s+(?=(?:Lei|C[óo]digo|Estatuto|Regimento|Constitui)\b)/).forEach((parte) => {
      const nome = parte.replace(/\s+(?:de|da|do|das|dos|e|para|à|ao|aos|às)$/i, "");
      /* "Lei de" / "Código de" sem nome próprio depois não é nome de lei */
      const resto = nome.split(" ").slice(1).filter((w) => !LED_NOME_VAZIAS.has(ledSemAcento(w)));
      if (!resto.length) return;
      if (/^Lei\s+(?:de|da|do|das|dos)\s/i.test(nome) && resto.length < 2) return;
      if (/^Lei\s+(?:de|da|do|das|dos)\s/i.test(nome) && resto.every((w) => LED_NOME_GENERICAS.has(ledSemAcento(w)))) return;
      if (out.indexOf(nome) < 0) out.push(nome);
    });
  }
  return out;
}
function ledPalavrasNome(s) { return ledSemAcento(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !LED_NOME_VAZIAS.has(w)); }
/* a lei da biblioteca com esse nome (todas as palavras do nome citado no nome/apelido/começo do texto dela) */
function ledCasarPorNome(nome, lista) {
  const ps = ledPalavrasNome(nome);
  if (ps.length < 2) return null;
  const cands = [];
  (lista || []).forEach((l) => {
    const alvo = new Set(ledPalavrasNome([l.nome, l.apelido, String(l.texto || "").slice(0, 600)].filter(Boolean).join(" ")));
    if (!ps.every((w) => alvo.has(w))) return;
    const doNome = new Set(ledPalavrasNome([l.nome, l.apelido].filter(Boolean).join(" ")));
    const noNome = ps.every((w) => doNome.has(w));
    cands.push({ l, noNome, sobra: doNome.size });
  });
  if (!cands.length) return null;
  cands.sort((a, b) => (b.noNome - a.noNome) || (a.sobra - b.sobra));
  if (cands.length > 1 && cands[0].noNome === cands[1].noNome && cands[0].sobra === cands[1].sobra) return null;
  return cands[0].l;
}
function ledChaveNome(nome) { const ps = ledPalavrasNome(nome); return ps.length >= 2 ? "nome:" + ps.join("_") : ""; }

/* =====================================================================
 * (19.164.0) "LEIS CITADAS NO EDITAL": todas as leis que o edital cita, por número ou pelo nome, numa lista só, cada
 * uma com a situação — na biblioteca, falta, já dentro de outra lei, dispensada — e os tópicos que a citam. É a
 * conferência de que nada ficou de fora: o que está nas disciplinas e o que está em "faltam" sai daqui.
 * ===================================================================== */
const LED_CIT_ORDEM = { falta: 0, dispensada: 1, coberta: 2, biblioteca: 3 };
function ledCitadasSituacao(M) {
  const lac = {};
  (M.lacunas || []).forEach((G) => { lac[G.chave] = G; });
  const cob = {};
  (M.cobertas || []).forEach((G) => { cob[G.chave] = G; });
  return (M.citadasEdital || []).map((C) => {
    let st = "biblioteca", dentro = "";
    if (!C.leiId) {
      if (cob[C.chave]) { st = "coberta"; dentro = cob[C.chave].dentroDe.map((x) => x.nome).join("; "); }
      else if (lac[C.chave] && lac[C.chave].dispensada) st = "dispensada";
      else st = "falta";
    }
    return Object.assign({}, C, { st, dentro });
  }).sort((a, b) => LED_CIT_ORDEM[a.st] - LED_CIT_ORDEM[b.st] || String(a.rotulo).localeCompare(String(b.rotulo)));
}
/* (19.182.0) "na biblioteca" não é "ligada": os tópicos que citam a lei PELO NÚMERO e não estão ligados a ela.
 * (19.204.0) à parte, para a faixa do que falta contar e oferecer o "ligar todas" */
function ledVinculosFaltando(M) {
  const L = ledCitadasSituacao(M);
  /* a MESMA regra das sugestões, tópico a tópico (a linha da lei junta tópicos achados pelo número e pelo nome: a
   * "Constituição do crédito tributário" cai na linha da CF, e não pode ganhar a CF por isso) */
  const E = typeof ledEdital === "function" ? ledEdital(M.edId) : null;
  const TT = E && typeof lvTopicosDoEdital === "function" ? lvTopicosDoEdital(E) : [];
  const semV = (x) => {
    if (x.st !== "biblioteca" || !x.leiId || typeof lvSugestoesDoTopico !== "function") return [];
    return x.topicos.filter((T) => {
      const k = leisChaveComparavel(matChave(T.disciplina, T.nome));
      const z = TT.find((y) => y.chave === k) || {};
      return lvSugestoesDoTopico(T.disciplina, T.nome, z.ramos || [], z.motivo || "").some((o) => o.lei.id === x.leiId);
    }).map((T) => ({ disciplina: T.disciplina, nome: T.nome, leiId: x.leiId }));
  };
  const pend = [];
  L.forEach((x) => { x.semVinc = semV(x); x.semVinc.forEach((p) => pend.push(p)); });
  return { L, pend };
}
function ledCitadasEl(M, V0) {
  const V = V0 || ledVinculosFaltando(M);
  const L = V.L, pend = V.pend;
  if (!L.length) return null;
  const nB = L.filter((x) => x.st === "biblioteca" || x.st === "coberta").length, nF = L.filter((x) => x.st === "falta").length;
  const det = ledEl("details", "led-lig led-cit");
  det.id = "ledCit";
  det.append(ledEl("summary", "led-lig-tit", t("led_cit_tit", { n: L.length, b: nB, f: nF }) + (pend.length ? " · " + t("lv_cit_sem", { n: pend.length }) : "")));
  det.append(ledInfo(t("led_cit_expl")));
  /* o "ligar todas" mora na faixa do que falta; aqui, a lei a lei */
  if (pend.length && typeof lvLigarVarios === "function") det.open = true;
  L.forEach((x) => {
    const lin = ledEl("div", "led-cit-lin led-cit-" + x.st);
    lin.id = "ledCit_" + ledIdSeguro(x.chave);
    lin.append(ledEl("span", "led-cit-ic", x.st === "falta" ? "⚠" : x.st === "dispensada" ? "–" : "✓"));
    const tx = ledEl("div", "led-lei-txt");
    tx.append(ledEl("div", "led-lei-nome", x.rotulo));
    tx.append(ledEl("div", "led-lei-meta", t("led_cit_st_" + x.st, { l: x.dentro }) + " · " + t("led_cit_em", { n: x.topicos.length, t: x.topicos.slice(0, 3).map((T) => T.nome).join("; ") + (x.topicos.length > 3 ? "…" : "") })
      + (x.porNome ? " · " + t("led_orig_nome") : "")));
    if (x.semVinc && x.semVinc.length) {
      lin.className += " led-cit-semv";
      tx.append(ledEl("div", "led-lei-meta led-sem-vinculo", t("lv_cit_linha_sem", { n: x.semVinc.length, t: x.semVinc.slice(0, 3).map((T) => T.nome).join("; ") + (x.semVinc.length > 3 ? "…" : "") })));
    }
    lin.append(tx);
    if (x.semVinc && x.semVinc.length && typeof lvLigarVarios === "function") {
      const bl = ledEl("button", "btn-min btn-min-ok", t("lv_cit_ligar", { n: x.semVinc.length }));
      bl.type = "button"; bl.id = "btnLedCitLigar_" + ledIdSeguro(x.chave);
      bl.onclick = () => { lvLigarVarios(x.semVinc, "leis do edital: " + x.rotulo); ledPintar(); };
      lin.append(bl);
    }
    det.append(lin);
  });
  return det;
}


/* =====================================================================
 * (19.166.0) ITEM 4 — AS LEIS CITADAS SÓ NO SEU MATERIAL
 *
 * O edital não é a única fonte: o resumo de um tópico, os cartões dele e o comentário das questões citam leis que o
 * edital não nomeia (a LC 105 no comentário de uma questão de sigilo, o CPP num resumo de inviolabilidade). Elas não
 * entram em "faltam" (a lista do edital continua a do edital), mas aparecem à parte, por fonte e tópico, com "＋ incluir".
 * É a montagem mais cara da tela (lê todo o material dos tópicos): só ao pintar, e guardada enquanto nada muda.
 * ===================================================================== */
let ledOutrasMemo = null;
function ledOutrasFontes(edId, M) {
  const e = ledEdital(edId);
  if (!e || !M) return [];
  const lista = typeof leisLista === "function" ? leisLista() : [];
  const res = (typeof matResumos !== "undefined" && matResumos) || {};
  const qs = typeof qsTodas === "function" ? (qsTodas() || []) : [];
  const ja = new Set((M.lacunas || []).concat(M.cobertas || []).map((G) => G.chave));
  const assin = [edId, lista.length, Object.keys(res).length, qs.length, Array.from(ja).sort().join(","), String(e.texto || "").length].join("|");
  if (ledOutrasMemo && ledOutrasMemo.assin === assin) return ledOutrasMemo.lista;
  const norm = typeof matChaveNormal === "function" ? matChaveNormal : ledSemAcento;
  const resPor = new Map();
  Object.keys(res).forEach((k) => { try { resPor.set(norm(k), res[k]); } catch (x) {} });
  const qsPor = new Map();
  qs.forEach((q) => { if (!q || !q.chave) return; const k = norm(q.chave); if (!qsPor.has(k)) qsPor.set(k, []); qsPor.get(k).push(q); });
  const casados = new Map();
  const naBiblioteca = (rot) => {
    if (!casados.has(rot)) {
      let l = null;
      try { l = leiCasarRotulo(rot, lista) || (ledCanon(rot) ? leiCasarRotulo(ledCanon(rot), lista) : null); } catch (x) { l = null; }
      casados.set(rot, l);
    }
    return casados.get(rot);
  };
  /* a norma que alterou uma lei da biblioteca já está dentro dela (como nas lacunas do edital) */
  const altSet = new Set();
  lista.forEach((l) => { try { leiAlteradorasDe(l).forEach((k) => altSet.add(k)); } catch (x) {} });
  const dentro = (rot) => { let k = ""; try { k = leiChaveDeEspecieNumero(String(rot).replace(/\s*\([^)]*\)\s*$/, "")); } catch (x) { k = ""; } return !!k && altSet.has(k); };
  const out = {};
  const anotar = (chave, rotulo, fonte, D0, tp) => {
    if (!chave || ja.has(chave)) return;
    const G = out[chave] = out[chave] || { chave, rotulo, fontes: { resumo: 0, cartao: 0, questao: 0 }, topicos: [], disciplinas: [] };
    if (String(rotulo).length > String(G.rotulo).length) G.rotulo = rotulo;
    G.fontes[fonte]++;
    if (!G.topicos.some((x) => x.disciplina === D0.nome && x.nome === tp.nome)) G.topicos.push({ disciplina: D0.nome, nome: tp.nome, peso: tp.peso || 0 });
    if (G.disciplinas.indexOf(D0.nome) < 0) G.disciplinas.push(D0.nome);
  };
  const ler = (txt, fonte, D0, tp) => {
    const s = String(txt || "");
    if (s.length < 8) return;
    const rots = [];
    try { (leiCitacoesNoTexto(s) || []).forEach((c) => { if (c.rotulo) rots.push(c.rotulo); }); } catch (x) {}
    ledMencoes(s).forEach((r) => rots.push(r));
    ledCatalogoNoTexto(s).forEach((x) => rots.push(x.achado));
    rots.filter((r, i, a) => a.indexOf(r) === i).forEach((rot) => {
      if (naBiblioteca(rot)) return;
      const r2 = ledRotuloLacuna(rot);
      if (dentro(r2)) return;
      anotar(ledChaveLacuna(r2), r2, fonte, D0, tp);
    });
    ledNomesNoTexto(s).forEach((nm) => {
      if (ledCanon(nm) || ledCasarPorNome(nm, lista)) return;
      anotar(ledChaveNome(nm), nm, fonte, D0, tp);
    });
  };
  const L = lerEdital(e.texto || "");
  (L.disciplinas || []).filter((d) => !d.inativa).forEach((d) => {
    const D0 = { nome: d.nome };
    (d.topicos || []).forEach((tp) => {
      let k = "";
      try { k = norm(typeof matChaveViva === "function" ? matChaveViva(d.nome, tp.nome) : matChave(d.nome, tp.nome)); } catch (x) { k = ""; }
      const r = resPor.get(k);
      if (r) { ler(r.texto, "resumo", D0, tp); ler(r.cartoes, "cartao", D0, tp); }
      (qsPor.get(k) || []).forEach((q) => ler([q.comentario, q.enunciado].filter(Boolean).join("\n"), "questao", D0, tp));
    });
  });
  /* o mesmo nome escrito de jeitos diferentes ("Lei Orgânica Municipal", "Lei Orgânica de Caruaru", "Lei Orgânica
   * Municipal de Caruaru"): as palavras de um contidas nas de outro juntam no nome mais completo */
  const nomes = Object.keys(out).filter((k) => /^nome:/.test(k)).sort((a, b) => b.split("_").length - a.split("_").length);
  nomes.forEach((k) => {
    if (!out[k]) return;
    const ws = new Set(k.slice(5).split("_"));
    nomes.forEach((k2) => {
      if (k2 === k || !out[k2]) return;
      const w2 = k2.slice(5).split("_");
      if (w2.length < ws.size && w2.every((w) => ws.has(w))) {
        const A = out[k], B = out[k2];
        Object.keys(B.fontes).forEach((f) => { A.fontes[f] += B.fontes[f]; });
        B.topicos.forEach((T) => { if (!A.topicos.some((x) => x.disciplina === T.disciplina && x.nome === T.nome)) A.topicos.push(T); });
        B.disciplinas.forEach((d) => { if (A.disciplinas.indexOf(d) < 0) A.disciplinas.push(d); });
        delete out[k2];
      }
    });
  });
  const lista2 = Object.keys(out).map((k) => out[k])
    .sort((a, b) => b.topicos.length - a.topicos.length || String(a.rotulo).localeCompare(String(b.rotulo)));
  ledOutrasMemo = { assin, lista: lista2 };
  return lista2;
}
function ledOutrasEl(M) {
  let L = [];
  try { L = ledOutrasFontes(M.edId, M); } catch (e) { L = []; }
  if (!L.length) return null;
  const det = ledEl("details", "led-lig led-outras");
  det.id = "ledOutras";
  det.append(ledEl("summary", "led-lig-tit", t("led_outras_tit", { n: L.length })));
  det.append(ledInfo(t("led_outras_expl")));
  L.forEach((G) => {
    const k = ledIdSeguro(G.chave);
    const lin = ledEl("div", "led-lac-lin");
    lin.id = "ledOutras_" + k;
    const tx = ledEl("div", "led-lei-txt");
    tx.append(ledEl("div", "led-lei-nome", G.rotulo));
    const fs = ["resumo", "cartao", "questao"].filter((f) => G.fontes[f]).map((f) => t("led_outras_f_" + f, { n: G.fontes[f] }));
    tx.append(ledEl("div", "led-lei-meta", fs.join(" · ") + " · " + t("led_cit_em", { n: G.topicos.length, t: G.topicos.slice(0, 3).map((T) => T.nome).join("; ") + (G.topicos.length > 3 ? "…" : "") })));
    lin.append(tx);
    const ac = ledEl("div", "led-lei-acoes");
    const bi = ledEl("button", "btn-min btn-min-ok", t("led_lac_incluir"));
    bi.type = "button"; bi.id = "btnLedOutrasInc_" + k;
    bi.onclick = () => ledIncluir(Object.assign({ porNome: /^nome:/.test(G.chave) }, G));
    ac.append(bi);
    lin.append(ac);
    det.append(lin);
  });
  return det;
}

/* =====================================================================
 * (19.166.0) ITEM 5 — O ARTIGO CITADO QUE NÃO ESTÁ NO TEXTO DA LEI
 *
 * "art. 195 do CTN" com o CTN na biblioteca mas sem o art. 195 no texto dele: a citação sumia calada (não entrava nos
 * artigos cobrados, nem virava aviso). Pode ser cópia cortada, artigo revogado que saiu na limpeza, numeração com letra
 * lida de outro jeito, ou o edital/espelho citando errado — em todo caso, a pessoa precisa saber. Agora fica num aviso,
 * por lei, com os artigos, quem os cita e "abrir a lei".
 * ===================================================================== */
function ledArtsFaltaEl(M) {
  const L = (M && M.artsFalta) || [];
  if (!L.length) return null;
  const n = L.reduce((a, x) => a + x.nums.length, 0);
  const det = ledEl("details", "led-lig led-artfalta");
  det.id = "ledArtFalta";
  det.append(ledEl("summary", "led-lig-tit", t("led_artfalta_tit", { n })));
  det.append(ledInfo(t("led_artfalta_expl")));
  L.forEach((x) => {
    const lin = ledEl("div", "led-lac-lin");
    lin.id = "ledArtFalta_" + x.leiId;
    const tx = ledEl("div", "led-lei-txt");
    tx.append(ledEl("div", "led-lei-nome", x.nome));
    tx.append(ledEl("div", "led-lei-meta", t("led_artfalta_arts", { a: x.nums.map((y) => y.numCru).join(", ") })));
    x.nums.slice(0, 6).forEach((y) => tx.append(ledEl("div", "led-lei-meta", "art. " + y.numCru + " — " + y.onde.slice(0, 3).map((o) => t("led_orig_" + o.fonte) + ": " + o.nome).join("; "))));
    lin.append(tx);
    const ac = ledEl("div", "led-lei-acoes");
    const b = ledEl("button", "btn-min", t("led_artfalta_abrir"));
    b.type = "button"; b.id = "btnLedArtFalta_" + x.leiId;
    b.onclick = () => ledLer(x.leiId);
    ac.append(b);
    lin.append(ac);
    det.append(lin);
  });
  return det;
}

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
  /* (etapa 2) AS LACUNAS: lei citada no edital que não está na biblioteca, por espécie e número ("LC 116/03" e "Lei
   * Complementar 116/2003" são a mesma); e, para o pedido à IA, o que cada tópico cita */
  const lac = {};
  const citas = [];
  /* (19.164.0) toda lei que o EDITAL cita (por número ou pelo nome): a conferência "leis citadas no edital" */
  const cit = {};
  const citar = (chave, rot, l, D0, tp, porNome) => {
    if (!chave) return;
    const C = cit[chave] = cit[chave] || { chave, rotulo: l ? l.nome : rot, leiId: l ? l.id : "", topicos: [], porNome: false };
    if (!C.leiId && String(rot).length > String(C.rotulo).length) C.rotulo = rot;
    if (porNome) C.porNome = true;
    if (!C.topicos.some((x) => x.nome === tp.nome && x.disciplina === D0.nome)) C.topicos.push({ disciplina: D0.nome, nome: tp.nome });
  };
  /* (19.166.0) o artigo citado (no edital ou numa discursiva) que não está no texto da lei guardada */
  const artFalta = {};
  const faltaArt = (l, c, onde, fonte) => {
    const A = artFalta[l.id] = artFalta[l.id] || { leiId: l.id, nome: l.nome, nums: [] };
    const nn = leiNumNormal(c.num);
    let y = A.nums.find((z) => z.num === nn);
    if (!y) { y = { num: nn, numCru: c.numCru || c.num, onde: [] }; A.nums.push(y); }
    if (!y.onde.some((o) => o.nome === onde)) y.onde.push({ nome: onde, fonte });
  };
  const lacunar = (rot, D0, tp, num, apelido, chaveFixa) => {
    const k = chaveFixa || ledChaveLacuna(rot);
    if (!k) return;
    const G = lac[k] = lac[k] || { chave: k, rotulo: rot, topicos: [], disciplinas: [], peso: 0, nums: new Set() };
    if (apelido) { G.apelidos = G.apelidos || []; if (G.apelidos.indexOf(apelido) < 0) G.apelidos.push(apelido); }
    if (String(rot).length > String(G.rotulo).length) G.rotulo = rot;
    if (chaveFixa) G.porNome = true;
    if (!G.topicos.some((x) => x.disciplina === D0.nome && x.nome === tp.nome)) { G.topicos.push({ disciplina: D0.nome, nome: tp.nome, peso: tp.peso || 0 }); G.peso += tp.peso || 0; }
    if (G.disciplinas.indexOf(D0.nome) < 0) G.disciplinas.push(D0.nome);
    if (num) G.nums.add(leiNumNormal(num));
  };
  const casar = (rot) => {
    const k = String(rot || "");
    if (!casados.has(k)) { let l = null; try { l = leiCasarRotulo(k, lista); } catch (x) { l = null; } casados.set(k, l); }
    return casados.get(k);
  };
  /* (19.164.0) a sigla ou o nome popular ("LEF", "Estatuto da Cidade") casa pela lei do catálogo */
  const casarCat = (rot) => casar(rot) || (ledCanon(rot) ? casar(ledCanon(rot)) : null);
  const mencoesDe = (txt) => ledMencoes(txt).concat(ledCatalogoNoTexto(txt).map((x) => x.achado)).filter((r, i, a) => a.indexOf(r) === i);
  /* (19.159.0) OS FUNDAMENTOS DAS DISCURSIVAS: as leis e os artigos citados no espelho e na resposta modelo dos temas
   * guardados deste edital entram na lei (artigos cobrados), na disciplina do tema; a lei citada que não está na
   * biblioteca vira lacuna ("citada em N discursiva(s)"). O tema não é tópico do edital: não liga lei a nada. */
  const dsTodas = ledDiscursivas(e.id);
  const discNomes = new Set((L.disciplinas || []).filter((d) => !d.inativa).map((d) => ledNormDisc(d.nome)));
  const dsDe = (nome) => dsTodas.filter((q) => ledNormDisc(q.disc) === ledNormDisc(nome));
  const dsSoltas = dsTodas.filter((q) => !discNomes.has(ledNormDisc(q.disc)));
  const lacunarDs = (rot, nomeD, q, num, apelido, chaveFixa) => {
    const k = chaveFixa || ledChaveLacuna(rot);
    if (!k) return;
    const G = lac[k] = lac[k] || { chave: k, rotulo: rot, topicos: [], disciplinas: [], peso: 0, nums: new Set() };
    if (apelido) { G.apelidos = G.apelidos || []; if (G.apelidos.indexOf(apelido) < 0) G.apelidos.push(apelido); }
    if (String(rot).length > String(G.rotulo).length) G.rotulo = rot;
    if (chaveFixa) G.porNome = true;
    G.ds = G.ds || [];
    if (!G.ds.some((x) => x.id === q.id)) G.ds.push({ id: q.id, tema: q.tema, disciplina: nomeD });
    if (nomeD && G.disciplinas.indexOf(nomeD) < 0) G.disciplinas.push(nomeD);
    if (num) G.nums.add(leiNumNormal(num));
  };
  const lerDs = (q, D) => {
    const achadas = {};
    ledCitacoes(q.txt).forEach((c) => {
      let lei = c.rotulo ? casarCat(c.rotulo) : null;
      if (!lei || !leiTemArtigo(lei, c.num)) {
        let r = null;
        try { r = leiResolverCitacao(c, lista, []); } catch (x) { r = null; }
        lei = r && r.lei;
      }
      if (!lei && c.rotulo && !casarCat(c.rotulo)) { lacunarDs(ledRotuloLacuna(c.rotulo), D.nome, q, c.num, ledCanon(c.rotulo) ? c.rotulo : ""); return; }
      if (c.rotulo) {
        const ln = casarCat(c.rotulo);
        if (ln && c.num && !leiTemArtigo(ln, c.num) && !(lei && leiTemArtigo(lei, c.num))) faltaArt(ln, c, q.tema, "discursiva");
      }
      if (!lei || !leiTemArtigo(lei, c.num)) return;
      (achadas[lei.id] = achadas[lei.id] || new Set()).add(leiNumNormal(c.num));
    });
    mencoesDe(q.txt).forEach((rot) => {
      const l = casarCat(rot);
      if (l) { if (!achadas[l.id]) achadas[l.id] = new Set(); return; }
      const r2 = ledRotuloLacuna(rot);
      if (ledChaveLacuna(r2)) lacunarDs(r2, D.nome, q, "", ledCanon(rot) ? rot : "");
    });
    ledNomesNoTexto(q.txt).forEach((nm) => {
      if (ledCanon(nm)) return;
      const l = ledCasarPorNome(nm, lista);
      if (l) { if (!achadas[l.id]) achadas[l.id] = new Set(); return; }
      const k = ledChaveNome(nm);
      if (k) lacunarDs(nm, D.nome, q, "", "", k);
    });
    Object.keys(achadas).forEach((id) => {
      const S = { id: q.id, tema: q.tema, disciplina: D.nome, nums: Array.from(achadas[id]) };
      const DL = D.leis[id] = D.leis[id] || { id, peso: 0, topicos: [] };
      (DL.ds = DL.ds || []).push(S);
      const P = porLei[id] = porLei[id] || { id, cob: new Set(), topicos: [], disciplinas: [] };
      P.dsCob = P.dsCob || new Set();
      S.nums.forEach((n) => P.dsCob.add(n));
      (P.ds = P.ds || []).push(S);
      if (P.disciplinas.indexOf(D.nome) < 0) P.disciplinas.push(D.nome);
    });
  };
  (L.disciplinas || []).filter((d) => !d.inativa).forEach((d, ordem) => {
    const D = { nome: d.nome, peso: d.peso || 0, abs: d.abs || 0, ordem, leis: {} };
    (d.topicos || []).forEach((tp) => {
      const ch = typeof matChaveViva === "function" ? matChaveViva(d.nome, tp.nome) : matChave(d.nome, tp.nome);
      const dt = leisDoTopico(ch);
      const achadas = {};
      dt.forEach((l) => { achadas[l.id] = new Set(); });
      const txt = ledTextoDoTopico(tp);
      const cita = new Map();   /* rótulo → números, para o pedido à IA */
      const anotar = (rot, num) => { const k = String(rot || "").trim(); if (!k) return; if (!cita.has(k)) cita.set(k, []); if (num && cita.get(k).length < 8 && cita.get(k).indexOf(num) < 0) cita.get(k).push(num); };
      ledCitacoes(txt).forEach((c) => {
        if (c.rotulo && !c.meioDaFaixa) anotar(c.rotulo, c.numCru || c.num);
        /* o caminho comum (o rótulo casa com uma lei que tem o artigo) pela memória; o resto, pela regra inteira */
        let lei = c.rotulo ? casarCat(c.rotulo) : null;
        if (!lei || !leiTemArtigo(lei, c.num)) {
          let r = null;
          try { r = leiResolverCitacao(c, lista, dt); } catch (x) { r = null; }
          lei = r && r.lei;
        }
        if (!lei && c.rotulo && !casarCat(c.rotulo)) {
          const rl = ledRotuloLacuna(c.rotulo);
          lacunar(rl, D, tp, c.num, ledCanon(c.rotulo) ? c.rotulo : "");
          citar(ledChaveLacuna(rl), rl, null, D, tp);
          return;
        }
        /* a lei NOMEADA na citação conta como citada, mesmo que o artigo não esteja no texto dela */
        if (c.rotulo) {
          const ln = casarCat(c.rotulo);
          if (ln) {
            citar("id:" + ln.id, c.rotulo, ln, D, tp);
            /* (19.166.0) a lei nomeada não tem o artigo, e nenhuma outra (a alterada) o resolveu: aviso */
            if (c.num && !leiTemArtigo(ln, c.num) && !(lei && leiTemArtigo(lei, c.num))) faltaArt(ln, c, tp.nome, "edital");
          }
        }
        if (!lei || !leiTemArtigo(lei, c.num)) return;
        (achadas[lei.id] = achadas[lei.id] || new Set()).add(leiNumNormal(c.num));
      });
      mencoesDe(txt).forEach((rot) => {
        const l = casarCat(rot);
        if (l) { if (!achadas[l.id]) achadas[l.id] = new Set(); anotar(rot); citar("id:" + l.id, rot, l, D, tp); return; }
        const r2 = ledRotuloLacuna(rot);
        if (ledChaveLacuna(r2)) { lacunar(r2, D, tp, "", ledCanon(rot) ? rot : ""); anotar(r2); citar(ledChaveLacuna(r2), r2, null, D, tp); }
      });
      /* (19.164.0) a lei citada PELO NOME, sem número ("Código Tributário Municipal", "Lei Orgânica do Município") */
      ledNomesNoTexto(txt).forEach((nm) => {
        if (ledCanon(nm)) return;
        const l = ledCasarPorNome(nm, lista);
        if (l) { if (!achadas[l.id]) achadas[l.id] = new Set(); anotar(nm); citar("id:" + l.id, nm, l, D, tp, true); return; }
        const k = ledChaveNome(nm);
        if (!k) return;
        lacunar(nm, D, tp, "", "", k);
        anotar(nm);
        citar(k, nm, null, D, tp, true);
      });
      citas.push({ disciplina: d.nome, peso: d.peso || 0, nome: tp.nome, tpPeso: tp.peso || 0,
        cita: Array.from(cita.entries()).map(([r, ns]) => r + (ns.length ? " (art. " + ns.join(", ") + ")" : "")) });
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
    dsDe(d.nome).forEach((q) => lerDs(q, D));
    D.lista = Object.keys(D.leis).map((k) => D.leis[k]).filter((x) => leiDe(x.id))
      .sort((a, b) => b.peso - a.peso || String(leiDe(a.id).nome).localeCompare(String(leiDe(b.id).nome)));
    if (D.lista.length) discs.push(D);
  });
  /* tema de discursiva com disciplina fora do edital: uma seção própria, no fim */
  if (dsSoltas.length) {
    const D = { nome: t("led_ds_disc"), peso: 0, abs: 0, ordem: 999, leis: {}, soDs: true };
    dsSoltas.forEach((q) => lerDs(q, D));
    D.lista = Object.keys(D.leis).map((k) => D.leis[k]).filter((x) => leiDe(x.id))
      .sort((a, b) => String(leiDe(a.id).nome).localeCompare(String(leiDe(b.id).nome)));
    if (D.lista.length) discs.push(D);
  }
  discs.sort((a, b) => b.peso - a.peso || b.abs - a.abs || a.ordem - b.ordem);
  let tot = 0, lid = 0;
  Object.keys(porLei).forEach((id) => {
    /* os artigos das discursivas contam quando a lei já é medida por artigos no edital, ou só aparece nas discursivas:
     * uma lei que o edital cobra inteira continua inteira (o art. 195 de um espelho não encolhe o CTN para 1 artigo) */
    const P0 = porLei[id];
    if (P0.dsCob && (P0.cob.size || !P0.topicos.length)) P0.dsCob.forEach((n) => P0.cob.add(n));
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
      x.leit = ledLeituraParcial(porLei[x.id].leit, [].concat(...x.topicos.map((T) => T.nums), ...(x.ds || []).map((S) => S.nums)));
      if (x.leit.modo === "cobrados") { t2 += x.leit.total; l2 += x.leit.lidos; }
    });
    D.total = t2; D.lidos = l2; D.pct = t2 ? Math.round((l2 / t2) * 100) : 0;
  });
  /* as lacunas, da disciplina mais pesada para a mais leve; as dispensadas ficam à parte */
  const pesoDisc = {};
  discs.forEach((D) => { pesoDisc[D.nome] = D.peso; });
  (L.disciplinas || []).forEach((d) => { if (pesoDisc[d.nome] == null) pesoDisc[d.nome] = d.peso || 0; });
  const disp = ledDispensadas(e.id);
  const lacunas = Object.keys(lac).map((k) => lac[k]).map((G) => Object.assign(G, {
    pesoDisc: Math.max(0, ...G.disciplinas.map((n) => pesoDisc[n] || 0)), dispensada: !!disp[G.chave], noEdital: true }))
    .sort((a, b) => b.pesoDisc - a.pesoDisc || b.peso - a.peso || String(a.rotulo).localeCompare(String(b.rotulo)));
  /* as leis da biblioteca citadas em tópicos a que ainda não estão ligadas */
  const semLigacao = Object.keys(porLei).map((id) => ({ id, lei: porLei[id].lei,
    topicos: porLei[id].topicos.filter((T) => !T.ligada) })).filter((x) => x.topicos.length)
    .sort((a, b) => b.topicos.length - a.topicos.length);
  const M = { edId: e.id, nome: (L.cfg && L.cfg.concurso) || e.nome || "", disciplinas: discs, leis: porLei,
    total: tot, lidos: lid, pct: tot ? Math.round((lid / tot) * 100) : 0, n: Object.keys(porLei).length,
    lacunas, semLigacao, citas, pesos: (L.disciplinas || []).filter((d) => !d.inativa).map((d) => ({ nome: d.nome, peso: d.peso || 0 })) };
  ledAplicarIa(M, casar, e.texto || "");
  /* (19.164.0) a norma que só alterou uma lei da biblioteca não falta: o texto consolidado dela já a traz */
  ledSepararCobertas(M, lista);
  M.citadasEdital = Object.keys(cit).map((k) => cit[k]);
  M.artsFalta = Object.keys(artFalta).map((k) => artFalta[k]).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  return M;
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
  /* aberta a partir da leitura (o "📚 leis do edital" da fila), a biblioteca está POR CIMA da lei: fecha, e a leitura
   * de baixo troca de lei. Aberta pela agenda, ela fica embaixo e volta (repintada) quando a leitura fecha. */
  if ($("dlgLeiSeca") && $("dlgLeiSeca").open && $("dlgLeiBib") && $("dlgLeiBib").open && ledPorCimaDaLeitura) $("dlgLeiBib").close();
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

/* ---------------- a tela: DENTRO DA BIBLIOTECA (19.204.0) ----------------
 * "Integrar as leis do edital à biblioteca, sem janela à parte." Escolhida a pasta 📋 de um edital, a biblioteca (na
 * vista "por disciplina") mostra as leis AGRUPADAS PELAS DISCIPLINAS do edital, da de maior peso para a de menor: cada
 * grupo com o peso, os artigos cobrados já lidos e uma barra; a lei de duas disciplinas aparece nas duas ("também em").
 * O que falta (leis fora da biblioteca, vínculos, artigos fora do texto, a IA) vira UMA faixa recolhida, com "ligar
 * todas" à mão. Quem chamava a janela (o ⚖ da agenda, a fila da leitura, a porta do tópico, a análise) abre a
 * biblioteca já nessa pasta, com o tópico em destaque e a disciplina dele aberta. Os grupos lembram, por edital, se
 * estão abertos; as explicações moram no "ⓘ como funciona". A vista "lista" é a biblioteca de sempre. */
const LED_FECHADAS_CH = "eac_lb_disc_fechadas";   /* {edId: {disciplina normalizada: 1}} — os grupos que a pessoa fechou */
const LED_PEND_CH = "eac_lb_pend_aberta";          /* "1": a faixa do que falta fica aberta */
let ledRolar = "";
let ledNaBibPintando = false;
let ledExtras = [];

function ledDiscFechadas(edId) {
  const o = ledLerMapa(LED_FECHADAS_CH)[String(edId)];
  return o && typeof o === "object" ? o : {};
}
function ledDiscGuardar(edId, nome, aberta) {
  const todos = ledLerMapa(LED_FECHADAS_CH);
  const o = todos[String(edId)] && typeof todos[String(edId)] === "object" ? todos[String(edId)] : {};
  const k = ledNormDisc(nome);
  if (aberta) delete o[k]; else o[k] = 1;
  if (Object.keys(o).length) todos[String(edId)] = o; else delete todos[String(edId)];
  ledGravarMapa(LED_FECHADAS_CH, todos);
  return !!aberta;
}
function ledPendAberta() { try { return localStorage.getItem(LED_PEND_CH) === "1"; } catch (e) { return false; } }
function ledPendGuardar(sim) { try { if (sim) localStorage.setItem(LED_PEND_CH, "1"); else localStorage.removeItem(LED_PEND_CH); } catch (e) {} return !!sim; }

/* o edital mostrado mudou: o destaque do tópico sai e "o que mudou" é refeito na próxima pintura */
function ledContexto(edId, opc) {
  const o = opc || {};
  ledCtx = { edId: String(edId || ""), disciplina: o.disciplina || "", topico: o.topico || "", recem: true };
  return ledCtx;
}
function ledLimparFoco() { ledCtx = Object.assign({}, ledCtx, { disciplina: "", topico: "", recem: true }); }

function ledAbrir(edId, opc) {
  const o = opc || {};
  const id = edId || (typeof edAberto === "function" && edAberto() ? edAberto().id : "") || (typeof editalAtual !== "undefined" ? editalAtual : "");
  if (!ledEdital(id) || typeof leiBibAbrirNoEdital !== "function" || !$("dlgLeiBib")) return false;
  ledContexto(id, o);
  ledPorCimaDaLeitura = !!($("dlgLeiSeca") && $("dlgLeiSeca").open);
  /* a disciplina pedida abre (mesmo que a pessoa a tenha fechado antes) e a tela rola até ela — ou até o tópico */
  if (o.disciplina) ledDiscGuardar(id, o.disciplina, true);
  ledRolar = o.topico ? "ledFoco" : (o.disciplina ? "disc:" + ledNormDisc(o.disciplina) : "");
  /* a janela abre antes da lista: a primeira montagem lê os artigos de cada lei (a CF, o CTM…) e pode levar um instante */
  leiBibAbrirNoEdital(id);
  const montar = () => { try { leiBibPintar(); } catch (e) { try { reg("ERRO", "leis do edital: falha ao montar", (e && e.message) || ""); } catch (x) {} } };
  /* LOGO DEPOIS DE ABRIR O APP as leis ainda estão chegando do IndexedDB (idb-leis.js): montar agora dava "0 leis".
   * Espera a leitura terminar; sem IndexedDB (ou já lidas), monta no próximo instante. */
  const lendo = typeof _leisCache !== "undefined" && _leisCache === null && typeof leisIdbSuportado === "function" && leisIdbSuportado()
    && typeof leisIdbMigrar === "function";
  if (lendo) Promise.resolve(leisIdbMigrar()).then(montar, montar);
  else setTimeout(montar, 0);
  try { reg("LEI", "leis do edital abertas na biblioteca", (ledUltimo ? ledUltimo.nome + " · " + ledUltimo.n + " leis" : id) + (o.topico ? " · tópico " + o.topico : (o.disciplina ? " · disciplina " + o.disciplina : ""))); } catch (e) {}
  return true;
}

function ledEl(tag, cls, txt) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (txt != null) el.textContent = txt;
  return el;
}

/* "ⓘ como funciona": a explicação longa fica recolhida, a um toque */
function ledInfo(...partes) {
  const d = ledEl("details", "led-info");
  d.append(ledEl("summary", "", t("led_info")));
  partes.forEach((p) => { if (p) d.append(typeof p === "string" ? ledEl("p", "nota", p) : p); });
  return d;
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
function ledBarra(pct, cls) {
  const barra = ledEl("span", "led-barra" + (cls ? " " + cls : ""));
  const fill = ledEl("span", "led-barra-fill");
  fill.style.width = (pct || 0) + "%";
  barra.append(fill);
  barra.setAttribute("role", "img");
  barra.setAttribute("aria-label", t("led_anel_aj", { p: pct || 0 }));
  return barra;
}

function ledBotaoLer(id, leit, T, idBt) {
  const b = ledEl("button", "btn-min" + (leit.prox ? " btn-min-ok" : ""));
  b.type = "button";
  b.id = idBt;
  b.textContent = leit.prox ? t(leit.comecou ? "led_continuar" : "led_comecar", { a: leit.prox.numCru }) : t("led_abrir");
  b.onclick = () => ledLer(id, leit.prox, T);
  return b;
}

/* as leis da pasta do edital que o edital não cita nem liga (postas à mão, usadas num vínculo): um grupo no fim */
function ledExtrasDaPasta(M) {
  if (!M || typeof pasContem !== "function" || typeof leisLista !== "function") return [];
  const pid = "ed:" + M.edId;
  let idx = null;
  try { idx = typeof pasIndice === "function" ? pasIndice() : null; } catch (e) { idx = null; }
  return leisLista().filter((l) => !M.leis[l.id] && pasContem(pid, { t: "lei", id: l.id, topicos: l.topicos || [] }, idx));
}

/* a fileira da leitura da biblioteca (não começadas · em leitura · lidas) conta, nesta vista, as LEIS que aparecem em
 * cada filtro: uma lei de duas disciplinas conta uma vez em cada estado em que esteja em alguma delas */
function ledContarEstados(M) {
  const por = {};
  ((M && M.disciplinas) || []).forEach((D) => D.lista.forEach((x) => { (por[x.id] = por[x.id] || new Set()).add(ledEstado(x.leit)); }));
  const c = { todas: 0, nao: 0, lendo: 0, ok: 0 };
  Object.keys(por).forEach((id) => { c.todas++; por[id].forEach((s) => { c[s]++; }); });
  (ledExtras || []).forEach((l) => { c.todas++; const s = typeof leiBibEstadoDe === "function" ? leiBibEstadoDe(l) : "nao"; c[s] = (c[s] || 0) + 1; });
  return c;
}

/* a biblioteca pinta o edital por aqui; ledPintar (de fora) repinta a biblioteca inteira, que conta e filtra junto */
function ledMontarNaBib(edId, opc) {
  if (String(ledCtx.edId) !== String(edId)) ledContexto(edId);
  ledNaBibPintando = true;
  try { return ledMontar(opc); } finally { ledNaBibPintando = false; }
}
function ledPintar(opc) {
  const dlg = $("dlgLeiBib");
  if (!ledNaBibPintando && dlg && dlg.open && typeof leiBibVendoEdital === "function" && leiBibVendoEdital() && typeof leiBibPintar === "function") {
    leiBibPintar(opc);
    return ledUltimo;
  }
  return ledMontar(opc);
}

/* NESTE TÓPICO: o que o ⚖ da agenda pediu */
function ledFocoEl(M) {
  const fc = ledEl("section", "led-foco");
  fc.id = "ledFoco";
  const cab = ledEl("div", "led-foco-cab");
  cab.append(ledEl("div", "led-foco-tit", t("led_foco_tit")));
  const bx = ledEl("button", "btn-quieto btn-p", "✕");
  bx.type = "button"; bx.id = "btnLedFocoX";
  bx.title = t("led_foco_x");
  bx.setAttribute("aria-label", t("led_foco_x"));
  bx.onclick = () => { ledCtx = Object.assign({}, ledCtx, { disciplina: "", topico: "" }); ledPintar({ reusar: true }); };
  cab.append(bx);
  fc.append(cab);
  fc.append(ledEl("div", "led-foco-sub", t("led_foco_sub", { t: ledCtx.topico, d: ledCtx.disciplina })));
  const doT = ledDoTopico(M, ledCtx.disciplina, ledCtx.topico);
  /* (19.182.0) sem lei achada pelo edital, a que o tópico cita pelo número (a CF com todas as letras) ainda pode estar
   * na biblioteca sem vínculo: ela aparece aqui, com "ligar e ler" */
  let sugF = [];
  if (!doT.length && typeof lvSugestoesDoTopico === "function") { try { sugF = lvSugestoesDoTopico(ledCtx.disciplina, ledCtx.topico); } catch (e) { sugF = []; } }
  sugF.forEach((o, i) => {
    const lin = ledEl("div", "led-foco-lin led-foco-sem");
    lin.id = "ledFocoSug_" + i;
    const tx = ledEl("div", "led-lei-txt");
    tx.append(ledEl("div", "led-lei-nome", o.lei.nome));
    tx.append(ledEl("div", "led-lei-meta", t("lv_foco_sem_vinculo", { r: o.rotulo })));
    lin.append(tx);
    const ac = ledEl("div", "led-lei-acoes");
    const bl = ledEl("button", "btn-min btn-min-ok", t("lv_foco_ligar"));
    bl.type = "button"; bl.id = "btnLedFocoLigarSug_" + i;
    bl.onclick = () => lvLigarEAbrir(ledCtx.disciplina, ledCtx.topico, o.lei.id, "leis do edital");
    ac.append(bl);
    lin.append(ac);
    fc.append(lin);
  });
  if (!doT.length) {
    if (!sugF.length) fc.append(ledEl("p", "nota", t("led_foco_vazio")));
    /* a lei seca do tópico: "usar uma lei já guardada" ou "colar uma lei nova" */
    const b = ledEl("button", "btn-min" + (sugF.length ? "" : " btn-min-ok"), t(sugF.length ? "lv_foco_outra" : "led_foco_abrir"));
    b.type = "button"; b.id = "btnLedFocoAbrir";
    b.title = t("lv_foco_abrir_tip");
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
      : t(x.T.ligada ? "led_foco_sem_art" : "lv_foco_sem_art_cit")));
    /* (19.189.0) os ★ importantes desta lei para este edital */
    try {
      const nImp = typeof liLista === "function" ? liLista(x.id, M.edId).length : 0;
      if (nImp) tx.append(ledEl("div", "led-lei-meta li-led", t("li_led_n", { n: nImp })));
    } catch (e) {}
    lin.append(tx);
    const acF = ledEl("div", "led-lei-acoes");
    /* (19.182.0) achada pelo edital, mas SEM vínculo com o tópico: ler solta não conta para ele — ligar e ler primeiro */
    if (!x.T.ligada && typeof lvLigarEAbrir === "function") {
      lin.className += " led-foco-sem";
      tx.append(ledEl("div", "led-lei-meta led-sem-vinculo", t("lv_foco_nao_ligada")));
      const bl = ledEl("button", "btn-min btn-min-ok", t("lv_foco_ligar"));
      bl.type = "button"; bl.id = "btnLedFocoLigar_" + x.id;
      bl.onclick = () => lvLigarEAbrir(ledCtx.disciplina, ledCtx.topico, x.id, "leis do edital");
      acF.append(bl);
    } else acF.append(ledBotaoLer(x.id, x.leit, x.T, "btnLedFocoLer_" + x.id));
    lin.append(acF);
    fc.append(lin);
  });
  return fc;
}

/* O QUE FALTA, numa faixa: "⚠ 2 faltam na biblioteca · 6 vínculo(s) faltando" + "🔗 ligar todas"; tocar abre o detalhe
 * (as citadas no edital, as lacunas, as que já estão dentro de outra lei, os artigos fora do texto, o material e a IA) */
function ledPendEl(M) {
  const V = ledVinculosFaltando(M);
  const nLac = (M.lacunas || []).filter((G) => !G.dispensada).length;
  const nArt = (M.artsFalta || []).reduce((a, x) => a + x.nums.length, 0);
  const nNov = ledDif && ledDif.edId === M.edId && !ledDif.igual ? (ledDif.entraram || []).length : 0;
  const partes = [];
  if (nLac) partes.push(t("led_resumo_lac", { n: nLac }));
  if (V.pend.length) partes.push(t("led_pend_vinc", { n: V.pend.length }));
  if (nArt) partes.push(t("led_pend_art", { n: nArt }));
  const aviso = partes.length > 0;
  if (nNov) partes.push(t("led_pend_novas", { n: nNov }));
  const box = ledEl("section", "led-pend" + (aviso ? "" : " led-pend-ok"));
  box.id = "ledPend";
  const lin = ledEl("div", "led-pend-lin");
  const aberta = ledPendAberta();
  const alt = ledEl("button", "led-pend-alt", (aviso ? "⚠ " : "✓ ") + (partes.length ? partes.join(" · ") : t("led_pend_nada")));
  alt.type = "button"; alt.id = "btnLedPend";
  alt.title = t("led_pend_aj");
  alt.setAttribute("aria-expanded", String(aberta));
  alt.setAttribute("aria-controls", "ledPendCorpo");
  lin.append(alt);
  if (V.pend.length && typeof lvLigarVarios === "function") {
    const bt = ledEl("button", "btn-min btn-min-ok", t("led_pend_ligar", { n: V.pend.length }));
    bt.type = "button"; bt.id = "btnLedCitLigarTodas";
    bt.title = t("lv_cit_ligar_todas_tip");
    bt.onclick = () => { lvLigarVarios(V.pend, "leis do edital: ligar todas"); ledPintar(); };
    lin.append(bt);
  }
  box.append(lin);
  const cp = ledEl("div", "led-pend-corpo");
  cp.id = "ledPendCorpo";
  cp.hidden = !aberta;
  alt.onclick = () => { const abrir = !!cp.hidden; cp.hidden = !abrir; alt.setAttribute("aria-expanded", String(abrir)); ledPendGuardar(abrir); };
  const difEl = ledDif && ledDif.edId === M.edId ? ledDifEl(ledDif) : null;
  if (difEl) cp.append(difEl);
  const citEl = ledCitadasEl(M, V);
  if (citEl) cp.append(citEl);
  ledPintarLacunas(M, cp);
  box.append(cp);
  return box;
}

/* UMA DISCIPLINA: o cabeçalho (nome, peso, leis, artigos cobrados lidos e a barra) e as leis dela, dobrável */
function ledDiscEl(M, D, k, itens, aberta) {
  const sec = ledEl("details", "led-disc");
  sec.id = "ledDisc_" + k;
  sec.open = aberta;
  if (sec.addEventListener) sec.addEventListener("toggle", () => ledDiscGuardar(M.edId, D.nome, sec.open));
  const sm = ledEl("summary", "led-disc-cab");
  sm.append(ledEl("span", "led-disc-nome", D.nome));
  sm.append(ledEl("span", "led-disc-meta", t("led_disc_meta", { p: D.peso, n: D.lista.length })));
  if (D.total) {
    const pg = ledEl("span", "led-disc-prog");
    pg.append(ledEl("span", "", t("led_disc_arts", { l: D.lidos, t: D.total })));
    pg.append(ledBarra(D.pct, "led-barra-p"));
    sm.append(pg);
  }
  sec.append(sm);
  itens.forEach((x) => sec.append(ledLeiEl(M, D, k, x)));
  return sec;
}

/* UMA LEI dentro da disciplina: o que ESTA disciplina cobra dela, os tópicos e temas, e as ações da biblioteca */
function ledLeiEl(M, D, k, x) {
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
  const meta = [L2.modo === "cobrados" ? t("led_cob", { t: L2.total, l: L2.lidos }) : t("led_cob_lei", { t: L2.total, l: L2.lidos })];
  const outras = P.disciplinas.filter((n) => n !== D.nome);
  if (outras.length) meta.push(t("led_tambem", { d: outras.join(", ") }));
  tx.append(ledEl("div", "led-lei-meta", meta.join(" · ")));
  if (M.iaPrioridade && M.iaPrioridade[x.id]) tx.append(ledEl("div", "led-lei-meta led-ia-nota", t("led_ia_prio", { m: M.iaPrioridade[x.id] })));
  if (M.iaNaoCai && M.iaNaoCai[x.id]) tx.append(ledEl("div", "led-lei-meta led-aviso", t("led_ia_nao_cai", { m: M.iaNaoCai[x.id] })));
  if (L2.modo === "cobrados" && L2.cobrados.length) tx.append(ledEl("div", "led-lei-arts", t("led_arts", { f: ledFaixas(L2.cobrados, P.leit, 14) })));
  const det = ledEl("details", "led-lei-tops");
  det.append(ledEl("summary", "", x.topicos.length ? t("led_topicos_n", { n: x.topicos.length }) + ((x.ds || []).length ? " · " + t("led_em_ds", { n: x.ds.length }) : "") : t("led_ds_ver", { n: (x.ds || []).length })));
  x.topicos.slice().sort((a, b) => b.peso - a.peso).forEach((T) => {
    const li = ledEl("div", "led-top");
    li.append(ledEl("span", "led-top-peso", String(T.peso)));
    li.append(ledEl("span", "led-top-nome", T.nome + (T.nums.length ? " · " + t("led_arts", { f: ledFaixas(T.nums.filter((n) => P.leit.pos && P.leit.pos[n] !== undefined).sort((a, b) => P.leit.pos[a] - P.leit.pos[b]), P.leit, 6) }) : "")));
    det.append(li);
  });
  /* (19.159.0) os temas de discursiva que citam a lei, com os artigos; tocar abre o tema */
  (x.ds || []).forEach((S) => {
    const li = ledEl("div", "led-top led-top-ds");
    li.append(ledEl("span", "led-top-peso", "✍"));
    li.append(ledEl("span", "led-top-nome", S.tema + (S.nums.length ? " · " + t("led_arts", { f: ledFaixas(S.nums.filter((n) => P.leit.pos && P.leit.pos[n] !== undefined).sort((a, b) => P.leit.pos[a] - P.leit.pos[b]), P.leit, 6) }) : "")));
    const b = ledEl("button", "btn-min", t("led_ds_abrir"));
    b.type = "button"; b.id = "btnLedDs_" + k + "_" + x.id + "_" + ledIdSeguro(S.id);
    b.onclick = () => {
      if ($("dlgLeiBib") && $("dlgLeiBib").open) $("dlgLeiBib").close();
      if (typeof dsIrPara === "function") dsIrPara(M.edId, { secao: "propostas", pid: S.id });
    };
    li.append(b);
    det.append(li);
  });
  tx.append(det);
  card.append(tx);
  const ac = ledEl("div", "led-lei-acoes");
  ac.append(ledBotaoLer(x.id, L2, x.topicos.find((T) => T.ligada) || null, "btnLedLer_" + k + "_" + x.id));
  /* o 📁 e o "⋯" (mapa, ligar a um tópico, apagar): os mesmos da lista */
  if (typeof leiBibAcoesDaLei === "function") leiBibAcoesDaLei(P.lei, "_" + k).forEach((el) => ac.append(el));
  card.append(ac);
  return card;
}

/* a pintura: o resumo, o destaque do tópico, a faixa do que falta e as disciplinas (com o filtro de leitura e a busca
 * da biblioteca) */
function ledMontar(opc) {
  const o = opc || {};
  const M = o.reusar && ledUltimo && String(ledUltimo.edId) === String(ledCtx.edId) ? ledUltimo : ledModelo(ledCtx.edId);
  ledUltimo = M;
  const corpo = $("ledCorpo");
  if (!M || !corpo) return M;
  const rolagem = corpo.scrollTop || 0;
  corpo.innerHTML = "";
  const estado = typeof leiBibEstado !== "undefined" ? leiBibEstado : "todas";
  const q = typeof leiBibTexto !== "undefined" && typeof leiTxtChave === "function" ? leiTxtChave(leiBibTexto) : "";
  const casa = (l) => !q || typeof leiBibCasaBusca !== "function" || leiBibCasaBusca(l, q);

  /* o resumo do edital: quanto do que ele cobra já foi lido */
  const rs = ledEl("div", "led-resumo");
  rs.id = "ledResumo";
  rs.append(ledEl("span", "led-resumo-txt", t("led_resumo", { n: M.n, l: M.lidos, t: M.total, p: M.pct })));
  rs.append(ledBarra(M.pct));
  rs.append(ledInfo(t("led_como")));
  corpo.append(rs);
  /* (19.164.0) O QUE MUDOU desde a última vez (calculado só ao abrir, não a cada repintura) */
  if (ledCtx.recem) { ledCtx.recem = false; try { ledDif = ledDiferenca(M); if (ledDif) ledDif.edId = M.edId; } catch (e) { ledDif = null; } }
  if (ledCtx.topico) corpo.append(ledFocoEl(M));
  corpo.append(ledPendEl(M));

  const fechadas = ledDiscFechadas(M.edId);
  let mostrou = 0;
  let alvo = ledRolar === "ledFoco" && ledCtx.topico ? "ledFoco" : "";
  M.disciplinas.forEach((D, k) => {
    const itens = D.lista.filter((x) => (estado === "todas" || ledEstado(x.leit) === estado) && casa(M.leis[x.id].lei));
    if (!itens.length) return;
    mostrou++;
    const nd = ledNormDisc(D.nome);
    corpo.append(ledDiscEl(M, D, k, itens, !fechadas[nd]));
    if (ledRolar === "disc:" + nd) alvo = "ledDisc_" + k;
  });
  /* as leis da pasta que o edital não cita: no fim, com o cartão da lista */
  ledExtras = ledExtrasDaPasta(M);
  const ex = ledExtras.filter((l) => (estado === "todas" || (typeof leiBibEstadoDe === "function" ? leiBibEstadoDe(l) : "nao") === estado) && casa(l));
  if (ex.length && typeof leiBibCartao === "function" && typeof leiUsosDaLei === "function") {
    mostrou++;
    const sec = ledEl("details", "led-disc led-disc-outras");
    sec.id = "ledDiscOutras";
    sec.open = !fechadas["#outras"];
    if (sec.addEventListener) sec.addEventListener("toggle", () => ledDiscGuardar(M.edId, "#outras", sec.open));
    const sm = ledEl("summary", "led-disc-cab");
    sm.append(ledEl("span", "led-disc-nome", t("led_outras_pasta")));
    sm.append(ledEl("span", "led-disc-meta", t("led_outras_pasta_n", { n: ex.length })));
    sec.append(sm);
    let idx = null;
    try { idx = typeof matIndiceConcursos === "function" ? matIndiceConcursos() : null; } catch (e) { idx = null; }
    ex.forEach((l) => sec.append(leiBibCartao({ l, usos: leiUsosDaLei(l, idx) })));
    corpo.append(sec);
  }
  if (!M.disciplinas.length && !ledExtras.length) corpo.append(ledEl("p", "nota", t("led_vazio")));
  else if (!mostrou) corpo.append(ledEl("p", "nota", t("led_vazio_filtro")));
  ledRolar = "";
  if (alvo) ledRolarPara(alvo);
  else if (rolagem) corpo.scrollTop = rolagem;
  return M;
}

/* rolar até o tópico ou a disciplina pedida, com o foco do teclado nela */
function ledRolarPara(id) {
  const el = $(id);
  if (!el) return false;
  try { if (el.scrollIntoView) el.scrollIntoView({ block: "start" }); } catch (e) {}
  try {
    /* no destaque, a primeira ação (ler, ligar, abrir a lei seca) — não o "✕" */
    const f = el.querySelector ? el.querySelector(id === "ledFoco" ? ".led-lei-acoes button, #btnLedFocoAbrir" : "summary") : null;
    if (f && f.focus) f.focus({ preventScroll: true });
  } catch (e) {}
  return true;
}

function ledIniciar() {
  if (typeof document === "undefined") return;
  if ($("btnEdLeis")) $("btnEdLeis").onclick = () => ledAbrir();
  /* voltar da leitura ou do assistente de lei nova repinta a biblioteca: o marcador, os vistos e as leis mudaram */
  const repintar = () => { if ($("dlgLeiBib") && $("dlgLeiBib").open && typeof leiBibPintar === "function") leiBibPintar(); };
  ["dlgLeiNova", "dlgLeiSeca"].forEach((id) => {
    const d = $(id);
    if (d && d.addEventListener && !d._ledOuvinte) { d._ledOuvinte = true; d.addEventListener("close", repintar); }
  });
}

/* =====================================================================
 * ETAPA 2 (19.139.0) — O QUE FALTA NA BIBLIOTECA, E A IA CONFERINDO A LISTA
 *
 * · LACUNA: lei citada no texto do edital (nome, nota ou ramo de um tópico) que não está na biblioteca. A chave é a
 *   espécie e o número ("LC 116/03" = "Lei Complementar 116/2003"); sigla solta que não casa ("LEF", "ISS") não vira
 *   lacuna — é o mais faminto dos rótulos, e daria uma lista de ruído. Cada lacuna tem "＋ incluir" (o assistente de
 *   lei; pronta, ela é ligada aos tópicos que a citam) e "dispensar" (lembrado por edital, e vai no backup).
 * · CITADA SEM LIGAÇÃO: lei da biblioteca citada num tópico a que não está ligada — "ligar" põe o ⚖ nesses tópicos.
 * · A IA: o app monta o pedido (as disciplinas com peso, o que cada tópico cita, as leis que você tem e as lacunas que
 *   o app achou) e lê a resposta num formato fixo: "+ lei | disciplina | por quê" (falta), "- lei | por quê" (não cai),
 *   "! lei | por quê" (prioridade). Nada é aplicado sozinho: a sugestão vira item da lista, e a lei que a IA cita e
 *   o edital NÃO menciona vem com aviso — a IA pode inventar uma lei ou errar o número.
 * ===================================================================== */
const LED_DISP_CH = "eac_led_dispensadas";   /* {edId: {chaveDaLacuna: "AAAA-MM-DD"}} */
const LED_IA_CH = "eac_led_ia";              /* {edId: {em, itens: [{tipo, lei, disc, motivo}]}} */
const LED_IA_DIRETA = "eac_led_ia_direta";   /* "1": o Gemini direto pode ser usado aqui (opção da tela da chave) */
let ledIaRascunho = "";
let ledIaAberta = false;
let ledVerDispensadas = false;

/* a chave de uma lei citada: "lc:116", "lei:4320", "constituicao:" — "" para sigla solta e o que não é lei */
function ledChaveLacuna(rot) {
  let k = null;
  try { k = leiRotuloChave(rot); } catch (e) { k = null; }
  if (!k) return "";
  if (k.especie === "constituicao") return "constituicao:";
  if (!k.especie || !k.numero) return "";
  return k.especie + ":" + k.numero;
}

function ledLerMapa(ch) { try { const v = JSON.parse(localStorage.getItem(ch) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
function ledGravarMapa(ch, o) { try { localStorage.setItem(ch, JSON.stringify(o || {})); return true; } catch (e) { return false; } }
function ledDispensadas(edId) { return ledLerMapa(LED_DISP_CH)[String(edId)] || {}; }
function ledDispensar(edId, chave, sim) {
  const o = ledLerMapa(LED_DISP_CH);
  const m = Object.assign({}, o[String(edId)] || {});
  if (sim === false) delete m[chave]; else m[chave] = typeof leisHojeISO === "function" ? leisHojeISO() : new Date().toISOString().slice(0, 10);
  o[String(edId)] = m;
  ledGravarMapa(LED_DISP_CH, o);
  try { reg("LEI", sim === false ? "leis do edital: lacuna de volta" : "leis do edital: lacuna dispensada", chave); } catch (e) {}
  return true;
}

/* ---------------- a IA ---------------- */
function ledIaLigada() { try { return localStorage.getItem(LED_IA_DIRETA) === "1"; } catch (e) { return false; } }
function ledIaLigar(sim) { try { if (sim) localStorage.setItem(LED_IA_DIRETA, "1"); else localStorage.removeItem(LED_IA_DIRETA); } catch (e) {} return ledIaLigada(); }
function ledIaPronta() { return ledIaLigada() && typeof jurIaPerguntar === "function" && typeof vzChaveApi === "function" && !!vzChaveApi(); }

function ledIaGuardado(edId) { return ledLerMapa(LED_IA_CH)[String(edId)] || null; }
function ledIaGuardar(edId, itens) {
  const o = ledLerMapa(LED_IA_CH);
  if (itens && itens.length) o[String(edId)] = { em: new Date().toISOString(), itens: itens.slice(0, 80) };
  else delete o[String(edId)];
  return ledGravarMapa(LED_IA_CH, o);
}

/* O PEDIDO. Vai só o que está no edital e na biblioteca: nomes de disciplinas, de tópicos e de leis — nunca o texto das leis. */
function ledIaPedido(M) {
  const L = [];
  L.push(t("led_ia_p_abre"));
  L.push("");
  L.push(t("led_ia_p_concurso", { c: M.nome }));
  L.push("");
  L.push(t("led_ia_p_disciplinas"));
  const porDisc = {};
  (M.citas || []).forEach((c) => { (porDisc[c.disciplina] = porDisc[c.disciplina] || []).push(c); });
  (M.pesos || []).slice().sort((a, b) => b.peso - a.peso).forEach((d) => {
    L.push("## " + d.nome + " (" + t("led_ia_p_peso", { p: d.peso }) + ")");
    (porDisc[d.nome] || []).forEach((c) => {
      L.push("- " + c.nome + " [" + c.tpPeso + "]" + (c.cita.length ? " — " + t("led_ia_p_cita") + " " + c.cita.join("; ") : ""));
    });
  });
  L.push("");
  L.push(t("led_ia_p_tenho"));
  const ids = Object.keys(M.leis || {});
  if (!ids.length) L.push("- " + t("led_ia_p_nenhuma"));
  ids.forEach((id) => {
    const P = M.leis[id];
    L.push("- " + P.lei.nome + " — " + t("led_ia_p_em", { n: P.topicos.length, d: P.disciplinas.join(", ") }));
  });
  const lac = (M.lacunas || []).filter((G) => G.noEdital && G.topicos.length);
  if (lac.length) {
    L.push("");
    L.push(t("led_ia_p_faltam"));
    lac.forEach((G) => L.push("- " + G.rotulo + " — " + G.topicos.slice(0, 4).map((x) => x.nome).join("; ")));
  }
  L.push("");
  L.push(t("led_ia_p_tarefa"));
  L.push("");
  L.push(t("led_ia_p_formato"));
  return L.join("\n");
}

/* A RESPOSTA: uma linha por lei. Aceita a lista com marcador ("* + Lei…", "1. + Lei…"), negrito e o sinal de menos. */
function ledIaLer(texto) {
  const itens = [];
  String(texto || "").split(/\r?\n/).forEach((linha) => {
    const s = linha.replace(/\*\*/g, "").replace(/^\s*(?:[*•·]|\d{1,2}[.)])\s+/, "").trim();
    const m = s.match(/^([+\-−!])\s*(.+)$/);
    if (!m) return;
    const tipo = m[1] === "−" ? "-" : m[1];
    const partes = m[2].split(/\s*\|\s*/).map((x) => x.trim());
    const lei = (partes[0] || "").replace(/[.;:,]+$/, "").trim();
    if (lei.length < 3 || lei.length > 140) return;
    let disc = "", motivo = "";
    if (partes.length >= 3) { disc = partes[1]; motivo = partes.slice(2).join(" | "); }
    else motivo = partes[1] || "";
    itens.push({ tipo, lei, disc, motivo: motivo.slice(0, 240) });
  });
  return itens;
}

/* a sugestão da IA sobre o modelo: "+" vira lacuna (ou "já está na biblioteca"), "-" e "!" viram nota na lei */
function ledAplicarIa(M, casar, textoEdital) {
  M.iaNaoCai = {}; M.iaPrioridade = {}; M.iaJa = []; M.iaEm = "";
  const g = ledIaGuardado(M.edId);
  if (!g || !g.itens) return M;
  M.iaEm = g.em || "";
  const disp = ledDispensadas(M.edId);
  /* o que o texto INTEIRO do edital nomeia (cabeçalho e linhas de disciplina também) */
  const noTexto = new Set();
  ledMencoes(textoEdital).forEach((r) => { const k = ledChaveLacuna(r); if (k) noTexto.add(k); });
  const pesoDe = {};
  (M.pesos || []).forEach((d) => { pesoDe[leisChaveComparavel(d.nome)] = d.peso; });
  g.itens.forEach((it) => {
    const l = casar(it.lei);
    if (it.tipo === "+") {
      if (l) { if (!M.iaJa.some((x) => x.lei.id === l.id)) M.iaJa.push({ lei: l, motivo: it.motivo }); return; }
      const k = ledChaveLacuna(it.lei);
      if (!k) return;
      let G = M.lacunas.find((x) => x.chave === k);
      if (!G) {
        G = { chave: k, rotulo: it.lei, topicos: [], disciplinas: it.disc ? [it.disc] : [], peso: 0, nums: new Set(),
          pesoDisc: pesoDe[leisChaveComparavel(it.disc)] || 0, dispensada: !!disp[k], noEdital: noTexto.has(k), soIa: true };
        M.lacunas.push(G);
      }
      G.ia = it.motivo || "—";
      return;
    }
    if (l) {
      if (it.tipo === "-") M.iaNaoCai[l.id] = it.motivo || "—";
      if (it.tipo === "!") M.iaPrioridade[l.id] = it.motivo || "—";
      return;
    }
    if (it.tipo === "!") {
      const G = M.lacunas.find((x) => x.chave === ledChaveLacuna(it.lei));
      if (G) G.prioridade = it.motivo || "—";
    }
  });
  /* as do edital primeiro; depois as que só a IA apontou */
  M.lacunas.sort((a, b) => (a.soIa ? 1 : 0) - (b.soIa ? 1 : 0) || (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0) || b.pesoDisc - a.pesoDisc || b.peso - a.peso);
  return M;
}

function ledIaAplicarTexto(texto) {
  const itens = ledIaLer(texto);
  if (!itens.length) { if ($("ledIaMsg")) $("ledIaMsg").textContent = t("led_ia_nada"); return 0; }
  ledIaGuardar(ledCtx.edId, itens);
  ledIaRascunho = "";
  try { reg("LEI", "leis do edital: resposta da IA lida", itens.length + " sugestões · " + ["+", "-", "!"].map((x) => x + itens.filter((i) => i.tipo === x).length).join(" ")); } catch (e) {}
  ledPintar();
  if ($("ledIaMsg")) $("ledIaMsg").textContent = t("led_ia_lida", { n: itens.length, f: itens.filter((i) => i.tipo === "+").length,
    nc: itens.filter((i) => i.tipo === "-").length, p: itens.filter((i) => i.tipo === "!").length });
  return itens.length;
}

async function ledIaCopiar() {
  const M = ledUltimo;
  if (!M) return false;
  const pedido = ledIaPedido(M);
  let ok = false;
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(pedido); ok = true; } } catch (e) { ok = false; }
  if ($("ledIaMsg")) $("ledIaMsg").textContent = ok ? t("led_ia_copiado", { n: pedido.length }) : t("led_ia_nao_copiou");
  try { reg("LEI", "leis do edital: pedido à IA copiado", pedido.length + " caracteres"); } catch (e) {}
  return ok ? pedido : false;
}

async function ledIaGemini() {
  const M = ledUltimo;
  if (!M || !ledIaPronta()) return null;
  const pedido = ledIaPedido(M);
  if ($("btnLedIaGemini")) $("btnLedIaGemini").disabled = true;
  if ($("ledIaMsg")) $("ledIaMsg").textContent = t("led_ia_esperando");
  try { reg("LEI", "leis do edital: Gemini direto", pedido.length + " caracteres"); } catch (e) {}
  try {
    const r = await jurIaPerguntar(pedido, { modulo: "LEIS", tempo: 180000 });
    ledIaRascunho = r.texto;
    if ($("ledIaResp")) $("ledIaResp").value = r.texto;
    ledIaAplicarTexto(r.texto);
    return r;
  } catch (e) {
    const cod = (e && e.codigo) || "rede";
    if ($("ledIaMsg")) $("ledIaMsg").textContent = t("jur_ia_erro_" + cod) + (e && e.detalhe && cod !== "cancelado" ? " (" + e.detalhe + ")" : "");
    try { reg("LEI", "leis do edital: Gemini falhou", cod); } catch (x) {}
    return null;
  } finally {
    if ($("btnLedIaGemini")) $("btnLedIaGemini").disabled = false;
  }
}

/* ---------------- incluir e ligar ---------------- */
function ledIncluir(G) {
  if (typeof leiNovaAbrir !== "function") return false;
  try { reg("LEI", "leis do edital: incluir lacuna", G.rotulo); } catch (e) {}
  /* a biblioteca fica embaixo do assistente e é repintada quando ele fecha */
  return leiNovaAbrir({ volta: (id) => ledIncluida(G, id), manterBib: true });
}

/* a lei nova ficou pronta: se ela É a que faltava, liga aos tópicos que a citam; senão, só avisa */
function ledIncluida(G, id) {
  const l = leiDe(id);
  let casou = null;
  try { casou = leiCasarRotulo(G.rotulo, leisLista()); } catch (e) { casou = null; }
  /* (19.164.0) a lei citada pelo nome casa pelo nome da lei incluída */
  if (!casou && G.porNome && l) casou = ledCasarPorNome(G.rotulo, [l]);
  let n = 0;
  if (l && casou && casou.id === id && G.topicos.length) {
    G.topicos.forEach((T) => { try { if (leiLigar(id, typeof matChaveViva === "function" ? matChaveViva(T.disciplina, T.nome) : matChave(T.disciplina, T.nome))) n++; } catch (e) {} });
    try { toastMsg(t("led_inc_ligada", { l: l.nome, n }), 6000); } catch (e) {}
  } else if (l) {
    try { toastMsg(t("led_inc_outra", { l: l.nome, r: G.rotulo }), 7000); } catch (e) {}
  }
  if ($("dlgLeiBib") && $("dlgLeiBib").open) ledPintar();
  return n;
}

async function ledLigarCitada(x) {
  const n = x.topicos.length;
  if (!(await uiConfirm(t("led_lig_conf", { l: x.lei.nome, n, lista: x.topicos.slice(0, 8).map((T) => "• " + T.nome).join("\n") + (n > 8 ? "\n…" : "") }), { ok: t("led_lig_ok", { n }) }))) return 0;
  x.topicos.forEach((T) => { try { leiLigar(x.id, T.chave); } catch (e) {} });
  try { reg("LEI", "leis do edital: lei ligada aos tópicos que a citam", x.lei.nome + " · " + n + " tópico(s)"); } catch (e) {}
  try { toastMsg(t("led_lig_feito", { l: x.lei.nome, n }), 5000); } catch (e) {}
  ledPintar();
  return n;
}

function ledIdSeguro(k) { return String(k).replace(/[^A-Za-z0-9]/g, "_"); }

/* ---------------- a tela das lacunas e da IA ---------------- */
function ledPintarLacunas(M, corpo) {
  const ativas = M.lacunas.filter((G) => !G.dispensada);
  const disp = M.lacunas.filter((G) => G.dispensada);
  if (ativas.length || disp.length) {
    const sec = ledEl("section", "led-lac");
    sec.id = "ledLac";
    sec.append(ledEl("div", "led-lac-tit", t("led_lac_tit", { n: ativas.length })));
    sec.append(ledInfo(t("led_lac_expl"), ledEl("p", "nota led-lac-crit", t("led_lac_criterio"))));
    const linha = (G, dispensada) => {
      const k = ledIdSeguro(G.chave);
      const lin = ledEl("div", "led-lac-lin" + (dispensada ? " led-lac-disp" : ""));
      lin.id = "ledLac_" + k;
      const tx = ledEl("div", "led-lei-txt");
      const nm = ledEl("div", "led-lei-nome", G.rotulo);
      /* (19.164.0) de onde veio, e se é nova desde a última vez */
      ledOrigens(G).filter((o) => o !== "ia").forEach((o) => nm.append(ledEl("span", "led-tag led-tag-orig", t("led_orig_" + o))));
      if (ledDif && ledDif.edId === M.edId && (ledDif.entraram || []).some((x) => x.chave === G.chave)) nm.append(ledEl("span", "led-tag led-tag-novo", t("led_tag_novo")));
      if (G.prioridade) nm.append(ledEl("span", "led-tag led-tag-prio", t("led_tag_prio")));
      if (G.ia) nm.append(ledEl("span", "led-tag led-tag-ia", t("led_tag_ia")));
      tx.append(nm);
      const meta = [];
      if (G.topicos.length) meta.push(t("led_lac_em", { n: G.topicos.length, d: G.disciplinas.join(", ") }));
      else if (G.disciplinas.length) meta.push(G.disciplinas.join(", "));
      if (G.nums && G.nums.size) meta.push(t("led_arts", { f: Array.from(G.nums).slice(0, 8).join(", ") }));
      if ((G.ds || []).length) meta.push(t("led_lac_ds", { n: G.ds.length, l: G.ds.slice(0, 3).map((x) => x.tema).join("; ") + (G.ds.length > 3 ? "…" : "") }));
      if (meta.length) tx.append(ledEl("div", "led-lei-meta", meta.join(" · ")));
      if (G.ia && G.ia !== "—") tx.append(ledEl("div", "led-lei-meta led-ia-nota", t("led_ia_motivo", { m: G.ia })));
      if (G.prioridade && G.prioridade !== "—") tx.append(ledEl("div", "led-lei-meta led-ia-nota", t("led_ia_prio", { m: G.prioridade })));
      if (G.soIa && !G.noEdital) tx.append(ledEl("div", "led-lei-meta led-aviso", t("led_lac_so_ia")));
      lin.append(tx);
      const ac = ledEl("div", "led-lei-acoes");
      if (dispensada) {
        const b = ledEl("button", "btn-min", t("led_lac_voltar"));
        b.type = "button"; b.id = "btnLedLacVolta_" + k;
        b.onclick = () => { ledDispensar(M.edId, G.chave, false); ledPintar(); };
        ac.append(b);
      } else {
        const bi = ledEl("button", "btn-min btn-min-ok", t("led_lac_incluir"));
        bi.type = "button"; bi.id = "btnLedLacInc_" + k;
        bi.title = t("led_lac_incluir_aj");
        bi.onclick = () => ledIncluir(G);
        const bd = ledEl("button", "btn-min", t("led_lac_dispensar"));
        bd.type = "button"; bd.id = "btnLedLacDisp_" + k;
        bd.title = t("led_lac_dispensar_aj");
        bd.onclick = () => { ledDispensar(M.edId, G.chave, true); ledPintar(); };
        ac.append(bi, bd);
      }
      lin.append(ac);
      return lin;
    };
    ativas.forEach((G) => sec.append(linha(G, false)));
    if (!ativas.length) sec.append(ledEl("p", "nota", t("led_lac_nenhuma")));
    if (disp.length) {
      const b = ledEl("button", "btn-link led-lac-ver", t(ledVerDispensadas ? "led_lac_disp_esconder" : "led_lac_disp_ver", { n: disp.length }));
      b.type = "button"; b.id = "btnLedLacDispVer";
      b.onclick = () => { ledVerDispensadas = !ledVerDispensadas; ledPintar(); };
      sec.append(b);
      if (ledVerDispensadas) disp.forEach((G) => sec.append(linha(G, true)));
    }
    corpo.append(sec);
  }

  /* (19.164.0) já dentro de leis que você tem (a norma alterou uma lei da biblioteca) */
  const cobEl = ledCobertasEl(M);
  if (cobEl) corpo.append(cobEl);
  /* (19.166.0) o artigo citado que não está na lei, e as leis citadas só no seu material */
  const afEl = ledArtsFaltaEl(M);
  if (afEl) corpo.append(afEl);
  const ouEl = ledOutrasEl(M);
  if (ouEl) corpo.append(ouEl);

  /* citadas e sem ligação */
  if (M.semLigacao.length) {
    const det = ledEl("details", "led-lig");
    det.id = "ledLig";
    det.append(ledEl("summary", "led-lig-tit", t("led_lig_tit", { n: M.semLigacao.length })));
    det.append(ledInfo(t("led_lig_expl")));
    M.semLigacao.forEach((x) => {
      const lin = ledEl("div", "led-lac-lin");
      lin.id = "ledLig_" + x.id;
      const tx = ledEl("div", "led-lei-txt");
      tx.append(ledEl("div", "led-lei-nome", x.lei.nome));
      tx.append(ledEl("div", "led-lei-meta", t("led_lig_meta", { n: x.topicos.length, t: x.topicos.slice(0, 3).map((T) => T.nome).join("; ") + (x.topicos.length > 3 ? "…" : "") })));
      lin.append(tx);
      const ac = ledEl("div", "led-lei-acoes");
      const b = ledEl("button", "btn-min btn-min-ok", t("led_lig_bt", { n: x.topicos.length }));
      b.type = "button"; b.id = "btnLedLig_" + x.id;
      b.onclick = () => ledLigarCitada(x);
      ac.append(b);
      lin.append(ac);
      det.append(lin);
    });
    corpo.append(det);
  }

  /* a IA */
  const ia = ledEl("details", "led-ia");
  ia.id = "ledIa";
  ia.open = ledIaAberta;
  if (ia.addEventListener) ia.addEventListener("toggle", () => { ledIaAberta = ia.open; });
  ia.append(ledEl("summary", "led-ia-tit", t("led_ia_tit")));
  ia.append(ledInfo(t("led_ia_expl")));
  if (M.iaEm) {
    const ult = ledEl("p", "nota led-ia-ult", t("led_ia_ultima", { d: new Date(M.iaEm).toLocaleDateString() }) + " ");
    const bl = ledEl("button", "btn-link", t("led_ia_limpar"));
    bl.type = "button"; bl.id = "btnLedIaLimpar";
    bl.onclick = () => { ledIaGuardar(M.edId, []); ledPintar(); };
    ult.append(bl);
    ia.append(ult);
    if (M.iaJa.length) ia.append(ledEl("p", "nota", t("led_ia_ja", { l: M.iaJa.map((x) => x.lei.nome).join("; ") })));
  }
  const bts = ledEl("div", "led-ia-bts");
  const bc = ledEl("button", "btn-min", t("led_ia_copiar"));
  bc.type = "button"; bc.id = "btnLedIaCopiar";
  bc.onclick = () => ledIaCopiar();
  bts.append(bc);
  if (ledIaPronta()) {
    const bg = ledEl("button", "btn-min btn-min-ok", t("led_ia_gemini"));
    bg.type = "button"; bg.id = "btnLedIaGemini";
    bg.title = t("led_ia_gemini_aj");
    bg.onclick = () => ledIaGemini();
    bts.append(bg);
  } else {
    const bk = ledEl("button", "btn-link", t("led_ia_config"));
    bk.type = "button"; bk.id = "btnLedIaConfig";
    bk.onclick = () => { if (typeof vzAbrirChave === "function") vzAbrirChave(); };
    bts.append(bk);
  }
  ia.append(bts);
  const ta = ledEl("textarea", "led-ia-resp");
  ta.id = "ledIaResp";
  ta.rows = 5;
  ta.placeholder = t("led_ia_ph");
  ta.value = ledIaRascunho;
  ta.oninput = () => { ledIaRascunho = ta.value; };
  ia.append(ta);
  const bl2 = ledEl("button", "btn-min btn-min-ok", t("led_ia_ler"));
  bl2.type = "button"; bl2.id = "btnLedIaLer";
  bl2.onclick = () => ledIaAplicarTexto(($("ledIaResp") || {}).value || "");
  ia.append(bl2);
  const msg = ledEl("p", "nota led-ia-msg");
  msg.id = "ledIaMsg";
  msg.setAttribute("role", "status");
  ia.append(msg);
  corpo.append(ia);
}
