/* =====================================================================
 * LACUNAS QUEBRADAS PELA VERSÃO ANTIGA (v18.46.0)
 *
 * Antes da 16.73.0, gravar no material trocava o "::" de DENTRO da lacuna
 * por " — ": "{{c1::X}}" virava "{{c1 — X}}", que o leitor não reconhece.
 * No backup de 14/10 eram 14 cartões (Material contava 808, a Biblioteca
 * 794). O app conserta uma vez, no arranque, sem mexer na data do tópico.
 * As linhas abaixo são as do backup real.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const QUEBRADA1 = "Qual é o critério material da hipótese de incidência do ISS segundo o Código Tributário do Município de Caruaru? É a prática de qualquer das atividades econômicas previstas na {{c1 — Lista de Serviços do Anexo I}}, ainda que não constituam {{c2 — atividade preponderante}} do prestador. (Fonte: CTM, Art. 237) ::  :: iss_caruaru criterio_material";
  const QUEBRADA2 = "A incidência do ISS em Caruaru depende do cumprimento de exigências administrativas? {{c1 — Não}}. A incidência independe de {{c2 – exigências administrativas}}. ::  :: fato_gerador";
  const CERTA = "Quais são os 3 impostos municipais previstos no artigo 236 do CTM de Caruaru? São o {{c1::ISSQN}}, o {{c2::IPTU}} e o {{c3::ITBI}}. ::  :: ctm_caruaru";
  const BASICO = "Qual a periodicidade da SUP? :: Mensal — 25 UFMs por profissional. :: sup";
  const texto = ["@ CTM Caruaru > ISS", QUEBRADA1, "", QUEBRADA2, "", CERTA, "", BASICO].join("\n");

  /* L1: a função pura */
  {
    const { api } = rodar();
    const antes = api.parseText(texto).cards.length;
    const r = api.matRepararLacunas(texto);
    ok(r.n === 2, "L1 conserta as duas linhas quebradas (travessão e meia-risca): " + r.n);
    ok(r.texto.indexOf("{{c1::Lista de Serviços do Anexo I}}") > 0 && r.texto.indexOf("{{c2::atividade preponderante}}") > 0 && r.texto.indexOf("{{c2::exigências administrativas}}") > 0,
       "L1a a lacuna volta a ser {{cN::…}}");
    ok(r.texto.indexOf(CERTA) >= 0 && r.texto.indexOf("Mensal — 25 UFMs") > 0 && r.texto.indexOf("@ CTM Caruaru > ISS") === 0, "L1b o resto fica igual (lacuna certa, travessão do texto, título)");
    const depois = api.parseText(r.texto);
    ok(depois.cards.length === antes + 2 && depois.cards.filter((c) => c.kind === "cloze").length === 3,
       "L1c o leitor passa a reconhecer os dois cartões (como lacuna): " + antes + " → " + depois.cards.length);
    ok(api.matRepararLacunas(r.texto).n === 0 && api.matRepararLacunas("{{c12 — x}} ::  :: t").texto === "{{c12::x}} ::  :: t", "L1d de novo não muda nada; número de lacuna com dois dígitos");
  }

  /* L2: no arranque, nos tópicos do material, sem mexer na data */
  {
    const { api } = rodar();
    api.matIniciar();
    const k = api.matChave("Sistema Tributário Brasileiro", "Normas gerais");
    api.matGravarCartoes(k, texto, { disciplina: "Sistema Tributário Brasileiro", topico: "Normas gerais" });
    const tocado = api.matResumosAtual()[k].tocado;
    const r = api.matRepararLacunasTudo();
    ok(r.linhas === 2 && r.topicos.join() === "Normas gerais (2)", "L2 conserta no material e diz onde: " + JSON.stringify(r));
    ok(api.matResumosAtual()[k].cartoes.indexOf("{{c1::Lista de Serviços") > 0 && api.matResumosAtual()[k].tocado === tocado, "L2a gravado, e a data do tópico não muda");
    ok(JSON.parse(api.lojaLer("eac_resumos"))[k].cartoes.indexOf("{{c1::Lista de Serviços") > 0, "L2b persistido");
    ok(api.matRepararLacunasTudo().linhas === 0, "L2c rodar de novo não faz nada");
    ok(api.t("mat_lacunas_consertadas", { n: 2, t: "x" }).indexOf("2 cartão") > 0, "L2d o aviso existe");
  }
  /* L3: roda SOZINHO ao abrir o app (matIniciar), com o que está gravado */
  {
    const { api } = rodar();
    const k = api.matChave("Sistema Tributário Brasileiro", "Código Tributário Municipal");
    api.lojaGravar("eac_resumos", JSON.stringify({ [k]: { disciplina: "Sistema Tributário Brasileiro", topico: "Código Tributário Municipal", texto: "", cartoes: QUEBRADA1, tocado: "2026-09-28T10:00:00.000Z" } }));
    api.matIniciar();
    ok(api.matResumosAtual()[k].cartoes.indexOf("{{c1::Lista de Serviços") > 0 && api.matResumosAtual()[k].tocado === "2026-09-28T10:00:00.000Z", "L3 ao abrir o app, o que estava gravado quebrado é consertado (sem mudar a data)");
  }
  return falhas;
}

module.exports = { testes };
