import 'server-only'

export interface OfficialInstagramProvider {
  redirectUri: string
  encryptionKey: Buffer
  authorizationUrl(state: string): URL
  exchangeCode(code: string): Promise<{ token: string; accountId: string; username: string; expiresAt: Date }>
  revoke(token: string): Promise<void>
}

// Intentionally unavailable until an approved Meta application and its official
// token-exchange adapter are configured. Never accept provider configuration,
// credentials, redirect URIs or token material from a browser.
export function getInstagramProvider(): OfficialInstagramProvider | null {
  return null
}
