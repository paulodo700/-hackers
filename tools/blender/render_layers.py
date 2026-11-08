"""Renderiza as dez camadas do processador no Blender (Cycles), a partir da mesma grade do jogo.

Uso:  python3 tools/blender/render_layers.py [id_da_camada ...]   (sem argumentos: todas)
Saída: python/anelzero/assets/layers/<id>.png  (requer pip install bpy)

Cada código vira um material físico (cobre, ouro, silício, metal, emissão). As camadas são construídas
com geometria própria, não com imagens de terceiros.
"""

import math
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "python"))

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

from anelzero import layers as L  # noqa: E402

OUT = os.path.join(ROOT, "python", "anelzero", "assets", "layers")
RES = int(os.environ.get("LAYER_RES", "640"))
SAMPLES = int(os.environ.get("LAYER_SAMPLES", "48"))

# código -> (altura, nome do material)
CODE_STYLE = {
    "H": (0.14, "cobre"), "h": (0.16, "cobre_polido"), "R": (0.10, "ouro_emissivo"),
    "B": (0.03, "ouro"), "v": (0.05, "cobre"), "T": (0.10, "prata"), "t": (0.12, "ouro_emissivo"),
    "C": (0.05, "silicio_cache"), "c": (0.07, "silicio_bit"), "x": (0.04, "silicio_cache"),
    "L": (0.05, "silicio_logica"), "d": (0.03, "silicio_escuro"), "E": (0.06, "silicio_exec"),
    "M": (0.06, "silicio_mem"), "P": (0.07, "silicio_energia"), "I": (0.05, "silicio_ponte"),
    "G": (0.02, "substrato"),
}


def make_material(name, color, metallic=0.0, roughness=0.4, emission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if emission:
        b.inputs["Emission Color"].default_value = (*color, 1.0)
        b.inputs["Emission Strength"].default_value = emission
    return m


MATERIALS = {
    "cobre": make_material("cobre", (0.62, 0.36, 0.22), 1.0, 0.38),
    "cobre_polido": make_material("cobre_polido", (0.7, 0.45, 0.3), 1.0, 0.25),
    "ouro": make_material("ouro", (0.66, 0.5, 0.24), 1.0, 0.4),
    "ouro_emissivo": make_material("ouro_emissivo", (1.0, 0.8, 0.3), 1.0, 0.3, emission=2.5),
    "prata": make_material("prata", (0.42, 0.44, 0.47), 1.0, 0.5),
    "silicio_cache": make_material("silicio_cache", (0.12, 0.22, 0.38), 0.05, 0.62),
    "silicio_bit": make_material("silicio_bit", (0.3, 0.55, 0.85), 0.05, 0.62, emission=0.4),
    "silicio_logica": make_material("silicio_logica", (0.2, 0.42, 0.22), 0.05, 0.62),
    "silicio_escuro": make_material("silicio_escuro", (0.05, 0.06, 0.08), 0.05, 0.62),
    "silicio_exec": make_material("silicio_exec", (0.55, 0.38, 0.16), 0.05, 0.62),
    "silicio_mem": make_material("silicio_mem", (0.4, 0.18, 0.5), 0.05, 0.62),
    "silicio_energia": make_material("silicio_energia", (0.62, 0.22, 0.14), 0.05, 0.62),
    "silicio_ponte": make_material("silicio_ponte", (0.25, 0.25, 0.6), 0.05, 0.62),
    "substrato": make_material("substrato", (0.03, 0.1, 0.07), 0.0, 0.55),
}


def add_box(bm, x0, y0, z0, x1, y1, z1, mat_index):
    v = [bm.verts.new(p) for p in (
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    for f in faces:
        face = bm.faces.new([v[i] for i in f])
        face.material_index = mat_index


def build_layer(layer_id):
    rows = L.layer_rows(layer_id)
    n = len(rows)
    mesh = bpy.data.meshes.new(f"layer-{layer_id}")
    obj = bpy.data.objects.new(f"layer-{layer_id}", mesh)
    bpy.context.collection.objects.link(obj)
    names = list(MATERIALS)
    for name in names:
        mesh.materials.append(MATERIALS[name])
    bm = bmesh.new()
    for y, row in enumerate(rows):
        for x, code in enumerate(row):
            h, mat = CODE_STYLE[code]
            add_box(bm, x - 0.46, y - 0.46, 0.0, x + 0.46, y + 0.46, h, names.index(mat))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj.location = (-n / 2, -n / 2, 0)
    return obj


def setup_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = -1.0
    # Câmera em perspectiva, inclinada: a altura dos blocos aparece e as sombras se projetam
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 42
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (-7.0, -36.0, 30.0)
    target = Vector((0, 0, 0))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 1.0
    sun.angle = math.radians(2.0)
    sun.specular_factor = 0.3  # menos brilho especular: some o branco estourado nos metais
    sun_obj = bpy.data.objects.new("sun", sun)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(48), math.radians(14), math.radians(32))
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 50
    fill.size = 12
    fill_obj = bpy.data.objects.new("fill", fill)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.location = (-18, -18, 26)
    fill_obj.rotation_euler = (math.radians(35), 0, math.radians(-45))
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    # Céu procedural do Blender como ambiente: dá reflexo real nos metais
    tree = world.node_tree
    sky = tree.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_elevation = math.radians(38)
    tree.links.new(sky.outputs["Color"], tree.nodes["Background"].inputs["Color"])
    tree.nodes["Background"].inputs["Strength"].default_value = 0.08
    sc.world = world
    return sc


def render_layer(layer_id):
    sc = setup_scene()
    build_layer(layer_id)
    os.makedirs(OUT, exist_ok=True)
    sc.render.filepath = os.path.join(OUT, f"{layer_id}.png")
    bpy.ops.render.render(write_still=True)
    return sc.render.filepath


if __name__ == "__main__":
    ids = sys.argv[1:] or [layer["id"] for layer in L.LAYERS]
    for lid in ids:
        t0 = time.time()
        path = render_layer(lid)
        print("LAYER", lid, round(time.time() - t0, 1), "s ->", path)
