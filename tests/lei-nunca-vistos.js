/* =====================================================================
 * OS ARTIGOS QUE VOCÊ NUNCA VIU (v18.83.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. "visto" = antes do "parei", capítulo marcado como lido, com cartão,
 *     com questão respondida, com nota ou marcado "já vi"; revogado não
 *     conta; o resto é inédito;
 *  2. três camadas: 🔥 os que caem (questão ou prova), do que mais cai ao
 *     que menos; 🎯 os vizinhos (mesma divisão de um que cai); 📚 o resto;
 *  3. no mapa, o filtro "nunca vistos" mostra as camadas, "✓ já vi" tira
 *     da lista (guardado na lei) e "Estudar os 5 prioritários" abre a fila;
 *  4. a fila: o da vez, "✓ li — próximo" (marca visto e anda), as questões
 *     do artigo, e o fim diz que acabou.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const achar = (el, pred, acc) => { acc = acc || []; Array.from((el && el.children) || []).forEach((c) => { if (pred(c)) acc.push(c); achar(c, pred, acc); }); return acc; };

  const LEI = ["LEI Nº 9.000, DE 2020", "TÍTULO I", "Disposições", "Art. 1º Primeiro.", "Art. 2º Segundo.",
    "CAPÍTULO I", "Tributos", "Art. 3º Terceiro.", "Art. 4º Quarto.", "Art. 5º Quinto.",
    "CAPÍTULO II", "Taxas", "Art. 6º Sexto.", "Art. 7º (Revogado).", "Art. 8º Oitavo.", "Art. 9º Nono.",
    "CAPÍTULO III", "Outros", "Art. 10. Décimo.", "Art. 11. Onze."].join("\n");
  const montar = () => {
    const { api: a } = rodar();
    a.matIniciar(); a.leiIniciar(); a.qsUiIniciar();
    const ch = a.matChave("Direito Tributário", "Tributo");
    a.leiGuardar({ id: "lei_x", nome: "Lei 9.000/2020", especie: "Lei", numero: "9000", ano: "2020", texto: LEI, topicos: [ch], parei: "2",
      notasArtigos: { "10": "nota do décimo" } });
    const Q = (id, en, ts) => ({ id, tipo: "ce", enunciado: en, gabarito: "C", comentario: "", chave: ch, tentativas: ts || [] });
    [Q("a", "Art. 3º da Lei 9.000/2020."), Q("b", "Art. 3º da Lei 9.000/2020, outra."), Q("c", "Art. 6º da Lei 9.000/2020."), Q("e", "Art. 6º da Lei 9.000/2020, mais."), Q("g", "Art. 6º da Lei 9.000/2020, de novo."),
     Q("d", "Art. 4º da Lei 9.000/2020.", [{ acertou: true }])].forEach((q) => a.qsTodas().push(q));
    a.matGravarCartoes(ch, "Oitavo? :: art. 8º da Lei 9.000/2020 :: x", { disciplina: "Direito Tributário", topico: "Tributo" });
    a.leiAbrir("Direito Tributário", "Tributo", "lei_x");
    return { a, ch };
  };

  /* ---- 1 e 2 ---- */
  {
    const { a } = montar();
    const nv = a.leiNuncaVistos(a.leiIrDados());
    const nums = (xs) => xs.map((x) => x.a.num).join(",");
    ok(nv.total === 10 && nums(nv.cobrados) === "6,3", "N1 os que caem e você nunca viu: 6 (3 questões) antes do 3 (2) — pelo quanto cai, não pela ordem da lei; o 4 caiu mas já foi respondido: " + nums(nv.cobrados) + " / total " + nv.total);
    ok(nums(nv.vizinhos) === "5,9", "N2 vizinhos: o 5 (capítulo do 3) e o 9 (capítulo do 6); o 4 respondido, o 8 com cartão, o 7 revogado ficam fora: " + nums(nv.vizinhos));
    ok(nums(nv.resto) === "11" && nv.vistos === 5, "N3 o resto: o 11; vistos: o 1 e o 2 (antes do 'parei'), o 4 (respondido), o 8 (cartão), o 10 (nota): " + nums(nv.resto) + " · vistos " + nv.vistos);
    const pr = a.leiNuncaVistosPrioritarios(nv, 5);
    ok(nums(pr.lista) === "6,3,5,9,11" && pr.min === 5, "N4 os 5 prioritários, na ordem das camadas, e o tempo (≥1 min cada): " + nums(pr.lista) + " " + pr.min);
    /* capítulo marcado como lido e "já vi" */
    a.leiBlocoLido("lei_x", a.leiBlocos(a.leiDe("lei_x").texto)[2].nome, true);
    a.leiArtigoVistoMarcar("lei_x", "11", true);
    const nv2 = a.leiNuncaVistos(a.leiIrDados());
    ok(nums(nv2.cobrados) === "3" && nums(nv2.resto) === "", "N5 o capítulo II marcado como lido tira o 6 e o 9; 'já vi' tira o 11: " + [nums(nv2.cobrados), nums(nv2.vizinhos), nums(nv2.resto)].join(" | "));
  }

  /* ---- 2b: número repetido (corpo × ADCT): a repetição não herda "cai" ---- */
  {
    const { api: a } = rodar();
    a.matIniciar(); a.leiIniciar();
    const ch = a.matChave("Direito Constitucional", "Direitos");
    a.leiGuardar({ id: "lei_cf", nome: "Constituição Federal", especie: "Constituição", numero: "", ano: "1988", topicos: [ch],
      texto: ["TÍTULO I", "Princípios", "Art. 1º A República.", "Art. 5º Todos são iguais.", "ATO DAS DISPOSIÇÕES CONSTITUCIONAIS TRANSITÓRIAS", "Art. 1º O Presidente.", "Art. 5º Não se aplicam."].join("\n") });
    a.qsTodas().push({ id: "z", tipo: "ce", enunciado: "Art. 5º da CF.", gabarito: "C", comentario: "", chave: ch, tentativas: [] });
    a.leiAbrir("Direito Constitucional", "Direitos", "lei_cf");
    const nv = a.leiNuncaVistos(a.leiIrDados());
    ok(nv.cobrados.length === 1 && nv.cobrados[0].a.indice === 1, "N6 o art. 5º repetido (ADCT) não entra nos 'caem': só o do corpo: " + JSON.stringify(nv.cobrados.map((x) => [x.a.num, x.a.indice])));
  }

  /* ---- 3 e 4: na tela ---- */
  {
    const { a } = montar();
    a.leiIrAbrir({ filtro: "ineditos" });
    const g = a.$("leiIrGrade");
    ok(g.textContent.indexOf(a.t("lei_nv_cab", { n: 5, t: 10 })) >= 0, "T1 o cabeçalho conta 5 de 10: " + g.textContent.slice(0, 120));
    const cam = achar(g, (e) => /lei-nv-camada/.test(e.className || ""));
    ok(cam.length === 3 && cam[0].open === true && cam[2].open === false, "T2 três camadas; o resto começa fechado");
    const ja = achar(cam[0], (e) => e.textContent === a.t("lei_nv_ja_vi"))[0];
    ja.onclick();
    ok(a.leiDe("lei_x").artVistos && a.leiDe("lei_x").artVistos["6"] && a.$("leiIrGrade").textContent.indexOf(a.t("lei_nv_cobrados", { n: 1 })) >= 0, "T3 '✓ já vi' guarda na lei e tira da lista");
    a.leiArtigoVistoMarcar("lei_x", "6", false);
    ok(!a.leiDe("lei_x").artVistos["6"], "T3a desmarcar devolve à lista");
    a.leiIrPintar();
    a.$("btnLeiNvEstudar").onclick();
    const fila = a.leiFilaNVAtual();
    ok(fila && fila.itens.map((x) => x.num).join(",") === "6,3,5,9,11" && a.$("dlgLeiIr").open !== true, "T4 'Estudar os 5 prioritários' abre a fila e fecha o mapa");
    const bar = a.$("leiFilaNV");
    ok(bar.hidden === false && bar.textContent.indexOf(a.t("lei_nv_fila", { a: "Art. 6º", i: 1, n: 5 })) >= 0, "T5 a faixa diz o da vez: " + bar.textContent);
    const btQs = achar(bar, (e) => e.textContent === a.t("lei_nv_fila_qs", { n: 3 }))[0];
    ok(!!btQs, "T6 o art. 6º tem 3 questões: botão para respondê-las ali");
    btQs.onclick();
    ok(a.$("dlgQsResponder").open === true && a.qsSessaoAtual().fila.length === 3, "T6a responder abre uma rodada só com as 3 questões do artigo");
    a.$("dlgQsResponder").close();
    achar(bar, (e) => e.textContent === a.t("lei_nv_fila_li"))[0].onclick();
    ok(a.leiDe("lei_x").artVistos["6"] && a.leiFilaNVAtual().i === 1 && bar.textContent.indexOf(a.t("lei_nv_fila", { a: "Art. 3º", i: 2, n: 5 })) >= 0, "T7 '✓ li — próximo' marca o 6 como visto e vai ao 3");
    for (let k = 0; k < 4; k++) a.leiFilaNVProximo();
    ok(a.leiFilaNVAtual().fim === true && bar.textContent.indexOf(a.t("lei_nv_fila_fim", { n: 5 })) >= 0, "T8 no fim, a faixa diz que acabou");
    a.leiFilaNVSair();
    ok(bar.hidden === true, "T9 sair da fila esconde a faixa");
  }
  return falhas;
}

module.exports = { testes };
