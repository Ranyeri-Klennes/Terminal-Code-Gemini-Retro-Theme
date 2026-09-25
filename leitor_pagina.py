#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
leitor_pagina.py
Leitor de páginas web simples, leve e direto ao ponto.
Extrai o conteúdo principal de um artigo e reproduz a leitura
em voz alta usando a voz neural brasileira realista do Edge-TTS.
"""

import asyncio
import os
import sys
import tempfile
import urllib.parse

# 1. Validação e importação de dependências
try:
    import edge_tts
    import trafilatura
    import pygame
except ImportError as e:
    print(f"\n[ERRO] Dependência ausente: {e.name}")
    print("Por favor, instale as bibliotecas necessárias executando:")
    print("pip install edge-tts trafilatura pygame\n")
    sys.exit(1)


VOZ_PADRAO = "pt-BR-FranciscaNeural"  # Voz neural realista padrão em português


def formatar_url(url: str) -> str:
    """Garante que a URL tenha um esquema válido (http ou https)."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def extrair_texto(url: str) -> tuple[str, str]:
    """
    Faz o scraping da página informada e devolve apenas o título e o texto limpo,
    sem tags HTML residuais, barras de navegação, comentários ou rodapés.
    
    Retorna:
        tuple[str, str]: (titulo, texto_limpo)
    """
    url = formatar_url(url)
    print(f"[*] Acessando página: {url}...")

    # Download do conteúdo da página com trafilatura
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError("Não foi possível carregar a página. Verifique a URL ou sua conexão com a internet.")

    # Extrai metadados (como título)
    metadata = trafilatura.bare_extraction(downloaded)
    titulo = (metadata.title if metadata and metadata.title else "Artigo sem título").strip()

    # Extrai o corpo do texto filtrado (remove menus, propagandas, etc.)
    texto = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=False,
        no_fallback=False
    )

    if not texto or len(texto.strip()) < 30:
        raise ValueError("A página não contém texto principal legível ou possui bloqueio de leitura.")

    return titulo, texto.strip()


def dividir_em_blocos(texto: str, max_chars: int = 700) -> list[str]:
    """
    Divide o texto em blocos de tamanho razoável respeitando quebras
    de parágrafos e pontuação para que o áudio comece a tocar rápido.
    """
    paragrafos = [p.strip() for p in texto.split("\n") if p.strip()]
    blocos = []
    bloco_atual = ""

    for p in paragrafos:
        if len(bloco_atual) + len(p) + 1 <= max_chars:
            bloco_atual = f"{bloco_atual} {p}".strip()
        else:
            if bloco_atual:
                blocos.append(bloco_atual)
            
            # Se o próprio parágrafo for maior que max_chars, quebra por sentenças
            if len(p) > max_chars:
                frases = p.replace(". ", ".\n").split("\n")
                sub_bloco = ""
                for frase in frases:
                    if len(sub_bloco) + len(frase) + 1 <= max_chars:
                        sub_bloco = f"{sub_bloco} {frase}".strip()
                    else:
                        if sub_bloco:
                            blocos.append(sub_bloco)
                        sub_bloco = frase
                if sub_bloco:
                    bloco_atual = sub_bloco
            else:
                bloco_atual = p

    if bloco_atual:
        blocos.append(bloco_atual)

    return blocos


async def sintetizar_bloco(texto_bloco: str, arquivo_saida: str, voz: str = VOZ_PADRAO):
    """Sintetiza um bloco de texto para áudio MP3 utilizando Edge-TTS."""
    comunicador = edge_tts.Communicate(texto_bloco, voz)
    await comunicador.save(arquivo_saida)


async def sintetizar_e_tocar(texto: str, voz: str = VOZ_PADRAO):
    """
    Divide o texto em blocos, gera o áudio neural e reproduz em voz alta
    utilizando pygame.mixer, limpando arquivos temporários ao terminar.
    """
    # Inicializa o mixer do pygame para áudio
    pygame.mixer.init()

    blocos = dividir_em_blocos(texto)
    total_blocos = len(blocos)
    print(f"[*] Texto dividido em {total_blocos} bloco(s) para início rápido da reprodução.\n")

    for idx, bloco in enumerate(blocos, start=1):
        temp_file = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        temp_path = temp_file.name
        temp_file.close()

        try:
            print(f"[{idx}/{total_blocos}] Sintetizando áudio...")
            await sintetizar_bloco(bloco, temp_path, voz)

            print(f"[{idx}/{total_blocos}] Reproduzindo (Pressione Ctrl+C para pausar/sair)...")
            pygame.mixer.music.load(temp_path)
            pygame.mixer.music.play()

            # Aguarda a reprodução do bloco atual terminar
            clock = pygame.time.Clock()
            while pygame.mixer.music.get_busy():
                clock.tick(10)
                await asyncio.sleep(0.1)

            pygame.mixer.music.unload()

        finally:
            # Garante a limpeza do arquivo temporário
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

    print("\n[✔] Leitura finalizada com sucesso!")


async def main():
    print("=" * 60)
    print("        LEITOR DE PÁGINAS WEB (EDGE-TTS NEURAL)       ")
    print("=" * 60)

    try:
        url_input = input("\nCole o link da página que deseja ouvir: ").strip()
        if not url_input:
            print("[!] Nenhuma URL informada. Encerrando.")
            return

        # 1. Extração do conteúdo
        titulo, texto_extraido = extrair_texto(url_input)
        
        print("\n" + "-" * 60)
        print(f"TÍTULO: {titulo}")
        print(f"TAMANHO: {len(texto_extraido)} caracteres (~{len(texto_extraido.split())} palavras)")
        
        # Mostra um pequeno resumo/amostra
        amostra = (texto_extraido[:250] + "...") if len(texto_extraido) > 250 else texto_extraido
        print(f"INÍCIO: \"{amostra}\"")
        print("-" * 60 + "\n")

        # 2. Síntese e reprodução
        await sintetizar_e_tocar(texto_extraido, VOZ_PADRAO)

    except KeyboardInterrupt:
        print("\n\n[!] Reprodução interrompida pelo usuário.")
        try:
            pygame.mixer.music.stop()
            pygame.mixer.quit()
        except Exception:
            pass
    except Exception as erro:
        print(f"\n[ERRO] Ocorreu um problema: {erro}")


if __name__ == "__main__":
    asyncio.run(main())
