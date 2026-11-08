/* =====================================================================
 * PRÉ-EDITAL → PÓS-EDITAL
 *
 * Concurso planejado tem disciplinas esperadas e material de pré-edital,
 * mas não tem data — e quando o edital sai de verdade, data, disciplinas e
 * tópicos podem mudar.
 *
 * A REGRA QUE MANDA EM TUDO AQUI: estudo feito na fase de pré-edital NUNCA
 * é apagado. Se a disciplina sair do plano depois que o edital sai, o
 * registro continua no diário, marcado como pré-edital. Ele é histórico do
 * que você fez; o plano é uma expectativa sobre o futuro. Reescrever o
 * primeiro porque o segundo mudou é apagar trabalho real por causa de um
 * palpite que não se confirmou.
 * ===================================================================== */

/* Marca de confiança por disciplina, no terceiro campo:
 *   @ Direito Constitucional :: 4 :: confirmada
 * "boato" fica FORA da agenda por padrão — estudar por especulação é o
 * desperdício mais caro que existe num concurso. */
const PRE_CONFIANCA = ["confirmada", "provavel", "boato"];

function preNormal(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function preConfiancaDe(txt) {
  const n = preNormal(txt);
  if (!n) return "";
  const achou = PRE_CONFIANCA.find((c) => n.indexOf(c) >= 0);
  return achou || "";
}

/* Uma disciplina "boato" só entra na agenda se você mandar. A lista de
 * exceções fica no próprio texto, para não haver estado escondido. */
function preNaAgenda(disc, forcadas) {
  if (disc.confianca !== "boato") return true;
  /* (19.100.0) "@ X :: 3 :: boato · na agenda" — a inclusão escrita na própria linha */
  if (disc.naAgenda) return true;
  return (forcadas || []).indexOf(preNormal(disc.nome)) >= 0;
}

/* ------------------------------------------------------------------
 * (19.100.0) A MARCA NA LINHA DA DISCIPLINA
 * "@ Contabilidade :: 5 :: confirmada — mantida no projeto básico". Trocar a marca reescreve SÓ o terceiro campo,
 * guardando o motivo e o que vem depois ("| minimo:", "| escolha:"). A inclusão de um boato na agenda também é escrita
 * ali ("boato · na agenda"): estado nenhum fora do texto.
 * ------------------------------------------------------------------ */
const PRE_ROTULO = { confirmada: "confirmada", provavel: "provável", boato: "boato" };
function preConfLinha(linha, conf, naAgenda, notaPadrao) {
  const m = /^(\s*@\s*)(.*)$/.exec(String(linha || ""));
  if (!m) return linha;
  let corpo = m[2], suf = "";
  const ip = corpo.search(/\s*\|\s*(?:m[íi]nimo|escolha)\s*:/i);
  if (ip >= 0) { suf = corpo.slice(ip); corpo = corpo.slice(0, ip); }
  const p = corpo.split("::").map((x) => x.trim());
  const velho = p[2] || "";
  let nota = velho.replace(/^\s*(?:confirmada|prov[aá]vel|boato)\b/i, "").replace(/[·,;]?\s*na agenda\b/i, "")
    .replace(/^[\s—–\-·:,;]+/, "").trim();
  if (!preConfiancaDe(velho) && velho && !nota) nota = velho;
  if (!nota && notaPadrao) nota = notaPadrao;
  const c = PRE_CONFIANCA.indexOf(conf) >= 0 ? conf : "";
  const campo3 = c ? PRE_ROTULO[c] + (c === "boato" && naAgenda ? " · na agenda" : "") + (nota ? " — " + nota : "") : "";
  const partes = [p[0], p[1] || "3"];
  if (campo3 || p.length > 3) partes.push(campo3);
  return m[1] + partes.concat(p.slice(3)).join(" :: ") + suf;
}
function preNomeDaLinha(linha) {
  const m = /^\s*@\s*(.*)$/.exec(String(linha || ""));
  if (!m) return null;
  return m[1].split(/\s*\|\s*(?:m[íi]nimo|escolha)\s*:/i)[0].split("::")[0].trim();
}
/* troca a marca de UMA disciplina no texto do plano; devolve o texto (igual, se não achou) */
function preConfTrocar(texto, nomeDisc, conf, naAgenda) {
  const alvo = preNormal(nomeDisc);
  let mudou = false;
  const out = String(texto || "").split("\n").map((l) => {
    const nm = preNomeDaLinha(l);
    if (nm === null || preNormal(nm) !== alvo || mudou) return l;
    mudou = true;
    return preConfLinha(l, conf, naAgenda);
  }).join("\n");
  return mudou ? out : String(texto || "");
}
/* O PLANO DE UM EDITAL DO APP COMO BASE DO PRÉ-EDITAL: as disciplinas e os tópicos (com blocos, ramos e a discursiva),
 * sem o cabeçalho e sem a data da 2ª fase — são do concurso antigo. Com `nota`, a disciplina sem marca vira "provável"
 * (estava no edital anterior, sem confirmação nova). */
function preBaseDoEdital(texto, nota) {
  /* fica só a linha "# discursiva" (o formato da prova); cabeçalho e "# fase 2" (datas do concurso antigo) saem */
  return String(texto || "").replace(/\r/g, "").split("\n").filter((l) => !/^\s*#/.test(l) || /^\s*#\s*discursiva\b/i.test(l)).map((l) => {
    if (nota === undefined || nota === null || preNomeDaLinha(l) === null) return l;
    const p = (l.split(/\s*\|\s*(?:m[íi]nimo|escolha)\s*:/i)[0]).split("::");
    return preConfiancaDe(p[2] || "") ? l : preConfLinha(l, "provavel", false, nota);
  }).join("\n").trim();
}

