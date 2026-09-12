/* MÍNIMOS POR BLOCO, PESO EM QUESTÕES E FILTRO POR EDITAL.
 *
 * O problema que originou este arquivo: no TCE-PE havia acerto mínimo
 * por grupo de disciplinas, e olhar só o peso levava a negligenciá-los.
 *
 * Peso e mínimo respondem perguntas DIFERENTES:
 *   peso   → onde estão os pontos (maximizar a nota);
 *   mínimo → onde está a eliminação (não ser cortado).
 * Uma disciplina de peso baixo dentro de um bloco com corte não é um
 * problema de pontos, é de sobrevivência — e otimizar pelo peso leva
 * direto a ignorá-la. */
const { rodar } = require("./fumaca.js");

const EDITAL = [
  "# SEFAZ-AL | prova: 2027-01-10 | horas: 20",
  "& Conhecimentos Básicos | minimo: 50%",
  "@ Português :: 10q",
  "+ Crase :: 5",
  "+ Concordância :: 4",
  "@ Raciocínio Lógico :: 5q",
  "+ Proposições :: 3",
  "& Conhecimentos Específicos | minimo: 60%",
  "@ Direito Financeiro :: 20q",
  "+ Receita pública :: 5",
  "+ Despesa pública :: 5",
  "+ Restos a pagar :: 3",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const acharClasse = (el, cls, saida) => {
    Array.from(el.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) saida.push(f);
      acharClasse(f, cls, saida);
    });
    return saida;
  };

  /* ---- M1: ler os blocos e os mínimos ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);

    ok(r.blocos.length === 2, "M1 deviam ser 2 blocos, sao " + r.blocos.length);
    /* sem os blocos nao ha o que medir adiante, e seguir daqui estoura
     * com pilha de erro — que nao diz O QUE quebrou */
    if (r.blocos.length < 2) { falhas.quantas = n; return falhas; }
    ok(r.blocos[0].nome === "Conhecimentos Básicos",
       "M1b o nome do bloco saiu errado: " + r.blocos[0].nome);
    ok(r.blocos[0].minimo && r.blocos[0].minimo.tipo === "pct"
       && r.blocos[0].minimo.valor === 50,
       "M1c o minimo percentual nao foi lido: "
       + JSON.stringify(r.blocos[0].minimo));
    ok(r.blocos[0].disciplinas.length === 2,
       "M1d o bloco devia ter 2 disciplinas, tem "
       + r.blocos[0].disciplinas.length);
    ok(r.blocos[1].disciplinas.length === 1,
       "M1e o segundo bloco pegou disciplinas do primeiro: "
       + JSON.stringify(r.blocos[1].disciplinas));
    /* a disciplina sabe de que bloco é */
    const pt = r.disciplinas.filter((d) => /Português/.test(d.nome))[0];
    ok(pt && pt.bloco === "Conhecimentos Básicos",
       "M1f a disciplina nao sabe a que bloco pertence: " + (pt && pt.bloco));

    /* MÍNIMO ABSOLUTO tambem: "12" = doze acertos no bloco */
    const r2 = api.lerEdital("# X | prova: 2027-01-10\n"
      + "& B | minimo: 12\n@ P :: 20q\n+ A :: 5");
    ok(r2.blocos[0].minimo && r2.blocos[0].minimo.tipo === "abs"
       && r2.blocos[0].minimo.valor === 12,
       "M1g minimo absoluto nao foi lido: "
       + JSON.stringify(r2.blocos[0].minimo));

    /* BLOCO SEM MÍNIMO É AVISO, NÃO ERRO — pode ser só agrupamento, mas
     * quase sempre é esquecimento, e o minimo e justamente o dado que
     * evita a eliminacao. */
    const r3 = api.lerEdital("# X | prova: 2027-01-10\n& B\n@ P :: 5\n+ A :: 5");
    ok(r3.achados.some((a) => a.tipo === "bloco_sem_minimo"),
       "M1h bloco sem minimo passou calado");

    /* EDITAL SEM BLOCO NENHUM continua igual ao de sempre */
    const r4 = api.lerEdital("# X | prova: 2027-01-10\n@ P :: 5\n+ A :: 5");
    ok(r4.blocos.length === 0, "M1i edital plano ganhou blocos do nada");
  }

  /* ---- M2: peso em questões torna a fatia EXATA ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);
    const pt = r.disciplinas.filter((d) => /Português/.test(d.nome))[0];
    ok(pt && pt.abs === 10 && pt.unidade === "q",
       "M2 '10q' nao foi lido como dez questoes: "
       + JSON.stringify(pt && [pt.abs, pt.unidade]));

    const p = api.montarPlano(r, { horas: 20, feitos: {} });
    ok(p.fatiaExata === true,
       "M2b com todas as disciplinas em questoes a fatia devia ser exata");
    /* 10 + 5 + 20 = 35 questoes. Financeiro = 20/35 = 57%.
     * A escala de 1 a 5 nao consegue esse numero: espremer 10 e 20 em
     * cinco pontos perde a razao real de 2 para 1. */
    ok(p.fatia["Direito Financeiro"] === 57,
       "M2c a fatia do Financeiro devia ser 57%, veio "
       + p.fatia["Direito Financeiro"]);
    ok(p.fatia["Português"] === 29,
       "M2d a fatia do Portugues devia ser 29%, veio " + p.fatia["Português"]);
    /* a soma fecha em 100 (com o arredondamento de sempre) */
    const soma = Object.keys(p.fatia).reduce((a, k) => a + p.fatia[k], 0);
    ok(Math.abs(soma - 100) <= 2, "M2e as fatias somam " + soma + "%, nao 100");

    /* MISTURAR ESCALAS INVALIDA A CONTA EXATA.
     * Uma disciplina em questoes e outra na escala de 1 a 5 somariam
     * grandezas diferentes — e o resultado teria cara de exato sendo
     * pior que a estimativa. */
    const rm = api.lerEdital("# X | prova: 2027-01-10\n"
      + "@ A :: 10q\n+ x :: 5\n@ B :: 3\n+ y :: 5");
    const pm = api.montarPlano(rm, { horas: 10, feitos: {} });
    ok(pm.fatiaExata === false,
       "M2f com escalas misturadas o app disse que a fatia era exata");

    /* DECIMAIS na escala de 1 a 5 continuam valendo — eles so nao
     * resolvem o problema de fidelidade sozinhos */
    const rd = api.lerEdital("# X | prova: 2027-01-10\n@ A :: 2,5\n+ x :: 1.5");
    const dA = rd.disciplinas[0];
    ok(dA.peso === 2.5, "M2g peso 2,5 na disciplina nao foi aceito: " + dA.peso);
    ok(dA.topicos[0].peso === 1.5,
       "M2h peso 1.5 no topico nao foi aceito: " + dA.topicos[0].peso);
  }

  /* ---- M3: o cumprimento dos mínimos ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(EDITAL);

    /* nada estudado: os DOIS blocos estao abaixo */
    const p0 = api.montarPlano(r, { horas: 20, feitos: {} });
    ok(p0.blocos.length === 2, "M3 o plano nao trouxe os blocos");
    ok(p0.blocos.every((b) => b.abaixo),
       "M3b sem nada estudado algum bloco ja aparece cumprido");

    /* estudar TODO o bloco básico, e nada do específico */
    const feitos = {
      "português›crase": "feito",
      "português›concordância": "feito",
      "raciocínio lógico›proposições": "feito",
    };
    const p = api.montarPlano(r, { horas: 20, feitos });
    const bas = p.blocos.filter((b) => /Básicos/.test(b.nome))[0];
    const esp = p.blocos.filter((b) => /Específicos/.test(b.nome))[0];

    ok(bas && bas.pct === 100,
       "M3c o bloco basico devia estar 100% coberto: " + (bas && bas.pct));
    ok(bas && bas.abaixo === false, "M3d bloco 100% coberto marcado como abaixo");
    ok(esp && esp.pct === 0,
       "M3e o bloco especifico devia estar em 0%: " + (esp && esp.pct));
    ok(esp && esp.abaixo === true,
       "M3f bloco sem nada estudado nao foi marcado como abaixo do corte");

    /* O NÚMERO QUE MUDA A DECISÃO: o bloco em risco vale quanto da
     * prova? Um bloco de corte que vale 5% e um que vale 55% pedem
     * urgencias diferentes. */
    ok(esp && esp.fatia >= 50,
       "M3g o bloco especifico devia valer mais da metade da prova: "
       + (esp && esp.fatia));
    ok(bas && bas.minPct === 50 && esp && esp.minPct === 60,
       "M3h os cortes sairam errados: " + (bas && bas.minPct)
       + " / " + (esp && esp.minPct));

    /* "EM CIMA DA LINHA" É UM ESTADO PRÓPRIO.
     * Cobrir exatamente o minimo nao e estar seguro: ninguem acerta tudo
     * o que estudou, entao cobertura igual ao corte ja e risco. */
    const meio = api.montarPlano(r, { horas: 20, feitos: {
      "direito financeiro›receita pública": "feito",
      "direito financeiro›restos a pagar": "feito",
    } });
    const esp2 = meio.blocos.filter((b) => /Específicos/.test(b.nome))[0];
    ok(esp2 && esp2.pct === 62,
       "M3i premissa do teste mudou: esperava 62% coberto, veio "
       + (esp2 && esp2.pct));
    ok(esp2 && esp2.abaixo === false,
       "M3i2 62% coberto para corte de 60% nao esta abaixo");
    ok(esp2 && esp2.apertado === true,
       "M3j 62% para um corte de 60% devia contar como apertado: a folga e "
       + "de 25%, entao o seguro so comeca em 75%");

    /* e acima da folga o bloco fica limpo, sem alarme */
    const folgado = api.montarPlano(r, { horas: 20, feitos: {
      "direito financeiro›receita pública": "feito",
      "direito financeiro›despesa pública": "feito",
    } });
    const esp3 = folgado.blocos.filter((b) => /Específicos/.test(b.nome))[0];
    ok(esp3 && esp3.apertado === false && esp3.abaixo === false,
       "M3j2 77% para um corte de 60% ja esta com folga e nao devia alarmar: "
       + (esp3 && esp3.pct));

    /* mínimo ABSOLUTO vira percentual usando as questoes do bloco */
    const rAbs = api.lerEdital("# X | prova: 2027-01-10\n"
      + "& B | minimo: 12\n@ P :: 20q\n+ A :: 5\n+ C :: 5");
    const pAbs = api.montarPlano(rAbs, { horas: 10, feitos: {} });
    ok(pAbs.blocos[0].minPct === 60,
       "M3k 12 acertos em 20 questoes sao 60%, veio "
       + pAbs.blocos[0].minPct);

    /* bloco sem minimo NAO entra no painel de risco */
    const rSem = api.lerEdital("# X | prova: 2027-01-10\n& B\n@ P :: 5\n+ A :: 5");
    const pSem = api.montarPlano(rSem, { horas: 10, feitos: {} });
    ok(pSem.blocos[0].minPct === null,
       "M3l bloco sem minimo ganhou um corte inventado: "
       + pSem.blocos[0].minPct);
  }

  /* ---- M4: a visualização ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const r = api.lerEdital(EDITAL);
    const p = api.montarPlano(r, { horas: 20, feitos: {
      "português›crase": "feito", "português›concordância": "feito",
      "raciocínio lógico›proposições": "feito",
    } });
    const cx = api.edPintarBlocos(p);
    ok(!!cx, "M4 o painel dos minimos nao foi desenhado");
    if (!cx) { falhas.quantas = n; return falhas; }

    const txt = cx.textContent || "";
    /* O TÍTULO DÁ O RECADO SOZINHO: quem olha de relance tem de saber se
     * esta em risco antes de ler qualquer barra. */
    ok(/risco de elimina/i.test(txt),
       "M4b o titulo nao avisa do risco: " + txt.slice(0, 90));
    ok(/1 bloco/.test(txt),
       "M4c o titulo nao diz QUANTOS blocos estao em risco: " + txt.slice(0, 90));

    const linhas = acharClasse(cx, "ed-min-bloco", []);
    ok(linhas.length === 2, "M4d deviam aparecer 2 blocos, apareceram "
       + linhas.length);

    /* O BLOCO EM RISCO VEM PRIMEIRO, mesmo nao sendo o primeiro do
     * edital: a ordem e a do risco, nao a do documento. */
    ok(/Específicos/.test(linhas[0].textContent || ""),
       "M4e o bloco em risco nao veio primeiro: "
       + (linhas[0].textContent || "").slice(0, 60));
    ok(/ed-min-abaixo/.test(linhas[0].className || ""),
       "M4f o bloco em risco nao se distingue: " + linhas[0].className);
    ok(!/ed-min-abaixo/.test(linhas[1].className || ""),
       "M4g o bloco cumprido foi marcado como em risco");

    /* A LINHA DO CORTE DENTRO DA BARRA. Duas barras lado a lado
     * obrigariam a comparar dois comprimentos separados — que e
     * justamente o que o olho faz mal. */
    const cortes = acharClasse(cx, "ed-min-corte", []);
    ok(cortes.length === 2, "M4h falta a linha do corte nas barras: "
       + cortes.length);
    if (cortes.length !== 2) { falhas.quantas = n; return falhas; }
    ok(!!cortes[0] && cortes[0].style.left === "60%",
       "M4i a linha do corte nao ficou na posicao do minimo: "
       + cortes[0].style.left);
    const fills = acharClasse(cx, "ed-min-fill", []);
    ok(fills[0].style.width === "0%",
       "M4j a barra do bloco nao estudado devia estar vazia: "
       + fills[0].style.width);

    /* E ONDE ESTUDAR. Sem isto o painel diz que ha risco e nao diz do
     * que — e a pessoa volta a olhar so o peso. */
    ok(/Direito Financeiro/.test(linhas[0].textContent || ""),
       "M4k o bloco em risco nao lista as disciplinas dele");
    /* a ressalva honesta: a barra mede COBERTURA, o edital cobra ACERTOS */
    ok(/acertos/i.test(txt) && /cobriu|cobertura|cobert/i.test(txt),
       "M4l o painel nao avisa que cobertura nao e acerto: "
       + txt.slice(0, 200));

    /* edital SEM blocos nao ganha painel nenhum */
    const rp = api.lerEdital("# X | prova: 2027-01-10\n@ P :: 5\n+ A :: 5");
    ok(api.edPintarBlocos(api.montarPlano(rp, { horas: 10, feitos: {} })) === null,
       "M4m edital sem blocos ganhou o painel de minimos");
  }

  /* ---- M5: filtro por edital na agenda ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar(); api.edCarregarLista();
    const base = "| prova: 2027-06-01 | horas: 10\n@ D :: 5\n+ A :: 5\n+ B :: 4";
    const e1 = api.edCriar("TCE-PE", "# TCE-PE " + base);
    const e2 = api.edCriar("SEFAZ-AL", "# SEFAZ-AL " + base);
    api.hubPintarAgenda();

    const box = api.$("edAgendaTopo");
    const filtro = acharClasse(box, "ed-ag-editais", [])[0];
    /* O FILTRO SUMIA QUANDO NENHUM EDITAL ESTAVA ABERTO — e na tela da
     * agenda normalmente nao ha nenhum aberto. Alem disso ele so oferecia
     * "todos" ou "so o aberto": com tres concursos, "ver o TCE e a SEFAZ
     * mas nao o ISS" era impossivel. */
    ok(!!filtro, "M5 o filtro por edital nao aparece na agenda");
    if (!filtro) { falhas.quantas = n; return falhas; }
    const bts = filtro.querySelectorAll("button");
    ok(bts.length >= 2,
       "M5b o filtro devia ter um botao por edital, tem " + bts.length);
    ok(bts.some((b) => /TCE-PE/.test(b.textContent))
       && bts.some((b) => /SEFAZ/.test(b.textContent)),
       "M5c o filtro nao nomeia os editais: "
       + bts.map((b) => b.textContent).join(" | "));

    /* esconder um edital tira as linhas DELE */
    const antes = acharClasse(box, "ed-item", []).length;
    api.hubEdAlternar(e2.id);
    api.hubPintarAgenda();
    /* olhar as LINHAS, não o texto da caixa inteira: os chips do filtro
     * continuam nomeando todos os editais, inclusive os escondidos — é
     * assim que se volta a mostrá-los. Procurar o nome no textContent
     * testaria o filtro, não a agenda. */
    const linhasDepois = acharClasse(api.$("edAgendaTopo"), "ed-item", []);
    ok(!linhasDepois.some((l) => /SEFAZ/.test(l.textContent || "")),
       "M5d esconder o edital nao tirou as linhas dele da agenda");
    ok(acharClasse(api.$("edAgendaTopo"), "ed-item", []).length < antes,
       "M5e a agenda continuou com o mesmo numero de linhas");

    /* e AS DISCIPLINAS acompanham: era esta a queixa — sem isolar o
     * edital, nao havia como ver so as disciplinas dele */
    ok(api.hubEdVisivel(e1.id) === true && api.hubEdVisivel(e2.id) === false,
       "M5f o estado do filtro nao bate com o que foi clicado");

    /* a escolha fica guardada entre sessoes: a agenda e a primeira tela
     * do dia, e refazer a filtragem toda manha faz a pessoa desistir */
    ok(!!api.loja.getItem("eac_ag_editais_ocultos"),
       "M5g a escolha do filtro nao ficou guardada");

    /* ESCONDER TODOS DEIXARIA A TELA VAZIA sem que nada estivesse errado:
     * o ultimo visivel recusa ser desmarcado. */
    api.hubEdAlternar(e1.id);
    api.hubPintarAgenda();
    ok((api.$("edAgendaTopo").textContent || "").indexOf("TCE-PE") >= 0
       || (api.$("edAgendaTopo").textContent || "").indexOf("SEFAZ") >= 0,
       "M5h escondendo todos os editais a agenda ficou vazia");
  }

  /* ---- M6: quem gera o edital precisa saber que isto existe ---- */
  {
    const { api } = rodar();
    const p = api.t("ed_prompt");
    ok(/10q/.test(p),
       "M6 o prompt nao ensina a escrever o peso em questoes");
    ok(/&\s*Conhecimentos/.test(p),
       "M6b o prompt nao ensina os blocos com minimo");
    ok(/minimo:/.test(p), "M6c o prompt nao ensina a sintaxe do minimo");
    /* e avisa contra misturar escalas, que invalida a conta exata */
    ok(/não misture|nao misture/i.test(p),
       "M6d o prompt nao avisa contra misturar questoes com a escala 1-5");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes, EDITAL };
