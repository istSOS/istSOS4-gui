// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { IconSvgProps, LogoProps } from '@/types'

export const LogoIstSOS = ({
  size = 24,
  width,
  height,
  ...props
}: LogoProps) => {
  const computedWidth = width ?? size
  const computedHeight = height ?? size

  return (
    <img
      src={
        process.env.NODE_ENV === 'development'
          ? `${process.env.NEXT_PUBLIC_BASE_PATH}/istsos_logo.png`
          : '/NEXT_APP_URL/istsos_logo.png'
      }
      width={computedWidth}
      height={computedHeight}
      alt="Logo IstSOS"
      {...props}
    />
  )
}

export const LogoOSGeo = ({
  size = 24,
  width,
  height,
  ...props
}: LogoProps) => {
  const computedWidth = width ?? size
  const computedHeight = height ?? size

  return (
    <img
      src={
        process.env.NODE_ENV === 'development'
          ? `${process.env.NEXT_PUBLIC_BASE_PATH}/osgeo_logo.png`
          : '/NEXT_APP_URL/osgeo_logo.png'
      }
      width={computedWidth}
      height={computedHeight}
      alt="Logo OSGeo"
      {...props}
    />
  )
}

const getSize = (
  size: IconSvgProps['size'] = 24,
  width?: IconSvgProps['width'],
  height?: IconSvgProps['height']
) => ({
  width: width ?? size,
  height: height ?? size,
})

export const GithubIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="currentColor"
      {...props}
    >
      <path d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.545 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z" />
    </svg>
  )
}

export const CloseIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="presentation"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export const SearchIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path
        d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M22 22L20 20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export const DeleteIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="presentation"
      viewBox="0 0 20 20"
      height={h}
      width={w}
      {...props}
    >
      <path
        d="M17.5 4.98332C14.725 4.70832 11.9333 4.56665 9.15 4.56665C7.5 4.56665 5.85 4.64998 4.2 4.81665L2.5 4.98332"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <path
        d="M7.08331 4.14169L7.26665 3.05002C7.39998 2.25835 7.49998 1.66669 8.90831 1.66669H11.0916C12.5 1.66669 12.6083 2.29169 12.7333 3.05835L12.9166 4.14169"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <path
        d="M15.7084 7.61664L15.1667 16.0083C15.075 17.3166 15 18.3333 12.675 18.3333H7.32502C5.00002 18.3333 4.92502 17.3166 4.83335 16.0083L4.29169 7.61664"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <path
        d="M8.60834 13.75H11.3833"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <path
        d="M7.91669 10.4167H12.0834"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  )
}

export const EditIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="presentation"
      viewBox="0 0 20 20"
      width={w}
      height={h}
      {...props}
    >
      <path
        d="M11.05 3.00002L4.20835 10.2417C3.95002 10.5167 3.70002 11.0584 3.65002 11.4334L3.34169 14.1334C3.23335 15.1084 3.93335 15.775 4.90002 15.6084L7.58335 15.15C7.95835 15.0834 8.48335 14.8084 8.74168 14.525L15.5834 7.28335C16.7667 6.03335 17.3 4.60835 15.4583 2.86668C13.625 1.14168 12.2334 1.75002 11.05 3.00002Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.5}
      />
      <path
        d="M9.90833 4.20831C10.2667 6.50831 12.1333 8.26665 14.45 8.49998"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.5}
      />
      <path
        d="M2.5 18.3333H17.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.5}
      />
    </svg>
  )
}

export const EyeIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="presentation"
      viewBox="0 0 20 20"
      height={h}
      width={w}
      {...props}
    >
      <path
        d="M12.9833 10C12.9833 11.65 11.65 12.9833 10 12.9833C8.35 12.9833 7.01666 11.65 7.01666 10C7.01666 8.35 8.35 7.01666 10 7.01666C11.65 7.01666 12.9833 8.35 12.9833 10Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
      <path
        d="M9.99999 16.8916C12.9417 16.8916 15.6833 15.1583 17.5917 12.1583C18.3417 10.9833 18.3417 9.00831 17.5917 7.83331C15.6833 4.83331 12.9417 3.09998 9.99999 3.09998C7.05833 3.09998 4.31666 4.83331 2.40833 7.83331C1.65833 9.00831 1.65833 10.9833 2.40833 12.1583C4.31666 15.1583 7.05833 16.8916 9.99999 16.8916Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </svg>
  )
}

