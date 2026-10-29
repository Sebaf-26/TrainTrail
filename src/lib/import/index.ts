import type { PlatformOptions, ProcessResult } from '$lib/import/model';
import { type PlatformValue } from '$lib/import/platforms';
import {
  processTicketFile,
  processTicketFiles,
  processTicketText,
} from '$lib/import/ticket';
import { processTrainTrailFile } from '$lib/import/traintrail';
import { readFile } from '$lib/utils';

type Processor = (
  content: string,
  options: PlatformOptions,
) => Promise<ProcessResult>;

const processors: Record<PlatformValue, Processor> = {
  traintrail: processTrainTrailFile,
  ticket: processTicketText,
};

export type { PlatformValue } from '$lib/import/platforms';
export { processTicketText } from '$lib/import/ticket';

export const processFile = async (
  file: File,
  platform: PlatformValue,
  options: PlatformOptions,
): Promise<ProcessResult> => {
  // Tickets can be binary (.pkpass), so they read the file themselves.
  if (platform === 'ticket') return processTicketFile(file, options);

  const content = await readFile(file);
  const handler = processors[platform];
  if (!handler) throw new Error('Unknown platform');
  return handler(content, options);
};

/** Like `processFile`, for a source that takes several files at once (tickets). */
export const processFiles = async (
  files: File[],
  platform: PlatformValue,
  options: PlatformOptions,
): Promise<ProcessResult> => {
  if (platform === 'ticket') return processTicketFiles(files, options);

  const [file] = files;
  if (!file) throw new Error('No file was chosen');
  return processFile(file, platform, options);
};
