/* =====================================================================
 * "ABRIR NA GAVETA": LER, VER OS OUTROS, EDITAR À PARTE (v19.22.0)
 *
 * O RELATO: "o botão 'abrir na gaveta' mostra interface de difícil interpretação" — caía direto no formulário de
 * CRIAR, preenchido: passos "1 · Cole / 2 · Confira / 3 · Guarde", a caixa de colar vazia com um exemplo cinza que
 * parecia conteúdo, "separar julgados"; e o rodapé deixava o texto aparecer por baixo. E, a seguir: "permitir ver a
 * lista de outros julgados, sendo que o que está visualizando fica em destaque".
 *
 * O QUE PRECISA SER VERDADE:
 *  G1 abrir na gaveta = LEITURA, com a lista inteira do tópico e o aberto em destaque fixo ("▶ aberto");
 *  G2 editar tem tela própria: título "Editar julgado — …", Cancelar no lugar de Fechar, a ementa como campo opcional
 *     com explicação (não o exemplo), e a lista (chamada de volta) mostra o editado como "✏️ editando";
 *  G3 Cancelar sem mudanças volta direto; com mudanças pergunta; recusar o descarte continua editando; aceitar volta
 *     sem salvar nada — e o julgado segue em destaque;
 *  G4 salvar volta à leitura, com o salvo em destaque;
 *  G5 "+ guardar mais um" é o modo de criar de sempre (sem as marcas da edição);
 *  G6 julgado que não está na lista do tópico: abre a edição, para não ficar sem ele.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const DISC = "Direito Tributário", TOP = "Responsabilidade tributária";
  const espera = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= (n || 10) ? r() : setImmediate(f)); f(); });
  const msg = (api) => (api.$("uiModalMsg") ? api.$("uiModalMsg").textContent : "");
  const guardar = (api, dados, d, tp) => {
    const j = api.jurGravar(Object.assign({ tese: "tese qualquer" }, dados));
    if (d) api.jurLigar(j.id, api.matChave(d, tp), d, tp);
    return api.jurDe(j.id);
  };
  const preparar = () => {
    const { api } = rodar();
    api.matIniciar();
    api.jurIniciarTela();
    const a = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "430", tese: "O inadimplemento não gera, por si só, a responsabilidade do sócio-gerente." }, DISC, TOP);
    const b = guardar(api, { tribunal: "STJ", classe: "Súmula", numero: "435", tese: "Presume-se dissolvida irregularmente a empresa que deixar de funcionar." }, DISC, TOP);
    const c = guardar(api, { tribunal: "STF", classe: "Súmula", numero: "547", tese: "Não é lícito à autoridade proibir que o contribuinte em débito adquira estampilhas." }, DISC, TOP);
    return { api, a, b, c };
  };
  const card = (api, j) => api.$("jurItem_" + j.id);
  const emFoco = (api) => api.$("jurLista").querySelectorAll(".jur-item").filter((x) => /jur-foco/.test(x.className));

  /* ---- G1 ---- */
  {
    const { api, a, b, c } = preparar();
    api.jurAbrir(DISC, TOP, "ler");
    ok(emFoco(api).length === 0 && !api.jurFocoAtual(), "G1 abrir a gaveta pelo tópico: nenhum em destaque");
    ok(api.jurFocarJulgado(b.id) === true, "G1a focar o julgado da citação");
    ok(api.$("jurForm").hidden === true && api.$("jurLista").querySelectorAll(".jur-item").length === 3, "G1b leitura, com a lista INTEIRA do tópico (os outros também)");
    ok(emFoco(api).length === 1 && emFoco(api)[0] === card(api, b) && /▶ aberto/.test(card(api, b).textContent), "G1c o aberto em destaque, com o selo '▶ aberto' (e só ele)");
    ok(!/▶ aberto/.test(card(api, a).textContent) && !/▶ aberto/.test(card(api, c).textContent), "G1d os outros sem selo");
    api.jurPintarLista();
    ok(/jur-foco/.test(card(api, b).className), "G1e o destaque é FIXO: sobrevive a redesenhar a lista");
    api.jurAbrir(DISC, TOP, "ler");
    ok(emFoco(api).length === 0, "G1f abrir de novo pelo tópico: o destaque não fica de outra vez");
  }

  /* ---- G2 + G3 + G4 ---- */
  {
    const { api, b } = preparar();
    api.jurAbrir(DISC, TOP, "ler");
    /* editar pelo ⋯ do cartão, sem foco anterior: o editado passa a ser o destacado */
    api.jurEditar(b.id);
    const dlg = api.$("dlgJuris");
    ok(/jur-editando/.test(dlg.className) && api.jurModoAtual === "editar", "G2 editar tem modo e tela próprios");
    ok(/^Editar julgado — /.test(api.$("jurTitulo").textContent) && /435/.test(api.$("jurTitulo").textContent), "G2a título 'Editar julgado — STJ Súmula 435': " + api.$("jurTitulo").textContent);
    ok(!api.$("btnJurCancelarEd").hidden && api.$("btnJurFechar").hidden && /Salvar as altera/.test(api.$("btnJurSalvar").textContent), "G2b rodapé: Cancelar + Salvar as alterações (sem Fechar)");
    ok(/opcional/.test(api.$("jurColarRot").textContent) && /Pode ficar em branco/.test(api.$("jurColar").placeholder) && !/CÁRMEN/.test(api.$("jurColar").placeholder),
      "G2c a ementa é campo opcional explicado (não o exemplo que parecia conteúdo)");
    ok(api.$("jurMetaCampos").hidden === false && api.$("jurTribunal").value === "STJ", "G2d a identificação aberta, preenchida");
    /* a lista dos outros, chamada de volta, mostra o editado */
    api.$("btnJurOutros").onclick();
    ok(!api.$("jurLista").hidden && /✏️ editando/.test(card(api, b).textContent) && /jur-foco/.test(card(api, b).className), "G2e 'ver os outros' durante a edição: o editado em destaque, '✏️ editando'");
    /* G3: cancelar sem mudar nada */
    await api.jurCancelarEdicao();
    ok(api.jurModoAtual === "ler" && !/jur-editando/.test(dlg.className) && /jur-foco/.test(card(api, b).className) && !msg(api),
      "G3 cancelar sem mudanças: volta direto à leitura, com o julgado em destaque");
    /* com mudança: pergunta; recusar continua editando */
    api.jurEditar(b.id);
    api.$("jurTese").value = "tese mexida";
    let p = api.jurCancelarEdicao();
    await espera();
    ok(/Descartar as alterações/.test(msg(api)), "G3a com mudanças: pergunta antes de descartar");
    api._uiFechar(false);
    ok((await p) === false && api.jurModoAtual === "editar" && api.$("jurTese").value === "tese mexida", "G3b recusar o descarte: continua editando, com o que foi escrito");
    p = api.jurCancelarEdicao();
    await espera();
    api._uiFechar(true);
    await p;
    ok(api.jurModoAtual === "ler" && /Presume-se/.test(api.jurDe(b.id).tese), "G3c descartar: volta à leitura e nada foi salvo");
    /* G4: salvar */
    api.jurEditar(b.id);
    api.$("jurTese").value = "Presume-se dissolvida irregularmente (tese revista).";
    await api.jurSalvar();
    ok(api.jurModoAtual === "ler" && /tese revista/.test(api.jurDe(b.id).tese) && /jur-foco/.test(card(api, b).className), "G4 salvar: volta à leitura, com o salvo em destaque");
    /* G4b: guardar um julgado NOVO: ele (e não o editado antes) fica em destaque */
    api.jurTrocarModo("incluir");
    api.$("jurTese").value = "Súmula nova para o teste de destaque.";
    api.$("jurTribunal").value = "STJ"; api.$("jurClasse").value = "Súmula"; api.$("jurNumero").value = "999";
    await api.jurSalvar();
    const novo = api.jurLista().find((x) => /teste de destaque/.test(x.tese || ""));
    ok(novo && /jur-foco/.test(card(api, novo).className) && !/jur-foco/.test(card(api, b).className), "G4b guardar um novo: ele fica em destaque (o editado antes não)");
    /* G5: criar é o de sempre */
    api.jurTrocarModo("incluir");
    ok(!/jur-editando/.test(dlg.className) && !api.$("btnJurFechar").hidden && api.$("btnJurCancelarEd").hidden && /CÁRMEN/.test(api.$("jurColar").placeholder),
      "G5 '+ guardar mais um': o modo de criar de sempre (Fechar, exemplo na caixa de colar)");
  }

  /* ---- G6: a citação aponta um julgado que não está na lista deste tópico ---- */
  {
    const { api } = preparar();
    const fora = guardar(api, { tribunal: "STF", classe: "RE", numero: "574706", tese: "O ICMS não compõe a base do PIS/COFINS." }, "Outra", "Outro tópico");
    api.jurAbrir(DISC, TOP, "ler");
    ok(api.jurFocarJulgado(fora.id) === true, "G6 o julgado de outro tópico também abre para leitura");
    const itens = api.$("jurLista").querySelectorAll(".jur-item");
    ok(itens.length === 4 && itens[0] === card(api, fora) && /jur-visitante/.test(itens[0].className) && /jur-foco/.test(itens[0].className),
      "G6a ele vem NO TOPO, em destaque, e os 3 deste tópico logo abaixo: " + itens.length);
    ok(/Guardado em: Outro tópico/.test(itens[0].textContent) && /não está ligado a este tópico/.test(itens[0].textContent), "G6b a nota diz onde está guardado");
    ok(/\b3\b/.test(api.$("jurConta").textContent), "G6c a contagem continua sendo a do tópico: " + api.$("jurConta").textContent);
    api.$("btnJurVisitLigar").onclick();
    ok(api.jurDoTopico(api.matChave(DISC, TOP)).some((x) => x.id === fora.id) && !/jur-visitante/.test(card(api, fora).className) && /jur-foco/.test(card(api, fora).className),
      "G6d ligar a este tópico: entra na lista do tópico e continua em destaque");
    /* tópico SEM julgado nenhum: a gaveta abriria em criar — com o aberto de outro tópico, fica em leitura */
    const { api: a2 } = preparar();
    const so = guardar(a2, { tribunal: "STF", classe: "Súmula", numero: "323", tese: "É inadmissível a apreensão de mercadorias como meio coercitivo." }, "Outra", "Outro tópico");
    a2.jurAbrir("Disciplina vazia", "Tópico vazio", "ler");
    a2.jurFocarJulgado(so.id);
    ok(/abriu — guardado em outro tópico/.test(a2.$("jurConta").textContent), "G6g tópico vazio: a frase de cima fala do aberto, não diz só nenhum julgado");
    const menu = a2.$("jurItem_" + so.id).textContent;
    ok(!/excluir deste tópico/.test(menu), "G6h o aberto de outro tópico não oferece excluir deste tópico");
    ok(a2.jurFocarJulgado("id-que-nao-existe") === false && a2.jurFocoAtual() === so.id, "G6f julgado que não existe (apagado): não muda o destaque e volta false");
    ok(a2.jurModoAtual === "ler" && a2.$("jurForm").hidden === true && /jur-foco/.test(a2.$("jurItem_" + so.id).className), "G6e tópico vazio: a gaveta fica em leitura, com o julgado em destaque");
  }

  /* ---- textos ---- */
  {
    const { api } = rodar();
    ["jur_titulo_editar", "jur_ajuda_editar", "jur_ed_ident", "jur_ed_colar_rot", "jur_ed_colar_ph", "jur_ed_cancelar", "jur_ed_cancelar_aj",
      "jur_ed_descartar", "jur_ed_descartar_ok", "jur_foco_aberto", "jur_foco_editando"].forEach((k) =>
      ["pt", "en"].forEach((l) => { api.setLanguage(l); ok(api.t(k) && api.t(k) !== k, "X falta " + k + " em " + l); }));
    api.setLanguage("pt");
  }
  return falhas;
}

module.exports = { testes };
