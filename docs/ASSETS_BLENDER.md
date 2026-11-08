# Guia de entrega de assets 3D (Blender → jogo Python)

Este guia vale para personagem, mapa e ícones feitos no Blender pelo seu computador.

## Formato e exportação
- **Formato:** glTF binário (`.glb`), exportado com **Y para cima** desligado (o jogo usa Z para cima, como o Blender por padrão).
- **Escala:** 1 unidade do Blender = 1 unidade do jogo. Uma célula do mapa = 1 × 1.
- **Origem:** no centro da base (pés), no chão, com o eixo Z para cima.
- **Aplicar transformações** (Ctrl+A → Todas as transformações) antes de exportar.
- **Materiais:** Principled BSDF, com cor base, metálico, rugosidade e emissão. Nada de imagens de terceiros.
- **Texturas:** PNG, potência de 2 quando possível (256, 512, 1024).

## Personagem (Bit)
- Altura de cerca de **0,9 unidades** (o modelo atual tem essa escala).
- Frente voltada para **+Y** (o visor fica na frente, em +Y).
- Arquivo: `python/anelzero/assets/models/bit.glb`.
- Orçamento: até **5 000 triângulos**.

## Mapa (módulos de piso, parede e canto)
- Um módulo de piso e um de parede, cada um de **1 × 1** unidade.
- Parede com altura de **1,0** (os prédios da cidade multiplicam essa altura).
- Arquivos: `python/anelzero/assets/models/piso.glb`, `parede.glb`, `canto.glb`.
- Orçamento: até **1 000 triângulos** por módulo.

## Ícones
- Um modelo por ícone, centrado na origem, cabendo num cubo de **1 × 1 × 1**. O jogo renderiza cada um no quadro do ícone.
- Pastas: `python/anelzero/assets/models/itens/` (um `.glb` por item, nome igual ao id do item, ex.: `capacitor_filtro.glb`) e `python/anelzero/assets/models/ferramentas/` (ex.: `reparo_cache.glb`).

## Regras
- Nada de logotipos ou marcas de terceiros (inclusive de processadores reais).
- Modelo original, feito por você ou com ferramentas próprias.
- Nomes de arquivo em minúsculas, sem acentos e sem espaços.

## Como entregar
- Coloque os `.glb` nas pastas acima e me avise. Eu carrego no jogo, comparo com os modelos atuais e registro no GDD.
- Ou me envie os arquivos pelo chat, que eu copio para o repositório.
