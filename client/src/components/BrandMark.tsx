import React from 'react'

export default function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><defs><linearGradient id="brand-a" x1="4" y1="3" x2="36" y2="38" gradientUnits="userSpaceOnUse"><stop stopColor="#ffe695"/><stop offset=".42" stopColor="#f0a648"/><stop offset="1" stopColor="#8b48ff"/></linearGradient></defs><path d="M20 3 35 11v18L20 37 5 29V11L20 3Z" fill="#110d28" stroke="url(#brand-a)" strokeWidth="2"/><path d="M12 12h15l-2.5 4H17v3h6l-2.4 4H17v6h-5V12Z" fill="url(#brand-a)"/><circle cx="29.5" cy="10.5" r="2" fill="#7eefff"/></svg></span>
}
