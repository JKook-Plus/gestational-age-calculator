<h1 align="center">
<sub>
<img src="assets/logo.webp" height="38" width="38" alt="">
</sub>
Gestational Age (GA) calculator
</h1>

A [website](https://ga.jkook.plus/) that works out a gestational age, a due date, or a date from the other two.

## Features

- Live updating
- Accepts many written date formats, plus shortcuts such as `t` for today and `t+3`
- Copy buttons for each value
- A floating Picture-in-Picture window in Chromium browsers

## Development

There is no build step. Serve the folder with any static file server and open `index.html`.

The date and gestational age logic lives in `assets/calc.js` and has tests:

```
node --test
```

Halfmoon's stylesheet is trimmed to the rules the page uses. After using a Halfmoon class that is not styled yet, regenerate it and keep the comment at the top of the file:

```
curl -sO https://cdn.jsdelivr.net/npm/halfmoon@2.0.1/css/halfmoon.min.css
curl -sO https://cdn.jsdelivr.net/npm/halfmoon@2.0.1/css/cores/halfmoon.modern.css
mkdir trimmed
npx purgecss@6 --css halfmoon.min.css halfmoon.modern.css --content index.html assets/*.js assets/vendor/bootstrap-datepicker-1.10.0.min.js --output trimmed
cat trimmed/halfmoon.min.css trimmed/halfmoon.modern.css > assets/vendor/halfmoon-2.0.1.trimmed.css
```
