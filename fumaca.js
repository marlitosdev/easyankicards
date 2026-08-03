# -*- coding: utf-8 -*-
"""
EasyAnkiCards — aplicativo de desktop (Windows/Linux/macOS).

COMO FUNCIONA:
  * A interface é a MESMA da versão web. Para manter o desktop sempre na
    última versão sem reinstalar, ele carrega a interface direto do SITE
    (GitHub Pages) quando há internet; sem internet, usa a cópia local
    embutida (pasta docs/) como reserva.
  * Sobre essa interface, o desktop expõe uma ponte Python ao JavaScript
    (window.pywebview.api). O pywebview injeta essa ponte em QUALQUER
    página carregada — inclusive a do site —, então o botão "Importar
    arquivo" (MarkItDown) FUNCIONA mesmo exibindo a versão da internet.

Execução:  python app.py
Requisitos: pip install pywebview 'markitdown[all]'
Executável: scripts\\build_exe.bat  (gera release\\EasyAnkiCards.exe)
"""

import os
import sys

URL_SITE = "https://marlitosdev.github.io/easyankicards/"


def caminho_recurso(rel):
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return os.path.join(base, rel)
    raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(raiz, rel)


def _humano(nbytes):
    for unidade in ("B", "KB", "MB", "GB"):
        if nbytes < 1024 or unidade == "GB":
            txt = "%.1f %s" % (nbytes, unidade)
            return txt.replace(".0 ", " ")
        nbytes /= 1024.0


def _site_no_ar(timeout=2.5):
    """Verifica rapidamente se o site está acessível (para decidir a fonte)."""
    try:
        import urllib.request
        req = urllib.request.Request(URL_SITE, method="HEAD")
        urllib.request.urlopen(req, timeout=timeout)
        return True
    except Exception:
        return False


class Api:
    """Funções Python expostas ao JavaScript via window.pywebview.api."""

    def __init__(self):
        self._janela = None

    def set_janela(self, janela):
        self._janela = janela

    def escolher_arquivos(self):
        """Abre o seletor nativo (múltiplos) e devolve a lista de caminhos."""
        try:
            import webview
        except Exception:
            return []
        tipos = ("Arquivos suportados (*.pdf;*.docx;*.pptx;*.xlsx;*.csv;*.html;"
                 "*.txt;*.json;*.xml;*.epub)",)
        try:
            arqs = self._janela.create_file_dialog(
                webview.OPEN_DIALOG, allow_multiple=True, file_types=tipos)
        except Exception:
            arqs = self._janela.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=True)
        return list(arqs) if arqs else []

    def converter_um(self, caminho):
        """Converte UM arquivo com MarkItDown. {nome, tamIn, tamOut, texto}|{erro}"""
        try:
            from markitdown import MarkItDown
        except Exception as e:
            return {"erro": "MarkItDown não instalado (pip install 'markitdown[all]'): %s" % e}
        try:
            tam_in = os.path.getsize(caminho)
            texto = MarkItDown().convert_local(caminho).text_content or ""
            return {
                "nome": os.path.basename(caminho),
                "tamIn": _humano(tam_in),
                "tamOut": _humano(len(texto.encode("utf-8"))),
                "texto": texto,
            }
        except Exception as e:
            return {"nome": os.path.basename(caminho), "erro": str(e)}


def main():
    # fonte da interface: site (sempre atualizado) ou cópia local (offline)
    if _site_no_ar():
        fonte = URL_SITE
    else:
        local = caminho_recurso(os.path.join("docs", "index.html"))
        if not os.path.exists(local):
            print("[ERRO] Sem internet e sem cópia local em:", local)
            input("Pressione Enter para sair...")
            return 1
        fonte = local

    try:
        import webview
    except ImportError:
        import webbrowser
        print("pywebview não instalado — abrindo no navegador (sem importar arquivos).")
        webbrowser.open(fonte if fonte.startswith("http") else "file:///" + fonte.replace("\\", "/"))
        return 0

    api = Api()
    janela = webview.create_window("EasyAnkiCards", fonte, width=1180, height=820,
                                   min_size=(820, 600), text_select=True, js_api=api)
    api.set_janela(janela)
    webview.start()
    return 0


if __name__ == "__main__":
    sys.exit(main())