/* ------------------------------------------------------------------
 * A VIRADA
 * Compara o que você vinha estudando (pré) com o edital publicado (pós) e
 * devolve o retrato completo ANTES de qualquer mudança. Nada é aplicado
 * aqui — quem aplica é a pessoa, olhando estes números.
 * ------------------------------------------------------------------ */
function preComparar(txtPre, txtPos, progresso, diario) {
  const A = lerEdital(txtPre || "");
  const B = lerEdital(txtPos || "");
  const chave = (d, t) => preNormal(d) + "›" + preNormal(t);

  const antes = {}, depois = {};
  A.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
    antes[chave(d.nome, tp.nome)] = { disciplina: d.nome, topico: tp.nome };
  }));
  B.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
    depois[chave(d.nome, tp.nome)] = { disciplina: d.nome, topico: tp.nome };
  }));

  const prog = progresso || {};
  const estudado = (k) => {
    /* o progresso é endereçado pela chave do app (só minúsculas); aqui a
     * comparação é sem acento, então checo as duas formas */
    if (prog[k]) return true;
    return Object.keys(prog).some((x) => preNormal(x) === k);
  };

  const ficam = [], somem = [], surgem = [];
  Object.keys(antes).forEach((k) => {
    (depois[k] ? ficam : somem).push(Object.assign({ chave: k, estudado: estudado(k) }, antes[k]));
  });
  Object.keys(depois).forEach((k) => {
    if (!antes[k]) surgem.push(Object.assign({ chave: k }, depois[k]));
  });

  /* quanto tempo você já pôs no que vai sair do plano */
  const minutosPerdidos = (diario || []).reduce((a, x) => {
    if (!x || !x.n) return a;
    const k = chave(x.disc, x.n);
    return somem.some((s) => s.chave === k) ? a + (Number(x.m) || 0) : a;
  }, 0);

  const discAntes = A.disciplinas.map((d) => preNormal(d.nome));
  const discDepois = B.disciplinas.map((d) => preNormal(d.nome));
  const pesos = [];
  B.disciplinas.forEach((d) => {
    const velha = A.disciplinas.find((x) => preNormal(x.nome) === preNormal(d.nome));
    if (velha && velha.peso !== d.peso)
      pesos.push({ nome: d.nome, de: velha.peso, para: d.peso });
  });

  return {
    ficam, somem, surgem, pesos,
    estudadosQueSomem: somem.filter((s) => s.estudado),
    minutosPerdidos,
    discSomem: A.disciplinas.filter((d) => discDepois.indexOf(preNormal(d.nome)) < 0)
      .map((d) => ({ nome: d.nome, confianca: d.confianca || "", topicos: d.topicos.length })),
    discSurgem: B.disciplinas.filter((d) => discAntes.indexOf(preNormal(d.nome)) < 0)
      .map((d) => ({ nome: d.nome, topicos: d.topicos.length })),
    /* o edital publicado tem data? sem ela, a virada não completa */
    temData: !!(B.cfg && B.cfg.prova),
    prova: (B.cfg && B.cfg.prova) || "",
  };
}

