'use client'

export function LoadingBubble() {
  return (
    <div className="bg-white rounded-[4px_18px_18px_18px] px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-1.5 px-1 py-1">
        <span className="h-2 w-2 rounded-full bg-[#2ECC71] animate-[bounce-dot_1.2s_infinite]" />
        <span className="h-2 w-2 rounded-full bg-[#2ECC71] animate-[bounce-dot_1.2s_infinite_0.2s]" />
        <span className="h-2 w-2 rounded-full bg-[#2ECC71] animate-[bounce-dot_1.2s_infinite_0.4s]" />
      </div>
    </div>
  )
}
