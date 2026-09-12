/* CADASTRAR UM EDITAL DE DUAS DATAS, do começo ao fim.
 *
 * O caso é a SEFAZ-AL: objetiva em dezembro, discursiva em janeiro,
 * mínimo por bloco e peso em número de questões. Todas as peças já
 * existiam separadas; escrever o edital inteiro e mandá-lo ida e volta
 * mostrou que duas delas se perdiam na primeira reescrita de rotina.
 *
 * PERDA SILENCIOSA NA REESCRITA. edParaTexto devolvia o texto sem as
 * linhas "&" e com o peso derivado no lugar do real:
 *
 *   & Conhecimentos Básicos | minimo: 50%   →  (some)
 *   @ Português :: 10q                      →  @ Português :: 3
 *
 * A primeira perda apaga a nota mínima, que é a informação que decide
 * ELIMINAÇÃO — um plano sem ela otimiza pontos totais num concurso onde
 * dá para ser cortado com nota alta. A segunda troca um número medido
 * por uma estimativa, e a fatia da prova deixa de ser exata sem que
 * nada avise.
 *
 * E a caixa de criar: um prompt() do navegador pedindo o nome deixava a
 * pessoa numa bancada em branco, tendo de descobrir sozinha onde se põe
 * a data — sem a qual o plano não calcula nada. */
const { rodar } = require("./fumaca.js");

