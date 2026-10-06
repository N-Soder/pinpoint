# Third-party notices

Pinpoint is licensed under AGPL-3.0-only (see [LICENSE](LICENSE)). It includes or loads the following third-party works under their own licences.

## Included in this repository

| Component | Location | Licence |
|-----------|----------|---------|
| [shadcn/ui](https://github.com/shadcn-ui/ui) component source (adapted) | `src/components/ui/`, `src/hooks/use-toast.ts` | MIT, Copyright (c) 2023 shadcn |
| [Lucide](https://lucide.dev) "crosshair" icon | `public/favicon.svg` | ISC, Copyright (c) Lucide Contributors |

## Bundled fonts

DM Sans, Space Grotesk and JetBrains Mono are bundled into the build from the `@fontsource/*` packages under the [SIL Open Font License 1.1](https://openfontlicense.org). The full licence text ships in each package.

## Loaded at runtime

| Component | How | Licence |
|-----------|-----|---------|
| [html2canvas](https://github.com/niklasvh/html2canvas) 1.4.1 | Loaded by `public/widget.js` from cdnjs, pinned with Subresource Integrity | MIT, Copyright (c) 2012 Niklas von Hertzen |

## npm dependencies

Bundled npm dependencies (React, Radix UI, TanStack Query, React Router, lucide-react, Tailwind utilities and others) are under permissive licences: MIT, ISC, Apache-2.0, BSD-3-Clause and 0BSD. Their licence texts are in their packages under `node_modules/`. To list them:

```bash
npx license-checker --production --summary
```

## MIT licence text (shadcn/ui, html2canvas)

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ISC licence text (Lucide)

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
