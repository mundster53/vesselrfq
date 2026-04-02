import { createContext, useContext, type ReactNode } from 'react'

interface EmbedContextValue {
  shopId: string | null
}

const EmbedContext = createContext<EmbedContextValue>({ shopId: null })

export function EmbedProvider({ shopId, children }: { shopId: string | null; children: ReactNode }) {
  return <EmbedContext.Provider value={{ shopId }}>{children}</EmbedContext.Provider>
}

export function useEmbed() {
  return useContext(EmbedContext)
}
