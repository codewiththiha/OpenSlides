import fs from "node:fs";
import path from "node:path";

const version = (process.env.RELEASE_VERSION ?? "").replace(/^v/, "").trim();
if (!version) {
  console.error("Missing RELEASE_VERSION. Example: v1.2.3");
  process.exit(1);
}

const notePath = path.resolve("release-notes", `${version}.md`);
if (!fs.existsSync(notePath)) {
  console.error(`Release note not found: ${notePath}`);
  process.exit(1);
}

const raw = fs.readFileSync(notePath, "utf8");
const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
const content = raw.slice(frontmatter?.[0].length ?? 0).trim();
const fields = frontmatter?.[1] ?? "";
const versionFromFile = fields.match(/^version:\s*(.+)$/m)?.[1]?.trim();
const dateFromFile = fields.match(/^date:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];
const whatsNewBlock = fields.match(
  /^whatsNew:\s*\|\s*\r?\n((?:^[ \t]+.*(?:\r?\n|$))*)/m,
)?.[1];
const whatsNewFromHeading = content.match(
  /##\s*What['’]s New\s*\r?\n([\s\S]*?)(?=\r?\n##\s|$)/i,
)?.[1];
const whatsNew = (
  whatsNewBlock ??
  whatsNewFromHeading ??
  content.split(/\r?\n\r?\n/)[0] ??
  ""
)
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s{2}/, ""))
  .join("\n")
  .trim();

const payload = {
  version: versionFromFile || version,
  date: dateFromFile || new Date().toISOString().slice(0, 10),
  whatsNew,
  fullNotes: content,
};

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${payload.version}\n`);
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `payloadJson<<OPENSLIDES_PAYLOAD\n${JSON.stringify(payload)}\nOPENSLIDES_PAYLOAD\n`,
  );
}

console.log(JSON.stringify(payload, null, 2));
