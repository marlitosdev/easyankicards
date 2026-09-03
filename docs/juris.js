/* =====================================================================
 * JURISPRUDÊNCIA
 *
 * O quarto material de um tópico, ao lado do resumo, dos cartões, das
 * questões e da lei seca. Guarda o que os tribunais decidiram — e o que
 * se decora de uma decisão não é a decisão inteira: é a TESE, aquela
 * frase que a banca transcreve na assertiva.
 *
 * POR QUE NÃO É UMA LEI COM OUTRO NOME.
 *
 * A lei seca é um texto ARTICULADO e estável: dividida em artigos, lida
 * em ordem, e o marcador é "parei no art. 35". Um julgado não tem
 * artigos, não se lê em ordem, e o que importa dele cabe em três linhas.
 * Guardá-lo como lei obrigaria a inventar artigos onde não há, e o
 * leitor de lei — que existe para percorrer capítulos — mostraria uma
 * ementa como se fosse um código.
 *
 * E também não é uma questão: questão tem gabarito e se responde. Uma
 * tese se lê, se reconhece na prova e se revisa. São três verbos
 * diferentes, e o app já erra pouco justamente por não misturá-los.
 *
 * O QUE ELE FAZ DE DIFERENTE: colar uma ementa crua e sair com os
 * campos preenchidos. Quem estuda copia do sítio do tribunal um bloco
 * com "RE 574706 / PR - PARANÁ, Relator(a): Min. CÁRMEN LÚCIA,
 * Julgamento: 15/03/2017" e não deveria ter de redigitar nada disso.
 * ===================================================================== */

const JUR_CHAVE = "eac_juris";

/* Os tribunais que aparecem em edital de concurso. A lista é fechada de
 * propósito: reconhecer uma sigla qualquer de três letras encheria o
 * campo com lixo tirado do meio da ementa. */
const JUR_TRIBUNAIS = ["STF", "STJ", "TST", "TSE", "STM", "TCU", "TNU",
  "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", "CARF"];

/* DE QUAL TRIBUNAL É CADA CLASSE.
 *
 * "RE 574706" já diz que é do Supremo, e a página do tribunal nem
 * sempre repete a sigla no bloco que se copia — ela está no cabeçalho
 * do site, que fica de fora da seleção. Deduzir daqui poupa uma
 * digitação em quase todo julgado colado.
 *
 * É DEDUÇÃO, e por isso só vale quando a sigla não aparece no texto: o
 * que está escrito manda sempre. E só entram as classes que pertencem a
 * um tribunal só — "MS" e "HC" existem em todos, e chutar ali seria
 * inventar procedência. */
const JUR_CASA = {
  "RE": "STF", "ARE": "STF", "ADI": "STF", "ADC": "STF",
  "ADPF": "STF", "ADO": "STF", "Súmula Vinculante": "STF",
  "REsp": "STJ", "AREsp": "STJ", "EREsp": "STJ",
  "AgRg no REsp": "STJ", "AgRg no AREsp": "STJ",
  "AgInt no REsp": "STJ", "EDcl no REsp": "STJ",
  "RR": "TST", "AIRR": "TST", "E-RR": "TST",
};

/* As classes processuais que a banca cita pelo nome. Ordem importa: as
 * compostas antes das simples, senão "AgRg no REsp" vira "REsp" e o
 * agravo se perde. */
const JUR_CLASSES = [
  "Súmula Vinculante", "Súmula", "Tema", "Repercussão Geral",
  "AgRg no REsp", "AgRg no AREsp", "AgInt no REsp", "EDcl no REsp",
  "AgRg", "AgInt", "EDcl", "EREsp", "AREsp", "REsp", "RE", "ARE",
  "ADI", "ADC", "ADPF", "ADO", "RMS", "MS", "HC", "RHC", "MI", "Rcl",
  "IRDR", "IAC", "RR", "AIRR", "E-RR",
];

function jurLerTudo() {
  try {
    const o = JSON.parse(localStorage.getItem(JUR_CHAVE) || "{}");
    return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
  } catch (e) { return {}; }
}

function jurGravarTudo(tudo) {
  try {
    const s = JSON.stringify(tudo || {});
    if (typeof guardar === "function") return guardar(JUR_CHAVE, s) !== false;
    localStorage.setItem(JUR_CHAVE, s);
    return true;
  } catch (e) { return false; }
}

