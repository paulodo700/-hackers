# Teste do pipeline Blender (bpy): módulo de piso com rejunte, parede chanfrada e trilha emissiva.
# Uso: python3 tools/blender/tile_test.py  (grava /tmp/bpytest/tile.png). Requer pip install bpy.
import bpy, math, sys, time
t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 24
sc.render.resolution_x, sc.render.resolution_y = 640, 360
def mat(name, col, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m
floor = mat("floor", (0.07, 0.22, 0.22), 0.5)
grout = mat("grout", (0.01, 0.03, 0.03), 0.9)
wall = mat("wall", (0.12, 0.2, 0.22), 0.4, 0.1)
trace = mat("trace", (0.1, 0.9, 0.85), 0.2)
trace.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (0.1, 0.9, 0.85, 1)
trace.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 2.0
def box(name, loc, size, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object; o.name = name
    o.scale = [s / 2 for s in size]
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new("bevel", 'BEVEL'); bv.width = bevel; bv.segments = 3
    o.data.materials.append(m)
    return o
# piso 2x2 com rejunte
box("grout", (0, 0, -0.02), (2.0, 2.0, 0.04), grout)
for x in (-0.5, 0.5):
    for y in (-0.5, 0.5):
        box("tile", (x, y, 0.0), (0.92, 0.92, 0.06), floor, bevel=0.012)
# parede com topo e trilha
box("wall", (0, -0.5, 0.45), (1.0, 1.0, 0.9), wall, bevel=0.03)
box("trace", (0, -0.5, 0.92), (0.6, 0.06, 0.01), trace)
# câmera e luz
bpy.ops.object.camera_add(location=(2.4, -2.6, 2.2))
cam = bpy.context.active_object
cam.rotation_euler = (math.radians(62), 0, math.radians(43))
sc.camera = cam
bpy.ops.object.light_add(type='SUN', location=(0, 0, 4))
sun = bpy.context.active_object; sun.data.energy = 3.0; sun.rotation_euler = (math.radians(40), 0, math.radians(20))
bpy.ops.object.light_add(type='AREA', location=(0, 0, 3.5)); bpy.context.active_object.data.energy = 60
sc.render.filepath = "/tmp/bpytest/tile.png"
bpy.ops.render.render(write_still=True)
print("RENDER_OK", round(time.time() - t0, 1), "s")
