/* =====================================================================
 * "O QUE EU JÁ ESTUDEI DISTO?"
 *
 * Cruza o DIÁRIO (o que você estudou, em qualquer concurso) com os tópicos
 * pendentes do edital aberto. Comparar dois editais inteiros seriam 30.856
 * combinações; comparar o diário com o edital são ~5.300 — e vínculo entre
 * dois tópicos que você nunca estudou não produz informação nenhuma.
 *
 * NADA é aplicado sozinho. Nem mesmo nome idêntico:
 * "Controle interno e externo" num TCE e numa prefeitura cobram normas
 * diferentes; o mesmo nome em disciplinas diferentes é outro assunto. O
 * app APRESENTA os idênticos e quem decide é a pessoa — item a item, ou
 * mandando tudo para a IA.
 *
 * E a IA nunca vê datas. Ela responde uma coisa só: estes dois tópicos são
 * o mesmo assunto? A recência é aritmética, e o app faz aritmética certo.
 * ===================================================================== */

let vinculos = [];

function vkCarregar() {
  try { vinculos = JSON.parse(localStorage.getItem("eac_vinculos") || "[]"); }
  catch (e) { vinculos = []; }
  if (!Array.isArray(vinculos)) vinculos = [];
  return vinculos;
}

function vkSalvar() {
  if (typeof guardar === "function") guardar("eac_vinculos", JSON.stringify(vinculos));
  else { try { localStorage.setItem("eac_vinculos", JSON.stringify(vinculos)); } catch (e) {} }
}

