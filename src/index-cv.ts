import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import os from "os";
import { readFile } from 'fs/promises';

// "compact" was index-cv.ts, "detailed" was index-cl.ts (company location line, bold job titles).
const LAYOUTS = {
  compact: {
    companyLogoDy: 0,
    companyIndent: 25,
    companyUrlIndented: true,
    companyUrlGap: 0.5,
    showCompanyLocation: false,
    positionFont: "",
    educationIndent: 30,
  },
  detailed: {
    companyLogoDy: -5,
    companyIndent: 5,
    companyUrlIndented: false,
    companyUrlGap: 0.1,
    showCompanyLocation: true,
    positionFont: "-Bold",
    educationIndent: 5,
  },
};
type LayoutName = keyof typeof LAYOUTS;

class ResumeGenerator {
  private doc: PDFKit.PDFDocument;
  private pageHeight: number = 11 * 72; // Standard 11 inches in points (72 points per inch)
  private pageWidth: number = 8.5 * 72; // Standard 8.5 inches in points
  private yOffset: number = this.pageHeight - 50;

  private leftSpace: number = 60; // Increased margins for better readability
  private topSpace: number = 30;
  private mainFontFamily = "Helvetica";
  private mainFontSize = 10;

  private profile: any = {};
  private layout: (typeof LAYOUTS)[LayoutName];

  constructor(profile: any, layout: LayoutName = "compact") {
    this.layout = LAYOUTS[layout];
    this.doc = new PDFDocument({
      size: [this.pageWidth, this.pageHeight],
      margins: {
        top: 30,
        bottom: 30,
        left: 60,
        right: 60
      }
    });
    this.profile = profile;
  }

  private addText(
    text: string,
    x: number,
    y: number,
    options: { size?: number; font?: string } = {}
  ) {
    const { size = 12, font = this.mainFontFamily } = options;
    this.doc.font(font).fontSize(size).text(text, x, y);
  }

  private async addImage(
    imagePath: string,
    x: number,
    y: number,
    options: { width?: number; height?: number } = {}
  ) {
    const { width = 20, height = 20 } = options;
    this.doc.image(imagePath, x, y, { width, height });
  }

