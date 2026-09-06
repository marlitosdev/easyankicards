/* =====================================================================
 * MELHORAR UM CARTÃO
 *
 * Mesma história das questões, e pelo mesmo motivo: cartão gerado por
 * IA sai torto com frequência, e até aqui a única saída era apagar.
 *
 * O caso que originou isto estava na tela do usuário — um cartão cuja
 * frente era:
 *
 *   "3. Cartões de omissão (cloze): envolva o termo a memorizar em
 *    [...]. Cada lacuna do MESMO cartão usa um número DIFERENTE."
 *
 * Isso não é um cartão: é a REGRA nº 3 do prompt de geração, que a IA
 * copiou de volta junto com a resposta. O app já detecta isso na
 * bancada ("prompt vazado no cartão"), mas quem gerou pelo material
 * levava o lixo para dentro do tópico sem ninguém olhar.
 *
 * Aqui o defeito é NOMEADO antes de ir para a IA — pedir "melhore este
 * cartão" devolve outra versão do mesmo problema.
 * ===================================================================== */

/* Cada regra sabe reconhecer um jeito de o cartão sair errado. */
const CM_DEFEITOS = [
  /* a instrução do prompt virou cartão: fala de cartão, não de matéria */
  { id: "prompt", re: /(cart[ãa]o|cart[õo]es|lacuna|cloze|etiqueta|campo)\s+(de omiss|a memorizar|do mesmo|deve|precisa|usa um)/i },
  { id: "numerado", re: /^\s*\d+\s*[.)]\s+/ },
  { id: "instrucao", re: /(responda|use exatamente|n[ãa]o escreva|formato:|uma linha por|separe com)/i },
  { id: "markdown", re: /(\*\*|^#{1,6}\s|\n#{1,6}\s|^\s*---\s*$)/ },
  { id: "emoji", re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u },
  { id: "longo", re: null },
  { id: "sem_verso", re: null },
  { id: "cloze_repetida", re: null },
];

function cmDefeitosDoCartao(c) {
  if (!c) return [];
  const f = String(c.front || "");
  const v = String(c.back || "");
  const achados = [];
  CM_DEFEITOS.forEach((d) => {
    if (d.id === "longo") {
      /* 300 caracteres na frente é o dobro de uma pergunta de cartão.
       * Acima disso, quase sempre é um parágrafo que virou cartão. */
      if (f.length > 300) achados.push({ id: "longo", n: f.length });
      return;
    }
    if (d.id === "sem_verso") {
      /* cartão sem verso só faz sentido em lacuna; fora dela, é meio
       * cartão — pergunta sem resposta para conferir */
      if (!v.trim() && !/\{\{c\d+::/.test(f)) achados.push({ id: "sem_verso" });
      return;
    }
    if (d.id === "cloze_repetida") {
      const nums = [...f.matchAll(/\{\{c(\d+)::/g)].map((m) => m[1]);
      const repetido = nums.some((x, i) => nums.indexOf(x) !== i);
      if (repetido) achados.push({ id: "cloze_repetida" });
      return;
    }
    if (d.re && d.re.test(f)) achados.push({ id: d.id });
  });
  return achados;
}

/* ---------------- estado da janela ---------------- */

let cmMelAlvo = null;      /* o cartão como está */
let cmMelNovo = null;      /* a primeira versão devolvida */
let cmMelExtras = [];      /* as outras, se a IA devolver mais de uma */

function cmMelDescrever(lista) {
  if (!lista.length) return "- " + t("cm_mel_sem_defeito");
  return lista.map((d) => "- " + t("cm_mel_def_" + d.id, { n: d.n })).join("\n");
}

function cmMelTextoDoCartao(c) {
  const L = [String(c.front || "") + " :: " + String(c.back || "")
    + (c.ownTags && c.ownTags.length ? " :: " + c.ownTags.join(" ") : "")];
  if (c.more) L.push("+ " + String(c.more).replace(/<br>/g, "\n+ "));
  return L.join("\n");
}

function cmMelAbrir(c, contexto) {
  if (!c || !$("dlgMcMelhorar")) return;
  cmMelAlvo = c;
  cmMelNovo = null;
  cmMelExtras = [];
  const defeitos = cmDefeitosDoCartao(c);

  const cx = $("cmMelDefeitos");
  cx.innerHTML = "";
  if (!defeitos.length) {
    const d = document.createElement("div");
    d.className = "nota";
    d.textContent = t("cm_mel_sem_defeito");
    cx.append(d);
  } else {
    defeitos.forEach((x) => {
      const d = document.createElement("div");
      d.className = "qm-def";
      d.textContent = t("cm_mel_def_" + x.id, { n: x.n });
      cx.append(d);
    });
  }

  const alvo = contexto || {};
  $("cmMelPrompt").value = t("cm_mel_prompt", {
    defeitos: cmMelDescrever(defeitos),
    disciplina: alvo.disciplina || "—",
    topico: alvo.topico || "—",
    etiquetas: (c.tags && c.tags.length) ? c.tags.join(" ") : "—",
    atual: cmMelTextoDoCartao(c),
  });
  $("cmMelColar").value = "";
  $("cmMelComparar").hidden = true;
  $("cmMelExtras").hidden = true;
  $("btnCmMelAplicar").hidden = true;
  $("btnCmMelAplicarTodos").hidden = true;
  abrirModal("dlgMcMelhorar");
  try {
    matReg("cartoes", "correção de cartão aberta",
           defeitos.map((d) => d.id).join(", ") || "sem defeito detectado");
  } catch (e) {}
}

function cmMelConferir() {
  const cru = String(($("cmMelColar") || {}).value || "").trim();
  if (!cru) { uiAlert(t("cm_mel_vazio")); return false; }
  let lidos = [];
  try { lidos = (parseText(cru).cards || []); } catch (e) { lidos = []; }
  lidos = lidos.filter((x) => x && String(x.front || "").trim());
  if (!lidos.length) { uiAlert(t("cm_mel_nao_leu")); return false; }

  cmMelNovo = lidos[0];
  /* IA que devolve três a partir de um cartão longo demais está certa —
   * "um cartão por ideia" é exatamente a correção. Descartar as outras
   * em silêncio jogaria fora o trabalho sem dizer nada. */
  cmMelExtras = lidos.slice(1);

  const cx = $("cmMelComparar");
  cx.innerHTML = "";
  [["cm_mel_antes", cmMelAlvo, "qm-antes"],
   ["cm_mel_depois", cmMelNovo, "qm-depois"]].forEach(([rot, c, cls]) => {
    const r1 = document.createElement("div");
    r1.className = "qm-rot";
    r1.textContent = t(rot);
    const d = document.createElement("div");
    d.className = "qm-lado " + cls;
    const fr = document.createElement("div");
    fr.textContent = t("cm_mel_frente") + " " + String(c.front || "").slice(0, 400);
    const vs = document.createElement("div");
    vs.className = "qm-gab";
    vs.textContent = t("cm_mel_verso") + " "
      + (String(c.back || "").trim() || t("cm_mel_verso_vazio"));
    d.append(fr, vs);
    if (c.more) {
      const m = document.createElement("div");
      m.className = "qm-coment";
      m.textContent = String(c.more).replace(/<br>/g, " ").slice(0, 300);
      d.append(m);
    }
    cx.append(r1, d);
  });
  cx.hidden = false;
  $("btnCmMelAplicar").hidden = false;

  const av = $("cmMelExtras");
  av.hidden = !cmMelExtras.length;
  if (cmMelExtras.length) {
    av.textContent = t("cm_mel_extras", { n: cmMelExtras.length,
      lista: cmMelExtras.map((x) => "• " + String(x.front).slice(0, 80)).join("\n") });
  }
  const bT = $("btnCmMelAplicarTodos");
  bT.hidden = !cmMelExtras.length;
  bT.textContent = t("cm_mel_aplicar_todos", { n: cmMelExtras.length });

  /* a versão nova passa pelo mesmo detector: trocar um cartão torto por
   * outro torto seria só mudar a forma do problema */
  const ainda = cmDefeitosDoCartao(cmMelNovo);
  if (ainda.length) {
    uiAlert(t("cm_mel_ainda", { n: ainda.length,
      lista: ainda.map((d) => d.id).join(", ") }));
  }
  return true;
}

function cmMelAplicar(comExtras) {
  if (!cmMelAlvo || !cmMelNovo || !matAtual) return false;
  const bruto = String((matResumos[matAtual.chave] || {}).cartoes || "");
  /* tira o antigo pelo mesmo caminho do apagar — que sabe levar junto o
   * "+ saiba mais" e o título "@" do cartão */
  const sem = mcTextoSemCartao(bruto, cmMelAlvo);
  if (sem === null) { uiAlert(t("mc_apagar_nao_achou")); return false; }

  const novos = [cmMelNovo].concat(comExtras ? cmMelExtras : []);
  const linhas = novos.map((c) => cmMelTextoDoCartao(c));
  const texto = (sem ? sem + "\n" : "") + linhas.join("\n");
  matGravarCartoes(matAtual.chave, texto,
    { disciplina: matAtual.disciplina, topico: matAtual.topico });

  $("dlgMcMelhorar").close();
  try {
    matReg("cartoes", "cartão corrigido pela IA",
           String(cmMelNovo.front || "").slice(0, 60)
           + (comExtras && cmMelExtras.length ? " · +" + cmMelExtras.length : ""));
  } catch (e) {}
  uiAlert(comExtras && cmMelExtras.length
    ? t("cm_mel_aplicado_mais", { n: cmMelExtras.length })
    : t("cm_mel_aplicado"));
  cmMelAlvo = null; cmMelNovo = null; cmMelExtras = [];
  return true;
}

function cmMelIniciar() {
  if ($("btnCmMelFechar")) {
    $("btnCmMelFechar").onclick = () => $("dlgMcMelhorar").close();
  }
  if ($("btnCmMelConferir")) {
    $("btnCmMelConferir").textContent = t("cm_mel_conferir");
    $("btnCmMelConferir").onclick = () => cmMelConferir();
  }
  if ($("btnCmMelAplicar")) {
    $("btnCmMelAplicar").textContent = t("cm_mel_aplicar");
    $("btnCmMelAplicar").onclick = () => cmMelAplicar(false);
  }
  if ($("btnCmMelAplicarTodos")) {
    $("btnCmMelAplicarTodos").onclick = () => cmMelAplicar(true);
  }
  if ($("btnCmMelCopiar")) {
    $("btnCmMelCopiar").textContent = t("cm_mel_copiar");
    $("btnCmMelCopiar").onclick = () => {
      try { navigator.clipboard.writeText($("cmMelPrompt").value); } catch (e) {}
      const b = $("btnCmMelCopiar");
      const r = b.textContent;
      b.textContent = t("copied");
      setTimeout(() => { b.textContent = r; }, 1800);
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CM_DEFEITOS, cmDefeitosDoCartao, cmMelAbrir, cmMelConferir,
    cmMelAplicar, cmMelIniciar, cmMelTextoDoCartao,
  };
}
