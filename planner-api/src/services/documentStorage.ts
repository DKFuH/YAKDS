import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface StoredDocumentBlob {
  storage_provider: 'local_fs'
  storage_bucket: string | null
  storage_key: string
  size_bytes: number
}

export interface WriteDocumentBlobInput {
  tenantId: string
  projectId: string
  filename: string
  buffer: Buffer
}

const STORAGE_PROVIDER = 'local_fs' as const
const STORAGE_BUCKET = process.env.DOCUMENT_STORAGE_BUCKET ?? null
const STORAGE_ROOT = path.resolve(
  process.env.DOCUMENT_STORAGE_DIR ?? path.join(process.cwd(), '.storage', 'documents'),
)

function sanitizeSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return normalized.replace(/^-+|-+$/g, '') || 'file'
}

function buildStorageKey(input: WriteDocumentBlobInput): string {
  const extension = path.extname(input.filename) || ''
  const baseName = sanitizeSegment(path.basename(input.filename, extension))
  const datePrefix = new Date().toISOString().slice(0, 10)
  const hash = createHash('sha1').update(input.buffer).digest('hex').slice(0, 12)
  return [
    sanitizeSegment(input.tenantId),
    sanitizeSegment(input.projectId),
    datePrefix,
    `${baseName}-${hash}-${randomUUID()}${extension.toLowerCase()}`,
  ].join('/')
}

function resolveStoragePath(storageKey: string): string {
  return path.join(STORAGE_ROOT, ...storageKey.split('/'))
}

export async function writeDocumentBlob(input: WriteDocumentBlobInput): Promise<StoredDocumentBlob> {
  const storageKey = buildStorageKey(input)
  const targetPath = resolveStoragePath(storageKey)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, input.buffer)

  return {
    storage_provider: STORAGE_PROVIDER,
    storage_bucket: STORAGE_BUCKET,
    storage_key: storageKey,
    size_bytes: input.buffer.byteLength,
  }
}

export async function readDocumentBlob(storageKey: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveStoragePath(storageKey))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }

    throw error
  }
}

export async function deleteDocumentBlob(storageKey: string): Promise<void> {
  const absolutePath = resolveStoragePath(storageKey)

  try {
    await fs.unlink(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  let currentDir = path.dirname(absolutePath)
  while (currentDir.startsWith(STORAGE_ROOT) && currentDir !== STORAGE_ROOT) {
    try {
      await fs.rmdir(currentDir)
      currentDir = path.dirname(currentDir)
    } catch {
      break
    }
  }
}
