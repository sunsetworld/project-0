# ============================================================
# make_sprites.py - turns a Blender animation into sprite sheets
#
# For every mesh object in your scene it:
#   1. hides everything else and renders that one object on each frame
#   2. crops the frames to the box the object moves through
#   3. joins the frames side by side into  <object name>-sheet.png
# It also writes parts.json, which tells the web page where each part sits
# and where it can be clicked.
#
# How to run it:
#   1. Save your .blend file inside this project's "blender" folder.
#   2. In Blender, click the Scripting tab at the top of the window.
#   3. Text > Open, choose this file, then press the Run Script button (the
#      play triangle). Blender freezes while it renders. That is normal.
#   4. Look in the "assets" folder for your sheets.
# ============================================================
import bpy
import os
import re
import json
import numpy as np
from mathutils import Vector

# ---------- Settings you can change ----------

FRAME_SIZE = 512                 # the whole scene is rendered this many pixels square
OUTPUT_FOLDER = "//../assets"    # "//" means "next to the .blend file"
VIEW_FROM = (-0.55, -1.0, 0.5)   # where the automatic camera sits (x, y, z)
MARGIN = 1.08                    # breathing room around your object
PADDING = 2                      # spare pixels around each cropped part
CLICK_PADDING = 6                # makes small parts easier to click

# The frames to render come from your timeline's Start and End.

# ---------- 1. Find the parts ----------

scene = bpy.context.scene
render = scene.render
first_frame = scene.frame_start
last_frame = scene.frame_end
frame_numbers = list(range(first_frame, last_frame + 1))

parts = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
if not parts:
    raise RuntimeError("There are no mesh objects to render.")
if not bpy.data.filepath:
    raise RuntimeError("Save your .blend file first, inside the project's blender folder.")


def corners(frame):
    """The corners of every part's bounding box on one frame."""
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    return {o.name: [o.matrix_world @ Vector(c) for c in o.bound_box] for o in parts}


at_start = corners(first_frame)
at_end = corners(last_frame)

# A part is "animated" if it is somewhere else by the last frame
animated = {}
for part in parts:
    moved = max((a - b).length for a, b in zip(at_start[part.name], at_end[part.name]))
    animated[part.name] = moved > 0.0001

# ---------- 2. Camera: use yours, or make one that fits everything ----------

