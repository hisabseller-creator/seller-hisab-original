/**
 * Type definitions for the Amazon connector Service Binding RPC.
 *
 * These types describe the interface exposed by the internal Amazon
 * connector Worker (sellerhisab-amazon-connector) to the public
 * SellerHisab Worker via Cloudflare Service Binding.
 *
 * IMPORTANT: Raw Amazon tokens (access_token, refresh_token, client_secret)
 * NEVER cross this boundary. The internal Worker handles token exchange,
 * encryption, and storage; it returns only non-secret connection metadata.
 */

/** Non-secret result returned after successful Amazon OAuth exchange. */
export type AmazonConnectionResult = {
  connectionId: string;
  channelAccountId: string;
  externalAccountId: string;
  displayName: string;
  status: "connected";
};

/**
 * RPC interface exposed by the internal Amazon connector Worker.
 *
 * In production, this is accessed via env.AMAZON_SERVICE from the public Worker.
 * The Cloudflare runtime binds the actual WorkerEntrypoint methods.
 */
export interface AmazonConnectorRpc {
  exchangeAndStore(input: {
    code: string;
    redirectUri: string;
    sellerId: string;
    tenantId: string;
    userId: string;
    connectorId: string;
    channelId: string;
  }): Promise<AmazonConnectionResult>;

  buildAuthorizationUrl(input: {
    state: string;
    redirectUri: string;
  }): string;

  isConfigured(): boolean;
}
