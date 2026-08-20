import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const defaults: IconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function FolderIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="M3 7.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
}

export function WaveIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="M3 12h2l1.5-5 3 10 2.5-8 2.5 6 1.8-3H21" /></svg>
}

export function LockIcon(props: IconProps) {
  return <svg {...defaults} {...props}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
}

export function CheckIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="m5 12 4 4L19 6" /></svg>
}

export function AlertIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="M12 9v4m0 4h.01" /><path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.75 3h15.7a2 2 0 0 0 1.75-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /></svg>
}

export function StopIcon(props: IconProps) {
  return <svg {...defaults} {...props}><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
}

export function BoltIcon(props: IconProps) {
  return <svg {...defaults} {...props}><path d="m13 2-9 12h7l-1 8 9-12h-7Z" /></svg>
}
