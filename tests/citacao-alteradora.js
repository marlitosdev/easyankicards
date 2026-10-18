/* =====================================================================
 * A CITAÇÃO QUE NOMEIA A LEI ALTERADORA + UM LUGAR SÓ PARA DECIDIR A LEI (v18.79.0)
 *
 * O caso real: o material do CTM de Caruaru (LC 15/2009) cita "Art. 162,
 * § 5º da LC N° 145/2024", "Art. 356-E da LC N° 145/2024", "Art. 330, § 4º
 * da LC N° 95/2022" — 56 linhas. A LC 145 é a lei curta que ALTEROU o CTM.
 * O QUE PRECISA SER VERDADE:
 *  1. a citação vai para a lei que a alteradora alterou quando ela tem o
 *     artigo — sabido pelo histórico da fila de alterações OU pela nota
 *     "(Redação dada pela Lei Complementar nº 145, de 2024)" do texto;
 *  2. a alteradora guardada na biblioteca, com o artigo, continua sendo
 *     ela; sem o artigo, vai para a alterada; duas alteradas = dúvida;
 *  3. sem lei nomeada e com duas leis no tópico: continua PERGUNTANDO;
 *  4. o mapa da lei conta só as questões que citam AQUELA lei (o art. 3º
 *     da CF não conta para o CTN), e a mesma questão conta uma vez;
 *  5. a Cobertura por lei usa a mesma decisão (a citação da alteradora
 *     cobre o artigo do CTM).
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api: a } = rodar();
  a.matIniciar(); a.leiIniciar();

  ok(a.leiChaveDeEspecieNumero("LC N° 145/2024") === a.leiChaveDeEspecieNumero("Lei Complementar nº 145, de 2024") && a.leiChaveDeEspecieNumero("LC N° 145/2024") !== ""
     && a.leiChaveDeEspecieNumero("LC 95/2022") !== a.leiChaveDeEspecieNumero("Lei 95/2022") && a.leiChaveDeEspecieNumero("CTN") === "",
     "A0 a chave da lei citada é espécie + número (LC 145 por extenso ou abreviada é a mesma; Lei 95 não é LC 95; sigla sem número não tem chave)");

  const rots = ["Art. 162 da LC N° 145/2024.", "art. 162 da LC N.º 145/2024", "Art. 5º da EC N° 132/2023", "art. 3º da Lei N.º 5.172/1966", "Art. 162 da LC nº 145/2024."]
    .map((x) => (a.leiCitacoesNoTexto(x)[0] || {}).rotulo);
  ok(JSON.stringify(rots) === JSON.stringify(["LC N° 145/2024", "LC N.º 145/2024", "EC N° 132/2023", "Lei N.º 5.172/1966", "LC nº 145/2024"]),
     "A1 o nome da lei com 'N°' (maiúsculo, sinal de grau) e 'N.º' é lido — antes a citação ficava sem lei: " + JSON.stringify(rots));
  const CTM = ["LEI COMPLEMENTAR Nº 15, DE 2009 - Código Tributário Municipal de Caruaru",
    "Art. 1º Este Código regula os tributos municipais.",
    "Art. 2º O Município institui os tributos.",
    "Art. 162. O lançamento será revisto de ofício.",
    "§ 5º A revisão observa o prazo decadencial. (Redação dada pela Lei Complementar nº 145, de 2024)",
    "Art. 330. A multa é de 20%.",
    "§ 4º A multa será reduzida. (Incluído pela Lei Complementar nº 95, de 2022)"].join("\n");
  const ctm = a.leiGuardar({ id: "lei_ctm", nome: "LC 15/2009 - Código Tributário Municipal de Caruaru", especie: "Lei Complementar", numero: "15", ano: "2009", texto: CTM,
    alteracoes: { "356-E": { texto: "Art. 356-E. O contribuinte poderá parcelar.", historico: [{ fonte: "LC nº 112/2023", tipo: "novo" }] },
                  "356-F": { texto: "Art. 356-F. O parcelamento é de 60 meses.", fonteAlteracao: "LC nº 200/2025" } } });
  const ch = a.matChave("Direito Tributário", "CTM");
  const l = a.leiDe(ctm.id);
  const lista = () => a.leisLista();

  /* ---- 1 ---- */
  {
    const al = a.leiAlteradorasDe(l);
    ok(al.has(a.leiChaveDeEspecieNumero("LC 145/2024")) && al.has(a.leiChaveDeEspecieNumero("LC 95/2022")) && al.has(a.leiChaveDeEspecieNumero("LC 112/2023")) && al.has(a.leiChaveDeEspecieNumero("LC 200/2025")) && !al.has(a.leiChaveDeEspecieNumero("LC 15/2009")),
       "R1 as alteradoras do CTM: pelas notas do texto (145, 95), pelo histórico da fila (112) e pela fonte guardada no artigo (200): " + JSON.stringify(Array.from(al)));
    ok(a.leiTemArtigo(l, "162") && a.leiTemArtigo(l, "356-E") && !a.leiTemArtigo(l, "999"), "R1a o CTM tem o 162 e o 356-E (acrescentado pela fila), não o 999");
    const cits = a.leiCitacoesNoTexto("Art. 162, § 5º da LC N° 145/2024. Art. 356-E da LC N° 112/2023. Art. 999 da LC N° 145/2024. Art. 3º da LC 77/2020.");
    const r = cits.map((c) => a.leiResolverCitacao(c, lista(), []));
    ok(r[0].lei && r[0].lei.id === "lei_ctm" && r[0].via === "alteradora" && r[1].lei && r[1].lei.id === "lei_ctm",
       "R1b 'art. 162 da LC 145/2024' e 'art. 356-E da LC 112/2023' vão para o CTM: " + JSON.stringify(r.map((x) => [x.lei && x.lei.id, x.via, x.motivo])));
    const lk = a.qsUiLeiLink(cits[0], { chave: ch }, lista(), []);
    ok(!/qs-lei-link-sem/.test(lk.className) && lk.title.indexOf(a.t("cit_via_alteradora", { a: "LC N° 145/2024", l: l.nome })) >= 0,
       "R1d o link da questão abre o CTM e o balão diz por quê (a LC 145 alterou o CTM): " + lk.title);
    ok(!r[2].lei && r[2].motivo === "desconhecida" && !r[3].lei, "R1c artigo que o CTM não tem (999), ou lei que não alterou nada guardado (LC 77): continua sem destino");
  }

  /* ---- 2 ---- */
  {
    /* a alteradora guardada, com os artigos dela: "art. 2º da LC 145" é dela; "art. 162 da LC 145" (que ela não tem) é do CTM */
    a.leiGuardar({ id: "lei_145", nome: "Lei Complementar 145/2024", especie: "Lei Complementar", numero: "145", ano: "2024",
      texto: "LEI COMPLEMENTAR Nº 145, DE 2024\nArt. 1º Altera o CTM.\nArt. 2º Esta Lei entra em vigor na data da publicação." });
    const cits = a.leiCitacoesNoTexto("Art. 2º da LC N° 145/2024 e art. 162, § 5º, da LC N° 145/2024.");
    const r = cits.map((c) => a.leiResolverCitacao(c, lista(), []));
    ok(r[0].lei && r[0].lei.id === "lei_145" && !r[0].via && r[1].lei && r[1].lei.id === "lei_ctm" && r[1].via === "alteradora",
       "R2 com a LC 145 guardada: o art. 2º é dela; o art. 162 (que ela não tem) vai para o CTM: " + JSON.stringify(r.map((x) => [x.lei && x.lei.id, x.via])));
    /* duas leis alteradas pela mesma LC, as duas com o artigo: dúvida */
    a.leiGuardar({ id: "lei_ctm2", nome: "Código Tributário de Outro Município", especie: "Lei Complementar", numero: "20", ano: "2010",
      texto: "Art. 162. Outro.\n§ 5º X. (Redação dada pela Lei Complementar nº 145, de 2024)" });
    const r330 = a.leiAlteradaPor("LC 145/2024", "330", lista());
    ok(a.leiAlteradaPor("LC 145/2024", "162", lista()) === null && r330 && r330.id === "lei_ctm",
       "R2a duas leis alteradas pela mesma LC com o art. 162: dúvida (não chuta); o 330 só o CTM tem — a regra é por lei (a LC 145 alterou o CTM), não por artigo");
    a.leiRemover ? a.leiRemover("lei_ctm2") : null;
  }

  /* ---- 3: sem nome, duas leis no tópico → pergunta ---- */
  {
    const outra = a.leiGuardar({ id: "lei_x", nome: "Lei X", texto: "Art. 1º X.\nArt. 2º Y." });
    const c = a.leiCitacoesNoTexto("Conforme o art. 162, § 5º.")[0];
    const r = a.leiResolverCitacao(c, lista(), [l, a.leiDe(outra.id)]);
    ok(!r.lei && r.motivo === "ambigua", "R3 sem lei nomeada e com duas no tópico: pergunta — mesmo que só uma tenha o artigo (pode ser de uma terceira)");
    ok(a.leiResolverCitacao(c, lista(), [l]).lei.id === "lei_ctm", "R3a com uma lei só no tópico, é ela (como antes)");
  }
  return falhas.concat(await mapa());

  /* ---- 4 e 5: o mapa da lei e a Cobertura ---- */
  async function mapa() {
    const f2 = [];
    const ok2 = (c, m) => { if (!c) f2.push(m); };
    const { api: b } = rodar();
    b.matIniciar(); b.leiIniciar();
    const chT = b.matChave("Direito Tributário", "Tributo");
    const ctn = b.leiGuardar({ id: "lei_ctn", nome: "Lei 5.172/1966 - Código Tributário Nacional", especie: "Lei", numero: "5172", ano: "1966",
      texto: "Art. 1º Esta Lei regula.\nArt. 3º Tributo é prestação.\nArt. 4º A natureza.", topicos: [chT] });
    b.leiGuardar({ id: "lei_cf", nome: "Constituição Federal", especie: "Constituição", numero: "", ano: "1988", texto: "Art. 1º A República.\nArt. 3º Objetivos." });
    const ctm2 = b.leiGuardar({ id: "lei_ctm", nome: "LC 15/2009 - Código Tributário Municipal", especie: "Lei Complementar", numero: "15", ano: "2009", topicos: [chT],
      texto: "Art. 162. Revisão.\n§ 5º Prazo. (Redação dada pela Lei Complementar nº 145, de 2024)" });
    b.qsTodas().push(
      { id: "q1", tipo: "ce", enunciado: "Segundo o art. 3º do CTN, tributo é prestação pecuniária.", gabarito: "C", comentario: "", chave: chT, tentativas: [{ acertou: false }] },
      { id: "q2", tipo: "ce", enunciado: "O art. 3º da CF traz os objetivos.", gabarito: "C", comentario: "Art. 3º da CF, de novo.", chave: chT, tentativas: [{ acertou: true }] },
      { id: "q3", tipo: "ce", enunciado: "Art. 3º do CTN e art. 3º, II, do CTN.", gabarito: "E", comentario: "", chave: chT, tentativas: [{ acertou: true }] },
      { id: "q4", tipo: "ce", enunciado: "Pelo art. 162, § 5º da LC N° 145/2024, a revisão observa o prazo.", gabarito: "C", comentario: "", chave: chT, tentativas: [] },
    );
    b.leiAbrir("Direito Tributário", "Tributo", ctn.id);
    const rk = (id) => Object.fromEntries(b.leiRanking(id).map((r) => [r.num, r]));
    const rCtn = rk("lei_ctn");
    ok2(rCtn["3"] && rCtn["3"].questoes === 2 && rCtn["3"].erros === 1 && rCtn["3"].acertos === 1,
        "M1 no mapa do CTN, o art. 3º tem 2 questões (q1, q3 — a q3 cita duas vezes e conta uma); a do art. 3º da CF não conta: " + JSON.stringify(rCtn["3"]));
    b.leiAbrir("Direito Tributário", "Tributo", "lei_ctm");
    const rCtm = rk("lei_ctm");
    ok2(rCtm["162"] && rCtm["162"].questoes === 1, "M2 no mapa do CTM, a questão que cita 'art. 162 da LC 145/2024' conta para o art. 162: " + JSON.stringify(rCtm));
    const cob = b.covLeiMapa(b.leiDe(ctm2.id), [], {});
    ok2(cob.artigos.find((x) => x.num === "162").questoes === 1, "M3 a Cobertura por lei também (a mesma decisão)");
    return f2;
  }
}

module.exports = { testes };
