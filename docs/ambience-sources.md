# Ambience bed sources

`index.html` embeds three recorded loops in `assets/ambience/`. They are mixed
strictly **underneath** the procedural layer in `src/audio.js`, which still owns
every responsive sound (footsteps, wading, calls, impacts).

## Shipped clips

| File | Role | Source | Author | Licence |
|---|---|---|---|---|
| `bay.ogg` | water / shoreline bed, bass-heavy lapping | [Bayfront.wav](https://commons.wikimedia.org/wiki/File:Bayfront.wav) | Meibnotu | CC BY-SA 4.0 |
| `park.ogg` | daytime air movement + distant birds | [Parkatmo.flac](https://commons.wikimedia.org/wiki/File:Parkatmo.flac) | Burkhard Mücke | CC BY-SA 4.0 |
| `night.ogg` | night insect bed | [Nature sounds ambience in a Dordogne pond.ogg](https://commons.wikimedia.org/wiki/File:Nature_sounds_ambience_in_a_Dordogne_pond.ogg) | Glaneur de sons | CC BY 3.0 |

All three are derived works of the originals (band-limited, compressed,
crossfaded into a loop, RMS-normalised, re-encoded), so the source licences
apply to them.

## Processing

`scripts/make_ambience.py` turns a decoded source into a loop:

1. highpass + lowpass to remove rumble and inaudible HF, light compression;
2. mono, 22050 Hz;
3. pick the steadiest 38 s window in the file (RMS closest to the file median,
   plus a penalty on the sample delta at the loop boundary) so the loop avoids
   transients and clicks;
4. 8 s smoothstep crossfade of tail into head;
5. RMS-normalise every clip to a common -28 dBFS so one set of Web Audio gains
   controls the balance.

Measured loop-seam continuity, expressed as the boundary sample delta over the
mean sample delta: bay 0.00x, park 0.12x, night 0.04x.

Encoded Vorbis, mono, 22050 Hz, 32 kbps.

## Mix levels

Bed gains peak at bay 0.22, park 0.20, night 0.26 on a -28 dBFS source, i.e.
roughly -40 dBFS RMS. The procedural wind sits around -42 dBFS and footstep
peaks at -26 to -18 dBFS, so the recordings sit under everything that responds
to the player. Gains use a 2.2 s time constant so they glide.

Automation: `bay` follows water proximity, `park` follows `uDay` and wind,
`night` follows `uNight`.

## Rejected sources

Several public-domain and CC0 Commons files measured as digital silence
(-79 to -112 dBFS, or -inf), including `Swale.ogg`, `20090610 0 ambience.ogg`,
`Higurashi 06c5856.ogg` and the USFWS clips. A brook recording was dropped
because reaching -28 dBFS needed a 22x gain, which would have lifted its noise
floor by 27 dB.
