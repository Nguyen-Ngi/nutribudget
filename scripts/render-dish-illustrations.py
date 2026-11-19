"""Draw editorial ingredient illustrations. Requires Pillow for offline asset authoring."""
import hashlib
import json
import math
import random
import subprocess
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 640, 400
PALETTES = [
    ("#eee1cc", "#b27754"), ("#e9e6d3", "#748369"),
    ("#eddacb", "#aa6b5d"), ("#e7ded0", "#838b72"),
    ("#e8e3cf", "#ba8458"), ("#dbe5d5", "#799276"),
]
# Each ingredient has a food-specific shape vocabulary and color.
STYLES = {
    "white-rice": ("grain", "#f5e9c7"), "brown-rice": ("grain", "#aa7952"),
    "sticky-rice": ("grain", "#e1bc69"), "rice-noodles": ("noodle", "#f4e9c6"),
    "vermicelli": ("noodle", "#fff0c7"), "glass-noodles": ("noodle", "#dce0cd"),
    "thick-noodles": ("thick", "#fff0d4"), "wheat-noodles": ("noodle", "#e5aa48"),
    "baguette": ("bread", "#c78337"), "egg": ("egg", "#f3b342"),
    "chicken": ("chunk", "#d38a57"), "pork": ("chunk", "#ae6250"),
    "beef": ("chunk", "#824635"), "pork-hock": ("chunk", "#bd7d62"),
    "tilapia": ("fish", "#b66d40"), "shrimp": ("shrimp", "#e89073"),
    "crab": ("chunk", "#bf704b"), "tofu": ("cube", "#e8ba72"),
    "mung-beans": ("bean", "#d5a94e"), "peanuts": ("bean", "#a76543"),
    "water-spinach": ("stem", "#426b46"), "cabbage": ("leaf", "#95a863"),
    "carrot": ("cube", "#e18546"), "cucumber": ("slice", "#7a9b59"),
    "tomato": ("wedge", "#ca6044"), "pumpkin": ("cube", "#e5a247"),
    "oyster-mushroom": ("fan", "#a67b61"), "bean-sprouts": ("sprout", "#eee0b7"),
    "spring-onion": ("herb", "#557b47"), "garlic": ("bean", "#ecdaa7"),
    "lemongrass": ("herb", "#9a9c65"), "lime": ("wedge", "#a6b55d"),
    "daikon": ("cube", "#f0e1ba"), "ginger": ("bean", "#d4a867"),
    "chili": ("herb", "#c05335"), "star-anise": ("star", "#875339"),
}

def shade(color, delta):
    return tuple(max(0, min(255, value + delta)) for value in ImageColor.getrgb(color))

def ingredient(draw, shape, color, x, y, size, angle):
    def point(u, v):
        return (x + size * (u * math.cos(angle) - v * math.sin(angle)),
                y + size * (u * math.sin(angle) + v * math.cos(angle)))

    def polygon(points, fill):
        draw.polygon([point(*entry) for entry in points], fill=fill)

    def stroke(points, fill, width):
        draw.line([point(*entry) for entry in points], fill=fill, width=width, joint="curve")

    def oval(rx, ry, fill, dx=0, dy=0):
        polygon([(dx + rx * math.cos(i * math.tau / 32), dy + ry * math.sin(i * math.tau / 32))
                 for i in range(32)], fill)

    light, dark = shade(color, 20), shade(color, -25)
    if shape in {"noodle", "thick", "sprout", "stem", "herb"}:
        points = [(u / 20 - 1, .20 * math.sin(u / 4)) for u in range(41)]
        stroke(points, dark, max(2, round(size * .22)))
        stroke([(u, v - .05) for u, v in points], color, max(1, round(size * (.16 if shape != "thick" else .26))))
        if shape in {"stem", "sprout", "herb"}:
            oval(.38, .19, light, .72, -.06)
            if shape == "stem":
                oval(.39, .21, color, -.29, .18)
    elif shape in {"cube", "chunk"}:
        polygon([(-.8,-.45),(-.15,-.73),(.72,-.39),(.8,.43),(.09,.71),(-.79,.38)], dark)
        polygon([(-.8,-.45),(-.15,-.73),(.72,-.39),(.12,.17),(-.79,.38)], color)
        stroke([(-.63,-.35),(-.12,-.56),(.43,-.36)], light, 2)
    elif shape in {"egg", "slice", "bread", "fish"}:
        oval(1, .62 if shape in {"bread","fish"} else .8, dark)
        oval(.92,.55 if shape in {"bread","fish"} else .72, "#fff2d5" if shape == "egg" else color)
        if shape == "egg":
            oval(.38,.38,color,.13,-.05)
            oval(.28,.27,light,.16,-.10)
        elif shape == "slice":
            oval(.66,.44,light)
            for u in [-.3, 0, .3]:
                oval(.045,.09,"#f3e6be",u)
        else:
            for u in [-.48,-.03,.43]:
                stroke([(u-.10,-.21),(u+.07,.17)], light if shape == "bread" else dark, 3)
    elif shape in {"wedge", "fan"}:
        polygon([(-.94,.50),(-.71,-.14),(-.39,-.55),(.05,-.74),(.55,-.59),(.91,-.12),(.19,.72)], dark)
        polygon([(-.74,.40),(-.62,-.06),(-.27,-.47),(.13,-.56),(.63,-.4),(.73,-.11),(.14,.51)], color)
        for u in [-.44,-.04,.36]:
            stroke([(.14,.40),(u,-.32)],light,2)
    elif shape == "shrimp":
        points = [(math.cos(t)*.76, math.sin(t)*.70) for t in [i * .15 for i in range(33)]]
        stroke(points,dark,max(3,round(size*.38)))
        stroke(points,color,max(2,round(size*.29)))
        for k in range(3,26,5):
            u,v=points[k]
            stroke([(u*.85,v*.85),(u*1.14,v*1.14)],light,2)
    elif shape == "star":
        polygon([(math.cos(i*math.pi/5)*(1 if i%2==0 else .36),
                  math.sin(i*math.pi/5)*(1 if i%2==0 else .36)) for i in range(10)],color)
    else:
        oval(.97,.39 if shape=="grain" else .60,dark)
        oval(.88,.29 if shape=="grain" else .51,color,0,-.06)
        stroke([(-.48,-.10),(.24,-.16)],light,1)

