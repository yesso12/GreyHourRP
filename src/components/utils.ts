export function clsx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`)
  return res.json() as Promise<T>
}
