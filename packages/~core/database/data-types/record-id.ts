export type RecordIdString<T extends string> = `${T}:${string}`

export type RecordIdJson<T extends string> = {
  tb: T
  id: string
}