/* normalização só para COMPARAR nomes — nunca para exibir */
function vkNormal(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function vkChave(disc, top) { return vkNormal(disc) + "›" + vkNormal(top); }

/* ------------------------------------------------------------------
 * O QUE VOCÊ JÁ ESTUDOU
 * Uma linha por assunto, com a data mais recente e o concurso. Estudar
 * duas vezes o mesmo tópico não vira dois itens: vale o mais recente.
 * ------------------------------------------------------------------ */
function vkEstudados(diario) {
  const m = {};
  (diario || []).forEach((x) => {
    if (!x || !x.n || x.a === "pendente") return;
    const k = vkChave(x.disc, x.n);
    const antes = m[k];
    const dt = x.d && x.d !== "?" ? x.d : "";
    if (!antes || (dt && dt > antes.data)) {
      m[k] = { chave: k, disciplina: x.disc || "", topico: x.n,
               data: dt, concurso: x.cc || "", acao: x.a || "feito" };
    } else if (antes && x.a === "revisado") {
      antes.acao = "revisado";
    }
  });
  return Object.keys(m).map((k) => m[k]);
}

/* ------------------------------------------------------------------
 * TRIAGEM: nomes idênticos
 * Devolve os pares de nome exatamente igual (normalizado) — como
 * CANDIDATOS, nunca como fato. A disciplina entra na apresentação porque
 * é o que mais desmente a igualdade do nome.
 * ------------------------------------------------------------------ */
function vkIdenticos(estudados, pendentes) {
  const porNome = {};
  (estudados || []).forEach((e) => {
    (porNome[vkNormal(e.topico)] = porNome[vkNormal(e.topico)] || []).push(e);
  });
  const pares = [];
  (pendentes || []).forEach((p) => {
    const iguais = porNome[vkNormal(p.nome)];
    if (!iguais) return;
    iguais.forEach((e) => {
      if (vkJaTem(e.chave, vkChave(p.disciplina, p.nome))) return;
      pares.push({
        de: e, para: { disciplina: p.disciplina, topico: p.nome,
                       chave: vkChave(p.disciplina, p.nome) },
        /* mesma disciplina reforça, disciplina diferente é sinal de alerta —
         * e a tela mostra os dois casos, não esconde nenhum */
        mesmaDisciplina: vkNormal(e.disciplina) === vkNormal(p.disciplina),
      });
    });
  });
  return pares;
}

function vkJaTem(a, b) {
  return vinculos.some((v) => (v.a === a && v.b === b) || (v.a === b && v.b === a));
}

/* ------------------------------------------------------------------
 * O PROMPT
 * Recebe só o que a pessoa mandou para a IA. Sem datas: a IA responde
 * equivalência, o app calcula tempo.
 * ------------------------------------------------------------------ */
function vkPrompt(estudados, pendentes, nomeEdital) {
  const linha = (d, t) => "- " + (d ? d + " > " : "") + t;
  return t("vk_prompt", {
    edital: nomeEdital || "",
    estudei: (estudados || []).map((e) => linha(e.disciplina, e.topico)).join("\n"),
    pendentes: (pendentes || []).map((p) => linha(p.disciplina, p.nome)).join("\n"),
  });
}

/* ------------------------------------------------------------------
 * A RESPOSTA
 * "~ assunto estudado :: tópico do edital :: ALTA :: por quê"
 * ------------------------------------------------------------------ */
function vkLerResposta(txt, estudados, pendentes) {
  const achaEstudado = (s) => (estudados || []).find((e) =>
    vkNormal(e.disciplina + " " + e.topico) === vkNormal(s)
    || vkNormal(e.topico) === vkNormal(String(s).split(">").pop()));
  const achaPendente = (s) => (pendentes || []).find((p) =>
    vkNormal(p.disciplina + " " + p.nome) === vkNormal(s)
    || vkNormal(p.nome) === vkNormal(String(s).split(">").pop()));

  const pares = [], ignoradas = [];
  String(txt || "").split("\n").forEach((l, i) => {
    const bruta = l.trim();
    if (!bruta) return;
    if (!/^~/.test(bruta)) { ignoradas.push({ linha: i + 1, txt: bruta.slice(0, 70) }); return; }
    const p = bruta.replace(/^~\s*/, "").split("::").map((x) => x.trim());
    const e = achaEstudado(p[0]), d = achaPendente(p[1]);
    if (!e || !d) { ignoradas.push({ linha: i + 1, txt: bruta.slice(0, 70), motivo: "nao_achou" }); return; }
    const conf = /^alta$/i.test(p[2] || "") ? "ALTA" : "MEDIA";
    pares.push({ de: e, para: { disciplina: d.disciplina, topico: d.nome,
                                chave: vkChave(d.disciplina, d.nome) },
                 conf, por: p[3] || "", origem: "ia" });
  });
  return { pares, ignoradas };
}

/* ------------------------------------------------------------------
 * APLICAR
 * Idempotente de propósito: este botão vai ser apertado de novo todo mês,
 * e tem de acrescentar só o que é novo.
 * ------------------------------------------------------------------ */
function vkAplicar(pares, editalId) {
  let novos = 0, repetidos = 0;
  (pares || []).forEach((p) => {
    const a = p.de.chave, b = p.para.chave;
    if (vkJaTem(a, b)) { repetidos++; return; }
    vinculos.push({
      a, b, editalB: editalId || "",
      conf: p.conf || "ALTA", por: p.por || "",
      origem: p.origem || "manual", criado: new Date().toISOString(),
    });
    novos++;
  });
  if (novos) vkSalvar();
  return { novos, repetidos };
}

function vkDesfazer(a, b) {
  const antes = vinculos.length;
  vinculos = vinculos.filter((v) => !((v.a === a && v.b === b) || (v.a === b && v.b === a)));
  if (vinculos.length !== antes) vkSalvar();
  return antes - vinculos.length;
}

/* ------------------------------------------------------------------
 * A MARCA DE HISTÓRICO
 * Seis estados, e cada tópico está em exatamente um. As faixas de tempo
 * existem porque a decisão é diferente em cada uma: pular, revisar, ou
 * estudar sabendo que já há material.
 * ------------------------------------------------------------------ */
const VK_FAIXAS = { recente: 30, morno: 90 };

function vkHistorico(disciplina, topico, estado, diario, hoje) {
  if (estado === "revisado") return { marca: "revisado_aqui" };
  if (estado === "feito") return { marca: "estudado_aqui" };

  const chave = vkChave(disciplina, topico);
  const ligados = vinculos
    .filter((v) => v.a === chave || v.b === chave)
    .map((v) => (v.a === chave ? v.b : v.a));
  if (!ligados.length) return { marca: "sem_historico" };

  /* o registro mais recente entre todos os tópicos ligados */
  let melhor = null;
  (diario || []).forEach((x) => {
    if (!x || !x.n || x.a === "pendente") return;
    if (ligados.indexOf(vkChave(x.disc, x.n)) < 0) return;
    const d = x.d && x.d !== "?" ? x.d : "";
    if (!d) return;
    if (!melhor || d > melhor.d) melhor = x;
  });
  if (!melhor) return { marca: "sem_historico" };

  /* CONTA DE DIAS SEM FUSO.
   * new Date("2026-08-16") é meia-noite UTC; new Date("2026-08-10T00:00:00")
   * é meia-noite LOCAL. Subtrair os dois erra por um dia inteiro em quase
   * todo o Brasil — e "há 5 dias" contra "há 6 dias" muda a faixa quando o
   * valor está na borda dos 30. Aqui as duas datas viram número de dia puro,
   * sem hora nenhuma no meio. */
  const emDias = (iso) => {
    const p = String(iso).slice(0, 10).split("-").map(Number);
    return Math.floor(Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1) / 86400000);
  };
  const hojeIso = hoje ? String(hoje).slice(0, 10)
    : (typeof hojeISO === "function"
        ? hojeISO() : new Date().toISOString().slice(0, 10));
  const dias = Math.max(0, emDias(hojeIso) - emDias(melhor.d));
  const marca = dias <= VK_FAIXAS.recente ? "ja_visto"
    : dias <= VK_FAIXAS.morno ? "vale_revisar" : "visto_ha_muito";
  return { marca, dias, data: melhor.d, concurso: melhor.cc || "",
           topico: melhor.n, acao: melhor.a || "feito" };
}

/* limpeza: vínculo apontando para edital que não existe mais continua
 * contando cobertura de um concurso apagado */
function vkPodar(idsValidos) {
  const antes = vinculos.length;
  vinculos = vinculos.filter((v) => !v.editalB || idsValidos.indexOf(v.editalB) >= 0);
  if (vinculos.length !== antes) vkSalvar();
  return antes - vinculos.length;
}
