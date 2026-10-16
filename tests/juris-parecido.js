/* =====================================================================
 * JULGADOS: CRIAR AO VINCULAR + "JÁ EXISTE IGUAL OU PARECIDO" (v18.52.0)
 *
 * O pedido: "ao vincular julgados, é possível escolher julgados já
 * existentes mas não é possível criar um novo para suprir a lacuna" e
 * "quando um usuário tentar criar um julgado, deve haver checagem se já
 * existe julgado ou jurisprudência igual ou bastante similar. O usuário
 * deve poder ver este julgado similar ou igual e decidir se quer mesmo
 * criar." Agora: (1) "ligar a outro…" tem "＋ criar um julgado novo para
 * este trecho" (a criação da prévia; ao guardar, o trecho fica ligado);
 * (2) antes de criar — gaveta, prévia e "ligar a outro" — os iguais e
 * parecidos aparecem, com a tese, e a pessoa escolhe: usar este, criar
 * mesmo assim, ou voltar; (3) no lote, a ficha parecida diz qual é.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const DISC = "Direito Tributário", TOP = "Responsabilidade tributária", TOP2 = "Execução fiscal";
  const guardar = (api, dados, disciplina, topico) => {
    const j = api.jurGravar(Object.assign({ tese: "tese qualquer" }, dados));
    if (disciplina) api.jurLigar(j.id, api.matChave(disciplina, topico), disciplina, topico);
    return api.jurDe(j.id);
  };
  const TESE435 = "Presume-se dissolvida irregularmente a empresa que deixar de funcionar no seu domicílio fiscal, sem comunicação aos órgãos competentes, legitimando o redirecionamento da execução fiscal para o sócio-gerente.";
  /* deixa as promessas andarem (o diálogo abre depois de um await) */
  const girar = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

  /* ---- P: o motor ---- */
  {
    const { api } = rodar();
    const a = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: TESE435 });
    const b = guardar(api, { tribunal: "STJ", classe: "REsp", numero: "1101728", tese: "O mero inadimplemento da obrigação tributária não gera, por si só, a responsabilidade solidária do sócio-gerente." });
    const tipo = (r) => r.map((x) => x.j.id + ":" + x.motivo).join(" | ");
    let r = api.jurParecidos({ classe: "Súmula", numero: "435", tese: "outra coisa" });
    ok(r.length === 1 && r[0].j.id === a.id && r[0].motivo === "mesmo", "P1 mesma classe e número, sem tribunal de um lado: é o mesmo: " + tipo(r));
    r = api.jurParecidos({ tribunal: "STF", classe: "Súmula", numero: "435", tese: "x" });
    ok(!r.length, "P1a tribunais diferentes não são o mesmo: " + tipo(r));
    r = api.jurParecidos({ numero: "1.101.728", tese: "y" });
    ok(r.length === 1 && r[0].j.id === b.id && r[0].motivo === "numero", "P2 o mesmo número sem classe: provável: " + tipo(r));
    r = api.jurParecidos({ classe: "REsp", numero: "435", tese: "z" });
    ok(!r.length, "P2a o mesmo número com OUTRA classe (REsp 435 × Súmula 435) não é parecido: " + tipo(r));
    r = api.jurParecidos({ tribunal: "STJ", classe: "AgRg", numero: "999", tese: "A empresa que deixar de funcionar no seu domicílio fiscal, sem comunicação aos órgãos competentes, presume-se dissolvida irregularmente; cabe redirecionamento ao sócio-gerente." });
    ok(r.length === 1 && r[0].j.id === a.id && r[0].motivo === "tese" && r[0].pct >= 45 && r[0].pct < 100, "P3 outra decisão com a mesma tese: parecida: " + tipo(r) + " " + (r[0] && r[0].pct));
    r = api.jurParecidos({ tribunal: "STF", classe: "RE", numero: "574706", tese: "O ICMS não compõe a base de cálculo para a incidência do PIS e da COFINS." });
    ok(!r.length, "P4 tese de outro assunto não é parecida: " + tipo(r));
    r = api.jurParecidos({ tese: "sócio-gerente empresa" });
    ok(!r.length, "P4a tese curta demais não compara (falso alarme): " + tipo(r));
    guardar(api, { tese: "Sócio responde por dívida." });
    r = api.jurParecidos({ tese: "Sócio responde pela dívida" });
    ok(!r.length, "P4c com menos de 5 palavras de conteúdo dos dois lados, não compara (evita alarme com textos mínimos): " + tipo(r));
    r = api.jurParecidos(Object.assign({}, a));
    ok(!r.length, "P4b o próprio julgado (mesmo id) não é parecido de si");
  }

  /* ---- N: número com ponto de milhar (achado na verificação: "Tema 1.093 do STF" virava "Tema 1") ---- */
  {
    const { api } = rodar();
    const c = api.jurCitacoesNoTexto("conforme o Tema 1.093 do STF e a Súmula 435 do STJ.");
    ok(c.length === 2 && c[0].texto === "Tema 1.093 do STF" && c[0].numero === "1.093" && c[1].texto === "Súmula 435 do STJ",
       "N1 'Tema 1.093' é lido inteiro (e 'Súmula 435.' no fim da frase continua certo): " + JSON.stringify(c.map((x) => x.texto)));
    const sv = api.jurCitacoesNoTexto("SV 1.234 e Súmula 1.111 do STJ");
    ok(sv.length === 2 && sv[0].numero === "1.234" && sv[1].numero === "1.111", "N1a súmula e SV também: " + JSON.stringify(sv.map((x) => x.numero)));
    const re = guardar(api, { tribunal: "STF", classe: "RE", numero: "1287019", tese: "Fixada no Tema 1.093: a cobrança do diferencial de alíquota exige lei complementar." });
    const a = api.jurAcharCitado(c[0]);
    ok(a.julgado && a.julgado.id === re.id, "N2 o RE que diz 'Tema 1.093' na tese é achado pela citação: " + JSON.stringify(a.julgado && a.julgado.id));
  }

  /* ---- G: na gaveta ---- */
  const prepararGaveta = (api) => {
    api.matIniciar();
    api.jurIniciarTela();
    const a = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: TESE435 }, DISC, TOP);
    api.jurAbrir(DISC, TOP2, "incluir");
    api.$("jurTese").value = "A empresa que deixar de funcionar no seu domicílio fiscal sem comunicação aos órgãos competentes presume-se dissolvida irregularmente, cabendo redirecionamento ao sócio-gerente.";
    api.$("jurClasse").value = "AgRg"; api.$("jurNumero").value = "123456"; api.$("jurTribunal").value = "STJ";
    return a;
  };
  {
    const { api } = rodar();
    const a = prepararGaveta(api);
    const n0 = api.jurLista().length;
    let acabou = false;
    const pr = api.jurSalvar().then(() => { acabou = true; });
    await girar();
    ok(api.$("dlgJurParecido").open === true && !acabou, "G1 antes de criar, a gaveta mostra o julgado parecido e espera a decisão");
    const lista = api.$("jurParLista").textContent || "";
    ok(/STJ · Súmula 435/.test(lista) && /domicílio fiscal/.test(lista) && /tese \d+% parecida/.test(lista) && /Já está em: Responsabilidade tributária/.test(lista),
       "G1a cada parecido aparece com nome, motivo, a tese e onde já está: " + lista.slice(0, 300));
    ok(/Usar este \(ligar a este tópico\)/.test(api.$("btnJurParUsar_0").textContent), "G1b o botão diz que liga a ESTE tópico");
    api.$("btnJurParUsar_0").onclick();
    await pr;
    ok(api.jurLista().length === n0, "G2 'usar este' não cria cópia");
    ok((api.jurDe(a.id).topicos || []).some((x) => api.jurChaveComparavel(x) === api.jurChaveComparavel(api.matChave(DISC, TOP2))), "G2a o existente passa a valer também neste tópico");
    ok(/✓ Usado o julgado já guardado: STJ · Súmula 435/.test(api.$("toast").textContent), "G2b o aviso diz o que aconteceu: " + api.$("toast").textContent);
    ok(!api.$("dlgJurParecido").open, "G2c o diálogo fecha");
  }
  {
    const { api } = rodar();
    prepararGaveta(api);
    const n0 = api.jurLista().length;
    const pr = api.jurSalvar();
    await girar();
    api.$("btnJurParCriar").onclick();
    await pr;
    ok(api.jurLista().length === n0 + 1 && api.jurLista().some((j) => j.numero === "123456"), "G3 'criar mesmo assim' guarda o novo");
  }
  {
    const { api } = rodar();
    prepararGaveta(api);
    const n0 = api.jurLista().length;
    const pr = api.jurSalvar();
    await girar();
    api.$("btnJurParVoltar").onclick();
    await pr;
    ok(api.jurLista().length === n0 && /presume-se dissolvida/.test(api.$("jurTese").value), "G4 'voltar' não guarda e não apaga o que foi escrito");
  }
  {
    /* sem parecido: guarda direto, sem perguntar */
    const { api } = rodar();
    api.matIniciar(); api.jurIniciarTela();
    guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: TESE435 }, DISC, TOP);
    api.jurAbrir(DISC, TOP2, "incluir");
    api.$("jurTese").value = "O ICMS não compõe a base de cálculo para a incidência do PIS e da COFINS.";
    await api.jurSalvar();
    ok(!api.$("dlgJurParecido").open && api.jurLista().length === 2, "G5 sem nada parecido, guarda sem perguntar");
    /* editar não pergunta (não é criar) */
    const novo = api.jurLista().find((j) => /ICMS/.test(j.tese));
    api.jurEditar(novo.id);
    api.$("jurTese").value = TESE435;
    await api.jurSalvar();
    ok(!api.$("dlgJurParecido").open && api.jurDe(novo.id).tese === TESE435, "G5a editar não passa pela checagem");
  }

  /* ---- E: "ligar a outro…" → criar um julgado novo, e o trecho já fica ligado ---- */
  {
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    api.jurEscAbrir("Súmula 435 do STJ", { disciplina: DISC, topico: TOP });
    const html = require("fs").readFileSync(require("path").join(__dirname, "..", "docs", "index.html"), "utf8");
    const dlg = html.slice(html.indexOf('<dialog id="dlgJurEscolher"'), html.indexOf("</dialog>", html.indexOf('<dialog id="dlgJurEscolher"')));
    ok(/id="btnJurEscCriar" data-i18n="jur_esc_criar"/.test(dlg) && /criar um julgado novo/.test(api.t("jur_esc_criar")) && /criar um julgado novo/.test(api.$("jurEscLista").textContent || ""),
       "E1 'ligar a outro' oferece criar (e a lista vazia aponta para ele): " + api.$("jurEscLista").textContent);
    ["jur_esc_criar", "jur_esc_criar_aj", "jur_esc_criado_feito", "jur_par_tit", "jur_par_intro", "jur_par_mesmo", "jur_par_numero", "jur_par_tese", "jur_par_usar", "jur_par_usar_ja", "jur_par_criar", "jur_par_voltar", "jur_par_usado", "jur_lote_parecido_txt"].forEach((k) => {
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) && api.t(k) !== k, "E1a falta " + k + " em " + lg); });
    });
    api.setLanguage("pt");
    api.$("btnJurEscCriar").onclick();
    ok(!api.$("dlgJurEscolher").open && api.$("dlgJurCitaPreview").open && !api.$("jurCitaNovo").hidden, "E2 criar abre a criação na prévia");
    api.$("btnJurCitaPedido").onclick();
    ok(/"Súmula 435 do STJ"/.test(api.$("jurCitaPedidoTxt").value || ""), "E2a o pedido à IA leva a citação do trecho");
    api.$("jurCitaResp").value = JSON.stringify({ tribunal: "STJ", classe: "Súmula", numero: "435", tese_curta: TESE435, certeza_da_tese: "alta" });
    api.$("jurCitaResp").oninput();
    api.$("btnJurCitaGuardar").onclick();
    const g = api.jurLista().find((j) => j.numero === "435");
    const vs = api.citVinculosLer().filter((v) => v.tipo === "jur");
    ok(g && vs.length === 1 && vs[0].jurId === g.id && vs[0].trecho === "Súmula 435 do STJ" && vs[0].chave === ch,
       "E3 ao guardar, o trecho fica ligado ao julgado novo, neste tópico: " + JSON.stringify(vs));
    ok(/✓ Julgado ligado: «Súmula 435 do STJ» → STJ · Súmula 435 · só neste tópico/.test(api.$("toast").textContent), "E3a o aviso diz o que foi ligado: " + api.$("toast").textContent);
  }
  {
    /* trecho sem citação reconhecível: a identidade vem do que der para ler; criar continua possível */
    const { api } = rodar();
    api.matIniciar();
    ok(api.jurEscCriar() === false, "E4 sem 'ligar a outro' aberto, nada acontece");
    api.jurEscAbrir("segundo o STJ, a dissolução irregular autoriza o redirecionamento", { disciplina: DISC, topico: TOP });
    ok(api.jurEscCriar() === true && api.$("dlgJurCitaPreview").open, "E4a trecho sem número também pode virar julgado novo");
    api.jurEscAbrir("Súmula 1 do STJ", {});
    ok(api.jurEscCriar() === false && /tópico/.test(api.$("jurEscAviso").textContent || ""), "E4b sem tópico, avisa em vez de criar");
  }
  {
    /* criar pela prévia com um IGUAL já guardado: a checagem aparece; 'usar este' liga o trecho ao existente */
    const { api } = rodar();
    api.matIniciar();
    const ch = api.matChave(DISC, TOP);
    const a = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: TESE435 }, DISC, TOP2);
    api.jurEscAbrir("a súmula da dissolução irregular", { disciplina: DISC, topico: TOP });
    api.jurEscCriar();
    api.$("jurCitaResp").value = JSON.stringify({ tribunal: "STJ", classe: "Súmula", numero: "435", tese_curta: TESE435, certeza_da_tese: "alta" });
    api.$("jurCitaResp").oninput();
    const n0 = api.jurLista().length;
    const pr = api.$("btnJurCitaGuardar").onclick();
    await girar();
    ok(api.$("dlgJurParecido").open && /mesmo processo/.test(api.$("jurParLista").textContent || ""), "E5 a prévia também confere antes de criar: " + api.$("jurParLista").textContent);
    api.$("btnJurParUsar_0").onclick();
    await pr;
    const vs = api.citVinculosLer().filter((v) => v.tipo === "jur");
    ok(api.jurLista().length === n0 && vs.length === 1 && vs[0].jurId === a.id && vs[0].trecho === "a súmula da dissolução irregular",
       "E6 'usar este' não cria, e o trecho fica ligado ao existente: " + JSON.stringify(vs));
    ok((api.jurDe(a.id).topicos || []).some((x) => api.jurChaveComparavel(x) === api.jurChaveComparavel(ch)), "E6a o existente passa a valer neste tópico");
    ok(api.$("dlgJurCitaPreview").open && /domicílio fiscal/.test(api.$("jurCitaCorpo").textContent || ""), "E6b a prévia mostra o julgado usado");
  }

  {
    /* "usar a gaveta completa" a partir do criar do "ligar a outro": ao guardar na gaveta, o trecho também fica ligado */
    const { api } = rodar();
    api.matIniciar(); api.jurIniciarTela();
    const ch = api.matChave(DISC, TOP);
    api.jurEscAbrir("o julgado do ICMS na base", { disciplina: DISC, topico: TOP });
    api.jurEscCriar();
    api.$("btnJurCitaGaveta").onclick();
    ok(api.$("dlgJuris").open === true, "E7 'usar a gaveta completa' abre a gaveta");
    api.$("jurTese").value = "O ICMS não compõe a base de cálculo para a incidência do PIS e da COFINS.";
    await api.jurSalvar();
    const g = api.jurLista().find((j) => /ICMS/.test(j.tese || ""));
    const vs = api.citVinculosLer().filter((v) => v.tipo === "jur");
    ok(g && vs.length === 1 && vs[0].jurId === g.id && vs[0].trecho === "o julgado do ICMS na base" && vs[0].chave === ch,
       "E7a guardado pela gaveta, o trecho fica ligado ao julgado novo: " + JSON.stringify(vs));
    /* guardar mais um na MESMA gaveta (sem reabrir): o trecho continua no primeiro */
    api.$("jurTese").value = "A contribuição de iluminação pública pode ser cobrada na fatura de energia elétrica do contribuinte.";
    await api.jurSalvar();
    const vs2 = api.citVinculosLer().filter((v) => v.tipo === "jur");
    ok(api.jurLista().length === 2 && vs2.length === 1 && vs2[0].jurId === g.id, "E7b o segundo guardado na mesma gaveta não toma o vínculo do primeiro: " + JSON.stringify(vs2));
    /* depois disso, abrir a gaveta de novo e guardar outro NÃO liga o trecho antigo */
    api.jurEscAbrir("outro trecho qualquer", { disciplina: DISC, topico: TOP });
    api.jurEscCriar();
    api.$("btnJurCitaGaveta").onclick();
    api.jurAbrir(DISC, TOP2, "incluir");
    api.$("jurTese").value = "A taxa de coleta de lixo domiciliar é constitucional quando vinculada a serviço específico e divisível.";
    await api.jurSalvar();
    ok(api.citVinculosLer().filter((v) => v.tipo === "jur").length === 1, "E8 abrir a gaveta de novo esquece o trecho pendente");
  }

  /* ---- L: no lote, a ficha parecida diz qual é ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.jurIniciarTela();
    guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: TESE435 }, DISC, TOP);
    api.jurAbrir(DISC, TOP, "incluir");
    api.$("jurColar").value = JSON.stringify({ julgados: [
      { tribunal: "STJ", classe: "AgRg", numero: "777", tese_curta: "A empresa que deixar de funcionar no seu domicílio fiscal, sem comunicação aos órgãos competentes, presume-se dissolvida irregularmente; cabe redirecionamento ao sócio-gerente." },
      { tribunal: "STF", classe: "RE", numero: "574706", tese_curta: "O ICMS não compõe a base de cálculo para a incidência do PIS e da COFINS." },
    ] });
    api.jurColar();
    const p0 = api.$("jurLoteParecido_0"), p1 = api.$("jurLoteParecido_1");
    ok(p0 && /Já existe um parecido: STJ · Súmula 435/.test(p0.textContent) && /domicílio fiscal/.test(p0.textContent), "L1 a ficha parecida mostra qual é, com a tese: " + (p0 && p0.textContent));
    ok(!p1, "L1a a ficha de outro assunto não tem aviso");
  }
  return falhas;
}

module.exports = { testes };
