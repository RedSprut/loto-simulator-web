# Original ceremony artwork

Generated with the built-in `image_gen` tool using the `imagegen` skill; no API/CLI fallback and no external stock photographs. These are fictional illustrated people. Selected project assets are saved here, not only in the generator output directory:

- `hall-portrait.webp` / `hall-wide.webp`: selected original scene frames.
- `hall-portrait-plate.webp` / `hall-wide-plate.webp`: matching edited background plates under the forearm animation layer.

The originals were generated at 1086×1448 and 1672×941, then technically encoded as WebP quality 88. The shipped SVG clips the original forearm, hand and glass as one rigid layer and rotates it at the elbow. The plate removes only the underlying raised forearm. Faces are not warped. No interpolated video or morphing is shipped.

## Prompt set

Portrait scene: original premium 3:4 international banquet, polished cinematic editorial illustration, rich navy/gold Art Deco hall and chandeliers, stage with classical chamber musicians; around 24 distinct adult guests of varied appearance, expressive individually detailed faces and anatomically plausible hands; foreground six distinct people in tuxedos/evening dresses, middle/distant tables with unique groups; two elegant waiters carrying champagne trays organically in the room. White linen, champagne flutes and ice bucket, refined plates/cutlery, small white flowers, candles and restrained canapes. Warm lighting and perspective. No words, UI, lottery balls, logos or watermarks.

Wide scene: use the selected portrait as visual/identity reference; recompose as a wide 16:9 desktop view, camera pulled back, same elegant hall and six foreground guests, two waiters and musicians. Keep clear faces, distinct groups, precise hands and glasses, depth and gold/navy palette. No text/UI/numbers. Request a stable still base frame.

Plate edits (each with its own original as reference): preserve the complete image, exact camera, dimensions, people, faces, lighting, furniture and tableware. Remove only the foreground central dark-haired man's raised right forearm/hand and held flute, retain upper arm/elbow, reconstruct the small revealed tuxedo/shirt/table background. No changes to other hands, glasses or people. Original coordinates: approximately x640–780/y470–610 (wide), x380–495/y610–770 (portrait). Original clipped arm is subsequently overlaid by the renderer.

A separate second-keyframe experiment requested tiny glass/forearm, waiter and applause changes while preserving every identity. Optical-flow interpolation was inspected and rejected because of ghosted glass contours and waiter blur. These trial frames/videos are not project assets.
