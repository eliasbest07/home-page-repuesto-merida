'use client'

import dynamic from 'next/dynamic'

const ComerciosMap = dynamic(() => import('@/app/components/ComerciosMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[68vh] min-h-[560px] items-center justify-center rounded-3xl border border-[#e3d8c7] bg-[#f6f1e8]">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8c7af] border-t-[#A9714B]" />
    </div>
  ),
})

export default function MapaClient() {
  return <ComerciosMap large />
}
