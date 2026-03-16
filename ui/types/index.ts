import type { ImgHTMLAttributes, SVGProps } from 'react'

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number
}

export type LogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  size?: number
}

export type BasemapKey = 'pixelGray' | 'pixelColor' | 'satellite'
