/**
 * q402 Facilitator Service
 * 
 * A facilitator server for verifying and settling EIP-7702 delegated payments
 * on BSC and other EVM networks.
 */

import { loadEnvConfig } from "./config/env";
import { createNetworkClients } from "./config/networks";
import { createServer } from "./api/server";

async function main() {
  console.log("Starting q402 Facilitator...");

  // Load configuration
  const config = loadEnvConfig();
  console.log(`Host: ${config.host}`);
  console.log(`Port: ${config.port}`);
  console.log(`Log level: ${config.logLevel}`);

  // Create network clients
  const clientsMap = createNetworkClients(config);
  console.log(`Configured ${clientsMap.size} network(s)`);

  // Create and start server
  const app = createServer(config, clientsMap);

  app.listen(config.port, config.host, () => {
    console.log(`Facilitator listening on http://${config.host}:${config.port}`);
    console.log(`Ready to process payments!`);
  });
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { loadEnvConfig, createNetworkClients, createServer };