export const EyeOffIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M2,5.27L3.28,4L20,20.72L18.73,22L15.65,18.92C14.5,19.3 13.28,19.5 12,19.5C7,19.5 2.73,16.39 1,12C1.69,10.24 2.79,8.69 4.19,7.46L2,5.27M12,9A3,3 0 0,1 15,12C15,12.35 14.94,12.69 14.83,13L11,9.17C11.31,9.06 11.65,9 12,9M12,4.5C17,4.5 21.27,7.61 23,12C22.18,14.08 20.79,15.88 19,17.19L17.58,15.76C18.94,14.82 20.06,13.54 20.82,12C19.17,8.64 15.76,6.5 12,6.5C10.91,6.5 9.84,6.68 8.84,7L7.3,5.47C8.74,4.85 10.33,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C12.69,17.5 13.37,17.43 14,17.29L11.72,15C10.29,14.85 9.15,13.71 9,12.28L5.6,8.87C4.61,9.72 3.78,10.78 3.18,12Z" />
    </svg>
  )
}

export const ChevronDownIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path
        d="m19.92 8.95-6.52 6.52c-.77.77-2.03.77-2.8 0L4.08 8.95"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit={10}
        strokeWidth={1.5}
      />
    </svg>
  )
}

export const PlusIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      >
        <path d="M6 12h12" />
        <path d="M12 18V6" />
      </g>
    </svg>
  )
}

export const ChartIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="currentColor"
      {...props}
    >
      <path d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z" />
    </svg>
  )
}

export const CrosshairIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M17 12C17 7.55 11.62 5.31 8.46 8.46C5.31 11.61 7.55 17 12 17C14.76 17 17 14.76 17 12M12 15C9.33 15 8 11.77 9.88 9.88C11.77 8 15 9.33 15 12C15 13.66 13.66 15 12 15M5 15H3V19C3 20.1 3.9 21 5 21H9V19H5M5 5H9V3H5C3.9 3 3 3.9 3 5V9H5M19 3H15V5H19V9H21V5C21 3.9 20.1 3 19 3M19 19H15V21H19C20.1 21 21 20.1 21 19V15H19" />
    </svg>
  )
}

export const ZoomInIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14M12,10H10V12H9V10H7V9H9V7H10V9H12V10Z" />
    </svg>
  )
}

export const ZoomOutIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M15.5,14H14.71L14.43,13.73C15.41,12.59 16,11.11 16,9.5A6.5,6.5 0 0,0 9.5,3A6.5,6.5 0 0,0 3,9.5A6.5,6.5 0 0,0 9.5,16C11.11,16 12.59,15.41 13.73,14.43L14,14.71V15.5L19,20.5L20.5,19L15.5,14M9.5,14C7,14 5,12 5,9.5C5,7 7,5 9.5,5C12,5 14,7 14,9.5C14,12 12,14 9.5,14M7,9H12V10H7V9Z" />
    </svg>
  )
}

export const ThingIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L6.04,7.5L12,10.85L17.96,7.5L12,4.15M5,15.91L11,19.29V12.58L5,9.21V15.91M19,15.91V9.21L13,12.58V19.29L19,15.91Z" />
    </svg>
  )
}

export const LocationIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M12 4C14.2 4 16 5.8 16 8C16 10.1 13.9 13.5 12 15.9C10.1 13.4 8 10.1 8 8C8 5.8 9.8 4 12 4M12 2C8.7 2 6 4.7 6 8C6 12.5 12 19 12 19S18 12.4 18 8C18 4.7 15.3 2 12 2M12 6C10.9 6 10 6.9 10 8S10.9 10 12 10 14 9.1 14 8 13.1 6 12 6M20 19C20 21.2 16.4 23 12 23S4 21.2 4 19C4 17.7 5.2 16.6 7.1 15.8L7.7 16.7C6.7 17.2 6 17.8 6 18.5C6 19.9 8.7 21 12 21S18 19.9 18 18.5C18 17.8 17.3 17.2 16.2 16.7L16.8 15.8C18.8 16.6 20 17.7 20 19Z" />
    </svg>
  )
}

