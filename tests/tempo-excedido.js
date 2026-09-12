/* TEMPO ALÉM DO PREVISTO.
 *
 * O caso que originou isto estava na tela do usuário: um tópico com
 * "1h15 de 30min · 100%". As três informações juntas são falsas —
 * 1h15 de 30min são 250%, e o "100%" faz parecer plano cumprido na
 * medida quando o tópico custou duas vezes e meia o reservado.
 *
 * Não é detalhe estético. O plano inteiro é uma conta de horas: se cada
 * tópico consome 2,5× o previsto, as 40h da semana rendem 16h de
 * matéria, e a pessoa chega na prova com um terço do edital que a tela
 * jurava estar coberto. */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };

  const linha = (api, item) => api.edLinhaAgendaTeste(item);
  const textoDe = (el) => (el && el.textContent) || "";
  const acharClasse = (el, cls, saida) => {
    Array.from(el.children || []).forEach((f) => {
      if (new RegExp("(^| )" + cls + "( |$)").test(f.className || "")) saida.push(f);
      acharClasse(f, cls, saida);
    });
    return saida;
  };

  /* ---- T1: o número não trava em 100% ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const disc = "Direito Financeiro", top = "Lei 4.320";
    const ch = api.matChave(disc, top);
    /* 75 minutos registrados num tópico que o plano reservou 30 */
    api.diarioPor([{ c: ch, disc, n: top, a: "feito", m: 75 }]);

    const li = linha(api, { disciplina: disc, nome: top, chave: ch,
      minutos: 30, faixa: "alta", disciplinaPeso: 5, peso: 5 });
    const txt = textoDe(li);

    ok(!/100%/.test(txt),
       "T1 a linha ainda diz 100% para 1h15 de 30min: " + txt.slice(0, 140));
    ok(/45min|45 min/.test(txt),
       "T1b a linha nao diz QUANTO passou do previsto: " + txt.slice(0, 140));
    ok(/1h15/.test(txt) && /30min/.test(txt),
       "T1c a linha perdeu os dois numeros originais: " + txt.slice(0, 140));

    /* A BARRA CONTINUA TRAVADA — uma barra nao sabe passar da propria
     * caixa, e 250% de largura vazaria por cima da linha vizinha. */
    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length === 1, "T1d nao achei a barra do topico");
    if (fills.length) {
      ok(fills[0].style.width === "100%",
         "T1e a barra passou da caixa: " + fills[0].style.width);
      /* mas ela nao pode ficar VERDE: verde e "cumpri o plano", e nao foi
       * isso que aconteceu */
      ok(!/cheio/.test(fills[0].className || ""),
         "T1f a barra pintou de 'cumprido' um topico que estourou o previsto");
      ok(/excedeu/.test(fills[0].className || ""),
         "T1g a barra nao se distingue de um topico cumprido na medida: "
         + fills[0].className);
    }
  }

  /* ---- T2: cumprir na medida continua sendo cumprir ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "Exato");
    api.diarioPor([{ c: ch, disc: "D", n: "Exato", a: "feito", m: 30 }]);
    const li = linha(api, { disciplina: "D", nome: "Exato", chave: ch, minutos: 30 });
    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length && /cheio/.test(fills[0].className || ""),
       "T2 30min de 30min devia continuar aparecendo como cumprido: "
       + (fills[0] || {}).className);
    ok(/100%/.test(textoDe(li)),
       "T2b cumprir na medida perdeu o 100%: " + textoDe(li).slice(0, 120));

    /* PASSAR UM POUCO NÃO É NOTÍCIA. 34min de 30min sao 113%: alarmar
     * ali encheria a agenda de aviso amarelo e o aviso perderia sentido
     * justamente onde ele importa. */
    api.diarioPor([{ c: ch, disc: "D", n: "Exato", a: "feito", m: 34 }]);
    const li2 = linha(api, { disciplina: "D", nome: "Exato", chave: ch, minutos: 30 });
    const f2 = acharClasse(li2, "it-fill", []);
    ok(f2.length && !/excedeu/.test(f2[0].className || ""),
       "T2c 34min de 30min ja disparou o alerta — a folga sumiu");
  }

  /* ---- T3: metade do caminho continua sendo metade ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const ch = api.matChave("D", "Meio");
    api.diarioPor([{ c: ch, disc: "D", n: "Meio", a: "feito", m: 15 }]);
    const li = linha(api, { disciplina: "D", nome: "Meio", chave: ch, minutos: 30 });
    ok(/50%/.test(textoDe(li)),
       "T3 meio caminho deixou de mostrar 50%: " + textoDe(li).slice(0, 120));
    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length && /parcial/.test(fills[0].className || ""),
       "T3b a barra parcial mudou de estado sem motivo");
  }

  /* ---- T4: o fator de realidade da disciplina ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const disc = "Direito Financeiro";
    const itens = ["Receita", "Despesa", "Restos", "Créditos"].map((nome) => ({
      disciplina: disc, nome, chave: api.matChave(disc, nome), minutos: 30,
    }));
    /* três tópicos medidos, todos custando o dobro */
    api.diarioPor(itens.slice(0, 3).map((x) => ({
      c: x.chave, disc, n: x.nome, a: "feito", m: 60 })));

    const f = api.edFatorReal(disc, itens);
    ok(!!f, "T4 o fator de realidade nao foi calculado");
    ok(f && Math.abs(f.fator - 2) < 0.01,
       "T4b o fator devia ser 2, veio " + (f && f.fator));
    ok(f && f.topicos === 3,
       "T4c contou " + (f && f.topicos) + " topicos medidos, deviam ser 3");
    /* o tópico ainda NÃO estudado não entra na conta: incluí-lo como
     * "zero minutos" faria o fator despencar e mentir para o outro lado */
    ok(f && f.previsto === 90,
       "T4d o previsto somou o topico que ninguem estudou: " + (f && f.previsto));

    /* MENOS DE TRÊS TÓPICOS É ANEDOTA, NÃO MEDIDA.
     * Uma sessao longa num topico dificil viraria "esta disciplina custa
     * o triplo", e o numero seria pior que nenhum numero. */
    const { api: api2 } = rodar();
    api2.matIniciar(); api2.edIniciar();
    const it2 = ["A", "B", "C"].map((nome) => ({
      disciplina: "X", nome, chave: api2.matChave("X", nome), minutos: 30 }));
    api2.diarioPor([{ c: it2[0].chave, disc: "X", n: "A", a: "feito", m: 180 }]);
    ok(api2.edFatorReal("X", it2) === null,
       "T4e um topico so bastou para o app declarar um fator");

    /* disciplina sem nada estudado nao tem fator nenhum */
    ok(api.edFatorReal("Estatística", itens) === null,
       "T4f inventou um fator para disciplina sem tempo registrado");
  }

  /* ---- T5: revisão tem conta própria ---- */
  {
    const { api } = rodar();
    api.matIniciar(); api.edIniciar();
    const disc = "Direito Financeiro", top = "Lei 4.320";
    const ch = api.matChave(disc, top);

    /* O CASO REAL: o tópico foi estudado há oito dias (1h15 de estudo
     * original), a revisão venceu, e a linha mostrava "1h15 de 30min ·
     * 45min além" — numa revisão que sequer tinha começado.
     *
     * Os dois números eram verdadeiros e não falavam da mesma coisa:
     * 1h15 é tudo o que já foi gasto no tópico desde sempre; 30min é o
     * orçamento SÓ DA REVISÃO, que é metade do de um tópico novo. */
    api.diarioPor([
      { c: ch, disc, n: top, a: "feito", m: 75, d: "2026-08-18" },
    ]);
    const li = linha(api, { disciplina: disc, nome: top, chave: ch,
      minutos: 30, ehRevisao: true });
    const txt = textoDe(li);

    ok(!/45min além|45 min além/.test(txt),
       "T5 a revisao ainda se diz cumprida com o tempo do estudo original: "
       + txt.slice(0, 140));
    /* o tempo total NÃO some — ele é informação boa, desde que nomeada */
    ok(/1h15/.test(txt),
       "T5b o tempo ja investido no topico sumiu da linha: " + txt.slice(0, 140));
    ok(/ao todo|total/i.test(txt),
       "T5c o tempo total aparece sem dizer que e o total: " + txt.slice(0, 140));
    ok(/18/.test(txt),
       "T5d nao diz de quando e o estudo anterior: " + txt.slice(0, 140));
    /* E A RESPOSTA PARA "QUANTO DE REVISÃO EU JÁ CUMPRI?" É ZERO — dita
     * em voz alta. Esconder o zero deixaria a pergunta sem resposta
     * justamente quando ela mais importa. */
    ok(/0min de 30min|0 de 30min/.test(txt),
       "T5d2 a revisao pendente nao diz que ainda esta em zero: "
       + txt.slice(0, 160));
    ok(/de revis/i.test(txt),
       "T5d3 a linha nao diz que aquele tempo e de REVISAO: "
       + txt.slice(0, 160));

    const fills = acharClasse(li, "it-fill", []);
    ok(fills.length && !/excedeu|cheio/.test(fills[0].className || ""),
       "T5e a barra da revisao aparece cumprida sem a revisao ter comecado: "
       + (fills[0] || {}).className);

    /* AGORA A REVISÃO ACONTECE: 20 minutos depois da conclusão. */
    api.diarioPor([
      { c: ch, disc, n: top, a: "feito", m: 75, d: "2026-08-18" },
      { c: ch, disc, n: top, a: "revisado", m: 20, d: "2026-08-26" },
    ]);
    const li2 = linha(api, { disciplina: disc, nome: top, chave: ch,
      minutos: 30, ehRevisao: true });
    const t2 = textoDe(li2);
    ok(/20min/.test(t2),
       "T5f a revisao cumprida nao aparece: " + t2.slice(0, 140));
    ok(/de 30min/.test(t2),
       "T5g a revisao nao e medida contra o orcamento dela: " + t2.slice(0, 140));
    ok(/1h35/.test(t2),
       "T5h o total do topico devia somar 1h35 (1h15 + 20min): "
       + t2.slice(0, 160));
    ok(/67%|66%/.test(t2),
       "T5i 20 de 30 minutos sao dois tercos da revisao: " + t2.slice(0, 140));

    /* e um tópico NOVO continua medindo tudo, como sempre mediu */
    const ch2 = api.matChave("D", "Novo");
    api.diarioPor([{ c: ch2, disc: "D", n: "Novo", a: "feito", m: 45,
                     d: "2026-08-26" }]);
    const li3 = linha(api, { disciplina: "D", nome: "Novo", chave: ch2,
      minutos: 60 });
    ok(/45min de 1h/.test(textoDe(li3)),
       "T5j topico novo mudou de conta sem motivo: "
       + textoDe(li3).slice(0, 120));
    ok(!/ao todo/.test(textoDe(li3)),
       "T5k topico que nao e revisao ganhou a linha do total");
  }

  falhas.quantas = n;
  return falhas;
}

module.exports = { testes };