/* ------------------------------------------------------------------
 * CARIMBAR O DIÁRIO
 * Antes de aplicar o edital publicado, todo registro da fase pré recebe
 * uma marca. Depois disso, mesmo que o tópico deixe de existir, o registro
 * continua legível e localizável — e o diário sabe dizer "isto foi estudo
 * de pré-edital, antes de o edital sair em tal data".
 * ------------------------------------------------------------------ */
/* (19.101.0) SÓ O DESTE CONCURSO. O diário é um só para todos os editais, e o carimbo pegava tudo: fazer a virada do
 * ISS marcava como "pré-edital do ISS" o que se estudou para o TCE. Com `opc`, só leva a marca o registro deste
 * concurso — pelo nome gravado nele (cc), ou, sem nome, pelo tópico ser do plano previsto.
 *   opc.nomes: nomes do concurso (o do edital e o do cabeçalho);  opc.chaves: Set de "disciplina›tópico" sem acento. */
function preCarimbarDiario(diario, nomeEdital, quandoSaiu, opc) {
  let n = 0;
  const nomes = opc && opc.nomes ? opc.nomes.map(preNormal).filter(Boolean) : null;
  const chaves = opc && opc.chaves ? opc.chaves : null;
  const desteConcurso = (x) => {
    if (!nomes && !chaves) return true;
    if (x.cc) return !!nomes && nomes.indexOf(preNormal(x.cc)) >= 0;
    return !!chaves && chaves.has(preNormal(x.disc) + "›" + preNormal(x.n));
  };
  (diario || []).forEach((x) => {
    if (!x || x.fase) return;
    if (!desteConcurso(x)) return;
    x.fase = "pre";
    x.faseEdital = nomeEdital || "";
    x.faseAte = quandoSaiu || (typeof hojeISO === "function"
      ? hojeISO() : new Date().toISOString().slice(0, 10));
    n++;
  });
  return n;
}

/* Registros de pré-edital cujo tópico não existe mais no plano. Não somem
 * do diário: ganham este rótulo e continuam contando nas horas estudadas. */
function preOrfaos(diario, txtPos) {
  const B = lerEdital(txtPos || "");
  const vivos = new Set();
  B.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
    vivos.add(preNormal(d.nome) + "›" + preNormal(tp.nome));
  }));
  return (diario || []).filter((x) => {
    if (!x || !x.n) return false;
    return !vivos.has(preNormal(x.disc) + "›" + preNormal(x.n));
  });
}

/* ------------------------------------------------------------------
 * APLICAR
 * Devolve o texto novo e o que precisa ser dito. NÃO toca no diário além
 * do carimbo, e NÃO apaga progresso: progresso de tópico que saiu fica
 * guardado pela chave, exatamente como na exclusão de disciplina (v8.73) —
 * se o tópico voltar, ele volta junto.
 * ------------------------------------------------------------------ */
function preAplicar(txtPos, cmp) {
  return {
    texto: txtPos,
    resumo: {
      ficam: cmp.ficam.length,
      somem: cmp.somem.length,
      surgem: cmp.surgem.length,
      estudadosQueSomem: cmp.estudadosQueSomem.length,
      horasPreservadas: Math.round((cmp.minutosPerdidos / 60) * 10) / 10,
    },
  };
}

/* =====================================================================
 * P5 — REMANEJAR O QUE FICOU ÓRFÃO
 *
 * Quando o edital publicado tira um tópico, três coisas podem ficar sem
 * dono: o progresso marcado, o material escrito e os cartões salvos. Nada
 * disso é apagado — mas ficar guardado numa gaveta que ninguém abre é
 * quase a mesma coisa. Aqui a pessoa aponta para onde cada um vai.
 * ===================================================================== */

