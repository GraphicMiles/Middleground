# Ground materials

The ground palette draws on Namibian desert surfaces, Etosha grassland and pan margins, and Okavango floodplain soils.

## References

National Geographic's *Namibia's Landscape Safari* shows red dunes, pale Deadvlei clay, sandy plains, and ochre rock landscapes. These references guide the contrast between light ground and darker vegetation. [5](https://www.nationalgeographic.com/travel/article/namibias-landscape-safari)

The Etosha reference describes pale grasslands, clay and dust around the pan, and reddish-brown soils in the western landscape. [1](https://www.etoshanationalpark.org/)

*Soils of the Okavango River Basin* describes Kalahari sands, flood-deposited clay and silt, and organic deposits around swamp margins. Sections 2.4 and 2.5 of the February 1998 report cover river terraces, floodplains, the Panhandle, and the Delta. [1](https://the-eis.com/elibrary/sites/default/files/downloads/literature/Soils%20of%20the%20Okavango%20River%20Basin.pdf)

## Palette

Values are display RGB starting colours. The build converts them to linear light before rendering.

| Surface | RGB | Material response |
| --- | --- | --- |
| Sand | 0.62, 0.55, 0.44 | Matte, fine surface detail |
| Grey sand | 0.56, 0.53, 0.47 | Neutral floodplain soil |
| Ochre soil | 0.53, 0.40, 0.28 | Warm mineral patches |
| Clay crust | 0.67, 0.63, 0.54 | Fine cracks in dry patches |
| Loam | 0.36, 0.32, 0.25 | Darker soil under grass cover |
| Silt | 0.44, 0.42, 0.35 | Fine flood deposits above the water table |
| Damp mud | 0.235, 0.205, 0.165 | Smooth, darker surface |
| Submerged bed | 0.145, 0.145, 0.125 | Muted sand and silt |

Height, moisture, slope, and seeded mineral fields control the material mixture. The wet-ground blend lowers roughness and reduces normal detail. Dry clay receives a fine crack mask that fades with distance.

## Texture maps

`scripts/bake_ground.py` generates two original 256 x 256 maps:

- `ground-detail.png`: mineral variation in red, grit in green, and cracks in alpha.
- `ground-normal.png`: surface relief from sand, grit, and small ripples.

The maps repeat in world space and use mip filtering. Terrain heights, collisions, and walking behaviour come from the base simulation.

HIGH uses the physical ground material. LOW uses a Lambert material. AUTO selects between them as graphics quality changes.
