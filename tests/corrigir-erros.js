/* =====================================================================
 * "CORRIGIR ERROS" FAZ O QUE PROMETE  (19.141.0)
 *
 * O que originou: 20 cartões de CTN, o mesmo bloco de 10 colado duas vezes com a redação um pouco
 * mudada. A lista dizia "7 perguntas repetidas — o app corrige" e não havia botão nenhum; os grupos
 * repetidos levavam "precisa da IA" sem precisar; o "Aplicar" por cartão remontava o texto inteiro
 * (sumiam os comentários "#", as linhas não reconhecidas iam para o fim) sem guardar versão; os
 * botões de cada aviso corrigiam sem versão e sem a trava; a janela mostrava mudanças que não
 * existiam; a estrutura era aplicada sozinha e os cartões marcados, descartados; "travessão sem
 * espaço" só era arrumado grudado dos dois lados; e as 3 repetidas reescritas passavam caladas.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O resumo das repetidas desenha "Recortar as repetidas", e o recorte funciona.
 *  2. Selos: grupos repetidos e parecidas = "você decide"; cartão longo = "precisa da IA";
 *     espaçamento = "o app corrige".
 *  3. Todo "Aplicar" guarda versão e arma o "Desfazer correção", que volta o texto.
 *  4. O cartão é trocado NO LUGAR: comentários, linhas em branco, ordem e linhas não
 *     reconhecidas ficam onde estavam (estas, comentadas com "# " quando pedido).
 *  5. Botão de cada aviso: passa pela trava (guarda versão) e arma o desfazer.
 *  6. Sem mudança fantasma: cartão com "@" e "+" já canônico não aparece na janela.
 *  7. Estrutura e cartões marcados saem na MESMA aplicação.
 *  8. Travessão grudado de um lado só é arrumado; o resto do espaçamento não muda.
 *  9. Recorte em lote mantém a versão mais completa; "Ficar com esta" mantém a escolhida.
 * 10. Perguntas parecidas são avisadas e abrem lado a lado; idênticas e diferentes, não.
 * 11. O nome do "Desfazer" acompanha a última ação; a colagem volta a "Desfazer última colagem".
 * ===================================================================== */
