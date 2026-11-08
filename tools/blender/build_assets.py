"""Gera os assets 3D do jogo no Blender (bpy, Cycles não é necessário): Bit, módulos do mapa.

Uso:  python3 tools/blender/build_assets.py   (grava em python/anelzero/assets/models/*.glb)
Segue o guia docs/ASSETS_BLENDER.md: escala 1 unidade = 1 célula, Z para cima, origem no chão.
"""

import os

import bpy  # noqa: E402  (importar antes de bmesh)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "python", "anelzero", "assets", "models")


def mat(name, color, metal=0.0, rough=0.5, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def bevel(obj, width=0.02, segments=2):
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def box(name, loc, size, material, rounded=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = [s / 2 for s in size]
    bpy.ops.object.transform_apply(scale=True)
    if rounded:
        bevel(o, rounded)
    o.data.materials.append(material)
    return o


def export(name):
    for o in bpy.context.scene.objects:
        o.select_set(True)
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=False, export_yup=False,
                              export_apply=True)
    return path


def build_bit():
    """Bit: corpo de bloco arredondado, visor escuro na frente (+Y) e antena com ponta luminosa."""
    reset()
    body = mat("bit_corpo", (0.2, 0.9, 1.0), metal=0.2, rough=0.35)
    dark = mat("bit_visor", (0.04, 0.06, 0.09), metal=0.0, rough=0.15)
    glow = mat("bit_luz", (0.5, 1.0, 1.0), emit=3.0)
    box("corpo", (0, 0, 0.45), (0.44, 0.44, 0.9), body, rounded=0.06)
    box("visor", (0, 0.235, 0.62), (0.28, 0.02, 0.16), dark, rounded=0.01)
    box("antena", (0, 0, 1.0), (0.04, 0.04, 0.14), body)
    box("ponta", (0, 0, 1.1), (0.08, 0.08, 0.08), glow, rounded=0.02)
    return export("bit")


def build_piso():
    """Módulo de piso 1×1: placa com bisel, rejunte escuro e uma pequena trilha luminosa."""
    reset()
    base = mat("piso", (0.1, 0.32, 0.3), metal=0.0, rough=0.55)
    grout = mat("rejunte", (0.02, 0.05, 0.05), rough=0.8)
    trace = mat("trilha", (0.5, 1.0, 0.85), emit=1.5)
    box("placa", (0, 0, 0.03), (0.94, 0.94, 0.06), base, rounded=0.012)
    box("rejunte", (0, 0, 0.0), (1.0, 1.0, 0.02), grout)
    box("trilha", (0, 0, 0.065), (0.7, 0.04, 0.01), trace)
    return export("piso")


def build_parede():
    """Módulo de parede 1×1 com altura 1,0: bloco com topo iluminado e friso."""
    reset()
    body = mat("parede", (0.14, 0.3, 0.3), metal=0.1, rough=0.45)
    rim = mat("borda", (0.5, 1.0, 0.85), emit=1.2)
    box("bloco", (0, 0, 0.5), (1.0, 1.0, 1.0), body, rounded=0.03)
    box("borda", (0, 0, 1.005), (0.9, 0.9, 0.01), rim)
    return export("parede")


def build_canto():
    """Módulo de canto 1×1: parede em L, para fechar cantos do mapa."""
    reset()
    body = mat("canto", (0.14, 0.3, 0.3), metal=0.1, rough=0.45)
    rim = mat("borda", (0.5, 1.0, 0.85), emit=1.2)
    box("parte_a", (0, -0.25, 0.5), (1.0, 0.5, 1.0), body, rounded=0.03)
    box("parte_b", (-0.25, 0, 0.5), (0.5, 0.5, 1.0), body, rounded=0.03)
    box("borda", (0, 0, 1.005), (0.9, 0.9, 0.01), rim)
    return export("canto")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fn in (build_bit, build_piso, build_parede, build_canto):
        print("ASSET", fn.__name__, fn())
