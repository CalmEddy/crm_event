/**
 * Local intake smoke test (bypasses Resend webhook + signature).
 *
 *   npx tsx scripts/simulate-inbound.ts
 *   npx tsx scripts/simulate-inbound.ts --fail
 */
import { processInboundEmail } from "../src/lib/inbound/process";

async function main() {
  const fail = process.argv.includes("--fail");
  const messageId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const body = fail
    ? `Name: Incomplete Buyer\nEmail: incomplete@example.com\n`
    : `Name: Jane Buyer
Email: jane.buyer@example.com
Phone: 555-0100
Notes: Looking for Saturday late show in March; capacity ~200
`;

  const result = await processInboundEmail({
    providerMessageId: messageId,
    subject: "Event request",
    fromAddress: "forms@example.com",
    bodyText: body,
  });

  console.log(JSON.stringify({ messageId, result }, null, 2));

  const again = await processInboundEmail({
    providerMessageId: messageId,
    subject: "Event request",
    fromAddress: "forms@example.com",
    bodyText: body,
  });
  console.log(JSON.stringify({ duplicateCheck: again }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
