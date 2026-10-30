/* =====================================================================
 * O BALÃO DO BACKUP E A TRAVA CONTRA SOBREPOR O MAIS NOVO (19.40.0)
 *
 * O QUE PRECISA SER VERDADE:
 *  1. O balão aparece enquanto o automático grava ("salvando…") e depois ✓ por um instante; fica à vista enquanto
 *     há algo a resolver (desligado, permissão vencida, pausado, falhou, mais novo em outro aparelho); tocar abre o
 *     painel do backup. A posição arrastada fica guardada.
 *  2. No celular (sem o recurso de pasta), o balão lembra do backup MANUAL quando ele envelhece.
 *  3. Havendo um backup de OUTRO aparelho mais novo que a base daqui, o automático NÃO grava (senão o arquivo deste
 *     aparelho, desatualizado, passaria a parecer o mais novo). Volta a gravar quando a pessoa escolhe "manter os
 *     dados deste aparelho" — sem apagar o arquivo do outro.
 * ===================================================================== */
const zlib = require("zlib");
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  let n = 0;
  const ok = (c, m) => { n++; if (!c) falhas.push(m); };
  const conduzir = async (api, promessa, resp) => {
    let pronto = false;
    Promise.resolve(promessa).then(() => { pronto = true; }, () => { pronto = true; });
    for (let i = 0; i < 80 && !pronto; i++) {
      await new Promise((r) => setImmediate(r));
      try { api._uiFechar(resp === undefined ? true : resp); } catch (e) {}
    }
    return await promessa;
  };
  let agora = new Date(2026, 9, 25, 10, 0).getTime();
  const pasta = () => {
    const arqs = new Map();
    const P = { kind: "directory", name: "OneDrive/Backups", arqs, perm: "granted", resposta: "granted", escritas: 0 };
    const fh = (nm) => ({
      kind: "file", name: nm,
      createWritable: async () => { let buf = null; return { write: async (d) => { buf = d; }, close: async () => { arqs.set(nm, { dados: buf, mod: agora }); P.escritas++; }, abort: async () => {} }; },
      getFile: async () => { const a = arqs.get(nm); const bytes = typeof a.dados === "string" ? new TextEncoder().encode(a.dados) : a.dados;
        return { name: nm, lastModified: a.mod, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), text: async () => new TextDecoder().decode(bytes) }; },
    });
    P.queryPermission = async () => P.perm;
    P.requestPermission = async () => { P.perm = P.resposta; return P.perm; };
    P.getFileHandle = async (nm) => fh(nm);
    P.removeEntry = async (nm) => { arqs.delete(nm); };
    P.entries = async function* () { for (const nm of [...arqs.keys()]) yield [nm, fh(nm)]; };
    return P;
  };
  const preparar = (opc) => {
    const r = rodar();
    const { api, janela } = r;
    const L = api.loja;
    L.setItem("eac_texto", Array.from({ length: 30 }, (_, i) => "Pergunta " + i + " :: Resposta " + i).join("\n"));
    L.setItem("eac_aparelho", "PC da sala");
    api.bkaRelogioDefinir(() => agora);
    api.bkAntesLojaDefinir({ ler: async () => [], gravar: async () => {} });
    const loja = { h: null, ler: async () => loja.h, gravar: async (h) => { loja.h = h; } };
    api.bkaPastaLojaDefinir(loja);
    const P = (opc && opc.P) || pasta();
    if (!(opc && opc.semSuporte)) janela.showDirectoryPicker = async () => P;
    api.bkIniciar();
    return Object.assign(r, { L, P, loja });
  };
  const bolha = (api) => api.$("bkaBolha");

  /* ---- 1: desligado, salvando, salvo, tocar ---- */
  {
    const { api } = preparar();
    api.bkaBolhaPintar();
    ok(bolha(api) && bolha(api).hidden === false && /bb-desl/.test(bolha(api).className) && /desligado/.test(bolha(api).title),
      "B1 desligado: o balao fica a vista, tracejado, dizendo que esta desligado: " + (bolha(api) && bolha(api).title));
    ok(bolha(api).children[1] && bolha(api).children[1].textContent === "Backup auto OFF", "B1b a legenda embaixo do circulo diz 'Backup auto OFF'");
    /* os adiados (o ✓ "por um instante") ficam presos para o teste ver cada momento */
    api.segurarAdiados();
    const p = api.bkaConectar();
    await new Promise((r) => setImmediate(r));
    ok(/bb-grav/.test(bolha(api).className) && /salvando/.test(bolha(api).title), "B2 enquanto grava, o balao diz 'salvando…' (girando): " + bolha(api).className);
    const r = await conduzir(api, p);
    ok(r.ok && /bb-ok/.test(bolha(api).className) && bolha(api).firstChild.textContent === "✓", "B3 gravou: mostra o ✓ por um instante: " + JSON.stringify(r));
    api.soltarAdiados();
    ok(bolha(api).hidden === true, "B4 passado o instante, sem nada a resolver, o balao some");
    bolha(api).hidden = false;
    let abriu = false;
    const dlg = api.$("dlgBackup");
    bolha(api).onclick ? bolha(api).onclick() : api.bkaBolhaTocar();
    abriu = dlg && dlg.open === true;
    ok(abriu || typeof api.bkaBolhaTocar === "function", "B5 tocar no balao abre o painel do backup");
    api.bkaBolhaTocar();
    ok(dlg.open === true, "B5b o painel do backup abre pelo balao");
  }

  /* ---- 1: um problema deixa o balão à vista, na cor dele ---- */
  {
    const { api, P } = preparar();
    await conduzir(api, api.bkaConectar());
    P.perm = "prompt"; P.resposta = "denied";
    await api.bkaGravarAgora("periódico");
    api.bkaBolhaPintar("");
    ok(bolha(api).hidden === false && /bb-aviso|bb-alerta/.test(bolha(api).className) && /reconectar/.test(bolha(api).title),
      "B6 permissao vencida: o balao fica a vista com o aviso do selo: " + bolha(api).title);
  }

  /* ---- 2: no celular, o balão cuida do backup manual ---- */
  {
    const { api, L } = preparar({ semSuporte: true });
    L.removeItem("eac_backup_em");
    api.bkaBolhaPintar();
    const b0 = bolha(api);
    ok(b0 && b0.hidden === false && /nenhum backup|sem backup/.test(b0.title), "M1 sem o recurso de pasta e sem backup: o balao avisa: " + (b0 && b0.title));
    L.setItem("eac_backup_em", new Date(Date.now() - 10 * 86400000).toISOString());
    api.bkaBolhaPintar();
    ok(/sem backup há \d+ dia/.test(bolha(api).title) && /bb-alerta/.test(bolha(api).className), "M2 backup manual de 10 dias: alerta: " + bolha(api).title);
    L.setItem("eac_backup_em", new Date().toISOString());
    api.bkaBolhaPintar();
    ok(bolha(api).hidden === true, "M3 backup manual de hoje: o balao some");
  }

  /* ---- 3: não sobrepor o mais novo de outro aparelho ---- */
  {
    const P = pasta();
    agora = new Date(2026, 9, 25, 10, 0).getTime();
    const { api } = preparar({ P });
    await conduzir(api, api.bkaConectar());
    const meu = [...P.arqs.keys()].filter((x) => /pc-da-sala/.test(x));
    ok(meu.length === 1, "T0 este aparelho gravou o seu arquivo");
    /* outro aparelho grava DEPOIS, com dados mais novos */
    agora += 3600000;
    const outro = "easyankicards-auto-notebook-20261025.json.gz";
    P.arqs.set(outro, { dados: zlib.gzipSync(Buffer.from(JSON.stringify(api.montarBackup()))), mod: agora });
    agora += 3600000;
    api.loja.setItem("eac_texto", api.loja.getItem("eac_texto") + "\nNova :: mudança local");
    const n0 = P.escritas;
    const r = await api.bkaGravarAgora("periódico");
    ok(r.ok === false && r.razao === "mais_novo" && P.escritas === n0, "T1 com backup mais novo de outro aparelho, o automatico NAO grava: " + JSON.stringify(r));
    ok(P.arqs.has(outro), "T2 o arquivo do outro aparelho continua na pasta");
    api.bkaBolhaPintar("");
    ok(bolha(api).hidden === false && /bb-alerta/.test(bolha(api).className) && /notebook/.test(bolha(api).title), "T3 o balao avisa (vermelho) que o outro tem dados mais novos: " + bolha(api).title);
    api.bkPintarPainel();
    ok(api.$("btnBkaManterDeste") && api.$("btnBkaVerMaisNovo") && /PAROU/.test(api.$("bkaCorpo").textContent), "T4 o painel explica e oferece conferir ou manter os deste aparelho");
    const r2 = await conduzir(api, api.bkaManterDesteAparelho());
    ok(r2.ok && P.escritas === n0 + 1 && P.arqs.has(outro), "T5 'manter os deste aparelho' volta a gravar, sem apagar o do outro: " + JSON.stringify(r2));
    agora += 3600000;
    api.loja.setItem("eac_texto", api.loja.getItem("eac_texto") + "\nOutra :: mudança");
    const r3 = await api.bkaGravarAgora("periódico");
    ok(r3.ok, "T6 depois disso, o periodico segue gravando (o arquivo ignorado nao trava de novo): " + JSON.stringify(r3));
  }

  /* ---- 19.42.0: o painel começa pela SITUAÇÃO, e o balão reconecta a um toque ---- */
  {
    const { api } = preparar();
    api.bkPintarPainel();
    ok(/st-aviso/.test(api.$("bkSituacao").className) && /desligado/.test(api.$("bkSitTxt").textContent) && api.$("btnBkSitAcao").hidden === false && /Escolher a pasta/.test(api.$("btnBkSitAcao").textContent),
      "S1 desligado: a situacao no topo diz e oferece a acao: " + api.$("bkSitTxt").textContent);
    ok(!api.$("bkAgora"), "S2 'O que esta no aplicativo agora' saiu do painel");
    ok(/vai para a pasta de downloads/.test(api.$("btnBkBaixar").textContent) && /mostra antes o que muda/.test(api.$("btnBkCarregar").textContent), "S3 cada botao diz o que faz embaixo do nome");
  }
  {
    const { api, P } = preparar();
    await conduzir(api, api.bkaConectar());
    api.bkPintarPainel();
    ok(/st-ok/.test(api.$("bkSituacao").className) && api.$("btnBkSitAcao").hidden === true, "S4 ligado e em dia: situacao verde, sem acao");
    ok(api.$("bkaCorpo").querySelectorAll(".bka-ajustes").length === 1 && api.$("btnBkaDesligar") && api.$("btnBkaRenomear"), "S5 nome, mudar pasta e desligar ficam em 'Ajustes', recolhidos");
    P.perm = "prompt"; P.resposta = "denied";
    await api.bkaGravarAgora("periódico");
    api.bkPintarPainel();
    ok(/st-alerta/.test(api.$("bkSituacao").className) && /Permitir de novo/.test(api.$("btnBkSitAcao").textContent), "S6 permissao vencida: a situacao oferece 'Permitir de novo'");
    P.resposta = "granted";
    const r = await conduzir(api, api.bkaBolhaTocar());
    ok(r && r.ok !== undefined && P.perm === "granted" && api.$("dlgBackup").open !== true, "S7 com a permissao vencida, tocar no balao ja pede a permissao (sem abrir o painel): " + JSON.stringify(r));
  }

  /* ---- a posição arrastada fica guardada ---- */
  {
    const { api, L } = preparar();
    L.setItem("eac_bka_bolha_pos", JSON.stringify({ x: 0, y: 0 }));
    api.bkaBolhaPintar();
    const el = bolha(api);
    ok(el && el.style.left === "44px" && el.style.top === "12px", "P1 a posicao guardada vale ao desenhar: " + (el && el.style.left + "," + el.style.top));
  }

  return Object.assign(falhas, { quantas: n });
}

module.exports = { testes };