/* Material (resumo + cartões) cujo tópico não existe mais no edital novo. */
function preMaterialOrfao(resumos, txtPos) {
  const B = lerEdital(txtPos || "");
  const vivos = new Set();
  B.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
    vivos.add(preNormal(d.nome) + "›" + preNormal(tp.nome));
  }));
  const fora = [];
  Object.keys(resumos || {}).forEach((k) => {
    const r = resumos[k];
    if (!r) return;
    /* pasta livre (criada na biblioteca de cartões) não é do plano de edital nenhum: não é órfã */
    if (r.pastaLivre) return;
    const temConteudo = String(r.texto || "").trim() || String(r.cartoes || "").trim();
    if (!temConteudo) return;
    const alvo = preNormal(r.disciplina) + "›" + preNormal(r.topico);
    if (vivos.has(alvo)) return;
    fora.push({ chave: k, disciplina: r.disciplina || "", topico: r.topico || "",
                chars: String(r.texto || "").length,
                cartoes: String(r.cartoes || "").split("\n").filter(Boolean).length });
  });
  return fora;
}

/* Os destinos possíveis: todo tópico do edital publicado. */
function preDestinos(txtPos) {
  const B = lerEdital(txtPos || "");
  const lista = [];
  B.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
    lista.push({ disciplina: d.nome, topico: tp.nome });
  }));
  return lista;
}

/* Move o material de uma chave para outra, JUNTANDO em vez de sobrescrever.
 * Mesma regra do conserto de chaves órfãs (v8.79): o texto do destino manda,
 * os cartões somam, e nada do que já estava lá se perde. */
function preRemanejarMaterial(resumos, deChave, disciplina, topico, gravar) {
  const r = resumos[deChave];
  if (!r) return null;
  const nova = (typeof matChave === "function")
    ? matChave(disciplina, topico) : (disciplina + "›" + topico).toLowerCase();
  if (nova === deChave) return null;

  const destino = resumos[nova];
  if (!destino) {
    resumos[nova] = Object.assign({}, r, { disciplina, topico,
      remanejadoDe: r.disciplina + "›" + r.topico,
      remanejadoEm: new Date().toISOString() });
  } else {
    destino.texto = destino.texto || r.texto || "";
    const a = String(destino.cartoes || "").trim();
    const b = String(r.cartoes || "").trim();
    if (b) {
      const jaTem = new Set(a.split("\n").map((l) => l.split("::")[0].trim().toLowerCase()));
      const novas = b.split("\n").filter((l) =>
        l.trim() && !jaTem.has(l.split("::")[0].trim().toLowerCase()));
      destino.cartoes = (a ? a + "\n" : "") + novas.join("\n");
    }
    destino.remanejadoDe = r.disciplina + "›" + r.topico;
    destino.remanejadoEm = new Date().toISOString();
  }
  delete resumos[deChave];
  if (typeof gravar === "function") gravar();
  return { de: deChave, para: nova };
}

/* O progresso do tópico que morreu NÃO é copiado para o novo — ele vira
 * VÍNCULO, exatamente como no "o que eu já estudei disto" (v8.74). Assim a
 * tela continua sabendo dizer de onde veio, e desfazer devolve tudo ao
 * lugar sem ter reescrito nada. */
function preRemanejarEstudo(deDisc, deTop, paraDisc, paraTop, editalId) {
  if (typeof vkAplicar !== "function" || typeof vkChave !== "function") return null;
  const r = vkAplicar([{
    de: { chave: vkChave(deDisc, deTop), disciplina: deDisc, topico: deTop },
    para: { chave: vkChave(paraDisc, paraTop), disciplina: paraDisc, topico: paraTop },
    conf: "ALTA", por: "remanejado na virada do edital", origem: "virada",
  }], editalId || "");
  return r;
}