function jurLista() {
  const tudo = jurLerTudo();
  return Object.keys(tudo).map((k) => tudo[k])
    .sort((a, b) => String(b.tocado || "").localeCompare(String(a.tocado || "")));
}

/* A MESMA COMPARAÇÃO DE CHAVE DA LEI SECA.
 * Um acento de diferença entre o que o edital escreveu e o que ficou
 * gravado abriria duas gavetas para o mesmo tópico. */
function jurChaveComparavel(c) {
  return String(c || "").toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

function jurDoTopico(chave) {
  const alvo = jurChaveComparavel(chave);
  if (!alvo) return [];
  return jurLista().filter((j) =>
    (j.topicos || []).some((c) => jurChaveComparavel(c) === alvo));
}

function jurContarDoTopico(chave) { return jurDoTopico(chave).length; }
function jurTem(chave) { return jurDoTopico(chave).length > 0; }

/* ------------------------------------------------------------------
 * COLAR COM FORMATAÇÃO
 *
 * Recebe o bloco cru copiado do sítio do tribunal e devolve os campos
 * separados. Nada aqui é adivinhação sobre o CONTEÚDO — só leitura de
 * formatos que os tribunais escrevem sempre igual.
 *
 * O que não for reconhecido fica em branco, e o texto inteiro é sempre
 * preservado: um extrator que "limpa" o que não entendeu apaga
 * justamente o que era diferente, e diferente costuma ser importante.
 * ------------------------------------------------------------------ */
function jurIdentificar(txt) {
  const bruto = String(txt || "");
  const achado = { tribunal: "", classe: "", numero: "", data: "",
                   relator: "", orgao: "", tese: "", tribunalDeduzido: false };
  if (!bruto.trim()) return achado;

  /* TRIBUNAL: sigla isolada, não pedaço de palavra. "STF" dentro de
   * "MANIFESTO" não é tribunal nenhum. */
  const tri = JUR_TRIBUNAIS.filter((s) =>
    new RegExp("(^|[^A-Za-z])" + s + "([^A-Za-z0-9]|$)").test(bruto))[0];
  if (tri) achado.tribunal = tri;

  /* CLASSE E NÚMERO juntos: é o par que identifica o julgado, e separá-los
   * em duas buscas independentes casaria a classe de uma citação com o
   * número de outra. */
  for (let i = 0; i < JUR_CLASSES.length; i++) {
    const c = JUR_CLASSES[i];
    const re = new RegExp("(^|[^A-Za-zÀ-ú])"
      + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
      + "\\s*(?:n?[º°.]?\\s*)?([\\d][\\d.\\-/]*)", "i");
    const m = bruto.match(re);
    if (m) {
      achado.classe = c;
      /* o "/PR" do fim é o estado, não parte do número */
      achado.numero = String(m[2]).replace(/[.\-/]+$/, "");
      break;
    }
  }

  /* A CASA DA CLASSE, quando a sigla não está escrita. O que aparece no
   * texto tem precedência: dedução não corrige ninguém. */
  if (!achado.tribunal && achado.classe && JUR_CASA[achado.classe]) {
    achado.tribunal = JUR_CASA[achado.classe];
    achado.tribunalDeduzido = true;
  }

  /* DATA DE JULGAMENTO. "Julgamento: 15/03/2017", "j. 15.03.2017",
   * "DJe 02/10/2017" — e a primeira data do bloco quando nenhuma delas
   * aparece rotulada. */
  const dRot = bruto.match(
    /(?:julgamento|julgado em|j\.|DJe|DJ)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  const dQualquer = bruto.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/);
  const data = (dRot && dRot[1]) || (dQualquer && dQualquer[1]) || "";
  if (data) {
    const p = data.split(/[./-]/);
    const ano = p[2].length === 2 ? "20" + p[2] : p[2];
    achado.data = ano + "-" + String(p[1]).padStart(2, "0")
      + "-" + String(p[0]).padStart(2, "0");
  }

  const rel = bruto.match(/Relator(?:\(a\))?\s*:?\s*(?:Min(?:istro|istra)?\.?\s*)?([^\n,;]{3,60})/i);
  if (rel) achado.relator = rel[1].trim();

  const org = bruto.match(/\b(Tribunal Pleno|Plenário|Corte Especial|Órgão Especial|Primeira Turma|Segunda Turma|Terceira Turma|Quarta Turma|Quinta Turma|Sexta Turma|Primeira Seção|Segunda Seção|Terceira Seção|[12]ª\s*Turma|[12]ª\s*Seção)\b/i);
  if (org) achado.orgao = org[1].trim();

  /* A TESE é o que se decora, e quase sempre está numa linha que começa
   * com "Tese:" ou dentro do bloco de ementa. Sem marcação nenhuma,
   * sugere-se a primeira frase longa — que quem cola confere e corrige,
   * porque é o campo que vai ser lido na revisão. */
  const tRot = bruto.match(/(?:^|\n)\s*(?:tese|ementa)\s*:?\s*([\s\S]{20,600}?)(?:\n\s*\n|$)/i);
  if (tRot) achado.tese = tRot[1].replace(/\s+/g, " ").trim();
  else {
    const frase = bruto.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, " ").trim())
      .filter((x) => x.length >= 40)[0];
    if (frase) achado.tese = frase.slice(0, 600);
  }
  return achado;
}