  private async addExperienceSection({
    company,
    logo,
    companyLocation,
    companyUrl,
    candidateLocation,
    totalDuration,
    positions,
  }: {
    company: string,
    logo?: string,
    companyLocation: string,
    companyUrl?: string,
    candidateLocation: string,
    totalDuration: string,
    positions: Array<{
      position: string,
      startDate: string,
      endDate: string | null,
      duration: string,
      descriptionType: string,
      candidateLocation: string,
      description: string[],
    }>,
  }) {

    this.doc.fontSize(10).font(`${this.mainFontFamily}-Bold`).fillColor("black");

    const isLogoAvailable = logo && fs.existsSync(logo);
    const logoTop = this.doc.y + this.layout.companyLogoDy;
    // Add company logo if available
    if (isLogoAvailable) {
      try {
        await this.addImage(logo, this.leftSpace, logoTop);
      } catch (error) {
        console.warn(`Could not load logo for ${company}:`, error);
      }
    }

    // Company name and total duration
    const companyX = isLogoAvailable ? this.leftSpace + this.layout.companyIndent : this.leftSpace;
    this.doc.text(company, companyX, this.doc.y);

    this.doc.fontSize(10).font(this.mainFontFamily).fillColor("gray");
    // this.doc.text(totalDuration, isLogoAvailable ? 65 : this.leftSpace, this.doc.y);

    if (companyUrl) {
      this.doc.fontSize(9).font(this.mainFontFamily).fillColor("#0049B7");
      this.doc.text(companyUrl, this.layout.companyUrlIndented ? companyX : this.leftSpace, this.doc.y, {
        link: companyUrl,
        underline: true,
      }).moveDown(this.layout.companyUrlGap);
    } else {
      this.doc.moveDown(0.1);
    }

    // Without a company URL the text beside the logo is shorter than the logo: continue below it.
    const logoBottom = logoTop + 20 + 4;
    if (isLogoAvailable && this.doc.y < logoBottom) {
      this.doc.y = logoBottom;
    }

    this.doc.fontSize(9).font(`${this.mainFontFamily}`).fillColor("gray");
    if (this.layout.showCompanyLocation) {
      this.doc.text(`${companyLocation}`, this.leftSpace, this.doc.y).moveDown(0.5);
    }

    // Add each position
    for (const pos of positions) {
      // Position title
      this.doc.fontSize(10).font(`${this.mainFontFamily}${this.layout.positionFont}`).fillColor("black");
      this.doc.text(pos.position, this.leftSpace, this.doc.y);

      // Position dates and duration
      this.doc.fontSize(10).font(this.mainFontFamily).fillColor("gray");
      const endDateText = pos.endDate ? new Date(pos.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "Present";
      const startDateText = new Date(pos.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      this.doc.text(`${startDateText} - ${endDateText} • ${pos.duration} • ${pos.candidateLocation}`, this.leftSpace, this.doc.y);
      
      // this.doc.fontSize(9).font(`${this.mainFontFamily}`).fillColor("gray");
      // this.doc.text(`${companyLocation}`, this.leftSpace, this.doc.y).moveDown(0.3);

      // Position description
      this.doc.fontSize(10).font(`${this.mainFontFamily}`).fillColor("black");
      if (pos.descriptionType === "bullets" && pos.description && pos.description.length > 0) {
        this.doc.text("", this.leftSpace, this.doc.y);
        this.doc.list(
          pos.description.map((item: string) => item.trim()),
          { bulletIndent: 3, bulletRadius: 2 }
        ).moveDown(0.4);
      } else if (pos.descriptionType === "paragraph" && pos.description && pos.description.length > 0) {
        this.doc.text(pos.description.join(" "), this.leftSpace, this.doc.y).moveDown(0.4);
      }
    }

    this.doc.moveDown(0.3);
  }

  private async addHeaderSection() {
    this.addText(this.profile.infoData.fullName, this.leftSpace, this.topSpace, {
      size: 18,
      font: `${this.mainFontFamily}-Bold`,
    });
    this.doc.fontSize(14).font(this.mainFontFamily);
    this.doc.text(this.profile.infoData.positionLocation);
    if (this.profile.infoData.address) {
      this.doc.fontSize(10).text(this.profile.infoData.address);
    }
    this.doc.fontSize(11);
    this.doc.text(this.profile.infoData.email);

    this.doc.fontSize(10).font(this.mainFontFamily).fillColor("black");

    if (!this.profile.infoData.hidePhone && this.profile.infoData.phone) {
      this.doc.text(this.profile.infoData.phone, this.leftSpace, this.doc.y);
    }
    this.doc.fontSize(11).fillColor("#0049B7");
    this.doc.moveDown(0.3);
    const links = Object.entries(this.profile.infoData.links)
      .filter(([_, value]: [any, any]) => !!value)
      .map(([key, value]: [any, any]) => {
        const displayText = key.charAt(0).toUpperCase() + key.slice(1);
        const url = value.startsWith('http') ? value : `https://${value}`;
        return { displayText, url };
      });

    if (links.length > 0) {
      let x = this.leftSpace;
      const y = this.doc.y;
      links.forEach((link, idx) => {
        this.doc.text(
          link.displayText,
          x + (idx > 0 ? 5 : 0), // Add space after the first link
          y,
          { link: link.url, underline: true, continued: idx < links.length - 1 }
        );

        if (idx < links.length - 1) {
          this.doc.text(' ', x, y, { continued: true });
          x += this.doc.widthOfString(' ');
        }
      });
      this.doc.text('', x, y); // End continued text
      this.doc.moveDown(0.9);
    }

    this.doc.fontSize(11).font(`${this.mainFontFamily}-Bold`).fillColor("black")
  }

  private async addTechStackSection() {
    this.doc.fontSize(9).font(`${this.mainFontFamily}`).fillColor("black")
    this.doc
      .text(
        this.profile.techStackHighlights.join(' • ')
      )
      .moveDown(0.7);
  }

  private async addEducationSection() {
    if (this.profile.infoData.education && this.profile.infoData.education.length > 0) {
      for (const edu of this.profile.infoData.education) {
        this.doc.fontSize(10).font(`${this.mainFontFamily}-Bold`);
        this.doc.text(edu.institution, this.leftSpace, this.doc.y);

        const isLogoAvailable = edu.logo && fs.existsSync(edu.logo);

        if (isLogoAvailable) {
          try {
            await this.addImage(edu.logo, this.leftSpace, this.doc.y - 5);
          } catch (error) {
            console.warn(`Could not load logo for ${edu.institution}:`, error);
          }
        }
        if (edu.location) {
          this.doc.fontSize(10).font(this.mainFontFamily).fillColor("gray");
          this.doc.text(`${edu.location}`, isLogoAvailable ? this.leftSpace + this.layout.educationIndent : this.leftSpace, this.doc.y).moveDown(0.1);
        }
        edu.degree.forEach((degree: any) => {
          this.doc.fontSize(10).font(this.mainFontFamily).fillColor("black");
          const startYear = new Date(degree.startDate).getFullYear();
          const endYear = new Date(degree.endDate).getFullYear();
          this.doc.text(
            `${startYear} - ${endYear} • ${degree.degree} `,
            isLogoAvailable ? this.leftSpace + this.layout.educationIndent : this.leftSpace,
            this.doc.y
          );
        })
        this.doc.moveDown(0.5);
      }
    }
  }

  private async addSertificationsSection() {
    for (const cert of this.profile.certifications) {
      const isLogoAvailable = cert.logo && fs.existsSync(cert.logo);
      
      if (isLogoAvailable) {
        try {
          await this.addImage(
            cert.logo,
            this.leftSpace,
            this.doc.y - 5,
            { width: 16, height: 16 }
          );
        } catch (error) {
          console.warn(`Could not load logo for certification:`, error);
        }
      }

      this.doc.fontSize(10).font(this.mainFontFamily).fillColor("black");
      if (cert.date) {
        const year = new Date(cert.date).getFullYear();
        this.doc.text(
          `${year} • ${cert.title}`,
          isLogoAvailable ? this.leftSpace + 25 : this.leftSpace,
          this.doc.y
        );
      } else {
        this.doc.text(
          cert.title,
          isLogoAvailable ? this.leftSpace + 25 : this.leftSpace,
          this.doc.y
        );
      }
      
      if (cert.issuer) {
        this.doc.fontSize(9).font(this.mainFontFamily).fillColor("gray");
        this.doc.text(`${cert.issuer}`, isLogoAvailable ? this.leftSpace + 25 : this.leftSpace, this.doc.y).moveDown(0.3);
      } else {
        this.doc.moveDown(0.3);
      }
    }
  }

  async generateResume() {
    await this.addHeaderSection();
    this.doc.moveDown(0.5);
    this.doc.text("Tech Stack", this.leftSpace, this.doc.y);
    await this.addTechStackSection();
    this.doc.fontSize(11).font(`${this.mainFontFamily}-Bold`).fillColor("black")
    this.doc.text("Experience", this.leftSpace, this.doc.y);
    this.doc.moveDown(0.3);
    for (const item of this.profile.experience) {
      await this.addExperienceSection({
        company: item.company,
        logo: item.logo,
        companyLocation: item.companyLocation,
        companyUrl: item.companyUrl,
        candidateLocation: this.profile.infoData.positionLocation,
        totalDuration: item.totalDuration,
        positions: item.positions,
      });
    }
    this.doc.fontSize(11).font(`${this.mainFontFamily}-Bold`).fillColor("black")
    this.doc.text("Education", this.leftSpace, this.doc.y);
    this.doc.moveDown(0.1);
    await this.addEducationSection();
    this.doc.moveDown(0.1);
    this.doc.fontSize(11).font(`${this.mainFontFamily}-Bold`).fillColor("black")
    this.doc.text("Licenses & Certifications", this.leftSpace, this.doc.y);
    await this.addSertificationsSection();
    this.doc.end();
  }

  savePDF(outputPath: string) {
    return new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);
      this.doc.pipe(stream);
      stream.on("finish", () => {
        console.log("PDF created successfully!");
        resolve();
      });
      stream.on("error", reject);
    });
  }
}