/* =====================================================================
 * (19.101.0) A VIRADA COM APOIO DE IA — e o que ela leva junto
 *
 * 1. O DE-PARA. O pedido da virada pede à IA, além do edital no formato, as linhas do que mudou de nome, foi juntado ou
 *    dividido:   = Disciplina antiga :: Tópico antigo => Disciplina nova :: Tópico novo
 *    O app lê essas linhas e PRÉ-ESCOLHE o destino dos tópicos que saíram (marcado "sugestão da IA"; você confere). Sem
 *    a IA, sugere pelo nome parecido. As linhas "=" não entram no plano.
 * 2. O TÓPICO INTEIRO VAI JUNTO: o estudo (como vínculo), o resumo e os cartões — e agora também as leis ligadas, os
 *    julgados, as questões e os vínculos de citação. Antes, só o resumo e o estudo; as leis ficavam presas ao nome antigo
 *    e a pasta do edital as perdia.
 * 3. O CABEÇALHO É SEU: da resposta da IA vêm a data (prova:) e as linhas "# fase 2" / "# discursiva"; o nome do
 *    concurso, as horas por semana e o resto ficam como estavam (o exemplo do pedido trazia "horas: 12" e a IA copiava).
 * ===================================================================== */
const PRE_DEPARA_RE = /^\s*=\s*(.+?)\s*=>\s*(.+?)\s*$/;
function preLadoDePara(s) {
  const p = String(s || "").split("::").map((x) => x.trim());
  return p.length >= 2 && p[0] && p[1] ? { disciplina: p[0], topico: p[1] } : null;
}
/* as linhas "= de => para" da resposta: [{de:{disciplina,topico}, para:{disciplina,topico}}] */
function preDePara(txt) {
  const out = [];
  String(txt || "").split(/\r?\n/).forEach((l) => {
    const m = PRE_DEPARA_RE.exec(l);
    if (!m) return;
    const de = preLadoDePara(m[1]);
    m[2].split(/\s*;\s*/).forEach((alvo) => { const para = preLadoDePara(alvo); if (de && para) out.push({ de, para }); });
  });
  return out;
}
function preTirarDePara(txt) {
  return String(txt || "").split(/\r?\n/).filter((l) => !PRE_DEPARA_RE.test(l)).join("\n");
}

/* palavras de um nome de tópico, para comparar */
const PRE_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no", "na", "nos", "nas", "para", "com", "por", "sobre", "lei", "geral", "noções", "nocoes"]);
function prePalavras(s) {
  return new Set(preNormal(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !PRE_VAZIAS.has(w)));
}
function preSemelhanca(a, b) {
  const A = prePalavras(a), B = prePalavras(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => { if (B.has(w)) n++; });
  return n / (A.size + B.size - n);
}
/* o destino sugerido de um tópico que saiu: primeiro o de-para da IA (se o destino existe no edital novo), depois o nome
 * parecido (o melhor, com folga sobre o segundo). Devolve {destino, por: "ia"|"nome"} ou null. */
function preSugerirDestino(orf, destinos, depara) {
  const k = (d, t) => preNormal(d) + "›" + preNormal(t);
  const existe = (p) => destinos.find((d) => k(d.disciplina, d.topico) === k(p.disciplina, p.topico))
    || (destinos.filter((d) => preNormal(d.topico) === preNormal(p.topico)).length === 1 ? destinos.find((d) => preNormal(d.topico) === preNormal(p.topico)) : null);
  const meu = k(orf.disciplina, orf.topico);
  const ia = (depara || []).find((x) => k(x.de.disciplina, x.de.topico) === meu && existe(x.para))
    || (depara || []).find((x) => preNormal(x.de.topico) === preNormal(orf.topico) && existe(x.para));
  if (ia) return { destino: existe(ia.para), por: "ia" };
  let melhor = null, seg = 0;
  destinos.forEach((d) => {
    const s = preSemelhanca(orf.topico, d.topico) + (preNormal(d.disciplina) === preNormal(orf.disciplina) ? 0.1 : 0);
    if (!melhor || s > melhor.s) { if (melhor) seg = Math.max(seg, melhor.s); melhor = { d, s }; }
    else if (s > seg) seg = s;
  });
  if (melhor && melhor.s >= 0.5 && melhor.s - seg >= 0.15) return { destino: melhor.d, por: "nome" };
  return null;
}

