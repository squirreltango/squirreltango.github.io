export async function portalRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Request failed. Please try again.')
  return result as T
}
