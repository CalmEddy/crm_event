import { ensureSeedData } from "../src/db/seed";

async function main() {
  const result = await ensureSeedData();
  console.log(
    result.seeded
      ? `Seeded sample data (event #${result.eventId})`
      : "Seed skipped — data already present",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
