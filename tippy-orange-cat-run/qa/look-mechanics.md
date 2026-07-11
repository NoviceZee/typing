# Tippy look mechanics

Tippy is a soft, rounded orange tabby cat. Keep the paws and lower torso anchored while the eyes lead the gaze, followed by a small head turn and ear follow-through. The scarf stays wrapped around the neck and shifts only subtly with the head; the paperclip charm remains attached to the tail and lags slightly through turns. Up/down directions use eye and eyelid placement plus gentle head pitch; left/right directions use visible muzzle, nose, ear occlusion, and head turn. Diagonals interpolate evenly between these pose families. No whole-sprite rotation.

Cardinals in viewer coordinates:
- 000 up: eyes lift, chin slightly up, both ears visible.
- 090 right: nose and muzzle point screen-right; near cheek leads, far cheek is partly occluded.
- 180 down: eyes and chin drop, ears remain stable, upper body compresses subtly.
- 270 left: nose and muzzle point screen-left; near cheek leads, far cheek is partly occluded.

Motion budget: each 22.5-degree step changes gaze, head turn, ear occlusion, and tail follow-through by even small increments while keeping the lower body scale and baseline fixed.
