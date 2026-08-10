import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, "server/data/characters.json");
const RESULT_PATH = process.env.ROLE_RESULT_PATH || "/private/tmp/beginner-role-result.json";

const rows = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const result = JSON.parse(fs.readFileSync(RESULT_PATH, "utf8"));
const demoteKeys = new Set(result.demote.map((item) => `${item.name}\u0000${item.work}`));

let demoted = 0;
const updated = rows.map((row) => {
  if (!demoteKeys.has(`${row.name}\u0000${row.work}`)) return row;
  const difficulties = row.difficulties.filter((key) => key !== "beginner");
  demoted += 1;
  return { ...row, difficulties: difficulties.length ? difficulties : ["normal"] };
});

function serialize(rs) {
  const lines = rs.map((r) => {
    const parts = [
      `"name": ${JSON.stringify(r.name)}`,
      `"work": ${JSON.stringify(r.work)}`,
      `"company": ${JSON.stringify(r.company)}`,
      `"release_year": ${r.release_year}`,
      `"gender": ${JSON.stringify(r.gender)}`,
      `"cv": ${JSON.stringify(r.cv)}`,
      `"hair_color": ${JSON.stringify(r.hair_color)}`,
      `"hair_color_family": ${JSON.stringify(r.hair_color_family)}`,
      `"hair_length": ${JSON.stringify(r.hair_length)}`,
      `"writer": ${JSON.stringify(r.writer)}`,
      `"difficulties": ${JSON.stringify(r.difficulties)}`,
    ];
    return `  { ${parts.join(", ")} }`;
  });
  return `[\n${lines.join(",\n")}\n]\n`;
}

const dryRun = process.argv.includes("--dry-run");
const target = dryRun ? "/private/tmp/characters-beginner-demote-preview.json" : DATA_PATH;
fs.writeFileSync(target, serialize(updated));

console.log(`demoted from beginner: ${demoted}`);
console.log(`beginner: ${updated.filter((row) => row.difficulties.includes("beginner")).length}`);
console.log(`easy: ${updated.filter((row) => row.difficulties.includes("easy")).length}`);
console.log(`normal: ${updated.filter((row) => row.difficulties.includes("normal")).length}`);
console.log(dryRun ? "dry-run only" : `written ${DATA_PATH}`);
