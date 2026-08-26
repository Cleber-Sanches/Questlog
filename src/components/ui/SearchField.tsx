import type { RefObject } from 'react'
import { Input } from './Input'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
}

export function SearchField({ value, onChange, placeholder, inputRef }: Props) {
  return (
    <div className="searchWrap">
      <i className="ph ph-magnifying-glass searchIcon" aria-hidden />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="searchInput"
      />
    </div>
  )
}