/* O TÍTULO CURTO, para caber numa linha de lista. */
function jurTitulo(j) {
  if (!j) return "";
  const partes = [j.tribunal, j.classe, j.numero].filter(Boolean);
  if (partes.length) return partes.join(" ");
  return String(j.tese || j.texto || "").replace(/\s+/g, " ").slice(0, 60)
    || "(sem identificação)";
}

function jurId(j) {
  const base = jurChaveComparavel(jurTitulo(j)).replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (base || "jur") + "-" + Math.random().toString(36).slice(2, 7);
}

/* Grava um julgado. Sem id, cria; com id, atualiza. */
function jurGravar(dados) {
  if (!dados) return null;
  const tudo = jurLerTudo();
  const id = dados.id || jurId(dados);
  const antigo = tudo[id] || {};
  const r = Object.assign({
    id, tribunal: "", classe: "", numero: "", orgao: "", relator: "",
    data: "", tese: "", texto: "", fonte: "", topicos: [],
    criado: new Date().toISOString(),
  }, antigo, dados, { id, tocado: new Date().toISOString() });
  r.topicos = (r.topicos || []).filter((x, i, a) => x && a.indexOf(x) === i);
  tudo[id] = r;
  if (!jurGravarTudo(tudo)) return null;
  return r;
}

function jurDe(id) { return jurLerTudo()[String(id)] || null; }

function jurApagar(id) {
  const tudo = jurLerTudo();
  if (!tudo[String(id)]) return false;
  delete tudo[String(id)];
  return jurGravarTudo(tudo);
}

/* LIGAR E DESLIGAR DE UM TÓPICO.
 * O mesmo julgado serve a vários tópicos e a vários editais — uma tese
 * de repercussão geral encosta em meia dúzia de assuntos. Por isso a
 * ligação é uma lista, e desligar de um tópico não apaga o julgado. */
function jurLigar(id, chave) {
  const j = jurDe(id);
  if (!j || !chave) return false;
  const alvo = jurChaveComparavel(chave);
  if ((j.topicos || []).some((c) => jurChaveComparavel(c) === alvo)) return true;
  j.topicos = (j.topicos || []).concat([chave]);
  return !!jurGravar(j);
}

function jurDesligar(id, chave) {
  const j = jurDe(id);
  if (!j) return false;
  const alvo = jurChaveComparavel(chave);
  j.topicos = (j.topicos || []).filter((c) => jurChaveComparavel(c) !== alvo);
  return !!jurGravar(j);
}

/* O TEXTO PARA REVISÃO, em uma linha por julgado. */
function jurTexto(lista) {
  return (lista || []).map((j) => {
    const cab = jurTitulo(j)
      + (j.data ? " · " + String(j.data).split("-").reverse().join("/") : "")
      + (j.orgao ? " · " + j.orgao : "");
    return cab + (j.tese ? "\n" + j.tese : "");
  }).join("\n\n");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    JUR_CHAVE, JUR_TRIBUNAIS, JUR_CLASSES, JUR_CASA,
    jurLerTudo, jurGravarTudo, jurLista, jurChaveComparavel,
    jurDoTopico, jurContarDoTopico, jurTem, jurIdentificar, jurTitulo,
    jurGravar, jurDe, jurApagar, jurLigar, jurDesligar, jurTexto,
  };
}
