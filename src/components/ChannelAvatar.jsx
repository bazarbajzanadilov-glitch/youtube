import { useState } from 'react'

export const DEFAULT_CHANNEL_AVATAR = '/studio-assets/trading-avatar.svg'

export default function ChannelAvatar({
  src,
  alt = '',
  className,
  style,
  ...props
}) {
  const requestedSrc = src || DEFAULT_CHANNEL_AVATAR
  const [failedSrc, setFailedSrc] = useState(null)
  const displayedSrc = failedSrc === requestedSrc
    ? DEFAULT_CHANNEL_AVATAR
    : requestedSrc

  return (
    <img
      {...props}
      className={className}
      src={displayedSrc}
      alt={alt}
      draggable="false"
      style={{ display: 'block', objectFit: 'cover', ...style }}
      onError={() => {
        if (displayedSrc !== DEFAULT_CHANNEL_AVATAR) setFailedSrc(requestedSrc)
      }}
    />
  )
}
