export const catchError = async <TError extends Error, TResult = unknown>(
  callback: Promise<TResult> | TResult,
  logError: boolean = true,
) => {
  try {
    const value: Awaited<typeof callback> = await callback
    return { value, isError: false } as const
  } catch (error) {
    if (logError) {
      console.error((error as TError).message)
      console.error(error)
    }
    return {
      error: error as TError,
      isError: true,
    } as const
  }
}

export const sleep = (seconds: number) =>
  new Promise(r => setTimeout(r, seconds * 1000))