const fs = require("fs");
const path = require("path");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api, janela } = rodar();
  if (!api) return Object.assign(["corrigir-erros: o app nao carregou"], { quantas: 0 });

  const todos = (no, f, acc = []) => {
    Array.from(no.children || []).forEach((k) => todos(k, f, acc));
    if (f(no)) acc.push(no);
    return acc;
  };
  const ehBotao = (no) => no.tagName && no.tagName.toLowerCase() === "button";
  const itensSug = () => Array.from(api.$("sugestoes").children || []);
  const itemCom = (re) => itensSug().find((d) => re.test(d.textContent || ""));
  const botoesDe = (no) => todos(no, (x) => ehBotao(x) && /\bbtn\b/.test(x.className || ""));
  const seloDe = (no) => todos(no, (x) => /sug-quem/.test(x.className || ""))[0];
  const carregar = (txt) => { api.$("editor").value = txt; api.preview(); };

  /* o caso do usuário, encolhido: um bloco, a 2ª rodada com redação mudada, um longo, espaço duplo */
  const longo = "Quando o crédito tributário é pago por meio de cheque, em que momento se considera extinto?";
  const CASO = [
    "@ CTN — Extinção do crédito",
    longo + " :: Somente com o resgate do cheque pelo sacado, conforme o art. 162, § 2º, do CTN; antes disso o pagamento não produz o efeito extintivo, e o crédito pode ser cobrado normalmente. :: ctn_extincao",
    "+ Base — art. 162, § 2º, do CTN.",
    "Qual é o prazo extintivo para o sujeito passivo pleitear a restituição? :: Cinco anos  , contados da extinção do crédito. :: ctn_restituicao",
    "Certo ou errado: o depósito do montante integral extingue o crédito? :: Errado— ele suspende a exigibilidade. :: ctn_suspensao",
    "",
    "# comentário meu: revisar a rodada 2",
    "",
    "@ CTN — Extinção do crédito (rodada 2)",
    longo + " :: Só com o resgate pelo sacado (art. 162, § 2º). :: ctn_extincao",
    "Qual é o prazo extintivo para o sujeito passivo pleitear a restituição? :: 5 anos (art. 168), contados da extinção. :: ctn_restituicao",
    "+ Nota — o prazo é decadencial para a doutrina majoritária.",
    "Certo ou errado: o depósito integral extingue o crédito tributário? :: Errado, suspende. :: ctn_suspensao",
    "",
  ].join("\n");

  /* ---- 1 e 2: botão do resumo das repetidas e os selos ---- */
  {
    carregar(CASO);
    const resumo = itemCom(/pergunta\(s\) repetida\(s\)/);
    ok(!!resumo, "C1 o resumo das repetidas aparece");
    const bRec = resumo && botoesDe(resumo).find((b) => /Recortar as repetidas/.test(b.textContent));
    ok(!!bRec, "C1a o resumo das repetidas desenha o botão 'Recortar as repetidas'");
    ok(resumo && /quem-app/.test(seloDe(resumo).className), "C1b e ele é 'o app corrige' — agora com botão de verdade");
    const grupo = itemCom(/Mesma pergunta em 2 cartões/);
    ok(grupo && /quem-voce/.test(seloDe(grupo).className) && /você decide/.test(seloDe(grupo).textContent),
       "C2 grupo repetido leva 'você decide', não 'precisa da IA'");
    const longoIt = itemCom(/muito longo/);
    ok(longoIt && /quem-ia/.test(seloDe(longoIt).className), "C2a cartão longo continua 'precisa da IA'");
    const esp = itemCom(/espaços duplos/);
    ok(esp && /quem-app/.test(seloDe(esp).className), "C2b espaçamento continua 'o app corrige'");
    const par = itemCom(/perguntas parecidas/);
    ok(par && /quem-voce/.test(seloDe(par).className), "C2c parecidas aparecem e levam 'você decide'");
    ok(par && /linhas 5 e 13/.test(par.textContent), "C2d o aviso das parecidas diz as linhas: " + (par && par.textContent.slice(0, 160)));
    ok(!/pulsa/.test(api.$("btnPromptCorrigir").className || "") || !!longoIt,
       "C2e (o prompt pulsa por causa do cartão longo, não dos grupos)");
    /* só o que é 'você decide' não faz o prompt de correção pulsar */
    carregar("Pergunta X? :: Verso um. :: t\n\nPergunta X? :: Verso dois. :: t\n");
    ok(!/pulsa/.test(api.$("btnPromptCorrigir").className || ""), "C2f grupo repetido sozinho não pede a IA");

    /* o botão recorta e mantém a MAIS COMPLETA */
    carregar(CASO);
    const gav0 = api.recortes.length;
    const b = botoesDe(itemCom(/pergunta\(s\) repetida\(s\)/)).find((x) => /Recortar as repetidas/.test(x.textContent));
    const p = b.onclick();
    api._uiFechar(true);
    await p;
    const v = api.$("editor").value;
    ok(api.gruposDuplicados(api.parseAtual()).length === 0, "C1c clicar recorta as repetidas");
    ok(api.recortes.length === gav0 + 2, "C1d as 2 repetidas foram para a gaveta");
    ok(/conforme o art\. 162/.test(v) && !/Só com o resgate pelo sacado/.test(v),
       "C9 no grupo do cheque fica a versão mais completa (a 1ª, de verso longo)");
    ok(/5 anos \(art\. 168\)/.test(v) && /decadencial/.test(v) && !/Cinco anos/.test(v),
       "C9a no grupo do prazo fica a da 2ª rodada (mais resposta e com Saiba mais), não a primeira");
    ok(api.$("btnDesfazerColagem").textContent === "Desfazer recorte", "C11 o desfazer se chama 'Desfazer recorte': " + api.$("btnDesfazerColagem").textContent);
    api.$("btnDesfazerColagem").onclick();
    ok(api.$("editor").value === CASO, "C11a 'Desfazer recorte' volta o texto inteiro");
    ok(api.$("btnDesfazerColagem").textContent === "Desfazer última colagem" && api.$("btnDesfazerColagem").disabled,
       "C11b depois de desfazer, o botão volta ao nome de sempre e se apaga");
    api.recortes.length = gav0;
  }

  /* ---- 9: versão mais completa e "Ficar com esta" ---- */
  {
    const g = [{ back: "curto", more: "" , line: 1 }, { back: "bem mais longo", more: "", line: 3 }, { back: "bem mais longo", more: "", line: 5 }];
    ok(api.versaoMaisCompleta(g) === g[1], "C9b empate fica com a primeira das mais completas");
    ok(api.versaoMaisCompleta([{ back: "abc", more: "" }, { back: "a", more: "explicação longa" }]).more,
       "C9c o 'Saiba mais' conta para a mais completa");

    const T = "Pergunta X? :: Verso curto. :: t\n\nPergunta X? :: Verso MAIS COMPLETO, com o artigo. :: t\n\nPergunta X? :: Verso médio, ok. :: t\n";
    carregar(T);
    const lst = api.problemasNavegaveis().filter((x) => x.tipo === "grupo");
    api.abrirFoco(lst[0].linha, lst[0].msg);
    const reps = Array.from(api.$("focoGrupo").children || []);
    ok(reps.length === 3, "C9d o foco mostra as 3 versões");
    const fica = reps.findIndex((d) => /\bfica\b/.test(d.className));
    ok(fica === 1, "C9e o selo FICA marca a mais completa (a 2ª), não a primeira: " + fica);
    const bFica = botoesDe(reps[2]).find((b) => /Ficar com esta/.test(b.textContent));
    ok(!!bFica, "C9f cada versão tem 'Ficar com esta'");
    const gav0 = api.recortes.length;
    bFica.onclick();
    const v = api.$("editor").value;
    ok(/Verso médio/.test(v) && !/Verso curto/.test(v) && !/MAIS COMPLETO/.test(v), "C9g fica só a escolhida (a 3ª)");
    ok(api.recortes.length === gav0 + 2, "C9h as outras 2 foram para a gaveta, não para o lixo");
    ok(api.$("btnDesfazerColagem").textContent === "Desfazer recorte", "C9i e dá para desfazer");
    api.$("btnDesfazerColagem").onclick();
    ok(api.$("editor").value === T, "C9j desfeito, as três voltam");
    api.recortes.length = gav0;
    api.fecharFoco();
  }

  /* ---- 3, 4 e 7: "Corrigir erros" aplica no lugar, junto, e guarda versão ---- */
  {
    const T = [
      "# minhas notas: conferir art. 156",
      "@ CTN — Extinção",
      "Pergunta um?::Resposta  um.::ctn_a",
      "",
      "# comentário no meio",
      "Pergunta dois? :: Resposta dois. :: ctn_b",
      "+ Saiba — mais.",
      "",
      "Pergunta tres?::Resposta tres.::ctn_c",
      "",
    ].join("\n");
    carregar(T);
    ok(api.$("btnNormalizar").disabled === false, "C3 o botão acende");
    const h0 = api.historico.length;
    api.$("btnNormalizar").onclick();
    const itensJanela = Array.from(api.$("normLista").children || []);
    ok(itensJanela.length === 3, "C7 a janela lista a estrutura (espaço duplo) e os 2 cartões fora do formato: " + itensJanela.length);
    api.$("btnNormAplicar").onclick();
    const v = api.$("editor").value;
    ok(api.historico.length === h0 + 1 && api.historico[api.historico.length - 1].txt === T,
       "C3a aplicar guardou UMA versão, com o texto de antes");
    ok(v === [
      "# minhas notas: conferir art. 156",
      "@ CTN — Extinção",
      "Pergunta um? :: Resposta um. :: ctn_a",
      "",
      "# comentário no meio",
      "Pergunta dois? :: Resposta dois. :: ctn_b",
      "+ Saiba — mais.",
      "",
      "Pergunta tres? :: Resposta tres. :: ctn_c",
      "",
    ].join("\n"), "C4/C7 estrutura e cartões na mesma vez, tudo no lugar, comentários intactos:\n" + v);
    ok(api.$("btnNormalizar").disabled === true, "C7a não sobrou nada para um segundo clique");
    ok(api.$("btnDesfazerColagem").textContent === "Desfazer correção" && !api.$("btnDesfazerColagem").disabled,
       "C3b o desfazer passa a ser 'Desfazer correção'");
    api.$("btnDesfazerColagem").onclick();
    ok(api.$("editor").value === T, "C3c 'Desfazer correção' volta o texto de antes");
  }

  /* desmarcar um cartão na janela: ele fica como estava */
  {
    const T = "Pergunta um?::Resposta um.::t_a\n\nPergunta dois?::Resposta dois.::t_b\n";
    carregar(T);
    api.$("btnNormalizar").onclick();
    const chks = todos(api.$("normLista"), (x) => x.tagName && x.tagName.toLowerCase() === "input");
    ok(chks.length === 2, "C4a dois cartões na janela");
    chks[1].checked = false;
    api.$("btnNormAplicar").onclick();
    ok(api.$("editor").value === "Pergunta um? :: Resposta um. :: t_a\n\nPergunta dois?::Resposta dois.::t_b\n",
       "C4b só o marcado mudou: " + JSON.stringify(api.$("editor").value));
  }

  /* ---- 4: trechos de várias linhas e linhas não reconhecidas, no lugar (função pura) ---- */
  {
    const T = [
      "Pergunta longa que a IA quebrou?::Resposta que continua",
      "# um comentário no meio do cartão",
      "na linha de baixo.",
      "",
      "linha solta sem delimitador",
      "",
      "Outra? :: Certa. :: t_y",
    ].join("\n");
    const v = api.aplicarNoLugar(T, () => true, true);
    ok(v === [
      "Pergunta longa que a IA quebrou? :: Resposta que continua na linha de baixo.",
      "# um comentário no meio do cartão",
      "",
      "# linha solta sem delimitador",
      "",
      "Outra? :: Certa. :: t_y",
    ].join("\n"), "C4c cartão de 2 linhas vira 1, o comentário fica, a linha solta é comentada ONDE está:\n" + v);
    ok(api.aplicarNoLugar(T, () => true, false).split("\n").indexOf("linha solta sem delimitador") === 3,
       "C4d sem pedir, a linha não reconhecida fica intacta e no lugar");
    ok(api.faixaDoTrecho(["@ Título :: Pergunta? :: Resposta"], 1, "Título :: Pergunta? :: Resposta", 1) === null,
       "C4e se as linhas não reconstroem o texto lido (título grudado), não mexe");
  }

  /* ---- 5: botão de cada aviso passa pela trava e arma o desfazer ---- */
  {
    const T = "Pergunta um? :: Resposta  um , ok. :: t_a\n\nPergunta dois? :: Errado— ele suspende. :: t_b\n";
    carregar(T);
    const it = itemCom(/espaços duplos/);
    const b = botoesDe(it).find((x) => /Arrumar espaçamento/.test(x.textContent));
    const h0 = api.historico.length;
    const reg0 = (api.registroTexto().match(/\[CORRIGIR\]|CORRIGIR/g) || []).length;
    b.onclick();
    api.$("btnNormAplicar").onclick();
    const v = api.$("editor").value;
    ok(v === "Pergunta um? :: Resposta um, ok. :: t_a\n\nPergunta dois? :: Errado — ele suspende. :: t_b\n",
       "C5 'Arrumar espaçamento' arruma, inclusive o travessão grudado de um lado: " + JSON.stringify(v));
    ok(api.historico.length === h0 + 1, "C5a e guarda versão (antes: nenhuma)");
    ok((api.registroTexto().match(/\[CORRIGIR\]|CORRIGIR/g) || []).length > reg0, "C5b passou pela rede de segurança (registro CORRIGIR)");
    ok(api.$("btnDesfazerColagem").textContent === "Desfazer correção", "C5c e arma o desfazer");
    api.$("btnDesfazerColagem").onclick();
    ok(api.$("editor").value === T, "C5d desfeito, volta");
  }

  /* ---- 6: sem mudança fantasma ---- */
  {
    carregar("@ CTN — Extinção\nPergunta do cheque? :: Resposta do cheque. :: ctn_extincao\n+ Base — art. 162.\n");
    ok(api.$("btnNormalizar").disabled === true, "C6 cartão canônico com '@' e '+': nada a corrigir");
    api.$("btnNormalizar").onclick();
    const itens = Array.from(api.$("normLista").children || []);
    ok(itens.length === 1 && /formato padrão/.test(itens[0].textContent),
       "C6a a janela não inventa mudança no cartão com título e Saiba mais: " + itens.map((d) => d.textContent.slice(0, 40)).join(" | "));
    api.$("btnNormFechar").onclick();
  }

  /* ---- 8: travessão ---- */
  {
    const H = api._higienizarLinha;
    ok(H("Errado— ele suspende") === "Errado — ele suspende", "C8 grudado à esquerda");
    ok(H("ele —suspende") === "ele — suspende", "C8a grudado à direita");
    ok(H("a—b") === "a — b", "C8b grudado dos dois lados, como antes");
    ok(H("a — b") === "a — b" && H(H("Errado— ele")) === H("Errado— ele"), "C8c o certo fica igual; idempotente");
    ok(H("— item no começo") === "— item no começo" && H("# a— b") === "# a— b", "C8d travessão no começo e comentário não mudam");
    ok(api.temEspacosRuins("Errado— ele :: x") === true, "C8e o detector acende para o grudado de um lado");
  }

  /* ---- 10: perguntas parecidas ---- */
  {
    const P = (fronts) => api.gruposParecidos({ cards: fronts.map((f, i) => ({ front: f, line: i * 2 + 1 })) });
    ok(P(["Certo ou errado: o depósito do montante integral extingue o crédito?",
          "Certo ou errado: o depósito integral extingue o crédito tributário?"]).length === 1,
       "C10 a redação mudada do caso do usuário é avisada");
    ok(P(["Qual o prazo do recurso?", "Qual o prazo do recurso?"]).length === 0, "C10a idênticas ficam com o aviso de repetidas");
    ok(P(["Qual o prazo de decadência do lançamento?", "Quem é o sujeito ativo da taxa municipal?"]).length === 0,
       "C10b perguntas diferentes não são parecidas");
    ok(P(["Prazo?", "Prazo de quê?"]).length === 0, "C10c frente curta demais não entra (pouca palavra para comparar)");
    ok(P(["Complete: {{c1::lançamento}} é o ato que constitui o crédito tributário",
          "Complete: o {{c1::lançamento}} é o ato que constitui o crédito"]).length === 1,
       "C10d a marca da lacuna não atrapalha a comparação");

    carregar(CASO);
    const lst = api.problemasNavegaveis().filter((x) => x.parecidas);
    ok(lst.length === 1 && lst[0].linha === 5, "C10e as parecidas entram na navegação do foco");
    const it = itemCom(/perguntas parecidas/);
    const ver = botoesDe(it).find((b) => /Ver no texto/.test(b.textContent));
    ver.onclick();
    ok(/parecidas/.test(api.$("focoTitulo").textContent), "C10f 'Ver no texto' abre o grupo das parecidas: " + api.$("focoTitulo").textContent);
    const reps = Array.from(api.$("focoGrupo").children || []);
    ok(reps.length === 2 && reps.every((d) => !/\bfica\b/.test(d.className)),
       "C10g lado a lado, sem decidir sozinho qual fica");
    ok(reps.every((d) => botoesDe(d).some((b) => /Ficar com esta/.test(b.textContent))), "C10h e com 'Ficar com esta'");
    api.fecharFoco();
  }

  /* ---- 11: colar depois de um recorte volta o nome de sempre ---- */
  {
    carregar("Pergunta X? :: Verso um. :: t\n\nPergunta X? :: Verso dois mais longo. :: t\n");
    const p = api.recortarDuplicados(api.gruposDuplicados(api.parseAtual()));
    api._uiFechar(true);
    await p;
    ok(api.$("btnDesfazerColagem").textContent === "Desfazer recorte", "C11c depois do recorte: 'Desfazer recorte'");
    janela.__area = "Pergunta nova? :: Resposta nova. :: t";
    await api.$("btnColarMais").onclick();
    ok(api.$("btnDesfazerColagem").textContent === "Desfazer última colagem", "C11d depois de colar: 'Desfazer última colagem'");
    api.recortes.length = 0;
  }

  /* ---- textos em PT e EN ---- */
  {
    const src = fs.readFileSync(path.join(__dirname, "..", "docs", "i18n.js"), "utf8");
    ["quem_voce_dica", "crit_parecidas", "foco_parecidas_titulo", "foco_parecidas_aviso", "foco_ficar_com",
     "toast_ficou", "undo_correcao", "undo_recorte", "undo_excluir", "undo_tip", "toast_desfeito"]
      .forEach((k) => ok((src.match(new RegExp('"' + k + '"', "g")) || []).length === 2, "C12 o texto " + k + " existe em PT e EN"));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };

if (require.main === module) {
  testes().then((f) => {
    if (f.length) { console.log(f.join("\n")); process.exit(1); }
    console.log(`corrigir-erros: ok (${f.quantas} verificacoes)`);
  });
}
