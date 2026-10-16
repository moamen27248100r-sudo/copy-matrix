# Hero video credits

The landing page film (`public/video/hero-{ar,en}-{mobile,desktop}.{webm,mp4,jpg}`): a 3D studio
scene of a laptop and a phone showing the platform, cut with two shots of the same person.
Mobile 4:5 (1080x1350), desktop 16:9 (1920x1080); rendered at 60 fps and encoded at 30 fps.
Arabic version for the Arabic interface, English for every other language.

## How it is made

- **3D scene**: Remotion 4.0.535 with @remotion/three, React Three Fiber, drei and postprocessing
  (depth of field, light bloom, grain, vignette). The scene, the camera moves and the six shots are
  in the film project (kept outside this repository).
- **Laptop and phone models**: modelled in code for this film (rounded aluminium base and lid,
  keyboard, trackpad, glass bezel; titanium phone frame, glass front, camera island). No third-party
  model is used, so no model licence applies, and there is no brand mark or logo on either device.
- **Device screens**: real screens of Copy Matrix recorded frame by frame with Playwright on the
  Demo Preview test account (dashboard scroll, phone home, the copy sheet with an amount being
  typed and the copy button pressed -- nothing is submitted --, a trader's chart drawing with the
  crosshair moving along it, the portfolio). Account e-mail, number and account-type badges are
  hidden in the recordings.

## People footage (Mixkit, Stock Video Free License)

Both shots are the same person in the same room, from one Mixkit series. Each clip's page was
checked on 2026-10-16 and is under the **Mixkit Stock Video Free License** (not the Restricted
License): free for commercial and non-commercial projects, may be modified and distributed, no
account or key needed, attribution not required (credited here anyway).
License text: https://mixkit.co/license/#videoFree

| Shot | Clip | Source page | Used |
| --- | --- | --- | --- |
| 3 | Skilled programmer working in front of a computer (41651) | https://mixkit.co/free-stock-video/skilled-programmer-working-in-front-of-a-computer-41651/ | 0.0–2.0 s, colour graded, slow push in |
| 5 | Experienced programmer working very concentrated (41645) | https://mixkit.co/free-stock-video/experienced-programmer-working-very-concentrated-41645/ | 0.2–1.7 s, colour graded, slow push in |

Colour grade (both): lower saturation, cooler shadows and highlights, slightly darker, vignette,
to match the 3D studio and the platform's colours.

## Reference

The shot order, camera language and pacing follow the public.com home page hero, studied from a
local copy that is not part of this repository and not published.
