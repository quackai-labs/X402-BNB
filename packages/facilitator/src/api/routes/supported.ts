import type { Request, Response } from "express";
import type { SupportedNetwork } from "@q402/core";
import { NetworkConfigs } from "@q402/core";
import type { NetworkClients } from "../../config/networks";

/**
 * GET /supported
 * Return supported networks and their configurations
 */
export async function handleSupported(
  req: Request,
  res: Response,
  clientsMap: Map<SupportedNetwork, NetworkClients>,
): Promise<void> {
  try {
    const supportedNetworks = Array.from(clientsMap.keys()).map((network) => {
      const config = NetworkConfigs[network];
      return {
        networkId: network,
        chainId: config.chainId,
        name: config.name,
        explorer: config.explorer,
      };
    });

    res.json({
      version: 1,
      networks: supportedNetworks,
    });
  } catch (error) {
    console.error("Supported networks error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
}