if scene.camera is None:
    points = [p for name in at_start for p in at_start[name] + at_end[name]]
    centre = sum(points, Vector()) / len(points)
    view = Vector(VIEW_FROM).normalized()

    cam_data = bpy.data.cameras.new("SpriteCamera")
    cam_data.type = "ORTHO"   # orthographic: no perspective, like classic game art
    cam = bpy.data.objects.new("SpriteCamera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = centre + view * 20
    cam.rotation_euler = (-view).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    bpy.context.view_layer.update()

    # Measure everything from the camera's point of view, then centre and zoom to fit
    to_camera = cam.matrix_world.inverted()
    seen = [to_camera @ p for p in points]
    min_x, max_x = min(p.x for p in seen), max(p.x for p in seen)
    min_y, max_y = min(p.y for p in seen), max(p.y for p in seen)
    cam.location += cam.matrix_world.to_3x3() @ Vector(((min_x + max_x) / 2, (min_y + max_y) / 2, 0))
    cam_data.ortho_scale = max(max_x - min_x, max_y - min_y) * MARGIN
    bpy.context.view_layer.update()

# ---------- 3. Light: use yours, or add a sun and a soft white sky ----------

if not any(o.type == "LIGHT" for o in scene.objects):
    sun_data = bpy.data.lights.new("SpriteSun", "SUN")
    sun_data.energy = 3.0
    sun = bpy.data.objects.new("SpriteSun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = Vector((0.35, -0.8, -1.0)).to_track_quat("-Z", "Y").to_euler()

    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    sky = scene.world.node_tree.nodes.get("Background")
    if sky:
        sky.inputs["Color"].default_value = (1, 1, 1, 1)
        sky.inputs["Strength"].default_value = 0.6

# ---------- 4. Render settings ----------

render.resolution_x = FRAME_SIZE
render.resolution_y = FRAME_SIZE
render.resolution_percentage = 100
render.film_transparent = True                 # no background, so parts can overlap
render.image_settings.file_format = "PNG"
render.image_settings.color_mode = "RGBA"      # the A is the transparency
scene.view_settings.view_transform = "Standard"   # keeps colours as you picked them

out_dir = bpy.path.abspath(OUTPUT_FOLDER)
os.makedirs(out_dir, exist_ok=True)
temp_path = os.path.join(out_dir, "_temp.png")
old_filepath = render.filepath


def render_frame(frame):
    """Renders one frame and returns its pixels, with row 0 at the top."""
    scene.frame_set(frame)
    render.filepath = temp_path
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(temp_path)
    pixels = np.empty(FRAME_SIZE * FRAME_SIZE * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return pixels.reshape(FRAME_SIZE, FRAME_SIZE, 4)[::-1]


# ---------- 5. Render each part on its own ----------

rendered = {}
for part in parts:
    for other in parts:
        other.hide_render = other is not part
    frames = frame_numbers if animated[part.name] else [first_frame]
    rendered[part.name] = [render_frame(f) for f in frames]
    print("Rendered", part.name, "-", len(frames), "frame(s)")

for part in parts:
    part.hide_render = False
os.remove(temp_path)
render.filepath = old_filepath
scene.frame_set(first_frame)

# ---------- 6. Crop each part to the box it moves through ----------


def used_box(frames):
    """The smallest box (left, top, right, bottom) holding the part on every frame."""
    solid = np.max([f[:, :, 3] for f in frames], axis=0) > 0.02
    rows, columns = np.where(solid)
    if len(rows) == 0:
        return None
    return (max(columns.min() - PADDING, 0), max(rows.min() - PADDING, 0),
            min(columns.max() + PADDING + 1, FRAME_SIZE), min(rows.max() + PADDING + 1, FRAME_SIZE))


boxes = {name: used_box(frames) for name, frames in rendered.items()}
boxes = {name: box for name, box in boxes.items() if box}   # drop parts the camera cannot see
stage_left = min(b[0] for b in boxes.values())
stage_top = min(b[1] for b in boxes.values())
stage_width = max(b[2] for b in boxes.values()) - stage_left
stage_height = max(b[3] for b in boxes.values()) - stage_top

# Stacking order. Parts that stay still go at the back. Moving parts go on top,
# biggest first, so that a small part is never buried under a big part's box.
def area(name):
    left, top, right, bottom = boxes[name]
    return (right - left) * (bottom - top)

order = sorted(boxes, key=lambda name: (animated[name], -area(name)))

# ---------- 7. Save one sheet per part, and parts.json ----------


def click_box(frame, left, top, right, bottom):
    """Where the part actually is on one frame, measured inside its own box."""
    rows, columns = np.where(frame[top:bottom, left:right, 3] > 0.02)
    if len(rows) == 0:
        return {"x": 0, "y": 0, "w": int(right - left), "h": int(bottom - top)}
    x0 = max(int(columns.min()) - CLICK_PADDING, 0)
    y0 = max(int(rows.min()) - CLICK_PADDING, 0)
    x1 = min(int(columns.max()) + CLICK_PADDING + 1, right - left)
    y1 = min(int(rows.max()) + CLICK_PADDING + 1, bottom - top)
    return {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}


layout = []
for name in order:
    left, top, right, bottom = boxes[name]
    part_id = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    strip = np.concatenate([f[top:bottom, left:right] for f in rendered[name]], axis=1)[::-1]

    sheet = bpy.data.images.new(part_id + "-sheet", strip.shape[1], strip.shape[0], alpha=True)
    sheet.pixels.foreach_set(np.ascontiguousarray(strip).ravel())
    sheet.filepath_raw = os.path.join(out_dir, part_id + "-sheet.png")
    sheet.file_format = "PNG"
    sheet.save()
    bpy.data.images.remove(sheet)

    layout.append({
        "id": part_id,
        "x": int(left - stage_left),
        "y": int(top - stage_top),
        "w": int(right - left),
        "h": int(bottom - top),
        "frames": len(rendered[name]),
        # the clickable area when the part is in place, and when it is apart
        "start": click_box(rendered[name][0], left, top, right, bottom),
        "end": click_box(rendered[name][-1], left, top, right, bottom)
    })

with open(os.path.join(out_dir, "parts.json"), "w", encoding="utf-8") as f:
    f.write('{\n  "width": %d,\n  "height": %d,\n  "parts": [\n' % (stage_width, stage_height))
    f.write(",\n".join("    " + json.dumps(item) for item in layout))
    f.write("\n  ]\n}\n")

print("Done:", len(layout), "sheets and parts.json saved in", out_dir)
