/**
 * Estado global de sincronização (memória do processo Next.js).
 * Atualizado pelo syncKommoData e lido pelo /api/sync/status.
 */
export const syncProgress = {
  running: false,
  source: "",
  phase: "",
  processed: 0,
  total: 0,
  pages: 0,
  startedAt: null as Date | null,
  finishedAt: null as Date | null,
  lastError: null as string | null,
};

export function startSync(source: string) {
  syncProgress.running = true;
  syncProgress.source = source;
  syncProgress.phase = "Iniciando...";
  syncProgress.processed = 0;
  syncProgress.total = 0;
  syncProgress.pages = 0;
  syncProgress.startedAt = new Date();
  syncProgress.finishedAt = null;
  syncProgress.lastError = null;
}

export function updateSync(phase: string, processed: number, total: number, pages?: number) {
  syncProgress.phase = phase;
  syncProgress.processed = processed;
  syncProgress.total = total;
  if (pages !== undefined) syncProgress.pages = pages;
}

export function finishSync(error?: string) {
  syncProgress.running = false;
  syncProgress.finishedAt = new Date();
  syncProgress.lastError = error ?? null;
  if (!error) syncProgress.phase = "Concluído";
}
