/* =====================================================================
 * O LEITOR DE RESUMOS (v18.74.0+)
 *
 * R1 (18.74.0) — ONDE PAREI, EM CADA RAMO. A leitura é um painel só, e
 * trocar de ramo deixava a rolagem onde estava: o ramo novo abria no meio.
 * O QUE PRECISA SER VERDADE:
 *  1. cada bloco desenhado leva a linha de origem (data-l), e a linha do
 *     marcador — que o desenho acrescenta — não desloca as outras;
 *  2. cada escopo (Tudo, Geral, cada ramo) de cada tópico guarda o seu
 *     lugar: o parágrafo do alto e quanto dele já passou (e a fração, de
 *     reserva); o que nunca foi lido começa do INÍCIO;
 *  3. voltar a um ramo, sair para editar e voltar, fechar e reabrir: o
 *     lugar volta; com a leitura escondida ou fechada nada é gravado (ela
 *     lê 0 e apagaria o lugar);
 *  4. mudar a letra mantém o mesmo parágrafo no alto.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const { api: a } = rodar();
  a.matIniciar();

  /* ---- 1: a linha de origem ---- */
  {
    const h = a.matParaHtml("Primeiro.\n\n## Título\n- item\n1. passo\n---\n> dica", null, { comLinhas: true });
    ok(/<p data-l="0">Primeiro/.test(h) && /<h4 data-l="2">Título/.test(h) && /<li data-l="3">item/.test(h)
       && /mat-num' data-l="4"/.test(h) && /<hr data-l="5">/.test(h) && /mat-dica" data-l="6"/.test(h), "R1 cada bloco leva a sua linha de origem: " + h);
    ok(!/data-l/.test(a.matParaHtml("Primeiro.\n- item")), "R1a sem pedir, nada muda no desenho (a lei e as prévias usam o mesmo motor)");
  }

  const ch = a.matChave("Leitura", "Rolagem");
  const ramos = [{ id: "a", nome: "A" }, { id: "b", nome: "B" }];
  const texto = "Geral um.\n\nGeral dois.\n\n## Ramo — A\nA um.\n\nA dois.\n\n## Ramo — B\nB um.\n\nB dois.";
  a.matGravar(ch, texto, { disciplina: "Leitura", topico: "Rolagem" });

  /* ---- 1b: o marcador não desloca as linhas ---- */
  {
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos });
    a.matObter(ch).marcador = 3;            /* fim da 1ª linha: o marcador entra depois dela */
    a.matTrocarModo("ler");
    const h = a.$("matLeitura").innerHTML;
    ok(/mat-marcador/.test(h) && /<p data-l="2">Geral dois/.test(h), "R1b a linha do marcador não desloca as outras: " + h.slice(0, 200));
    delete a.matObter(ch).marcador;
    a.matTrocarModo("ler");
    a.matFechar();
  }

  /* ---- 2: o guardado ---- */
  {
    a.matRolGuardar("x", "*", { l: 4, d: 12.6, f: 0.41234 });
    a.matRolGuardar("x", "", { l: 1, d: 0, f: 0.1 });
    a.matRolGuardar("x", "a", { l: null, d: 0, f: 0.5 });
    const g = a.matRolLer().x;
    ok(g["*"].l === 4 && g["*"].d === 13 && g["*"].f === 0.412 && g._geral.l === 1 && g.a.f === 0.5,
       "R2 cada escopo guarda o seu lugar ('' = geral não se confunde com '*' = tudo): " + JSON.stringify(g));
    ok(a.matRolDe("x", "b") === null && a.matRolDe("y", "*") === null, "R2a o que nunca foi lido não tem lugar");
    a.matRolGuardar("x", "a", null);
    ok(a.matRolDe("x", "a") === null && a.matRolDe("x", "*").l === 4, "R2b apagar um lugar não mexe nos outros");
  }

  /* ---- 3: trocar de ramo ---- */
  const painel = a.$("matLeitura");
  /* um painel de 200 px de altura com 1000 px de texto, no alto da tela */
  painel.clientHeight = 200; painel.scrollHeight = 1000; painel._rect = { top: 100, height: 200 };
  const bloco = (l) => painel.querySelector('[data-l="' + l + '"]');
  /* o simulador não mede: por padrão os blocos ficam "fora da vista" e só vale a fração; cada caso põe a medida que quer */
  const semMedida = () => painel.querySelectorAll("[data-l]").forEach((b) => { b._rect = { top: -5000, height: 0 }; });
  const ir = (e) => { a.matEscopoEscolher(e); semMedida(); };
  {
    a.loja.removeItem(a.MAT_ROL_CHAVE);
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos });
    semMedida();
    ok(a.matEscopoAtual() === "*" && painel.scrollTop === 0, "R3 a primeira leitura começa do início");
    /* rolou 300 px: o 1º bloco (linha 0) já passou; o da linha 2 está pela metade no alto */
    painel.scrollTop = 300;
    bloco(0)._rect = { top: -200, height: 100 };
    bloco(2)._rect = { top: -100, height: 250 };
    ir("a");
    const g = a.matRolDe(ch, "*");
    ok(g && g.l === 2 && g.d === 200 && g.f === 0.375, "R3a trocar de ramo guarda o lugar do 'Tudo': o parágrafo do alto (linha 2) e 200 px dele: " + JSON.stringify(g));
    ok(painel.scrollTop === 0 && /A um/.test(painel.innerHTML) && !/Geral um/.test(painel.innerHTML), "R3b o ramo A nunca lido abre no INÍCIO (antes: no ponto em que o outro parou)");
    painel.scrollTop = 400;
    ir("b");
    ok(a.matRolDe(ch, "a").f === 0.5 && painel.scrollTop === 0, "R3c o ramo B também começa do início; o A ficou guardado na metade");
    ir("a");
    ok(painel.scrollTop === 400, "R3d voltar ao ramo A volta à metade: " + painel.scrollTop);
    /* voltar ao Tudo: o bloco da linha 2 é desenhado 300 px abaixo do alto (com a rolagem em 0) */
    a.matEscopoEscolher("*");
  }

  /* ---- 3f: o lugar é o parágrafo, não o pixel ---- */
  {
    bloco(2)._rect = { top: 400, height: 250 };
    a.matRolAplicar(painel, a.matRolDe(ch, "*"));
    ok(painel.scrollTop === 500, "R3f vai ao parágrafo guardado (300 até ele + 200 dentro dele), não à fração (0,375 = 300): " + painel.scrollTop);
    semMedida();
    a.matRolAplicar(painel, { l: 99, d: 0, f: 0.25 });
    ok(painel.scrollTop === 200, "R3g a linha não existe mais (texto editado) e não há bloco depois: usa a fração: " + painel.scrollTop);
    a.matRolAplicar(painel, null);
    ok(painel.scrollTop === 0, "R3h sem lugar guardado: início");
    /* a janela em escala (transform 0,97): a tela mede 97% da distância de layout — a medida é convertida */
    painel.offsetHeight = 200; painel._rect = { top: 100, height: 194 };
    bloco(2)._rect = { top: 100 + 291, height: 250 };
    a.matRolAplicar(painel, { l: 2, d: 200, f: 0 });
    ok(Math.round(painel.scrollTop) === 500, "R3h2 com a janela em escala a volta ao parágrafo desfaz a escala (291 na tela = 300 de rolagem): " + painel.scrollTop);
    painel.scrollTop = 500;
    bloco(2)._rect = { top: 100 - 194, height: 250 };
    bloco(0)._rect = { top: -5000, height: 0 };
    const mEsc = a.matRolMedir(painel);
    ok(mEsc.l === 2 && Math.round(mEsc.d) === 200, "R3h3 e a medida também (194 na tela = 200 de layout): " + JSON.stringify(mEsc));
    delete painel.offsetHeight; painel._rect = { top: 100, height: 200 };
    semMedida();
  }

  /* ---- 3i: editar e fechar não apagam o lugar ---- */
  {
    ir("a");
    painel.scrollTop = 160;
    a.matTrocarModo("editar");
    ok(a.matRolDe(ch, "a").f === 0.2, "R3i ir editar guarda o lugar do ramo (antes de esconder a leitura): " + JSON.stringify(a.matRolDe(ch, "a")));
    painel.scrollTop = 0;                 /* escondida, a leitura lê 0 */
    a.matTrocarModo("editar");
    ok(a.matRolDe(ch, "a").f === 0.2, "R3j com a leitura escondida nada é gravado (ela leria 0): " + JSON.stringify(a.matRolDe(ch, "a")));
    painel.scrollTop = 0;
    a.matTrocarModo("ler");
    ok(painel.scrollTop === 160, "R3k voltar a ler volta ao lugar: " + painel.scrollTop);
    semMedida();
    painel.scrollTop = 240;
    a.matFechar();
    ok(a.matRolDe(ch, "a").f === 0.3 && a.$("dlgMaterial").open === false, "R3l fechar guarda o lugar antes de fechar");
    painel.scrollTop = 0;
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos, ramo: "a" });
    ok(painel.scrollTop === 240, "R3m reabrir o tópico no ramo A volta ao lugar: " + painel.scrollTop);
    semMedida();
    /* a rolagem é lida também ao rolar (Esc fecha sem passar por matFechar) */
    painel.scrollTop = 80;
    const ouv = (painel._ouv && painel._ouv.scroll) || [];
    ouv.forEach((f) => f({}));
    ok(ouv.length >= 1 && a.matRolDe(ch, "a").f === 0.1, "R3n rolar grava o lugar: " + JSON.stringify(a.matRolDe(ch, "a")));
    /* fechada por fora (Esc, outra janela por cima): a leitura fechada lê 0 — reabrir não pode gravar esse 0 por cima */
    a.$("dlgMaterial").open = false;
    painel.scrollTop = 0;
    a.matAbrirEditor({ disciplina: "Leitura", nome: "Rolagem", chave: ch }, "ler", { ramos, ramo: "a" });
    ok(a.matRolDe(ch, "a").f === 0.1 && painel.scrollTop === 80, "R3o com a janela fechada nada é gravado (ela leria 0): " + JSON.stringify(a.matRolDe(ch, "a")) + " " + painel.scrollTop);
    semMedida();
  }

  /* ---- 4: a letra muda, o parágrafo fica ---- */
  {
    ir("*");
    painel.scrollTop = 300;
    bloco(0)._rect = { top: -200, height: 100 };
    bloco(2)._rect = { top: -100, height: 250 };
    /* depois da letra maior o mesmo bloco fica noutro lugar (o simulador não reflui: a posição nova é a do retângulo) */
    a.matRolManter(() => { bloco(2)._rect = { top: 150, height: 300 }; });
    ok(painel.scrollTop === 150 - 100 + 200, "R4 mudar a letra mantém o parágrafo do alto (e o ponto dentro dele): " + painel.scrollTop);
    /* o A+ de verdade: com a letra maior, o parágrafo da linha 2 desce (400 px × 17/15); a medida acompanha a rolagem */
    const posDe = (base) => () => { const y = base * a.matFonteAtual() / 15; const top = 100 + y - painel.scrollTop; return { top, bottom: top + 250, left: 0, right: 0, width: 0, height: 250 }; };
    a.matFonteZerar();
    bloco(0).getBoundingClientRect = () => ({ top: 100 - painel.scrollTop, bottom: 200 - painel.scrollTop, left: 0, right: 0, width: 0, height: 100 });
    bloco(2).getBoundingClientRect = posDe(400);
    painel.scrollTop = 500;
    a.$("btnMatMaior").onclick();
    ok(a.matFonteAtual() === 17 && painel.scrollTop === Math.round(400 * 17 / 15 + 100) || Math.abs(painel.scrollTop - (400 * 17 / 15 + 100)) < 1,
       "R4a o A+ mantém o parágrafo (desceu para 453 px; ficam os 100 px dentro dele): " + painel.scrollTop);
    a.matFonteZerar();
  }
  a.matFechar();
  return falhas;
}

module.exports = { testes };
