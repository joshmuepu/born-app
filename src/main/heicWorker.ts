/**
 * Runs imageConvert in a worker thread so a 48-megapixel photo never freezes the operator's window or the
 * projection while it is being converted. Started by convertInWorker() in heicConvert.ts.
 */
import { parentPort, workerData } from 'worker_threads'
import { convertToJpegFile } from './imageConvert'

const { src, out } = workerData as { src: string; out: string }
void convertToJpegFile(src, out).then((r) => parentPort?.postMessage(r))