// PDFs are kept outside the code, in a pdfs/ folder next to this project
const DEFAULT_OUT_DIR = path.resolve(__dirname, "../../pdfs/cv");

async function createResumePDF(profile: any, layout: LayoutName, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${profile.name}-cv.pdf`);
  const resumeGenerator = new ResumeGenerator(profile, layout);
  const saved = resumeGenerator.savePDF(outputPath);
  await resumeGenerator.generateResume();
  await saved;
  console.log(outputPath);
}

// Personal data lives in .env (gitignored); the profile refers to it as "${CV_EMAIL}".
// "${NAME:-fallback}" uses the fallback (possibly empty) when NAME is not set.
const ENV_FILE = path.resolve(__dirname, "../.env");

function fillPlaceholders(value: any, missing: Set<string>): any {
  if (typeof value === "string") {
    return value.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_, name, fallback) => {
      const env = process.env[name];
      if (env !== undefined && env !== "") return env;
      if (fallback !== undefined) return fallback;
      missing.add(name);
      return "";
    });
  }
  if (Array.isArray(value)) return value.map((item) => fillPlaceholders(item, missing));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillPlaceholders(v, missing)]));
  }
  return value;
}

// Logos are given by file name and looked up in CV_ASSETS_DIR (default: ./assets).
// "./…" is relative to this project; absolute paths and "~/…" are used as they are.
const PROJECT_DIR = path.resolve(__dirname, "..");

function resolveLogos(value: any, assetsDir: string): any {
  if (Array.isArray(value)) return value.map((item) => resolveLogos(item, assetsDir));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => {
      if (k === "logo" && typeof v === "string" && v) {
        const expanded = v.replace(/^~(?=\/)/, os.homedir());
        if (path.isAbsolute(expanded)) return [k, expanded];
        if (/^\.\.?\//.test(expanded)) return [k, path.resolve(PROJECT_DIR, expanded)];
        return [k, path.join(assetsDir, expanded)];
      }
      return [k, resolveLogos(v, assetsDir)];
    }));
  }
  return value;
}

async function loadProfileFromJSON(filePath: string) {
  try {
    if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
    const jsonData = await readFile(filePath, 'utf-8');
    const missing = new Set<string>();
    const profile = fillPlaceholders(JSON.parse(jsonData), missing);
    if (missing.size > 0) {
      console.error(`Missing in .env: ${[...missing].join(", ")} (see .env.example)`);
      process.exit(1);
    }
    // A relative CV_ASSETS_DIR is relative to this project folder.
    const assetsDir = path.resolve(PROJECT_DIR, (process.env.CV_ASSETS_DIR || "assets")
      .replace(/^~(?=\/|$)/, os.homedir()));
    return resolveLogos(profile, assetsDir);
  } catch (error) {
    console.error(`Error reading JSON file: ${error}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const i = args.indexOf(name);
    if (i === -1) return undefined;
    const value = args[i + 1];
    args.splice(i, 2);
    return value;
  };
  const layout = (option("--layout") ?? "compact") as LayoutName;
  const outDir = option("--out") ?? DEFAULT_OUT_DIR;

  if (args.length !== 1 || !(layout in LAYOUTS)) {
    console.error('Usage: ts-node src/index-cv.ts <profile.json> [--layout compact|detailed] [--out <dir>]');
    process.exit(1);
  }

  const jsonFilePath = args[0];
  console.log(`Loading profile from ${jsonFilePath}`);
  const profile = await loadProfileFromJSON(jsonFilePath);

  await createResumePDF(profile, layout, outDir);
  console.log(`Resume generated successfully for ${profile.name} (${layout} layout)`);
}

main().catch(console.error);
