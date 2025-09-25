'use client'
import { useRef } from 'react'
import { Provider } from 'react-redux'
import { makeStore, AppStore } from '@/app/lib/store'
import { initializeMessageApi } from '@/app/lib/store/openApi'


export default function StoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const storeRef = useRef<AppStore>(undefined)
  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore()
    // storeRef.current.dispatch(initializeMessageApi("Procesando..."))
  }

  return <Provider store={storeRef.current}>{children}</Provider>
}