const SEFAZ = [
  "# SEFAZ-AL Auditor Fiscal | prova: 2026-12-13 | horas: 25",
  "# fase 2: discursiva | prova: 2027-01-24 | horas: 25",
  "& Conhecimentos Básicos | minimo: 50%",
  "@ Língua Portuguesa :: 10q",
  "+ Crase :: 3 :: cai sempre",
  "& Conhecimentos Específicos | minimo: 60%",
  "@ Direito Tributário :: 20q",
  "+ Obrigação tributária :: 5 :: cai sempre !d",
  "+ Responsabilidade tributária :: 3 :: recorrente !d5",
  "@ Contabilidade Geral :: 15q",
  "+ Balanço patrimonial :: 5 :: base de tudo !d",
].join("\n");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  /* ---- N1: o edital de duas datas é lido inteiro ---- */
  {
    const { api } = rodar();
    const r = api.lerEdital(SEFAZ);
    ok(r.cfg.prova === "2026-12-13",
       "N1 a data da primeira fase se perdeu: " + r.cfg.prova);
    ok(r.cfg.fase2 && r.cfg.fase2.prova === "2027-01-24",
       "N1b a segunda data nao foi lida: " + JSON.stringify(r.cfg.fase2));
    ok((r.blocos || []).length === 2,
       "N1c os blocos com minimo nao foram lidos: " + (r.blocos || []).length);
    ok((r.achados || []).filter((a) => a.tipo === "linha_ignorada").length === 0,
       "N1d alguma linha do edital foi ignorada");
    /* o "!d" sem número herda o peso da primeira fase; com número, manda
     * o número — um tópico que vale pouco na objetiva pode ser uma
     * questão discursiva inteira */
    const tops = [];
    r.disciplinas.forEach((d) => d.topicos.forEach((tp) => tops.push(tp)));
    const obr = tops.filter((x) => /Obrigação/.test(x.nome))[0];
    const resp = tops.filter((x) => /Responsabilidade/.test(x.nome))[0];
    const crase = tops.filter((x) => /Crase/.test(x.nome))[0];
    ok(obr && obr.fase2 && obr.pesoF2 === 5,
       "N1e o !d sem numero nao herdou o peso da primeira fase: "
       + JSON.stringify(obr && obr.pesoF2));
    ok(resp && resp.pesoF2 === 5 && resp.peso === 3,
       "N1f o !d5 nao deu peso proprio na segunda fase: "
       + JSON.stringify(resp && { p: resp.peso, p2: resp.pesoF2 }));
    ok(crase && !crase.fase2,
       "N1g topico sem marcador entrou na segunda fase");
  }

  /* ---- N2: a fase vira sozinha quando a data passa ---- */
  {
    const { api } = rodar();
    const cfg = api.lerEdital(SEFAZ).cfg;
    const antes = api.edFaseAtual(cfg, "2026-08-29");
    ok(antes.n === 1 && antes.temFase2 === true,
       "N2 antes de dezembro a fase deveria ser a 1: " + JSON.stringify(antes));
    /* NO DIA SEGUINTE À OBJETIVA o edital não está encerrado: falta a
     * discursiva, e é justamente a semana em que ela vira tudo. */
    const depois = api.edFaseAtual(cfg, "2026-12-14");
    ok(depois.n === 2 && depois.prova === "2027-01-24",
       "N2b depois da objetiva a fase 2 nao assumiu: " + JSON.stringify(depois));
  }

  /* ================================================================
   * N3: A REESCRITA NÃO PODE PERDER NADA
   * ============================================================== */
  {
    const { api } = rodar();
    const r = api.lerEdital(SEFAZ);
    const volta = api.lerEdital(api.edParaTexto(r));

    ok(volta.cfg.fase2 && volta.cfg.fase2.prova === "2027-01-24",
       "N3 a segunda data nao sobreviveu a reescrita: "
       + JSON.stringify(volta.cfg.fase2));
    /* OS MÍNIMOS DECIDEM ELIMINAÇÃO. Perdê-los faz o plano otimizar
     * pontos totais num concurso onde dá para ser cortado com nota alta. */
    ok((volta.blocos || []).length === 2,
       "N3b os blocos com minimo sumiram na reescrita: "
       + JSON.stringify((volta.blocos || []).map((b) => b.nome)));
    const m0 = ((volta.blocos || [])[0] || {}).minimo || {};
    ok(m0.tipo === "pct" && m0.valor === 50,
       "N3c o valor do minimo nao voltou igual: " + JSON.stringify(m0));

    /* O PESO EM QUESTÕES é medido; o 1..5 é derivado dele. Escrever o
     * derivado troca um número real por uma estimativa. */
    const porNome = {};
    volta.disciplinas.forEach((d) => { porNome[d.nome] = d; });
    ok(porNome["Direito Tributário"] && porNome["Direito Tributário"].abs === 20,
       "N3d o peso em questoes virou nota de 1 a 5: "
       + JSON.stringify(porNome["Direito Tributário"]
         && { abs: porNome["Direito Tributário"].abs,
              peso: porNome["Direito Tributário"].peso }));
    ok(porNome["Língua Portuguesa"] && porNome["Língua Portuguesa"].abs === 10,
       "N3e o peso em questoes de Português se perdeu");

    /* e as marcas da segunda fase continuam onde estavam */
    const f2 = [];
    volta.disciplinas.forEach((d) => d.topicos.forEach((tp) => {
      if (tp.fase2) f2.push(tp.nome + ":" + tp.pesoF2);
    }));
    ok(f2.length === 3,
       "N3f as marcas !d nao sobreviveram: " + JSON.stringify(f2));

    /* A FATIA DA PROVA é a prova de que o número real sobreviveu: com o
     * peso derivado, as três disciplinas ficariam iguais.
     *
     * A fatia mora em "porque.fatia", não em "fatiaDisc" — este segundo
     * nome não existe em item nenhum, e ler dele comparava undefined com
     * undefined: a asserção passava com o defeito de pé. */
    const fatia = (ed) => {
      const p = api.montarPlano(ed, { horas: 25, prova: "2026-12-13" });
      const f = {};
      p.itens.forEach((i) => { f[i.disciplina] = i.porque.fatia; });
      return f;
    };
    const fa = fatia(r), fb = fatia(volta);
    ok(JSON.stringify(fa) === JSON.stringify(fb),
       "N3g a fatia da prova mudou depois da reescrita:\n"
       + JSON.stringify(fa) + "\n" + JSON.stringify(fb));
  }

  /* ================================================================
   * N4: a caixa de criar monta o cabeçalho
   * ============================================================== */
  {
    const { api } = rodar();
    const txt = api.hubNovoTexto({
      nome: "SEFAZ-AL Auditor Fiscal", prova: "2026-12-13", horas: "25",
      f2Nome: "discursiva", f2Prova: "2027-01-24",
      plano: "@ Direito Tributário :: 20q\n+ Obrigação tributária :: 5 :: !d",
    });
    const r = api.lerEdital(txt);
    ok(r.cfg.prova === "2026-12-13" && r.cfg.horas === 25,
       "N4 a caixa nao levou data e horas para o texto: "
       + JSON.stringify(r.cfg));
    ok(r.cfg.fase2 && r.cfg.fase2.prova === "2027-01-24",
       "N4b a segunda data da caixa nao virou cabecalho");
    ok((r.disciplinas || []).length === 1,
       "N4c as disciplinas coladas nao entraram: "
       + (r.disciplinas || []).length);

    /* O CABEÇALHO É DO APP. Se a pessoa colar a resposta inteira da IA —
     * que já vem com "#" —, aquela linha viraria uma segunda
     * configuração competindo com a que ela acabou de preencher. */
    const txt2 = api.hubNovoTexto({
      nome: "Meu nome", prova: "2026-12-13", horas: "25",
      plano: "# OUTRO CONCURSO | prova: 2030-01-01 | horas: 99\n"
        + "@ Português :: 10q\n+ Crase :: 3",
    });
    const r2 = api.lerEdital(txt2);
    ok(r2.cfg.prova === "2026-12-13" && r2.cfg.horas === 25,
       "N4d o cabecalho colado atropelou os campos da caixa: "
       + JSON.stringify(r2.cfg));
    ok((r2.disciplinas || []).length === 1,
       "N4e tirar o cabecalho colado levou as disciplinas junto");

    /* sem plano, o edital nasce vazio mas COM data: é o que permite a
     * agenda existir antes de a lista de tópicos chegar */
    const txt3 = api.hubNovoTexto({ nome: "Só a data", prova: "2026-12-13",
      horas: "10", plano: "" });
    const r3 = api.lerEdital(txt3);
    ok(r3.cfg.prova === "2026-12-13",
       "N4f criar sem disciplinas perdeu a data");
  }

  /* ================================================================
   * N4b: O PESO 1..5 SAI DO NÚMERO DE QUESTÕES
   *
   * edPeso devolvia "peso: 3" para toda disciplina escrita em "Nq" —
   * ela conhece o número absoluto e não conhece as outras, então não
   * tinha como situá-lo numa escala, e o 3 era um valor de espera que
   * ninguém trocava depois.
   *
   * O estrago aparecia inteiro num edital escrito TODO no formato
   * exato: as dezesseis disciplinas da SEFAZ-AL, de 5q a 20q, saíam com
   * peso 3, o produto "peso da disciplina × peso do tópico" perdia um
   * dos fatores e a ordenação virava quase um empate. Escrever o número
   * certo do edital dava um plano PIOR do que chutar 1 a 5.
   * ============================================================== */
  {
    const { api } = rodar();
    const L = ["# X | prova: 2027-06-01 | horas: 40"];
    [["Matematica", 5], ["Tributario", 10], ["Reforma", 15],
     ["Dados", 20]].forEach(([d, q]) => {
      L.push("@ " + d + " :: " + q + "q");
      L.push("+ " + d + " t1 :: 5");
    });
    const r = api.lerEdital(L.join("\n"));
    const peso = {};
    r.disciplinas.forEach((d) => { peso[d.nome] = d.peso; });

    ok(peso.Dados === 5 && peso.Matematica === 2,
       "N4b-pre a escala nao vai da maior a menor: " + JSON.stringify(peso));
    /* O QUE FALHAVA: todas iguais. */
    const distintos = Object.keys(peso)
      .map((k) => peso[k])
      .filter((v, i, a) => a.indexOf(v) === i);
    ok(distintos.length === 4,
       "N4b as disciplinas continuam empatadas no peso: " + JSON.stringify(peso));
    /* e o numero de origem nao se perde: e' ele que da a fatia exata */
    ok(r.disciplinas.every((d) => d.abs > 0),
       "N4c derivar o peso apagou o numero de questoes");

    /* A FATIA DA PROVA NÃO PODE SE MEXER. Ela vem do "Nq" direto; se
     * passasse a vir do peso derivado, arredondar para 1..5 traria de
     * volta a estimativa que o formato exato existe para eliminar. */
    const p = api.montarPlano(r, { horas: 40, prova: "2027-06-01",
                                   fatores: {}, acertos: {} });
    ok(p.fatia.Dados === 40 && p.fatia.Matematica === 10,
       "N4d a fatia da prova mudou ao derivar o peso: "
       + JSON.stringify(p.fatia));
    ok(p.fatiaExata === true, "N4e a fatia deixou de ser exata");

    /* e o bruto passa a distinguir: 5x5 contra 2x5 */
    const bruto = {};
    p.itens.forEach((i) => { bruto[i.disciplina] = i.bruto; });
    ok(bruto.Dados === 25 && bruto.Matematica === 10,
       "N4f o peso derivado nao chegou ao bruto: " + JSON.stringify(bruto));
  }

  /* ---- N5: sem segunda data, não se inventa fase 2 ---- */
  {
    const { api } = rodar();
    const txt = api.hubNovoTexto({ nome: "Uma prova só",
      prova: "2026-12-13", horas: "20", plano: "" });
    ok(txt.indexOf("fase 2") < 0,
       "N5 a caixa escreveu uma segunda fase que ninguem pediu: " + txt);
    const r = api.lerEdital(txt);
    ok(!r.cfg.fase2, "N5b o edital de uma prova ganhou fase 2");
  }

  /* ---- N6: o prompt ensina as duas datas ---- */
  {
    const { api } = rodar();
    const p = api.t("ed_prompt");
    /* O PROMPT É A ÚNICA DOCUMENTAÇÃO que a pessoa lê antes de colar o
     * edital numa IA. Um formato que o app entende e o prompt não ensina
     * é um formato que ninguém usa. */
    ok(/fase 2:/.test(p), "N6 o prompt nao ensina a segunda linha de cabecalho");
    ok(/!d/.test(p), "N6b o prompt nao ensina o marcador da segunda fase");
    ok(/minimo:/.test(p), "N6c o prompt nao ensina o minimo por bloco");
    ok(/\d+q/.test(p), "N6d o prompt nao ensina o peso em questoes");
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
