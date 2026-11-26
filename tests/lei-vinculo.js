/* =====================================================================
 * O VÍNCULO LEI ↔ TÓPICO (19.182.0)
 *
 * O caso real: "Licitações públicas e contratos administrativos (Lei 14.133/2021)" abria a lei seca vazia, pedindo para
 * colar a lei, com a Lei 14.133/2021 guardada na biblioteca sem vínculo; o registro dizia só "nenhuma lei ligada ainda".
 *
 * O QUE PRECISA SER VERDADE:
 *  V1. as candidatas são as leis da biblioteca citadas PELO NÚMERO (no nome, na nota do edital ou nos ramos) e a CF
 *      citada com todas as letras; pelo nome solto, não ("Constituição do crédito tributário", "DAS");
 *  V2. a porta única: com lei ligada, abre a lei; sem lei e com o edital conhecido, abre as Leis do edital com o tópico
 *      em destaque; a ficha e a trilha passam por ela;
 *  V3. o destaque do tópico oferece "ligar a este tópico e ler" (a leitura passa a ser do tópico);
 *  V4. a ficha diz que a lei está na biblioteca e liga com um toque;
 *  V5. "Leis citadas" separa "na biblioteca" de "ligada" e liga todas de uma vez;
 *  V6. a lei seca vazia mostra a faixa "ligar e ler"; o registro anota um AVISO; o diagnóstico conta os tópicos;
 *  V7. a biblioteca liga a lei solta aos tópicos que a citam.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  const arts = (k) => Array.from({ length: k }, (_, i) => "Art. " + (i + 1) + "º Texto do artigo " + (i + 1) + ".").join(NL);
  const montar = () => {
    const r = rodar();
    const { api } = r;
    api.matIniciar(); api.edIniciar(); api.leiIniciar && api.leiIniciar(); api.ledIniciar && api.ledIniciar();
    const e = api.edCriar("ISS", ["# ISS | prova: 2027-06-01 | horas: 20",
      "@ Noções de Direito Administrativo :: 4", "+ Licitações públicas e contratos administrativos (Lei 14.133/2021) :: 5", "+ Atos administrativos :: 4",
      "@ Direito Tributário :: 5", "+ Constituição do crédito tributário (lançamento) :: 3", "+ Crimes contra a ordem tributária :: 3 :: Lei nº 8.137/90",
      "@ Direito Constitucional :: 3", "+ Constituição Federal de 1988 :: 3"].join(NL));
    const l14 = api.leiGuardar({ nome: "Lei 14.133/2021 Lei de Licitações", texto: arts(10), topicos: [] });
    const l8137 = api.leiGuardar({ nome: "Lei 8.137/1990", texto: arts(6), topicos: [] });
    const cf = api.leiGuardar({ nome: "CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988", texto: arts(12), topicos: [] });
    const das = api.leiGuardar({ nome: "Lei 10.257/2001 - Estatuto das Cidades", texto: arts(4), topicos: [] });
    return Object.assign(r, { e, l14, l8137, cf, das });
  };
  const id = (x) => (x && (x.id || x)) || "";

  /* V1 */
  {
    const { api, l14, cf } = montar();
    const nomes = (txt) => api.lvCandidatas(txt).map((o) => o.lei.nome).join("|");
    ok(nomes("Licitações públicas e contratos administrativos (Lei 14.133/2021)") === "Lei 14.133/2021 Lei de Licitações", "V1a o número no nome: " + nomes("Licitações (Lei 14.133/2021)"));
    ok(nomes("Lei 14133 de 2021") === "Lei 14.133/2021 Lei de Licitações" && nomes("Lei nº 8.137/90") === "Lei 8.137/1990", "V1b sem ponto e ano por extenso; o ano de dois dígitos");
    ok(nomes("Constituição do crédito tributário (lançamento)") === "" && nomes("Simples Nacional (DAS)") === "", "V1c pelo nome solto, não: 'Constituição do crédito' e 'DAS'");
    ok(nomes("Constituição Federal de 1988") === cf.nome && nomes("Princípios da Constituição da República") === cf.nome, "V1d a CF com todas as letras, sim");
    ok(api.lvSugestoesDoTopico("Direito Tributário", "Crimes contra a ordem tributária", [], "Lei nº 8.137/90").length === 1, "V1e a nota do edital ('+ Tópico :: peso :: Lei nº …') também vale");
    api.leiLigar(id(l14), api.matChave("Noções de Direito Administrativo", "Licitações públicas e contratos administrativos (Lei 14.133/2021)"));
    ok(!api.lvSugestoesDoTopico("Noções de Direito Administrativo", "Licitações públicas e contratos administrativos (Lei 14.133/2021)").length, "V1f já ligada, não é mais sugestão");
  }

  /* V2 + V3 + V6: a porta única, o destaque do tópico, o registro */
  {
    const { api, e, l14 } = montar();
    const D = "Noções de Direito Administrativo", T = "Licitações públicas e contratos administrativos (Lei 14.133/2021)";
    const ch = api.matChave(D, T);
    ok(String(api.lvEditalDoTopico(D, T)) === String(e.id), "V2a o edital do tópico");
    api.lvAbrirLeiDoTopico(D, T, { origem: "teste" });
    ok(api.$("dlgLeiBib") && api.$("dlgLeiBib").open && !(api.$("dlgLeiSeca") && api.$("dlgLeiSeca").open), "V2b sem lei ligada: abre as Leis do edital, não a lei seca vazia");
    const foco = api.$("ledFoco");
    ok(foco && /Neste tópico/.test(foco.textContent) && /Lei 14\.133\/2021/.test(foco.textContent) && /sem vínculo com este tópico/.test(foco.textContent) && /citada pelo tópico/.test(foco.textContent) && !/ligada ao tópico/.test(foco.textContent), "V3a o destaque mostra a lei achada e diz que ela não está ligada: " + (foco && foco.textContent.slice(0, 160)));
    const bl = foco.querySelectorAll("button").find((b) => /^btnLedFocoLigar/.test(b.id));
    ok(bl && /ligar a este tópico e ler/.test(bl.textContent), "V3b o botão 'ligar a este tópico e ler'");
    if (bl) bl.onclick();
    ok(api.leisDoTopico(ch).some((l) => l.id === id(l14)) && api.$("dlgLeiSeca").open && /14\.133/.test(api.$("leiTexto").value ? "Lei 14.133" : ""), "V3c ligou e abriu a lei pelo tópico");
    const R = api.rtTudo({}).filter((x) => /ligada pela sugestão/.test(x.msg));
    ok(R.length === 1 && R[0].nivel === "info", "V3d o registro anota a ligação pela sugestão");
    try { api.$("dlgLeiSeca").close(); } catch (x) {}
    try { api.$("dlgLeiBib").close(); } catch (x) {}
    api.lvAbrirLeiDoTopico(D, T, { origem: "teste" });
    ok(api.$("dlgLeiSeca").open, "V2c com a lei ligada, a porta abre a lei direto");
    try { api.$("dlgLeiSeca").close(); } catch (x) {}
  }

  /* V6: a lei seca aberta vazia (por qualquer caminho) mostra a faixa e anota o AVISO; o diagnóstico conta */
  {
    const { api, l14 } = montar();
    const D = "Noções de Direito Administrativo", T = "Licitações públicas e contratos administrativos (Lei 14.133/2021)";
    const lin0 = api.lvLinhaDiagnostico();
    ok(lin0.tipo === "aviso" && /3 tópico\(s\)/.test(lin0.txt) && /Lei 14\.133/.test(lin0.txt) && !/crédito tributário/.test(lin0.txt), "V6a o diagnóstico conta os tópicos sem vínculo (a 'Constituição do crédito' não entra): " + lin0.txt);
    const L = []; api.diagResumo(L);
    ok(L.some((x) => /^⚠ Vínculos de lei: 3 tópico/.test(x)), "V6b e a linha está no resumo do diagnóstico");
    api.leiAbrir(D, T);
    const fx = api.$("leiSugVinculo");
    ok(fx && !fx.hidden && /já tem a lei que este tópico cita/.test(fx.textContent) && fx.querySelectorAll("button").some((b) => /ligar Lei 14\.133/.test(b.textContent)), "V6c a lei seca vazia mostra a faixa 'ligar e ler'");
    const av = api.rtTudo({}).filter((x) => /sem lei, mas a biblioteca tem lei sem vínculo/.test(x.msg));
    ok(av.length === 1 && av[0].nivel === "aviso", "V6d o registro anota um AVISO (não um detalhe): " + (av[0] && av[0].nivel));
    if (fx && fx.querySelectorAll("button")[0]) fx.querySelectorAll("button")[0].onclick();
    ok(api.leisDoTopico(api.matChave(D, T)).some((l) => l.id === id(l14)) && api.$("leiSugVinculo").hidden, "V6e ligar pela faixa: a faixa some");
    try { api.$("dlgLeiSeca").close(); } catch (x) {}
    api.leiAbrir("Noções de Direito Administrativo", "Atos administrativos");
    ok(api.$("leiSugVinculo").hidden, "V6f tópico sem lei citada: sem faixa");
    try { api.$("dlgLeiSeca").close(); } catch (x) {}
  }

  /* V4: a ficha */
  {
    const { api, l14 } = montar();
    const D = "Noções de Direito Administrativo", T = "Licitações públicas e contratos administrativos (Lei 14.133/2021)";
    const ch = api.matChave(D, T);
    api.matAbrirFicha({ chave: ch, disciplina: D, topico: T, texto: "" });
    const lista = api.$("matFichaLista");
    ok(/já está na sua biblioteca/.test(lista.textContent) && /Lei 14\.133/.test(lista.textContent), "V4a a linha da lei seca diz que a lei está na biblioteca");
    const b = lista.querySelectorAll("button").find((x) => /Ligar e abrir/.test(x.textContent));
    ok(b, "V4b o botão 'Ligar e abrir'");
    if (b) b.onclick();
    ok(api.leisDoTopico(ch).some((l) => l.id === id(l14)) && api.$("dlgLeiSeca").open, "V4c ligou e abriu");
    try { api.$("dlgLeiSeca").close(); } catch (x) {}
    try { api.$("dlgMatFicha").close(); } catch (x) {}
    /* sem candidata: o "Carregar" passa pela porta (Leis do edital) */
    const ch2 = api.matChave(D, "Atos administrativos");
    api.matAbrirFicha({ chave: ch2, disciplina: D, topico: "Atos administrativos", texto: "" }, { editalId: api.lvEditalDoTopico(D, "Atos administrativos") });
    const bc = api.$("matFichaLista").querySelectorAll("button").find((x) => /^Carregar$/.test(x.textContent));
    ok(bc, "V4d sem candidata: 'Carregar'");
    if (bc) bc.onclick();
    ok(api.$("dlgLeiBib").open && api.$("ledFoco") && /Atos administrativos/.test(api.$("ledFoco").textContent) && api.$("btnLedFocoAbrir"), "V4e 'Carregar' abre as Leis do edital com o tópico (e o caminho para colar)");
    try { api.$("dlgLeiBib").close(); } catch (x) {}
    try { api.$("dlgMatFicha").close(); } catch (x) {}
  }

  /* V2d: o passo "lei" da trilha passa pela porta */
  {
    const { api, e } = montar();
    const i = { disciplina: "Noções de Direito Administrativo", nome: "Atos administrativos", edital: e.id };
    api.edAbrirPasso(i, "lei");
    ok(api.$("dlgLeiBib").open && !(api.$("dlgLeiSeca") && api.$("dlgLeiSeca").open), "V2d o passo 'lei' da trilha abre as Leis do edital quando não há lei");
    try { api.$("dlgLeiBib").close(); } catch (x) {}
  }

  /* V5: as Leis citadas no edital */
  {
    const { api, e, l14, l8137 } = montar();
    api.ledAbrir(e.id);
    const cit = api.$("ledCit");
    ok(cit && cit.open === true && /vínculo\(s\) faltando/.test(cit.textContent) && /sem vínculo com 1 tópico/.test(cit.textContent), "V5a 'na biblioteca' não é 'ligada': a lista abre e diz o que falta: " + (cit && cit.textContent.slice(0, 200)));
    const todas = api.$("btnLedCitLigarTodas");
    ok(todas && /ligar todas/.test(todas.textContent), "V5b 'ligar todas'");
    if (todas) todas.onclick();
    ok(api.leisDoTopico(api.matChave("Noções de Direito Administrativo", "Licitações públicas e contratos administrativos (Lei 14.133/2021)")).some((l) => l.id === id(l14))
      && api.leisDoTopico(api.matChave("Direito Tributário", "Crimes contra a ordem tributária")).some((l) => l.id === id(l8137)), "V5c ligou cada lei aos tópicos que a citam pelo número");
    ok(!api.leisDoTopico(api.matChave("Direito Tributário", "Constituição do crédito tributário (lançamento)")).length, "V5d e não ligou a CF à 'Constituição do crédito tributário'");
    ok(!/vínculo\(s\) faltando/.test(api.$("ledCit").textContent), "V5e repintado: nada mais faltando");
    try { api.$("dlgLeiBib").close(); } catch (x) {}
  }

  /* V7: a biblioteca */
  {
    const { api, l14 } = montar();
    api.leiBibAbrir();
    const b = api.$("leiBibLista").querySelectorAll("button").find((x) => x.id === "btnLeiBibLigarCitam_" + id(l14));
    ok(b && /ligar aos 1 tópico/.test(b.textContent), "V7a a lei solta com 'ligar aos N tópico(s) que a citam'");
    if (b) b.onclick();
    ok(api.leisDoTopico(api.matChave("Noções de Direito Administrativo", "Licitações públicas e contratos administrativos (Lei 14.133/2021)")).some((l) => l.id === id(l14)), "V7b ligada");
    ok(!api.$("leiBibLista").querySelectorAll("button").some((x) => x.id === "btnLeiBibLigarCitam_" + id(l14)), "V7c ligada, o botão some");
    try { api.$("dlgLeiBib").close(); } catch (x) {}
    ["lv_faixa", "lv_faixa_n", "lv_ligar_ler", "lv_ficha_tem_na_bib", "lv_ficha_ligar", "lv_ficha_outra", "lv_foco_sem_vinculo", "lv_foco_nao_ligada", "lv_foco_ligar", "lv_foco_outra",
      "lv_cit_sem", "lv_cit_ligar_todas", "lv_cit_linha_sem", "lv_cit_ligar", "lv_bib_ligar", "lv_bib_ligar_tip"].forEach((k) =>
      ["pt", "en"].forEach((lg) => { api.setLanguage(lg); ok(api.t(k) !== k, "V8 falta " + k + " em " + lg); }));
    api.setLanguage("pt");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
