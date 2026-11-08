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
function preCarimbarDiario(diario, nomeEdital, quandoSaiu) {
  let n = 0;
  (diario || []).forEach((x) => {
    if (!x || x.fase) return;
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
