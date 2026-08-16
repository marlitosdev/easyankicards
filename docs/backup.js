/* =====================================================================
 * BACKUP — um arquivo único para o aplicativo inteiro
 *
 * Regras que este arquivo existe para garantir:
 *  1. UM arquivo, todos os modos. Backup dividido é backup que se restaura
 *     pela metade e deixa o app num estado que ninguém conhecia.
 *  2. FORMATO VERSIONADO. Campo desconhecido é ignorado, campo ausente
 *     ganha padrão — é o que permite restaurar hoje um backup de dezembro.
 *  3. NUNCA restaurar sem dizer ANTES o que vai mudar, com os números dos
 *     dois lados.
 *  4. Restauração é tudo-ou-nada.
 * ===================================================================== */

const BK_FORMATO = "backup/1";

/* Tudo que o app guarda, com o papel de cada chave. A lista é explícita de
 * propósito: varrer o localStorage inteiro levaria junto lixo de outras
 * origens e qualquer coisa que um dia alguém guardar sem pensar. */
const BK_CHAVES = {
  cartoes: ["eac_texto", "eac_recortes", "eac_revisados", "eac_hist"],
  edital: ["eac_edital_texto", "eac_edital_progresso", "eac_edital_diario"],
  material: ["eac_resumos"],
  preferencias: ["eac_deck", "eac_titulo", "eac_lang", "eac_theme", "eac_cor",
    "eac_style", "eac_alinha", "eac_2col", "eac_destaque", "eac_gaveta",
    "eac_maisCampos", "eac_modo", "eac_ampliar", "eac_edital_vista"],
};

function bkLer(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}

function montarBackup() {
  const dados = {};
  Object.keys(BK_CHAVES).forEach((grupo) => {
    dados[grupo] = {};
    BK_CHAVES[grupo].forEach((k) => {
      const v = bkLer(k);
      if (v !== null) dados[grupo][k] = v;
    });
  });
  return {
    app: "EasyAnkiCards",
    formato: BK_FORMATO,
    gerado: new Date().toISOString(),
    versao_app: typeof VERSAO === "string" ? VERSAO : "?",
    resumo: resumirBackup(dados),
    dados,
  };
}

/* O resumo vai DENTRO do arquivo. Assim dá para dizer o que tem num backup
 * sem restaurá-lo — que é a pergunta de quem está com dois arquivos na mão
 * e não sabe qual é o bom. */
function resumirBackup(dados) {
  const conta = (txt, re) => (String(txt || "").match(re) || []).length;
  const jsonN = (s) => { try { const o = JSON.parse(s); return Array.isArray(o)
    ? o.length : Object.keys(o || {}).length; } catch (e) { return 0; } };
  const c = (dados.cartoes || {}), e = (dados.edital || {}), m = (dados.material || {});
  return {
    cartoes: conta(c.eac_texto, /^[^\n#].*::/gm),
    bandeja: jsonN(c.eac_recortes),
    disciplinas: conta(e.eac_edital_texto, /^\s*@/gm),
    topicos: conta(e.eac_edital_texto, /^\s*\+/gm),
    progresso: jsonN(e.eac_edital_progresso),
    diario: jsonN(e.eac_edital_diario),
    resumos: jsonN(m.eac_resumos),
  };
}

function resumoAtual() { return resumirBackup(montarBackup().dados); }

/* Compara o backup com o que está no app AGORA. É o que a tela mostra antes
 * de perguntar "substituir?" — sem isto o usuário decide no escuro. */
function compararBackup(bk) {
  const agora = resumoAtual();
  const dele = (bk && bk.resumo) || resumirBackup((bk && bk.dados) || {});
  const linhas = [];
  const rotulos = {
    cartoes: "cartões", bandeja: "cartões na bandeja",
    disciplinas: "disciplinas", topicos: "tópicos do edital",
    progresso: "tópicos marcados", diario: "registros de estudo",
    resumos: "resumos",
  };
  Object.keys(rotulos).forEach((k) => {
    const a = agora[k] || 0, b = dele[k] || 0;
    if (!a && !b) return;
    linhas.push({ chave: k, rotulo: rotulos[k], agora: a, backup: b,
      perde: b < a, ganha: b > a });
  });
  return { linhas, agora, backup: dele,
    perdeAlgo: linhas.some((l) => l.perde) };
}

function validarBackup(obj) {
  if (!obj || typeof obj !== "object") return "arquivo não é um backup";
  if (obj.app !== "EasyAnkiCards") return "este arquivo não é do EasyAnkiCards";
  if (!obj.dados || typeof obj.dados !== "object") return "backup sem dados";
  /* formato futuro: avisa mas deixa tentar — campo desconhecido é ignorado
   * na restauração, e recusar por número de versão trava quem voltou de um
   * aparelho mais novo */
  return null;
}

/* Tudo-ou-nada: monta o conjunto inteiro primeiro, e só grava depois. Se
 * algo falhar no meio, nada foi escrito. */
function restaurarBackup(bk) {
  const erro = validarBackup(bk);
  if (erro) throw new Error(erro);
  const aplicar = [];
  Object.keys(BK_CHAVES).forEach((grupo) => {
    const g = bk.dados[grupo] || {};
    BK_CHAVES[grupo].forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(g, k)) aplicar.push([k, g[k]]);
    });
  });
  if (!aplicar.length) throw new Error("backup vazio");
  aplicar.forEach(([k, v]) => {
    try { localStorage.setItem(k, v); } catch (e) {}
  });
  return aplicar.length;
}

function nomeArquivoBackup() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return "easyankicards-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
    + "-" + p(d.getHours()) + p(d.getMinutes()) + ".json";
}

/* Idade da base em dias, para o app poder dizer de quando é o que você está
 * usando — a informação que faltava para alguém perceber que abriu o app num
 * aparelho onde o backup é de três semanas atrás. */
function idadeBase() {
  const q = bkLer("eac_backup_em");
  if (!q) return null;
  const dias = Math.floor((Date.now() - new Date(q).getTime()) / 86400000);
  return { quando: q, dias };
}