export const SensorIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M4.93,4.93C3.12,6.74 2,9.24 2,12C2,14.76 3.12,17.26 4.93,19.07L6.34,17.66C4.89,16.22 4,14.22 4,12C4,9.79 4.89,7.78 6.34,6.34L4.93,4.93M19.07,4.93L17.66,6.34C19.11,7.78 20,9.79 20,12C20,14.22 19.11,16.22 17.66,17.66L19.07,19.07C20.88,17.26 22,14.76 22,12C22,9.24 20.88,6.74 19.07,4.93M7.76,7.76C6.67,8.85 6,10.35 6,12C6,13.65 6.67,15.15 7.76,16.24L9.17,14.83C8.45,14.11 8,13.11 8,12C8,10.89 8.45,9.89 9.17,9.17L7.76,7.76M16.24,7.76L14.83,9.17C15.55,9.89 16,10.89 16,12C16,13.11 15.55,14.11 14.83,14.83L16.24,16.24C17.33,15.15 18,13.65 18,12C18,10.35 17.33,8.85 16.24,7.76M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z" />
    </svg>
  )
}

export const ObservedPropertyIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M19.07,4.93L17.66,6.34C19.1,7.79 20,9.79 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12C4,7.92 7.05,4.56 11,4.07V6.09C8.16,6.57 6,9.03 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12C18,10.34 17.33,8.84 16.24,7.76L14.83,9.17C15.55,9.9 16,10.9 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12C8,10.14 9.28,8.59 11,8.14V10.28C10.4,10.63 10,11.26 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12C14,11.26 13.6,10.62 13,10.28V2H12A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,9.24 20.88,6.74 19.07,4.93Z" />
    </svg>
  )
}

export const DatastreamIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z" />
    </svg>
  )
}

export const NameIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M21.41 11.58L12.41 2.58A2 2 0 0 0 11 2H4A2 2 0 0 0 2 4V11A2 2 0 0 0 2.59 12.42L11.59 21.42A2 2 0 0 0 13 22A2 2 0 0 0 14.41 21.41L21.41 14.41A2 2 0 0 0 22 13A2 2 0 0 0 21.41 11.58M13 20L4 11V4H11L20 13M6.5 5A1.5 1.5 0 1 1 5 6.5A1.5 1.5 0 0 1 6.5 5Z" />
    </svg>
  )
}

export const DescriptionIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M5,3C3.89,3 3,3.89 3,5V19C3,20.11 3.89,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.11,3 19,3H5M5,5H19V19H5V5M7,7V9H17V7H7M7,11V13H17V11H7M7,15V17H14V15H7Z" />
    </svg>
  )
}

export const CommitIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M4 4H20V6H4V4M4 8H20V10H4V8M4 12H20V14H4V12M4 18H11V20H4V18M20.59 14.58L22 16L16 22L12 18L13.41 16.59L16 19.17L20.59 14.58Z" />
    </svg>
  )
}

export const EncodingTypeIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z" />
    </svg>
  )
}

export const MetadataIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z" />
    </svg>
  )
}

export const DefinitionIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M15.5,12C18,12 20,14 20,16.5C20,17.38 19.75,18.21 19.31,18.9L22.39,22L21,23.39L17.88,20.32C17.19,20.75 16.37,21 15.5,21C13,21 11,19 11,16.5C11,14 13,12 15.5,12M15.5,14A2.5,2.5 0 0,0 13,16.5A2.5,2.5 0 0,0 15.5,19A2.5,2.5 0 0,0 18,16.5A2.5,2.5 0 0,0 15.5,14M5,3H19C20.11,3 21,3.89 21,5V13.03C20.5,12.23 19.81,11.54 19,11V5H5V19H9.5C9.81,19.75 10.26,20.42 10.81,21H5C3.89,21 3,20.11 3,19V5C3,3.89 3.89,3 5,3M7,7H17V9H7V7M7,11H12.03C11.23,11.5 10.54,12.19 10,13H7V11M7,15H9.17C9.06,15.5 9,16 9,16.5V17H7V15Z" />
    </svg>
  )
}

export const ObservationTypeIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M11,13.5V21.5H3V13.5H11M9,15.5H5V19.5H9V15.5M12,2L17.5,11H6.5L12,2M12,5.86L10.08,9H13.92L12,5.86M17.5,13C20,13 22,15 22,17.5C22,20 20,22 17.5,22C15,22 13,20 13,17.5C13,15 15,13 17.5,13M17.5,15A2.5,2.5 0 0,0 15,17.5A2.5,2.5 0 0,0 17.5,20A2.5,2.5 0 0,0 20,17.5A2.5,2.5 0 0,0 17.5,15Z" />
    </svg>
  )
}

