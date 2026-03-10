'use client'

type RequiredField = 'crop' | 'location' | 'month' | 'irrigation'

interface MissingInfoFormProps {
  title: string
  listeningText: string
  continueLabel: string
  placeholder: string
  fields: RequiredField[]
  labels: Record<RequiredField, string>
  questions: Record<RequiredField, string>
  values: Record<string, string>
  activeVoiceField: RequiredField | null
  onChange: (field: RequiredField, value: string) => void
  onMic: (field: RequiredField) => void
  onImage: (field: RequiredField) => void
  onSubmit: () => void
}

export function MissingInfoForm({
  title,
  listeningText,
  continueLabel,
  placeholder,
  fields,
  labels,
  questions,
  values,
  activeVoiceField,
  onChange,
  onMic,
  onImage,
  onSubmit,
}: MissingInfoFormProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#333]">{title}</p>
      {fields.map((field) => (
        <div key={field} className="rounded-2xl bg-[#FAFAFA] p-3">
          <p className="text-sm font-medium text-[#333]">{questions[field] || labels[field]}</p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={values[field] ?? ''}
              onChange={(event) => onChange(field, event.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-[20px] bg-[#F5F5F5] px-4 py-2.5 text-sm text-[#333] outline-none"
            />
            <button
              type="button"
              onClick={() => onMic(field)}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#F5F5F5]"
            >
              🎤
            </button>
            <button
              type="button"
              onClick={() => onImage(field)}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#F5F5F5]"
            >
              🖼
            </button>
          </div>
          {activeVoiceField === field && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>{listeningText}</span>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-full bg-[#2ECC71] px-4 py-2 text-sm font-medium text-white"
      >
        {continueLabel}
      </button>
    </div>
  )
}
