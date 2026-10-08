"""VANTA One — deterministic phone asset builder.

Builds the Vanta One phone from the brand reference renders:
  - rounded unibody slab (77 x 160 x 8.9 mm), corner radius 11 mm
  - emissive aurora wallpaper screen + glowing aurora rim band
  - matte ceramic back, stadium camera module (2 lenses + spectral sensor)
  - power/volume keys, USB-C recess, speaker holes, antenna inserts

Outputs (relative to repo root):
  blender/vanta_one.blend          authored scene
  blender/textures/wallpaper.png   generated screen texture
  web/public/vanta_one.glb         web export (Y-up, selected phone only)
  assets/renders/view_*.png        multiview evidence

Run:  blender --background --factory-startup --python create_vanta_phone.py
"""

import json
import math
import os
import random

import bpy
import numpy as np
from mathutils import Vector

# ---------------------------------------------------------------- constants
SEED = 7
random.seed(SEED)
np.random.seed(SEED)

MM = 0.001
W, H, D = 77 * MM, 160 * MM, 8.9 * MM          # body dimensions
CORNER = 11 * MM                               # plan corner radius
SCREEN_W, SCREEN_H = 72.6 * MM, 155.6 * MM     # active glass
SCREEN_R = 9.6 * MM
HALF_D = D / 2.0

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_PATH = os.path.join(REPO, "blender", "vanta_one.blend")
TEX_DIR = os.path.join(REPO, "blender", "textures")
GLB_PATH = os.path.join(REPO, "web", "public", "vanta_one.glb")
RENDER_DIR = os.path.join(REPO, "assets", "renders")
os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)
os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)

# Instrument-panel palette: amber signal + warm ivory (no blue/violet)
AMBER = (0.910, 0.639, 0.239)
IVORY = (0.960, 0.925, 0.860)
VIOLET = AMBER   # retained names, new values — used by wallpaper/rim/stage
CYAN = IVORY


# ------------------------------------------------------------ mesh helpers
def rounded_rect(w, h, r, arc_seg=10):
    """CCW outline of a rounded rectangle centered on origin (XY plane)."""
    pts = []
    for cx, cy, a0 in (
        ( w / 2 - r,  h / 2 - r,   0),
        (-w / 2 + r,  h / 2 - r,  90),
        (-w / 2 + r, -h / 2 + r, 180),
        ( w / 2 - r, -h / 2 + r, 270),
    ):
        for i in range(arc_seg):
            a = math.radians(a0 + i * (90.0 / arc_seg))
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def prism(name, w, h, depth, r, mat=None, z=0.0, arc_seg=10, bevel=0.0,
          bevel_seg=3, uv_planar=True):
    """Extruded rounded rectangle centered at (0,0,z)."""
    pts = rounded_rect(w, h, r, arc_seg)
    n = len(pts)
    zf, zb = z + depth / 2.0, z - depth / 2.0
    verts = [(x, y, zf) for x, y in pts] + [(x, y, zb) for x, y in pts]

    faces = []
    faces.append(tuple(range(n)))                    # front (normal +Z)
    faces.append(tuple(range(2 * n - 1, n - 1, -1))) # back  (normal -Z)
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, n + i, n + j, j))           # side wall (outward)

    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    if uv_planar:
        uvs = mesh.uv_layers.new(name="UVMap")
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                vi = mesh.loops[li].vertex_index
                x, y = verts[vi][0], verts[vi][1]
                uvs.data[li].uv = ((x + w / 2) / w, (y + h / 2) / h)

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True

    if bevel > 0:
        mod = obj.modifiers.new("edge_soften", "BEVEL")
        mod.width = bevel
        mod.segments = bevel_seg
        mod.limit_method = "ANGLE"
    return obj


def ring_prism(name, w_out, h_out, r_out, w_in, h_in, r_in, depth, mat,
               z=0.0, arc_seg=10):
    """Flat band between an outer and inner rounded rectangle."""
    po = rounded_rect(w_out, h_out, r_out, arc_seg)
    pi = rounded_rect(w_in, h_in, r_in, arc_seg)
    n = len(po)
    assert n == len(pi)
    zf, zb = z + depth / 2.0, z - depth / 2.0
    verts = [(x, y, zf) for x, y in po] + [(x, y, zf) for x, y in pi] \
          + [(x, y, zb) for x, y in po] + [(x, y, zb) for x, y in pi]
    faces = []
    for i in range(n):                              # top band
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    for i in range(n):                              # bottom band
        j = (i + 1) % n
        faces.append((2 * n + i, 3 * n + i, 3 * n + j, 2 * n + j))
    for i in range(n):                              # outer + inner walls
        j = (i + 1) % n
        faces.append((i, 2 * n + i, 2 * n + j, j))
        faces.append((n + i, n + j, 3 * n + j, 3 * n + i))
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uvs = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi = mesh.loops[li].vertex_index
            x, y = verts[vi][0], verts[vi][1]
            uvs.data[li].uv = ((x + w_out / 2) / w_out,
                               (y + h_out / 2) / h_out)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj


def cylinder(name, radius, depth, mat, loc=(0, 0, 0), vertices=48,
             bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, vertices=vertices, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    if bevel > 0:
        mod = obj.modifiers.new("edge_soften", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    return obj


def box(name, dims, loc, mat, bevel=0.0, bevel_seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False,
                                   scale=True)
    if mat:
        obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    if bevel > 0:
        mod = obj.modifiers.new("edge_soften", "BEVEL")
        mod.width = bevel
        mod.segments = bevel_seg
        mod.limit_method = "ANGLE"
    return obj


# --------------------------------------------------------------- materials
def principled(name, base, metallic=0.0, rough=0.5, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Coat Weight"].default_value = coat
    return mat


def emission_tex_material(name, img, strength, rough=0.12):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Base Color"].default_value = (0.004, 0.004, 0.01, 1)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = rough
    return mat


# ------------------------------------------------------------ textures
def make_wallpaper(path):
    """Seeded aurora ribbon wallpaper, 512x1024."""
    w, h = 512, 1024
    rng = np.random.default_rng(SEED)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    img = np.zeros((h, w, 3))
    img[..., 0], img[..., 1], img[..., 2] = 0.012, 0.014, 0.03
    violet = np.array(VIOLET)
    cyan = np.array(CYAN)
    for k in range(3):
        amp = rng.uniform(60, 170)
        freq = rng.uniform(260, 620)
        phase = rng.uniform(0, 2 * math.pi)
        sigma = rng.uniform(26, 56)
        drift = rng.uniform(-40, 40) * (yy / h)
        cx = w / 2 + amp * np.sin(2 * math.pi * yy / freq + phase) + drift
        sig = sigma * (1 + 0.35 * np.sin(yy / 90 + k * 1.7))
        inten = np.exp(-((xx - cx) / sig) ** 2)
        t = np.clip(yy / h * 0.9 + k * 0.12 - 0.2, 0, 1)
        col = violet[None, None, :] * (1 - t[..., None]) \
            + cyan[None, None, :] * t[..., None]
        img += col * (inten * 0.55)[..., None]
    # soft global bloom + noise + vignette
    img += np.clip(img - 0.25, 0, 1) * 0.35
    img += rng.normal(0, 0.006, img.shape)
    vd = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    img *= np.clip(1.15 - 0.55 * vd ** 2, 0, 1)[..., None]
    img = np.clip(img, 0, 1)

    rgba = np.dstack([img, np.ones((h, w))]).astype(np.float32)
    image = bpy.data.images.new("vanta_wallpaper", width=w, height=h)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    return image


def make_rim_gradient(path):
    """Horizontal violet->cyan gradient strip for the aurora rim."""
    w, h = 256, 16
    t = np.linspace(0, 1, w)[None, :, None]
    row = (np.array(VIOLET)[None, None, :] * (1 - t)
           + np.array(CYAN)[None, None, :] * t)
    row = np.repeat(row, h, axis=0)
    rgba = np.dstack([row, np.ones((h, w))]).astype(np.float32)
    image = bpy.data.images.new("vanta_rim", width=w, height=h)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    return image


# ------------------------------------------------------------------ build
def build_phone():
    wallpaper = make_wallpaper(os.path.join(TEX_DIR, "wallpaper.png"))
    rim_img = make_rim_gradient(os.path.join(TEX_DIR, "rim.png"))

    frame_mat = principled("Frame · dark titanium", (0.035, 0.035, 0.05),
                           metallic=0.92, rough=0.42)
    back_mat = principled("Back · void ceramic", (0.012, 0.012, 0.018),
                          metallic=0.05, rough=0.28, coat=0.5)
    module_mat = principled("Module · void gloss", (0.008, 0.008, 0.012),
                            metallic=0.15, rough=0.12, coat=0.8)
    screen_mat = emission_tex_material("Screen · aurora", wallpaper, 1.8,
                                       rough=0.25)
    rim_mat = emission_tex_material("Rim · aurora glow", rim_img, 2.4)
    lens_ring_mat = principled("Lens · machined ring", (0.09, 0.09, 0.12),
                               metallic=0.95, rough=0.22)
    lens_glass_mat = principled("Lens · glass", (0.01, 0.03, 0.05),
                                metallic=0.25, rough=0.05, coat=0.6)
    _bsdf = lens_glass_mat.node_tree.nodes.get("Principled BSDF")
    _bsdf.inputs["Emission Color"].default_value = (0.01, 0.05, 0.09, 1)
    _bsdf.inputs["Emission Strength"].default_value = 0.6
    sensor_mat = principled("Sensor · amber", (0.35, 0.18, 0.03),
                            metallic=0.1, rough=0.3)
    port_mat = principled("Port · recess", (0.005, 0.005, 0.008),
                          metallic=0.2, rough=0.6)
    tongue_mat = principled("Port · tongue", (0.25, 0.25, 0.3),
                            metallic=0.8, rough=0.4)
    antenna_mat = principled("Antenna · polymer", (0.16, 0.16, 0.19),
                             metallic=0.0, rough=0.55)

    phone = bpy.data.objects.new("VantaOne", None)
    bpy.context.scene.collection.objects.link(phone)

    body = prism("Body", W, H, D, CORNER, frame_mat, bevel=0.85 * MM)
    body.parent = phone

    back = prism("BackPanel", W - 1.6 * MM, H - 1.6 * MM, 0.6 * MM,
                 CORNER - 0.6 * MM, back_mat, z=-HALF_D + 0.15 * MM,
                 bevel=0.3 * MM)
    back.parent = phone

    # glowing aurora rim: band between body edge and screen edge
    rim = ring_prism("AuroraRim", W - 1.0 * MM, H - 1.0 * MM, CORNER - 0.4 * MM,
                     SCREEN_W - 0.8 * MM, SCREEN_H - 0.8 * MM, SCREEN_R - 0.3 * MM,
                     0.3 * MM, rim_mat, z=HALF_D - 0.25 * MM)
    rim.parent = phone

    screen = prism("Screen", SCREEN_W, SCREEN_H, 0.5 * MM, SCREEN_R,
                   screen_mat, z=HALF_D - 0.05 * MM)
    screen.parent = phone

    # punch-hole selfie camera
    punch = cylinder("SelfiePunch", 1.5 * MM, 0.3 * MM, port_mat,
                     loc=(0, H / 2 - 12 * MM, HALF_D + 0.16 * MM), vertices=32)
    punch.parent = phone

    # camera module — stadium pill, top-left of the back
    mod_w, mod_h = 26 * MM, 64 * MM
    mod_x = -(W / 2) + 5.5 * MM + mod_w / 2
    mod_y = H / 2 - 5.5 * MM - mod_h / 2
    module = prism("CameraModule", mod_w, mod_h, 3.0 * MM, mod_w / 2,
                   module_mat, z=-HALF_D - 1.2 * MM, bevel=0.5 * MM)
    module.location.x, module.location.y = mod_x, mod_y
    module.parent = phone

    for i, ly in enumerate((mod_y + 13 * MM, mod_y - 13 * MM)):
        ring = cylinder(f"Lens{i+1}Ring", 8.1 * MM, 2.4 * MM, lens_ring_mat,
                        loc=(mod_x, ly, -HALF_D - 1.4 * MM), bevel=0.3 * MM)
        barrel = cylinder(f"Lens{i+1}Barrel", 6.5 * MM, 2.8 * MM,
                          port_mat, loc=(mod_x, ly, -HALF_D - 1.5 * MM))
        glass = cylinder(f"Lens{i+1}Glass", 6.0 * MM, 1.0 * MM,
                         lens_glass_mat, loc=(mod_x, ly, -HALF_D - 2.2 * MM),
                         bevel=0.2 * MM)
        for o in (ring, barrel, glass):
            o.parent = phone

    sensor = cylinder("SpectralSensor", 1.7 * MM, 1.2 * MM, sensor_mat,
                      loc=(mod_x, mod_y - 26.5 * MM, -HALF_D - 1.8 * MM))
    sensor.parent = phone

    # side keys (+X edge)
    for name, ky, kh in (("KeyPower", -18 * MM, 18 * MM),
                         ("KeyVolUp", 25 * MM, 12 * MM),
                         ("KeyVolDown", 8 * MM, 12 * MM)):
        key = box(name, (1.2 * MM, kh, 2.6 * MM),
                  (W / 2 + 0.25 * MM, ky, 0.4 * MM), frame_mat,
                  bevel=0.5 * MM)
        key.parent = phone

    # USB-C recess + tongue + speaker holes (bottom edge)
    port = box("USBC_Recess", (8.6 * MM, 1.4 * MM, 2.6 * MM),
               (0, -H / 2 - 0.2 * MM, -0.3 * MM), port_mat, bevel=0.5 * MM)
    tongue = box("USBC_Tongue", (6.2 * MM, 1.0 * MM, 0.9 * MM),
                 (0, -H / 2 - 0.4 * MM, -0.3 * MM), tongue_mat, bevel=0.2 * MM)
    port.parent = phone
    tongue.parent = phone
    for side in (-1, 1):
        for i in range(4):
            hole = cylinder(f"Speaker{side}_{i}", 0.5 * MM, 1.6 * MM,
                            port_mat,
                            loc=(side * (7.5 * MM + i * 2.2 * MM),
                                 -H / 2 - 0.1 * MM, -0.3 * MM),
                            vertices=20)
            hole.rotation_euler.x = math.radians(90)
            hole.parent = phone

    # antenna inserts on left/right frame edges
    for side in (-1, 1):
        for ay in (52 * MM, -52 * MM):
            band = box(f"Antenna{side}_{ay>0}",
                       (1.1 * MM, 7 * MM, D + 0.15 * MM),
                       (side * (W / 2 + 0.05 * MM), ay, 0), antenna_mat,
                       bevel=0.2 * MM)
            band.parent = phone

    return phone


# -------------------------------------------------------------- stage/view
def build_stage():
    stage = bpy.data.collections.new("STAGE")
    bpy.context.scene.collection.children.link(stage)

    world = bpy.data.worlds.new("VantaWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.004, 0.004, 0.012, 1)
    bg.inputs[1].default_value = 0.08
    bpy.context.scene.world = world

    def area(name, loc, color, energy, size):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        stage.objects.link(obj)
        direction = Vector((0, 0, 0.004)) - obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return obj

    area("Key", (0.35, -0.45, 0.70), (0.85, 0.87, 1.0), 6, 1.2)
    area("RimViolet", (-0.50, 0.25, 0.30), VIOLET, 10, 0.8)
    area("RimCyan", (0.50, 0.35, 0.15), CYAN, 10, 0.8)

    ground_mat = principled("Stage · ground", (0.008, 0.008, 0.014),
                            metallic=0.05, rough=0.75)
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0, 0, -0.0046))
    ground = bpy.context.active_object
    ground.name = "StageGround"
    ground.data.materials.append(ground_mat)
    # move ground into STAGE collection
    for c in list(ground.users_collection):
        c.objects.unlink(ground)
    stage.objects.link(ground)

    cam_data = bpy.data.cameras.new("EvidenceCam")
    cam = bpy.data.objects.new("EvidenceCam", cam_data)
    stage.objects.link(cam)
    cam.data.lens = 52
    bpy.context.scene.camera = cam
    return cam


def render_view(cam, name, loc, target=(0, 0, 0.004), res=800):
    cam.location = loc
    direction = Vector(target) - Vector(loc)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.filepath = os.path.join(RENDER_DIR, name + ".png")
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------ explode animation
def explode_offset(obj):
    """Per-part explode translation (meters), or None for static parts."""
    n = obj.name
    if n == "Screen":
        return Vector((0, 0, 0.050))
    if n == "AuroraRim":
        return Vector((0, 0, 0.030))
    if n == "SelfiePunch":
        return Vector((0, 0, 0.090))
    if n == "BackPanel":
        return Vector((0, 0, -0.030))
    if n == "CameraModule":
        return Vector((0, 0, -0.055))
    if n.startswith("Lens") or n == "SpectralSensor":
        return Vector((0, 0, -0.085))
    if n.startswith("Key"):
        return Vector((0.022, 0, 0))
    if n.startswith("USBC") or n.startswith("Speaker"):
        return Vector((0, -0.022, 0))
    if n.startswith("Antenna"):
        return Vector((0.015 if obj.location.x > 0 else -0.015, 0, 0))
    return None


def add_explode_animation(root, frame_end=60):
    """One NLA-tracked clip named 'Explode': assembled -> exploded."""
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = frame_end
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        off = explode_offset(obj)
        if off is None:
            continue
        base = obj.location.copy()
        obj.location = base
        obj.keyframe_insert("location", frame=0)
        obj.location = base + off
        obj.keyframe_insert("location", frame=frame_end)
        # park the action on an NLA track so the glTF exporter merges
        # every part into a single animation clip named "Explode"
        ad = obj.animation_data
        act = ad.action
        ad.action = None
        track = ad.nla_tracks.new()
        track.name = "Explode"
        strip = track.strips.new("Explode", 0, act)
        strip.name = "Explode"
    scene.frame_set(0)


# --------------------------------------------------------------- turntable
def render_turntable(root, cam, frames=240, res=960):
    scene = bpy.context.scene
    cam.location = (0.16, -0.19, 0.14)
    direction = Vector((0, 0, 0.004)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"

    # spin the phone once over the frame range, then render the animation
    root.rotation_mode = "XYZ"
    root.rotation_euler.z = 0.0
    root.keyframe_insert("rotation_euler", frame=0, index=2)
    root.rotation_euler.z = 2 * math.pi
    root.keyframe_insert("rotation_euler", frame=frames, index=2)
    scene.frame_start = 0
    scene.frame_end = frames

    frames_dir = os.path.join(REPO, "assets", "renders", "turntable_frames")
    os.makedirs(frames_dir, exist_ok=True)
    scene.render.filepath = os.path.join(frames_dir, "frame_")

    # keep the phone assembled: mute Explode tracks during the spin
    animated = [o for o in root.children_recursive if o.animation_data]
    for o in animated:
        for tr in o.animation_data.nla_tracks:
            tr.mute = True
    bpy.ops.render.render(animation=True)
    for o in animated:
        for tr in o.animation_data.nla_tracks:
            tr.mute = False
    root.animation_data_clear()
    root.rotation_euler.z = 0.0

    import subprocess
    mp4 = os.path.join(REPO, "web", "public", "vanta_turntable.mp4")
    subprocess.run(
        ["ffmpeg", "-y", "-framerate", "30",
         "-i", os.path.join(frames_dir, "frame_%04d.png"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
         "-movflags", "+faststart", mp4],
        check=True, capture_output=True)
    import shutil
    shutil.copyfile(os.path.join(frames_dir, "frame_0000.png"),
                    os.path.join(REPO, "web", "public", "vanta_poster.jpg"))
    shutil.rmtree(frames_dir)


def tri_metrics(root):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    counts = {}
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        ev = obj.evaluated_get(depsgraph)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        t = len(me.loop_triangles)
        counts[obj.name] = t
        total += t
        ev.to_mesh_clear()
    return total, counts


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    phone = build_phone()
    add_explode_animation(phone)
    cam = build_stage()

    scene = bpy.context.scene
    scene.view_settings.look = "AgX - Medium High Contrast"
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.render.image_settings.file_format = "PNG"
        views = [
            ("view_front", (0.11, -0.135, 0.105)),
            ("view_back", (0.11, 0.135, 0.105)),
            ("view_side", (0.19, 0.0, 0.012)),
        ]
        for name, loc in views:
            render_view(cam, name, loc)
        engine = "BLENDER_EEVEE_NEXT"
    except Exception as exc:                       # pragma: no cover
        print("EEVEE failed, falling back to Cycles:", exc)
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 32
        scene.cycles.use_denoising = True
        for name, loc in views:
            render_view(cam, name, loc)
        engine = "CYCLES"

    total, counts = tri_metrics(phone)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

    bpy.ops.object.select_all(action="DESELECT")
    phone.select_set(True)
    for obj in phone.children_recursive:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=GLB_PATH, export_format="GLB",
                              use_selection=True)

    render_turntable(phone, cam)

    manifest = {
        "asset": "Vanta One",
        "dimensions_m": [W, H, D],
        "triangles_total": total,
        "triangles_by_part": counts,
        "blend": BLEND_PATH,
        "glb": GLB_PATH,
        "animation_clip": "Explode (0-60, scrubbed by scroll on the site)",
        "renders": [os.path.join(RENDER_DIR, n + ".png") for n, _ in views]
                  + [os.path.join(REPO, "web", "public", "vanta_turntable.mp4")],
        "render_engine": engine,
    }
    print("MANIFEST " + json.dumps(manifest))


if __name__ == "__main__":
    main()