def render(recipe, target):
    digest = int.from_bytes(hashlib.sha256(recipe["id"].encode()).digest()[:8], "big")
    rng = random.Random(digest)
    background, rim = PALETTES[digest % len(PALETTES)]
    image = Image.new("RGB", (WIDTH, HEIGHT), background)
    draw = ImageDraw.Draw(image)
    # Grain follows the canvas; the plate and food are structured by the dish.
    for _ in range(12500):
        x, y = rng.randrange(WIDTH), rng.randrange(HEIGHT)
        draw.point((x,y), fill=shade(background, rng.choice([-5,-3,3,5])))
    cx, cy = 320, 197
    rx, ry = (166,164) if recipe["soup"] else (193,155)
    draw.ellipse((cx-rx+8,cy-ry+12,cx+rx+8,cy+ry+12), fill=shade(background,-25))
    draw.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill="#faf1da",outline=rim,width=4)
    draw.ellipse((cx-rx+12,cy-ry+12,cx+rx-12,cy+ry-12),outline=rim,width=2)
    contents = "#b77a47" if recipe["soup"] else "#eee0c2"
    if recipe["soup"] and any(item["ingredientId"]=="tomato" for item in recipe["ingredients"]):
        contents = "#bd7247"
    draw.ellipse((cx-rx+32,cy-ry+32,cx+rx-32,cy+ry-32),fill=contents,outline=shade(contents,-15),width=2)
    draw.arc((cx-rx+38,cy-ry+38,cx+rx-38,cy+ry-38),195,280,fill=shade(contents,16),width=3)
    used = [(item, STYLES[item["ingredientId"]]) for item in recipe["ingredients"] if item["ingredientId"] in STYLES]
    used.sort(key=lambda row: row[1][0] not in {"grain", "noodle", "thick", "bread"})
    size_by_shape = {"bread": (74, 88), "fish": (46, 61), "egg": (25, 35), "grain": (3, 6),
                     "noodle": (24, 47), "thick": (23, 44), "stem": (20, 36), "herb": (7, 13)}
    for index, (item, (shape, color)) in enumerate(used):
        quantity = item["quantity"]
        base = shape in {"grain", "noodle", "thick", "bread"}
        garnish = quantity < 20 and shape not in {"egg", "shrimp"}
        wide = base or recipe["soup"] or len(used) < 4
        spread_x, spread_y = (108, 79) if wide else (65, 51)
        if shape == "grain":
            count = 680
        elif shape in {"noodle", "thick"}:
            count = 92
        elif shape == "bread":
            count, spread_x, spread_y = 2, 25, 34
        elif shape == "fish":
            count, spread_x, spread_y = 2, 39, 38
        elif shape == "egg":
            count = min(4, max(1, round(quantity)))
        elif garnish:
            count = min(16, max(5, round(quantity)))
        else:
            count = min(46, max(8, round(quantity / 3)))
        rotation = index * 2.4 + (digest % 9) * .34
        bounds = size_by_shape.get(shape, (11, 23))
        for piece in range(count):
            angle = rng.uniform(0, math.tau)
            radius = math.sqrt(rng.random())
            x = cx + math.cos(angle) * radius * spread_x
            y = cy + math.sin(angle) * radius * spread_y
            if shape == "bread":
                y = cy + (piece - .5) * 44
            elif not wide and not garnish:
                x += 52 * math.cos(rotation)
                y += 45 * math.sin(rotation)
            size = rng.uniform(*bounds)
            if garnish:
                size *= .7
            tilt = -.38 + rng.uniform(-.12, .12) if shape == "bread" else rng.uniform(-math.pi, math.pi)
            ingredient(draw, shape, color, x, y, size, tilt)
    image.save(target,"WEBP",quality=84,method=6)

def main():
    manifest = json.loads((ROOT / "src/data/meals/dishArt.json").read_text())
    metadata = subprocess.check_output(["node","--input-type=module","-e", """
      import { recipes } from './src/data/meals/recipes.ts';
      const soup = /^(chao-|canh-|hu-tieu|bun-bo-hue|bun-rieu|bo-kho|pho-|mien-|banh-canh|bun-ca)/;
      console.log(JSON.stringify(recipes.map(({id,ingredients})=>({id,ingredients,soup:soup.test(id)}))));
    """], cwd=ROOT)
    recipes=json.loads(metadata)
    for recipe in recipes:
        entry=manifest[recipe["id"]]
        if entry["kind"]=="illustration":
            target=ROOT / "public" / entry["file"]
            target.parent.mkdir(parents=True,exist_ok=True)
            render(recipe,target)

if __name__=="__main__":
    main()
