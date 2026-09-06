/* =====================================================================
 * COPIAR O TEXTO DA QUESTÃO
 *
 * Este arquivo era "pelicula.js" e tinha duas coisas dentro: um canvas
 * para grifar por cima do enunciado e a máquina de copiar a questão. O
 * canvas saiu — foi substituído por grifo por seleção de texto
 * (grifo.js), que sobrevive a reflow, zoom e rotação, coisas que
 * desenho sobre pixel não sobrevive. Sobrou o que sempre foi útil e
 * nunca teve a ver com grifar.
 *
 * Ficar com o canvas aqui, sem ninguém chamando, seria manter duas
 * implementações da mesma ideia — e a segunda, morta, é a que engana
 * quem for ler isto daqui a seis meses.
 * ===================================================================== */
/* ---------------------------------------------------------------------
 * COPIAR O TEXTO DA QUESTÃO
 *
 * O que se copia daqui vai para uma IA, para um caderno ou para um
 * colega — e em todos esses destinos o enunciado sozinho costuma não
 * bastar. Por isso as duas caixas vêm MARCADAS: o caso comum é querer o
 * pacote inteiro, e quem quiser só o enunciado desmarca.
 *
 * O gabarito sai por extenso ("Certo" / "Errado"), não como a letra
 * solta: "C" fora do aplicativo não quer dizer nada.
 * ------------------------------------------------------------------ */

let plIncluirGab = true;
let plIncluirDica = true;

function plTextoDaQuestao(q, opc) {
  if (!q) return "";
  const o = opc || {};
  const L = [];
  const cab = [q.concurso, q.banca, q.disciplina, q.topico].filter(Boolean);
  if (cab.length) L.push(cab.join(" · "));
  if (q.tipo === "ce") L.push(t("qs_julgue"));
  L.push(String(q.enunciado || ""));
  (q.opcoes || []).forEach((x) => {
    L.push(String(x.letra) + ") " + String(x.txt));
  });
  if (o.gabarito) {
    const g = q.tipo === "ce"
      ? (q.gabarito === "C" ? t("qs_certo") : t("qs_errado"))
      : q.gabarito;
    L.push("");
    L.push(t("pl_copia_gab", { g }));
    if (String(q.comentario || "").trim()) {
      L.push(t("pl_copia_coment", { c: q.comentario }));
    }
  }
  if (o.dica) {
    let d = "";
    try { d = (typeof qsDicaDeQuestao === "function" && qsDicaDeQuestao(q.id)) || ""; }
    catch (e) { d = ""; }
    if (String(d).trim()) {
      L.push("");
      L.push(t("pl_copia_dica", { d }));
    }
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* A barra de copiar: o botão e as duas caixas, lado a lado. As caixas
 * ficam VISÍVEIS, não escondidas atrás de um menu — a escolha muda o que
 * vai para a área de transferência, e escolha invisível vira surpresa. */
function plBarraCopiar(q) {
  const cx = document.createElement("div");
  cx.className = "pl-copiar";

  const b = document.createElement("button");
  b.type = "button";
  b.id = "btnPlCopiar";
  b.className = "btn-min";
  b.textContent = t("pl_copiar");
  b.title = t("pl_copiar_ajuda");
  b.onclick = () => {
    const txt = plTextoDaQuestao(q, { gabarito: plIncluirGab, dica: plIncluirDica });
    try { navigator.clipboard.writeText(txt); } catch (e) {}
    const antes = b.textContent;
    b.textContent = t("copied");
    setTimeout(() => { b.textContent = antes; }, 1800);
    try {
      matReg("questao", "texto da questão copiado",
             (plIncluirGab ? "com gabarito" : "sem gabarito")
             + (plIncluirDica ? " · com dica" : " · sem dica"));
    } catch (e) {}
  };
  cx.append(b);

  [["plCopGab", "pl_com_gab", () => plIncluirGab, (v) => { plIncluirGab = v; }],
   ["plCopDica", "pl_com_dica", () => plIncluirDica, (v) => { plIncluirDica = v; }],
  ].forEach(([id, chave, ler, escrever]) => {
    const lab = document.createElement("label");
    lab.className = "qs-chk";
    const c = document.createElement("input");
    c.type = "checkbox";
    c.id = id;
    c.checked = ler();
    c.onchange = () => escrever(!!c.checked);
    const sp = document.createElement("span");
    sp.textContent = t(chave);
    lab.append(c, sp);
    lab.title = t(chave + "_ajuda");
    cx.append(lab);
  });

  return cx;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { plBarraCopiar, plTextoDaQuestao };
}
