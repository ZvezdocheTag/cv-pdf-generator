# pdf-editor

Generate a one-page CV as a PDF from a JSON profile (PDFKit), and convert PDFs to
Markdown (MarkItDown).

Personal data (name, email, phone, address, links) is kept in `.env`, which is never
committed. The profile only refers to it through placeholders.

## Setup

```sh
pnpm install
cp .env.example .env      # then fill in your details
```

Requires Node 20.12 or later (for the built-in `.env` loading).

## Generate the CV

```sh
npx ts-node src/index-cv.ts input.cv.json
```

The PDF is written to `../pdfs/cv/<CV_FILE_NAME>-cv.pdf`, a `pdfs/` folder next to this
project, so generated CVs never end up inside the repository.
Options:

| Option | Effect |
|---|---|
| `--layout compact` | default: company name and link next to the logo, regular job titles |
| `--layout detailed` | adds the company location line and bold job titles |
| `--out <dir>` | write the PDF to another folder |

To try it without your own data, use the example profile (it needs no `.env`):

```sh
npx ts-node src/index-cv.ts input.cv.example.json --out /tmp
```

## Personal data: `.env`

| Variable | Required | Shown as |
|---|---|---|
| `CV_FILE_NAME` | yes | output file name (`<value>-cv.pdf`) |
| `CV_FULL_NAME` | yes | name at the top |
| `CV_EMAIL` | yes | email under the name |
| `CV_LOCATION` | yes | city under the name |
| `CV_PHONE` | no | phone line, hidden if empty |
| `CV_ADDRESS` | no | street address under the city, hidden if empty |
| `CV_LINKEDIN`, `CV_GITHUB` | no | links in the header, hidden if empty |
| `CV_ASSETS_DIR` | no | folder with your logos (see [Logos](#logos)), default `./assets` |

In the profile JSON:
- `"${CV_EMAIL}"` is **required**. If it's not set, the generator stops and lists every missing variable.
- `"${CV_PHONE:-}"` is **optional**: an empty value hides the line. You can also give a default, as in `"${CV_PHONE:-n/a}"`.

To add a new private field, add it to `.env` and `.env.example`, then reference it from the profile.

## Profile: `input.cv.json`

See `input.cv.example.json` for a complete example.

```jsonc
{
  "name": "${CV_FILE_NAME}",
  "infoData": {
    "fullName": "${CV_FULL_NAME}",
    "positionLocation": "${CV_LOCATION}",
    "address": "${CV_ADDRESS:-}",
    "email": "${CV_EMAIL}",
    "phone": "${CV_PHONE:-}",
    "hidePhone": false,                       // true hides the phone even if set
    "links": { "linkedin": "${CV_LINKEDIN:-}", "github": "${CV_GITHUB:-}" },
    "education": [
      { "institution": "…", "location": "…", "logo": null,
        "degree": [{ "degree": "…", "startDate": "2006-06-01", "endDate": "2010-06-30" }] }
    ]
  },
  "techStackHighlights": ["TypeScript", "React", "…"],   // one line, joined with •
  "experience": [
    {
      "company": "…", "companyUrl": "https://…", "companyLocation": "…",
      "logo": "company_logo.jpg",                         // optional, see Logos
      "positions": [
        {
          "position": "Senior Full Stack Developer",
          "startDate": "2021-05-01", "endDate": null,      // null → "Present"
          "duration": "3 yrs 6 mos", "candidateLocation": "Remote",
          "descriptionType": "bullets",                    // or "paragraph"
          "description": ["…", "…"]
        }
      ]
    }
  ],
  "certifications": [
    { "title": "…", "issuer": "…", "date": "2023-01-01", "logo": "aws_logo.jpg" }
  ]
}
```

`techStackFull`, `targetPosition` and `totalDuration` can stay in the profile, but they
are not printed.

## Logos

Company, school and certification logos are optional. Each `"logo"` in the profile can
be set on an `experience` entry, an `education` entry or a `certification`.

**Where the files live.** Logos of real companies are kept outside the repository, in
the folder set by `CV_ASSETS_DIR` in `.env`, for example `../pdfs/assets` next to the
generated PDFs. A relative path starts from this project folder. The project's own
`assets/` folder is gitignored, apart from `example-logo.png`, a neutral placeholder
used by the example profile.

**How a `"logo"` value is found:**

| Value in the profile | File used |
|---|---|
| `"acme_logo.jpg"` | `$CV_ASSETS_DIR/acme_logo.jpg` (or `./assets/…` if `CV_ASSETS_DIR` is not set) |
| `"./assets/example-logo.png"` | relative to this project folder |
| `"/abs/path/logo.png"`, `"~/logos/logo.png"` | used as is |
| `null` or missing | no logo, text starts at the left margin |

A logo file that doesn't exist is skipped silently. The text then starts at the left
margin, so check the PDF if a logo is missing.

**Adding a logo:**
1. Save a square JPG or PNG into your assets folder. It's drawn at 20 × 20 pt (16 × 16
   for certifications), so 64–128 px is plenty. LinkedIn company pages are a good source.
2. Put its file name in the profile: `"logo": "acme_logo.png"`.
3. Regenerate the CV.

## Convert PDFs to Markdown

```sh
pipx install 'markitdown[pdf]'     # once
scripts/pdf-to-md.sh ../pdfs/document.pdf [more.pdf …]
```

Each PDF gets a `.md` file with the same name next to it.

## Files

```
src/index-cv.ts          CV generator
assets/example-logo.png  placeholder logo for the example (other files here are gitignored)
input.cv.json            your profile, with placeholders (gitignored)
input.cv.example.json    example profile with fake data
.env                     your personal data (gitignored, never commit)
.env.example             template for .env
scripts/pdf-to-md.sh     PDF → Markdown
pnpm-workspace.yaml      dependency override (patched `diff` for ts-node)
```