/* o que está ligado a um tópico (pela chave do app) — para dizer o que vai junto */
function preLigacoesDe(chave) {
  const n = { leis: 0, jur: 0, qs: 0, cit: 0 };
  try { if (typeof leisDoTopico === "function") n.leis = leisDoTopico(chave).length; } catch (e) {}
  try { if (typeof jurDoTopico === "function") n.jur = jurDoTopico(chave).length; } catch (e) {}
  try { if (typeof qsContarDoTopico === "function") n.qs = qsContarDoTopico(chave); } catch (e) {}
  try { if (typeof citVinculosLer === "function") n.cit = citVinculosLer().filter((v) => v.chave && preNormal(v.chave) === preNormal(chave)).length; } catch (e) {}
  return n;
}
/* leva as leis, os julgados, as questões e os vínculos de citação de um tópico para outro */
function preMoverLigacoes(deChave, disciplina, topico) {
  const para = (typeof matChave === "function") ? matChave(disciplina, topico) : (disciplina + "›" + topico).toLowerCase();
  const n = { leis: 0, jur: 0, qs: 0, cit: 0 };
  if (!deChave || preNormal(deChave) === preNormal(para)) return n;
  try {
    if (typeof leisDoTopico === "function") leisDoTopico(deChave).forEach((l) => {
      leiLigar(l.id, para);
      (l.topicos || []).filter((c) => preNormal(c) === preNormal(deChave)).forEach((c) => leiDesligar(l.id, c));
      n.leis++;
    });
  } catch (e) {}
  try {
    if (typeof jurDoTopico === "function") jurDoTopico(deChave).forEach((j) => {
      jurLigar(j.id, para, disciplina, topico); jurDesligar(j.id, deChave); n.jur++;
    });
  } catch (e) {}
  try {
    if (typeof qsTodas === "function" && typeof qsMover === "function") {
      const ids = qsTodas().filter((q) => q.chave && preNormal(q.chave) === preNormal(deChave)).map((q) => q.id);
      if (ids.length) n.qs = qsMover(ids, { disciplina, topico }).length;
    }
  } catch (e) {}
  try {
    if (typeof citVinculosLer === "function") {
      const lista = citVinculosLer();
      lista.forEach((v) => {
        if (!v.chave || preNormal(v.chave) !== preNormal(deChave)) return;
        const resto = String(v.k || "").slice(String(v.chave).length);
        v.chave = para; v.k = para + resto; n.cit++;
      });
      if (n.cit) citVinculosGravar(lista);
    }
  } catch (e) {}
  return n;
}

/* O cabeçalho da virada: o SEU (nome, horas, o resto), com a data do edital publicado no lugar do "previsto:". Sem data
 * no publicado, o "previsto:" fica (continua previsto, como a confirmação avisa). As linhas "# fase 2" e "# discursiva"
 * vêm da resposta; as de antes só ficam se a resposta não trouxer as suas. */
function preCabecalhoVirada(txtAntes, txtNovo) {
  const linhasA = String(txtAntes || "").replace(/\r/g, "").split("\n");
  const linhasN = preTirarDePara(txtNovo).replace(/\r/g, "").split("\n");
  const ehExtra = (l) => /^\s*#\s*(?:fase\s*2\s*:|discursiva\b)/i.test(l);
  const iA = linhasA.findIndex((l) => /^\s*#/.test(l) && !ehExtra(l));
  const iN = linhasN.findIndex((l) => /^\s*#/.test(l) && !ehExtra(l));
  const B = lerEdital(linhasN.join("\n"));
  const prova = B.cfg && B.cfg.prova;
  let cab = iA >= 0 ? linhasA[iA].trim() : (iN >= 0 ? linhasN[iN].trim() : "");
  if (cab) {
    const partes = cab.replace(/^\s*#\s*/, "").split("|").map((x) => x.trim()).filter(Boolean);
    const fora = prova ? /^(?:prova|previsto|previsao|previsão)\s*:/i : /^prova\s*:/i;
    const ficam = partes.filter((x, i) => i === 0 || !fora.test(x));
    if (prova) ficam.splice(1, 0, "prova: " + prova);
    cab = "# " + ficam.join(" | ");
  }
  const extrasN = linhasN.filter(ehExtra);
  const extrasA = linhasA.filter(ehExtra).filter((l) => !extrasN.some((x) => /fase\s*2/i.test(x) === /fase\s*2/i.test(l)));
  const corpo = linhasN.filter((l, i) => i !== iN && !ehExtra(l));
  return [cab].concat(extrasN, extrasA, corpo).filter((l, i) => i > 0 || l).join("\n").replace(/^\n+/, "");
}
