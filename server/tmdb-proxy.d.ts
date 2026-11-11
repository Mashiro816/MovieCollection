import type { IncomingMessage, ServerResponse } from 'node:http'

export function tmdbProxy(
  params: URLSearchParams,
  env: Record<string, string | undefined>,
): Promise<{ status: number; body: string; cache: string }>

export function createTmdbHandler(
  getEnv: () => Record<string, string | undefined>,
): (req: IncomingMessage, res: ServerResponse) => Promise<void>
