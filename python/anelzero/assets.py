"""Carregador de assets 3D (.glb feitos no Blender). Se o arquivo não existir, quem chama usa o fallback."""

import pathlib

ASSET_DIR = pathlib.Path(__file__).resolve().parent / "assets" / "models"


def asset_path(name):
    return ASSET_DIR / f"{name}.glb"


def has_asset(name):
    return asset_path(name).exists()


def load_model(loader, name):
    """NodePath do modelo .glb, ou None se o arquivo não existir ou não puder ser lido."""
    if not has_asset(name):
        return None
    try:
        return loader.loadModel(str(asset_path(name)))
    except Exception:  # arquivo corrompido ou formato inesperado: usa o fallback
        return None
