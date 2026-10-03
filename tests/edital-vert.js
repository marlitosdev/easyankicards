/* =====================================================================
 * EDITAL VERTICALIZADO (V2) — o motor: o que entra na folha e em que ordem.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. As disciplinas saem por QUESTÕES (quando todas trazem o número) ou por peso, nunca por acaso;
 *     empate respeita a ordem do edital; "edital" mantém a ordem original.
 *  2. A fatia da prova de cada disciplina é a MESMA que o plano mostra (montarPlano) — duas contas
 *     para o mesmo número é o defeito que mais volta neste app.
 *  3. A numeração é 1, 2, 3… para tópicos e 1.1, 1.2… para ramos; sem a opção, os ramos não entram.
 *  4. "Só 2ª fase" leva só os tópicos marcados, com o peso da 2ª fase.
 *  5. As caixas seguem a regra do app: ramo sem marca própria herda a do tópico; o tópico só está feito
 *     quando todos os ramos ativos estão; sem progresso, tudo vazio.
 *  6. O motor é puro: não muda o edital que recebeu.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

const EXATO = [
  "# Teste Verticalizado | prova: 2030-01-01 | horas: 10",
  "& Básicos | minimo: 50%",
  "@ Português :: 10q",
  "+ Crase :: 3 :: cai sempre",
  "+ Concordância :: 5",
  "& Específicos | minimo: 60%",
  "@ Direito Financeiro :: 20q",
  "+ Orçamento :: 5 :: cai muito !d",
  "++ PPA :: 4 :: plurianual",
  "++ LOA :: 5",
  "+ Receita :: 2",
  "@ Contabilidade :: 15q",
  "+ Balanço :: 4 :: !d3",
].join("\n");

const ESCALA = [
  "# Escala | prova: 2030-01-01 | horas: 10",
  "@ Alfa :: 2",
  "+ A1 :: 3",
  "@ Beta :: 5",
  "+ B1 :: 4",
  "@ Gama :: 5",
  "+ G1 :: 2",
].join("\n");

function testes() {
  const falhas = []; let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const { api } = rodar();
  const nomes = (v) => v.disciplinas.map((d) => d.nome).join(",");

  /* ---- V1: a ordem ---- */
  {
    const r = api.lerEdital(EXATO);
    const v = api.edVerticalizar(r);
    ok(v.ordem === "peso" && v.exata === true && nomes(v) === "Direito Financeiro,Contabilidade,Português", "V1a com questoes em todas, a ordem e' por questoes: " + nomes(v));
    ok(v.disciplinas.map((d) => d.pos).join(",") === "1,2,3", "V1b a posicao e' 1..N depois de ordenar");
    ok(v.disciplinas[0].abs === 20 && v.disciplinas[0].unidade === "q" && v.disciplinas[2].abs === 10, "V1c cada disciplina leva o numero real do edital");
    const e = api.edVerticalizar(r, { ordem: "edital" });
    ok(e.ordem === "edital" && nomes(e) === "Português,Direito Financeiro,Contabilidade", "V1d ordem 'edital' mantem a do edital: " + nomes(e));
    ok(api.edVerticalizar(r, { ordem: "qualquer" }).ordem === "peso", "V1e ordem desconhecida volta ao padrao (peso)");
    /* 19q e 20q empatam no peso 1-5 DERIVADO (as duas viram 5): so' o numero real de questoes desempata */
    const quase = api.edVerticalizar(api.lerEdital("# Q\n@ Um :: 19q\n+ t :: 3\n@ Dois :: 20q\n+ t :: 3"));
    ok(quase.exata && quase.disciplinas[0].peso === quase.disciplinas[1].peso && nomes(quase) === "Dois,Um", "V1e2 com o peso derivado empatado, quem tem mais questoes vem primeiro: " + nomes(quase));
    /* escala 1-5: peso desc, empate pela ordem do edital */
    const s = api.edVerticalizar(api.lerEdital(ESCALA));
    ok(s.exata === false && nomes(s) === "Beta,Gama,Alfa", "V1f na escala 1-5 manda o peso e o empate (Beta/Gama) segue o edital: " + nomes(s));
    /* so' ALGUMA com questoes: nao e' exata, ordena pelo peso derivado */
    const mista = api.edVerticalizar(api.lerEdital("# M\n@ Um :: 3\n+ t :: 3\n@ Dois :: 10q\n+ t :: 3"));
    ok(mista.exata === false, "V1g basta uma disciplina sem numero para a conta deixar de ser exata");
  }

  /* ---- V2: a fatia e' a do plano ---- */
  {
    for (const [nome, txt] of [["exato", EXATO], ["escala", ESCALA]]) {
      const r = api.lerEdital(txt);
      const v = api.edVerticalizar(r);
      const plano = api.montarPlano(r, { horas: 10, prova: "2030-01-01" });
      const doPlano = {};
      plano.itens.forEach((i) => { doPlano[i.disciplina] = i.fatiaDisc; });
      ok(v.disciplinas.every((d) => d.fatia === doPlano[d.nome]), "V2a (" + nome + ") a fatia de cada disciplina e' a do plano: " + JSON.stringify(v.disciplinas.map((d) => [d.nome, d.fatia])) + " x " + JSON.stringify(doPlano));
      ok(plano.fatiaExata === v.exata, "V2b (" + nome + ") 'exata' concorda com o plano");
    }
    const f = api.edVertFatias(api.lerEdital(EXATO)).fatia;
    ok(f["Direito Financeiro"] === 44 && f["Contabilidade"] === 33 && f["Português"] === 22, "V2c fatia exata = questoes / total: " + JSON.stringify(f));
    /* arredonda ao mais proximo (61,5 -> 62), como o plano */
    const r2 = api.lerEdital("# R\n@ Cinco :: 5q\n+ t :: 3\n@ Oito :: 8q\n+ t :: 3");
    const f2 = api.edVertFatias(r2).fatia;
    const p2 = api.montarPlano(r2, { horas: 10, prova: "2030-01-01" }).itens.map((i) => [i.disciplina, i.fatiaDisc]);
    ok(f2["Cinco"] === 38 && f2["Oito"] === 62 && p2.every(([d, x]) => f2[d] === x), "V2d a fatia arredonda ao mais proximo, igual ao plano: " + JSON.stringify([f2, p2]));
  }

  /* ---- V3: grupo e minimo do bloco ---- */
  {
    const v = api.edVerticalizar(api.lerEdital(EXATO));
    const df = v.disciplinas.find((d) => d.nome === "Direito Financeiro"), pt = v.disciplinas.find((d) => d.nome === "Português");
    ok(pt.grupo === "Básicos" && pt.minimo && pt.minimo.tipo === "pct" && pt.minimo.valor === 50, "V3a o grupo e o minimo vem do bloco '&': " + JSON.stringify([pt.grupo, pt.minimo]));
    ok(df.grupo === "Específicos" && df.minimo.valor === 60, "V3b e o das outras disciplinas tambem");
    const sem = api.edVerticalizar(api.lerEdital(ESCALA)).disciplinas[0];
    ok(sem.grupo === "" && sem.minimo === null, "V3c sem bloco, grupo vazio e sem minimo");
  }

  /* ---- V4: numeracao e ramos ---- */
  {
    const r = api.lerEdital(EXATO);
    const sem = api.edVerticalizar(r).disciplinas.find((d) => d.nome === "Direito Financeiro");
    ok(sem.linhas.map((l) => l.num).join(",") === "1,2" && sem.ramos === 0 && sem.linhas.every((l) => l.nivel === 0 && !l.pai), "V4a sem a opcao os ramos nao entram: " + sem.linhas.map((l) => l.num));
    const com = api.edVerticalizar(r, { ramos: true }).disciplinas.find((d) => d.nome === "Direito Financeiro");
    ok(com.linhas.map((l) => l.num).join(",") === "1,1.1,1.2,2" && com.ramos === 2 && com.topicos === 2, "V4b com a opcao: 1, 1.1, 1.2, 2: " + com.linhas.map((l) => l.num));
    ok(com.linhas[0].pai === true && com.linhas[1].pai === false && com.linhas[1].nivel === 1 && com.linhas[3].pai === false, "V4c so' o topico que tem ramos e' 'pai' (negrito/vermelho na folha)");
    ok(com.linhas[1].texto === "PPA" && com.linhas[1].peso === 4 && com.linhas[2].peso === 5, "V4d o ramo leva nome e peso proprios");
    ok(com.linhas.every((l) => l.motivo === ""), "V4e sem a opcao 'motivo', nenhum motivo");
    const mo = api.edVerticalizar(r, { ramos: true, motivo: true }).disciplinas.find((d) => d.nome === "Direito Financeiro");
    ok(mo.linhas[0].motivo === "cai muito" && mo.linhas[1].motivo === "plurianual" && mo.linhas[2].motivo === "", "V4f com 'motivo': o do topico e a nota do ramo");
    const pt = api.edVerticalizar(r).disciplinas.find((d) => d.nome === "Português");
    ok(pt.linhas.map((l) => l.num + ":" + l.texto).join("|") === "1:Crase|2:Concordância", "V4g a numeracao reinicia em cada disciplina");
    ok(api.edVerticalizar(r, { ramos: true }).resumo.ramos === 2 && api.edVerticalizar(r, { ramos: true }).resumo.topicos === 5 && api.edVerticalizar(r).resumo.disciplinas === 3, "V4h o resumo conta disciplinas, topicos e ramos");
  }

  /* ---- V5: so' 2a fase ---- */
  {
    const r = api.lerEdital(EXATO);
    const v = api.edVerticalizar(r, { soFase2: true });
    ok(nomes(v) === "Direito Financeiro,Contabilidade" && v.soFase2 === true, "V5a so' as disciplinas com topico na 2a fase: " + nomes(v));
    const df = v.disciplinas[0], co = v.disciplinas[1];
    ok(df.linhas.length === 1 && df.linhas[0].texto === "Orçamento" && df.linhas[0].num === "1" && df.topicos === 1, "V5b so' o topico marcado, renumerado: " + JSON.stringify(df.linhas.map((l) => l.num + l.texto)));
    ok(co.linhas[0].peso === 3, "V5c usa o peso proprio da 2a fase (!d3): " + co.linhas[0].peso);
    ok(v.resumo.topicos === 2, "V5d resumo so' da 2a fase");
    ok(api.edVerticalizar(r).disciplinas.find((d) => d.nome === "Contabilidade").linhas[0].peso === 4, "V5e fora do modo 2a fase o peso e' o da primeira");
  }

  /* ---- V6: as caixas (progresso) ---- */
  {
    const r = api.lerEdital(EXATO);
    const base = api.edVerticalizar(r, { ramos: true });
    ok(base.disciplinas.every((d) => d.linhas.every((l) => !l.teoria && !l.rev1 && !l.rev2 && !l.pulado)), "V6a sem progresso todas as caixas vazias");
    const marcas = {
      "português›crase": { e: "feito", d: "2026-09-01" },
      "português›concordância": { e: "revisado", d: "2026-09-02" },
      "direito financeiro›receita": { e: "pulado" },
      "direito financeiro›orçamento": { e: "feito", d: "2026-09-03" },
      "direito financeiro›orçamento›#loa": { e: "pulado" },
    };
    const v = api.edVerticalizar(r, { ramos: true, marcaDe: (c) => marcas[c] || null });
    const L = (disc, num) => v.disciplinas.find((d) => d.nome === disc).linhas.find((l) => l.num === num);
    ok(L("Português", "1").teoria === true && L("Português", "1").rev1 === false, "V6b 'feito' marca so' TEORIA");
    ok(L("Português", "2").teoria === true && L("Português", "2").rev1 === true && L("Português", "2").rev2 === false, "V6c 'revisado' marca TEORIA e REV. 1; REV. 2 nunca (o app nao guarda)");
    ok(L("Direito Financeiro", "2").pulado === true && L("Direito Financeiro", "2").teoria === false, "V6d 'pulado' nao conta como estudado");
    ok(L("Direito Financeiro", "1.1").teoria === true, "V6e o ramo sem marca propria HERDA a do topico (PPA feito)");
    ok(L("Direito Financeiro", "1.2").pulado === true && L("Direito Financeiro", "1.2").teoria === false, "V6f o ramo com marca propria (LOA pulado) vale a dele");
    ok(L("Direito Financeiro", "1").teoria === true && L("Direito Financeiro", "1").pulado === false, "V6g o topico esta feito quando todos os ramos ATIVOS estao (o pulado fica de fora)");
    /* um ramo ativo sem estudo segura o topico */
    const m2 = { "direito financeiro›orçamento›#ppa": { e: "feito", d: "2026-09-03" } };
    const v2 = api.edVerticalizar(r, { ramos: true, marcaDe: (c) => m2[c] || null });
    const o = v2.disciplinas.find((d) => d.nome === "Direito Financeiro").linhas;
    ok(o[1].teoria === true && o[2].teoria === false && o[0].teoria === false, "V6h um ramo pendente impede o topico de aparecer como feito");
    /* sem ramos exibidos, o topico continua seguindo a regra dos ramos dele */
    const v3 = api.edVerticalizar(r, { marcaDe: (c) => marcas[c] || null });
    ok(v3.disciplinas.find((d) => d.nome === "Direito Financeiro").linhas[0].teoria === true, "V6i com os ramos escondidos o topico segue a mesma regra");
    /* a chave das marcas e' a mesma do app (edChave) */
    const item = api.priorizar(r).find((i) => i.nome === "Crase");
    ok(item && api.edChave(item) === "português›crase" && base.disciplinas.find((d) => d.nome === "Português").linhas[0].chave === api.edChave(item), "V6j a chave da linha e' a de edChave (a do progresso): " + (item && api.edChave(item)));
  }

  /* ---- V7: puro e sem edital ---- */
  {
    const r = api.lerEdital(EXATO);
    const antes = JSON.stringify(r);
    api.edVerticalizar(r, { ramos: true, motivo: true, soFase2: true, ordem: "edital", marcaDe: () => ({ e: "feito" }) });
    ok(JSON.stringify(r) === antes, "V7a o motor nao muda o edital que recebeu");
    const vazio = api.edVerticalizar(api.lerEdital(""));
    ok(vazio.disciplinas.length === 0 && vazio.resumo.disciplinas === 0 && vazio.exata === false, "V7b edital vazio: sem disciplinas e sem erro");
    ok(api.edVerticalizar(null).disciplinas.length === 0, "V7c sem edital nenhum tambem nao quebra");
    const v = api.edVerticalizar(r);
    ok(v.titulo === "Teste Verticalizado" && v.prova === "2030-01-01", "V7d titulo e data da prova vem do cabecalho: " + v.titulo + " " + v.prova);
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