export const KeyIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M21 18H15V15H13.3C12.2 17.4 9.7 19 7 19C3.1 19 0 15.9 0 12S3.1 5 7 5C9.7 5 12.2 6.6 13.3 9H24V15H21V18M17 16H19V13H22V11H11.9L11.7 10.3C11 8.3 9.1 7 7 7C4.2 7 2 9.2 2 12S4.2 17 7 17C9.1 17 11 15.7 11.7 13.7L11.9 13H17V16M7 15C5.3 15 4 13.7 4 12S5.3 9 7 9 10 10.3 10 12 8.7 15 7 15M7 11C6.4 11 6 11.4 6 12S6.4 13 7 13 8 12.6 8 12 7.6 11 7 11Z" />
    </svg>
  )
}

export const ReviewIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      {...props}
    >
      <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3M19 19H5V5H19V19M7 7H14V9H7V7M7 11H17V13H7V11M7 15H17V17H7V15Z" />
    </svg>
  )
}

export const DataSourcesIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="currentColor"
      {...props}
    >
      <path d="M9.1 19.7L8.8 19L9 18.6C7.1 18.1 6 17.3 6 17V14.8C7.3 15.4 8.8 15.8 10.6 16C11.3 15.2 12.2 14.5 13.1 14H12C9.6 14 7.3 13.4 6 12.5V9.6C7.5 10.4 9.6 11 12 11S16.5 10.5 18 9.6V12.4C17.7 12.6 17.4 12.8 17 13C18 13 19 13.2 20 13.6V7C20 4.8 16.4 3 12 3S4 4.8 4 7V17C4 18.8 6.4 20.3 9.7 20.8C9.5 20.5 9.3 20.1 9.1 19.7M12 5C15.9 5 18 6.5 18 7S15.9 9 12 9 6 7.5 6 7 8.1 5 12 5M17 18C17.6 18 18 18.4 18 19S17.6 20 17 20 16 19.6 16 19 16.4 18 17 18M17 15C14.3 15 11.9 16.7 11 19C11.9 21.3 14.3 23 17 23S22.1 21.3 23 19C22.1 16.7 19.7 15 17 15M17 21.5C15.6 21.5 14.5 20.4 14.5 19S15.6 16.5 17 16.5 19.5 17.6 19.5 19 18.4 21.5 17 21.5Z" />
    </svg>
  )
}

export const DataSourcesIconPlus = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="currentColor"
      {...props}
    >
      <path d="M20 13.09V7C20 4.79 16.42 3 12 3S4 4.79 4 7V17C4 19.21 7.59 21 12 21C12.46 21 12.9 21 13.33 20.94C13.12 20.33 13 19.68 13 19L13 18.95C12.68 19 12.35 19 12 19C8.13 19 6 17.5 6 17V14.77C7.61 15.55 9.72 16 12 16C12.65 16 13.27 15.96 13.88 15.89C14.93 14.16 16.83 13 19 13C19.34 13 19.67 13.04 20 13.09M18 12.45C16.7 13.4 14.42 14 12 14S7.3 13.4 6 12.45V9.64C7.47 10.47 9.61 11 12 11S16.53 10.47 18 9.64V12.45M12 9C8.13 9 6 7.5 6 7S8.13 5 12 5 18 6.5 18 7 15.87 9 12 9M23 18V20H20V23H18V20H15V18H18V15H20V18H23Z" />
    </svg>
  )
}

export const MapIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      role="presentation"
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="currentColor"
      {...props}
    >
      <path d="M20.5,3L20.34,3.03L15,5.1L9,3L3.36,4.9C3.15,4.97 3,5.15 3,5.38V20.5A0.5,0.5 0 0,0 3.5,21L3.66,20.97L9,18.9L15,21L20.64,19.1C20.85,19.03 21,18.85 21,18.62V3.5A0.5,0.5 0 0,0 20.5,3M10,5.47L14,6.87V18.53L10,17.13V5.47M5,6.46L8,5.45V17.15L5,18.31V6.46M19,17.54L16,18.55V6.86L19,5.7V17.54Z" />
    </svg>
  )
}
