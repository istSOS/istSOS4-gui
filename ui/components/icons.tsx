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
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      {...props}
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M7 7h10v10H7z" />
    </svg>
  )
}

export const MarkerIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const { width: w, height: h } = getSize(size, width, height)

  return (
    <svg
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      {...props}
    >
      <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
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
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      {...props}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5" />
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
      viewBox="0 0 24 24"
      width={w}
      height={h}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      {...props}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2M8.5 11h5" />
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
      width={w}
      height={h}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M15 3H5A2 2 0 0 0 3 5V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9L15 3M19 19H5V5H14V10H19M17 14H7V12H17M14 17H7V15H14" />
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
      width={w}
      height={h}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M12,2C15.31,2 18,4.66 18,7.95C18,12.41 12,19 12,19C12,19 6,12.41 6,7.95C6,4.66 8.69,2 12,2M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M20,19C20,21.21 16.42,23 12,23C7.58,23 4,21.21 4,19C4,17.71 5.22,16.56 7.11,15.83L7.75,16.74C6.67,17.19 6,17.81 6,18.5C6,19.88 8.69,21 12,21C15.31,21 18,19.88 18,18.5C18,17.81 17.33,17.19 16.25,16.74L16.89,15.83C18.78,16.56 20,17.71 20,19Z" />
    </svg>
  )
}
