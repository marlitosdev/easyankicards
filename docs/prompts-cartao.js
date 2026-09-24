/* ===================================================================
 * PADRÃO ÚNICO DOS PROMPTS DE CARTÃO
 *
 * Cada gerador (bancada, "N cartões" do tópico, questão, melhorar cartão,
 * revisar marcados, cloze de lei) tinha as SUAS regras de tamanho e de
 * conteúdo, e elas se contradiziam: o revisar mandava "encurte respostas
 * longas", o corretor parcial mandava "NÃO RESUMA", e "curto" / "caber de
 * cabeça" nunca diziam quanto era isso. Resultado medido em um baralho real
 * de 955 notas: 431 respostas com menos de 60 caracteres, só 16% citando o
 * artigo, e 62% dos básicos paráfrases uns dos outros.
 *
 * Aqui ficam os BLOCOS compartilhados. Os textos moram no i18n (chaves
 * pc_*), os números moram em PC_LIM — e são os mesmos que o detector usa.
 * O texto de cada prompt pede o bloco com {padrao_gerar},
 * {padrao_revisar} ou {padrao_corrigir}; t() resolve por pcPadrao().
 * =================================================================== */
const PC_LIM = {
  frente: 200,      // a pergunta cabe numa olhada
  vmin: 150,        // resposta que ensina: regra + fundamento, não uma palavra
  vmax: 500,
  mais: 900,        // "+ saiba mais" (literalidade, exemplo, esquema)
  frentesMax: 60,   // quantas perguntas já existentes vão no prompt
};

/* Quais blocos entram em cada tipo de prompt. */
const PC_BLOCOS = {
  gerar: ["tamanho", "qualidade", "antidup"],
  revisar: ["preservar", "tamanho", "qualidade"],
  corrigir: ["preservar", "qualidade"],
};

/* Lista de perguntas já existentes, sem repetir e sem estourar o prompt. */
function pcListaFrentes(frentes) {
  const vistos = new Set(), saida = [];
  (frentes || []).forEach((f) => {
    const s = String(f || "").replace(/\s+/g, " ").trim().slice(0, 140);
    const k = s.toLowerCase();
    if (!s || vistos.has(k) || saida.length >= PC_LIM.frentesMax) return;
    vistos.add(k); saida.push("- " + s);
  });
  return saida.join("\n");
}

function pcBloco(nome, opc) {
  const o = opc || {};
  if (nome === "antidup") {
    const lista = pcListaFrentes(o.frentes);
    return t(lista ? "pc_antidup_lista" : "pc_antidup", { frentes: lista });
  }
  return t("pc_" + nome, {
    frente: PC_LIM.frente, vmin: PC_LIM.vmin, vmax: PC_LIM.vmax, mais: PC_LIM.mais,
  });
}

/* tipo: "gerar" | "revisar" | "corrigir". opc.frentes: perguntas que já
 * existem (só o "gerar" usa: é o que impede a IA de reescrever o mesmo fato). */
function pcPadrao(tipo, opc) {
  const nomes = PC_BLOCOS[tipo] || [];
  return nomes.map((n) => pcBloco(n, opc)).join("\n\n");
}

/* Resolve os marcadores {padrao_*} de um texto de prompt. */
function pcResolver(texto, opc) {
  return String(texto).replace(/\{padrao_(gerar|revisar|corrigir)\}/g,
    (_, tipo) => pcPadrao(tipo, opc));
}

/* As perguntas que o tópico já tem, para a IA não reescrevê-las. Lê o mesmo
 * texto que o material guarda (linhas "pergunta :: resposta"; "@" e "+" são
 * título e explicação, não perguntas). */
function pcFrentesDoTopico(disciplina, topico) {
  try {
    if (!disciplina || !topico || typeof matChave !== "function" || typeof matResumos !== "object") return [];
    const reg = matResumos[matChave(disciplina, topico)];
    if (!reg || !reg.cartoes) return [];
    return String(reg.cartoes).split("\n")
      .filter((l) => l.indexOf("::") >= 0 && !/^\s*[@+]/.test(l))
      .map((l) => l.split("::")[0].trim()).filter(Boolean);
  } catch (e) { return []; }
}
