export const YTLogo = ({ className }) => (
  <img
    className={className}
    src="https://www.gstatic.com/youtube/img/creator/yt_studio_logo_v2_darkmode.svg"
    alt="YouTube Studio"
    height="24"
    style={{ display: 'block', height: 24, width: 'auto' }}
  />
)

export const Hamburger = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true"><path d="M20 5H4a1 1 0 000 2h16a1 1 0 100-2Zm0 6H4a1 1 0 000 2h16a1 1 0 000-2Zm0 6H4a1 1 0 000 2h16a1 1 0 000-2Z"/></svg>
)
export const SearchIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M11 2a9 9 0 105.641 16.01.966.966 0 00.152.197l3.5 3.5a1 1 0 101.414-1.414l-3.5-3.5a1 1 0 00-.197-.153A8.96 8.96 0 0020 11a9 9 0 00-9-9Zm0 2a7 7 0 110 14 7 7 0 010-14Z"/></svg>
)
export const HelpIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm.5 3h-.483a3.45 3.45 0 00-3.089 1.909l-.323.644a1 1 0 001.79.894l.322-.643a1.46 1.46 0 011.3-.804h.483a1.5 1.5 0 01.153 2.992l-.306.016A1.5 1.5 0 0011 12.5v1a1 1 0 002 0v-.535A3.5 3.5 0 0012.5 6Zm-.5 9.75a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5Z"/></svg>
)
export const SupportChatIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">
    <path d="M19 0a5 5 0 01-5 5 5 5 0 015 5 5 5 0 015-5 5 5 0 01-5-5Zm-6 4H5a2 2 0 00-2 2v10a2 2 0 002 2h4v2.6l4.23-2.348.452-.252H19a2 2 0 002-2v-6l2-2v8a4 4 0 01-4 4h-4.8l-5.105 2.836A1.41 1.41 0 017 21.604V20H5a4 4 0 01-4-4V6a4 4 0 014-4h10l-2 2Zm2 4H7a1 1 0 000 2h8a1 1 0 100-2Zm-2 4H7a1 1 0 000 2h6a1 1 0 000-2Z" />
  </svg>
)
export const SparkleIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M1 12c6.075 0 11 4.925 11 11 0-6.075 4.925-11 11-11-6.075 0-11-4.925-11-11 0 6.075-4.925 11-11 11Z"/></svg>
)
export const KpiDownCircleIcon = ({ size = 24, color = '#909090' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">
    <path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 5a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414L12 18.414l-4.707-4.707a1 1 0 111.414-1.414L11 14.586V7a1 1 0 011-1Z" fill={color} />
  </svg>
)
export const BellIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M16 19a4 4 0 11-8 0H4.765C3.21 19 2.25 17.304 3.05 15.97l1.806-3.01A1 1 0 005 12.446V8a7 7 0 0114 0v4.446c0 .181.05.36.142.515l1.807 3.01c.8 1.333-.161 3.029-1.716 3.029H16ZM12 3a5 5 0 00-5 5v4.446a3 3 0 01-.428 1.543L4.765 17h14.468l-1.805-3.01A3 3 0 0117 12.445V8a5 5 0 00-5-5Zm-2 16a2 2 0 104 0h-4Z"/></svg>
)
export const PlusBoxIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M14 4H4a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3v-1.536l3 1.732c1.333.77 3-.191 3-1.731V8.536c0-1.539-1.667-2.501-3-1.731l-3 1.731V7a3 3 0 00-3-3ZM4 6h10a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1Zm5 2a1 1 0 00-1 1v2H6a1 1 0 000 2h2v2a1 1 0 102 0v-2h2a1 1 0 000-2h-2V9a1 1 0 00-1-1Zm8 2.846 4-2.31v6.929l-4-2.309v-2.31Z"/></svg>
)
export const UploadIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.707 8.293 12 1.586 5.293 8.293a1 1 0 101.414 1.414L11 5.414V17a1 1 0 002 0V5.414l4.293 4.293a1 1 0 101.414-1.414ZM19 20H5a1 1 0 000 2h14a1 1 0 000-2Z"/></svg>
)
export const LiveIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M18.364 4.224a1 1 0 011.414 0 11 11 0 010 15.557 1 1 0 01-1.414-1.414 9 9 0 000-12.729 1 1 0 010-1.414ZM4.222 4.222a1 1 0 011.414 1.415 9 9 0 000 12.728 1 1 0 11-1.414 1.414 11.002 11.002 0 010-15.557Zm3.181 3.181a1.002 1.002 0 011.415 1.415 4.503 4.503 0 00-.975 4.904c.226.545.558 1.042.975 1.46a1.001 1.001 0 01-1.415 1.414 6.502 6.502 0 010-9.193Zm7.779 0c.39-.39 1.024-.39 1.415 0a6.5 6.5 0 010 9.193 1.001 1.001 0 01-1.415-1.415 4.5 4.5 0 000-6.363 1.001 1.001 0 010-1.415ZM12 10a2 2 0 110 4 2 2 0 010-4Z" clipRule="evenodd"/></svg>
)
export const EditIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="m17.232 2.354-9.546 9.547a3 3 0 00-.789 1.394l-.866 3.462-.404 1.617 1.616-.404 3.463-.865a3 3 0 001.394-.79l9.546-9.547a2.5 2.5 0 000-3.536l-.878-.878a2.5 2.5 0 00-3.536 0ZM14.758 2H4a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V9.242l-2 2V20H4V4h8.758l2-2Zm4.597 1.768.877.878a.5.5 0 010 .708l-.732.732L17.915 4.5l.733-.732a.5.5 0 01.707 0ZM9.1 13.315l7.4-7.4L18.086 7.5l-7.4 7.401c-.129.128-.29.22-.465.264l-1.846.46.462-1.846a1 1 0 01.263-.464Z"/></svg>
)
export const ChevronUp = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M16.59,15.42L12,10.83l-4.59,4.59L6,14l6-6l6,6L16.59,15.42z"/></svg>
)
export const ChevronDown = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.707 8.793a1 1 0 00-1.414 0L12 14.086 6.707 8.793a1 1 0 10-1.414 1.414L12 16.914l6.707-6.707a1 1 0 000-1.414Z"/></svg>
)
export const ChevronRight = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M9.4,18L8,16.6l4.6-4.6L8,7.4L9.4,6l6,6L9.4,18z"/></svg>
)
export const ChevronLeft = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M14.6,18L16,16.6L11.4,12L16,7.4L14.6,6l-6,6L14.6,18z"/></svg>
)
export const ChartIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M9,17H7V10h2V17z M13,17h-2V7h2V17z M17,17h-2v-4h2V17z M19.5,19.1H4.5V5h15V19.1z M21,3H3v18h18V3z"/></svg>
)
export const CommentIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M21,4H3v15.59l5.71-5.71h0.71H21V4z M19,12.59h-9.41l-0.59,0.58V12.59H5V6h14V12.59z"/></svg>
)
export const ThumbUpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">
    <path d="M9.221 1.795a1 1 0 011.109-.656l1.04.173a4 4 0 013.252 4.784L14 9h4.061a3.664 3.664 0 013.576 2.868A3.68 3.68 0 0121 14.85l.02.087A3.815 3.815 0 0120 18.5v.043l-.01.227a2.82 2.82 0 01-.135.663l-.106.282A3.754 3.754 0 0116.295 22h-3.606l-.392-.007a12.002 12.002 0 01-5.223-1.388l-.343-.189-.27-.154a2.005 2.005 0 00-.863-.26l-.13-.004H3.5a1.5 1.5 0 01-1.5-1.5V12.5A1.5 1.5 0 013.5 11h1.79l.157-.013a1 1 0 00.724-.512l.063-.145 2.987-8.535Zm-1.1 9.196A3 3 0 015.29 13H4v4.998h1.468a4 4 0 011.986.528l.27.155.285.157A10 10 0 0012.69 20h3.606c.754 0 1.424-.483 1.663-1.2l.03-.126a.819.819 0 00.012-.131v-.872l.587-.586c.388-.388.577-.927.523-1.465l-.038-.23-.02-.087-.21-.9.55-.744A1.663 1.663 0 0018.061 11H14a2.002 2.002 0 01-1.956-2.418l.623-2.904a2 2 0 00-1.626-2.392l-.21-.035-2.71 7.741Z" />
  </svg>
)
export const ThumbDownIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">
    <path d="m11.31 2 .392.007c1.824.06 3.61.534 5.223 1.388l.343.189.27.154c.264.152.56.24.863.26l.13.004H20.5a1.5 1.5 0 011.5 1.5V11.5a1.5 1.5 0 01-1.5 1.5h-1.79l-.158.013a1 1 0 00-.723.512l-.064.145-2.987 8.535a1 1 0 01-1.109.656l-1.04-.174a4 4 0 01-3.251-4.783L10 15H5.938a3.664 3.664 0 01-3.576-2.868A3.682 3.682 0 013 9.15l-.02-.088A3.816 3.816 0 014 5.5v-.043l.008-.227a2.86 2.86 0 01.136-.664l.107-.28A3.754 3.754 0 017.705 2h3.605ZM7.705 4c-.755 0-1.425.483-1.663 1.2l-.032.126a.818.818 0 00-.01.131v.872l-.587.586a1.816 1.816 0 00-.524 1.465l.038.23.02.087.21.9-.55.744a1.686 1.686 0 00-.321 1.18l.029.177c.17.76.844 1.302 1.623 1.302H10a2.002 2.002 0 011.956 2.419l-.623 2.904-.034.208a2.002 2.002 0 001.454 2.139l.206.045.21.035 2.708-7.741A3.001 3.001 0 0118.71 11H20V6.002h-1.47c-.696 0-1.38-.183-1.985-.528l-.27-.155-.285-.157A10.002 10.002 0 0011.31 4H7.705Z" />
  </svg>
)
export const HeartIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M16.25 2.5A6.56 6.56 0 0012 4.062 6.56 6.56 0 007.75 2.5C3.927 2.5 1 5.732 1 9.5c0 4.436 2.807 7.696 5.225 9.698a23.597 23.597 0 004.837 3.072l.095.044.029.013.01.004.005.003c.269-.61.535-1.222.799-1.834.797 1.834.799 1.834.799 1.834l.001-.001.003-.002.01-.004.03-.013.095-.044c.08-.037.19-.089.33-.157a23.6 23.6 0 004.507-2.915C20.193 17.196 23 13.936 23 9.5c0-3.768-2.927-7-6.75-7Zm0 2c2.623 0 4.75 2.239 4.75 5 0 7.089-9 11-9 11s-9-3.911-9-11c0-2.761 2.127-5 4.75-5a4.58 4.58 0 012.922 1.058A5 5 0 0112 7.265a5 5 0 011.328-1.707A4.58 4.58 0 0116.25 4.5Zm-3.453 17.834L12 20.5l-.797 1.834.797.347.797-.347Z"/></svg>
)
export const KebabIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"/></svg>
)
export const CheckCircle = ({ size = 16, color = '#2ba640' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm4.293 5.293L10 14.586l-2.293-2.293a1 1 0 10-1.414 1.414L10 17.414l7.707-7.707a1 1 0 10-1.414-1.414Z"/></svg>
)
export const ArrowUpIcon = ({ size = 16, color = '#2ba640' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12,4l-8,8h5v8h6v-8h5L12,4z"/></svg>
)
export const KpiArrowUpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 21 21" fill="none" aria-hidden="true">
    <rect width="21" height="21" rx="10.5" fill="#2BA640" />
    <path d="M10.5 5V17.5M15 9.5L10.5 5L6 9.5" stroke="#1F1F1F" strokeWidth="2" />
  </svg>
)
export const InfoIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M11,17h2v-6h-2V17z M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8 s3.59-8,8-8s8,3.59,8,8S16.41,20,12,20z M11,9h2V7h-2V9z"/></svg>
)
export const LockIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="currentColor"><path d="M9 .75A3.75 3.75 0 005.25 4.5v2.25h-1.5a1.5 1.5 0 00-1.5 1.5v7.5l.008.153a1.5 1.5 0 001.339 1.34l.153.007h10.5l.153-.008a1.5 1.5 0 001.347-1.492v-7.5a1.5 1.5 0 00-1.5-1.5h-1.5V4.5A3.75 3.75 0 009 .75Zm0 1.5a2.25 2.25 0 012.25 2.25v2.25h-4.5V4.5A2.25 2.25 0 019 2.25Zm-5.25 13.5v-7.5h10.5v7.5H3.75Zm5.25-6a1.5 1.5 0 00-.75 2.798v1.327c0 .207.168.375.375.375h.75a.375.375 0 00.375-.375v-1.327A1.498 1.498 0 009 9.75Z"/></svg>
)
export const CopyIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M16,1H4C2.9,1,2,1.9,2,3v14h2V3h12V1z M19,5H8C6.9,5,6,5.9,6,7v14c0,1.1,0.9,2,2,2h11c1.1,0,2-0.9,2-2V7C21,5.9,20.1,5,19,5z M19,21H8V7h11V21z"/></svg>
)
export const FilterIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3,4h18v2H3V4z M6,11h12v2H6V11z M10,18h4v2h-4V18z"/></svg>
)
export const PlusIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a1 1 0 00-1 1v7H4a1 1 0 000 2h7v7a1 1 0 002 0v-7h7a1 1 0 000-2h-7V4a1 1 0 00-1-1Z"/></svg>
)
export const PlayIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a11 11 0 00-7.778 18.778A11.002 11.002 0 0022.163 7.79 11 11 0 0012 1Zm0 2a9 9 0 016.364 2.636A9 9 0 015.636 18.364 9.001 9.001 0 0112 3Zm5 9L9 7.2v9.6l8-4.8Z"/></svg>
)
export const StarIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="m7.98 7.465 2.89-4.65a1.33 1.33 0 012.26 0l2.89 4.65 5.316 1.314a1.33 1.33 0 01.698 2.148l-3.529 4.187.394 5.46a1.33 1.33 0 01-1.827 1.328L12 19.84l-5.072 2.061a1.33 1.33 0 01-1.827-1.328l.394-5.46-3.529-4.187a1.33 1.33 0 01.698-2.148L7.98 7.465Zm6.771 1.747-.429-.69L12 4.785 9.678 8.521l-.43.69-.789.196-4.27 1.054 2.835 3.362.524.622-.058.811-.317 4.386 4.074-1.656.753-.306.753.306 4.074 1.656-.317-4.386-.058-.81.524-.623 2.834-3.362-4.269-1.054-.79-.195Z"/></svg>
)
export const DragHandle = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M3,8h18V6H3V8z M3,13h18v-2H3V13z M3,18h18v-2H3V18z"/></svg>
)
export const PageFirst = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.41,16.59L13.82,12l4.59-4.59L17,6l-6,6l6,6L18.41,16.59z M6,6h2v12H6V6z"/></svg>
)
export const PageLast = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M5.59,7.41L10.18,12l-4.59,4.59L7,18l6-6l-6-6L5.59,7.41z M16,6h2v12h-2V6z"/></svg>
)

/* Sidebar icons */
export const SideHome = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M9 2H4a2 2 0 00-2 2v7a2 2 0 002 2h5a2 2 0 002-2V4a2 2 0 00-2-2Zm11 0h-5a2 2 0 00-2 2v3a2 2 0 002 2h5a2 2 0 002-2V4a2 2 0 00-2-2Zm0 9h-5a2 2 0 00-2 2v7a2 2 0 002 2h5a2 2 0 002-2v-7a2 2 0 00-2-2ZM9 15H4a2 2 0 00-2 2v3a2 2 0 002 2h5a2 2 0 002-2v-3a2 2 0 00-2-2Z"/></svg>
)
export const SideContent = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2ZM8 16V4h12v12H8Zm-4 4V6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2H4Zm13-10-5-3v6l5-3Z"/></svg>
)
export const SideAnalytics = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V4a2 2 0 00-2-2ZM4 20V4h16v16H4Zm8-13a1 1 0 00-1 1v9h2V8a1 1 0 00-1-1Zm-4 3a1 1 0 00-1 1v6h2v-6a1 1 0 00-1-1Zm8 2a1 1 0 00-1 1v4h2v-4a1 1 0 00-1-1Z"/></svg>
)
export const SideCommunity = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18 3a4 4 0 00-3.25 1.668 6 6 0 011.6 1.202A2 2 0 1118 9l-.084-.002c.112.662.112 1.339.001 2.001A4 4 0 1018 3ZM6 3.001a4 4 0 10.083 8 6 6 0 010-2.001 2 2 0 111.566-3.13A6 6 0 019.25 4.668 4 4 0 006 3.001Zm6 3a4 4 0 100 8 4 4 0 000-8Zm0 2a2 2 0 110 4 2 2 0 010-4Zm-5.656 4.01A6 6 0 000 18a1 1 0 102 0 3.998 3.998 0 015.53-3.694l.057.024.155-.1a6 6 0 01-1.398-2.219ZM18 12c-.115 0-.23.003-.345.01a5.999 5.999 0 01-1.398 2.22l.155.1A3.998 3.998 0 0122 18a1 1 0 002 0 6 6 0 00-6-6Zm-6 3.001a6 6 0 00-6 6 1 1 0 102 0 4 4 0 018 .001 1 1 0 002 0 6 6 0 00-6-6.001Z"/></svg>
)
export const SideSubtitles = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2ZM3 19V5h18v14H3Zm5-8H6a1 1 0 000 2h2a1 1 0 000-2Zm10 0h-6a1 1 0 000 2h6a1 1 0 000-2Zm0 4h-2a1 1 0 000 2h2a1 1 0 000-2Zm-6 0H6a1 1 0 000 2h6a1 1 0 000-2Z"/></svg>
)
export const SideCopyright = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M15.25 8.95A4.5 4.5 0 1015.25 15.05" />
  </svg>
)
export const SideMonetize = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm0 2a1 1 0 00-1 1v1.104a3.5 3.5 0 00-1.435.656C8.886 8.3 8.5 9.09 8.5 10c0 .525.13 1.005.402 1.417.251.368.591.667.989.869.638.339 1.437.495 2.058.615l.109.022c.728.143 1.242.259 1.588.456.107.053.2.133.268.232.039.063.086.174.086.389 0 .2-.267 1-2 1-1.033 0-1.547-.303-1.788-.509a1.199 1.199 0 01-.274-.337 1 1 0 00-1.886.662L9 14.5l-.948.317.001.002.008.024c.055.143.123.281.203.413.175.283.394.537.648.753.478.41 1.156.765 2.088.915V18a1 1 0 002 0v-1.082c1.757-.299 3-1.394 3-2.918 0-.534-.125-1.022-.387-1.444a2.7 2.7 0 00-.978-.915c-.671-.383-1.512-.548-2.153-.673l-.04-.008c-.74-.145-1.258-.251-1.614-.439a.699.699 0 01-.258-.206c-.029-.045-.07-.13-.07-.315 0-.308.114-.518.31-.674C11.027 9.153 11.414 9 12 9c.463.006.917.133 1.316.368.167.095.323.206.468.331l.005.004.01.01a1 1 0 001.408-1.42L14.5 9l.706-.708-.011-.011-.017-.016-.054-.05A5 5 0 0013 7.115V6a1 1 0 00-1-1Z"/></svg>
)
export const SideMagic = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="m18.266 1.107-.878 2.283-2.282.878a.25.25 0 000 .466l2.282.878.878 2.283a.25.25 0 00.467 0l.878-2.283 2.282-.878a.25.25 0 000-.466l-2.282-.878-.878-2.283a.25.25 0 00-.467 0Zm-11 0L6.388 3.39l-2.282.878a.25.25 0 000 .466l2.282.878.878 2.283a.25.25 0 00.467 0l.878-2.283 2.282-.878a.25.25 0 000-.466L8.611 3.39l-.878-2.283a.25.25 0 00-.467 0ZM11.9 7.864l-8.486 8.484a2 2 0 000 2.83l1.412 1.411a2 2 0 002.828 0l8.485-8.485a2 2 0 000-2.829l-1.41-1.411a2 2 0 00-2.829 0Zm-7.072 9.9 6.715-6.715 1.411 1.411-6.714 6.714-1.412-1.41Zm14.438-4.657-.878 2.283-2.282.878a.25.25 0 000 .466l2.282.878.878 2.283a.25.25 0 00.467 0l.878-2.283 2.282-.878a.25.25 0 000-.466l-2.282-.878-.878-2.283a.25.25 0 00-.467 0Z"/></svg>
)
export const SideAudio = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2ZM8 16V4h12v12H8Zm6-10.513v3.687a3 3 0 101.996 2.98L16 12V8.3l1.621.973A.25.25 0 0018 9.059V7.302a.5.5 0 00-.241-.428l-3-1.814a.5.5 0 00-.759.427ZM4 20V6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2H4Zm9-9a1 1 0 110 2 1 1 0 010-2Z"/></svg>
)
export const SideAdmin = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 8c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm-6 4c.22-.72 3.31-2 6-2 2.7 0 5.8 1.29 6 2H6z"/></svg>
)
export const SideSettings = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12.844 1h-1.687a2 2 0 00-1.962 1.616 3 3 0 01-3.92 2.263 2 2 0 00-2.38.891l-.842 1.46a2 2 0 00.417 2.507 3 3 0 010 4.525 2 2 0 00-.417 2.507l.843 1.46a2 2 0 002.38.892 3.001 3.001 0 013.918 2.263A2 2 0 0011.157 23h1.686a2 2 0 001.963-1.615 3.002 3.002 0 013.92-2.263 2 2 0 002.38-.892l.842-1.46a2 2 0 00-.418-2.507 3 3 0 010-4.526 2 2 0 00.418-2.508l-.843-1.46a2 2 0 00-2.38-.891 3 3 0 01-3.919-2.263A2 2 0 0012.844 1Zm-1.767 2.347a6 6 0 00.08-.347h1.687a4.98 4.98 0 002.407 3.37 4.98 4.98 0 004.122.4l.843 1.46A4.98 4.98 0 0018.5 12a4.98 4.98 0 001.716 3.77l-.843 1.46a4.98 4.98 0 00-4.123.4A4.979 4.979 0 0012.843 21h-1.686a4.98 4.98 0 00-2.408-3.371 4.999 4.999 0 00-4.12-.399l-.844-1.46A4.979 4.979 0 005.5 12a4.98 4.98 0 00-1.715-3.77l.842-1.459a4.98 4.98 0 004.123-.399 4.981 4.981 0 002.327-3.025ZM16 12a4 4 0 11-7.999 0 4 4 0 018 0Zm-4 2a2 2 0 100-4 2 2 0 000 4Z"/></svg>
)
export const SideFeedback = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M19 2H5a4 4 0 00-4 4v10a4 4 0 004 4h2v1.604a1.41 1.41 0 002.095 1.232L14.2 20H19a4 4 0 004-4V6a4 4 0 00-4-4ZM5 4h14a2 2 0 012 2v10a2 2 0 01-2 2h-5.318l-.453.252L9 20.6V18H5a2 2 0 01-2-2V6a2 2 0 012-2Zm7 2a1 1 0 00-1 1v4.5a1 1 0 002 0V7a1 1 0 00-1-1Zm0 7.75a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5Z"/></svg>
)
export const CakeIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#F4B400"><path d="M12,6c1.11,0,2-0.9,2-2c0-0.38-0.1-0.73-0.29-1.03L12,0l-1.71,2.97C10.1,3.27,10,3.62,10,4C10,5.1,10.9,6,12,6z M18,9h-5V7h-2v2H6c-1.66,0-3,1.34-3,3v9h18v-9C21,10.34,19.66,9,18,9z M19,19H5v-3.46c0.59,0.35,1.31,0.46,2,0.46 c1.06,0,2.03-0.41,2.75-1.09c1.55,1.41,3.94,1.41,5.5,0c1.55,1.41,3.94,1.41,5.5,0c0.71,0.69,1.69,1.09,2.75,1.09v3z M19,15 c-0.97,0-1.71-0.74-1.71-1.71c0-0.93,0.41-1.79,1.13-2.37l0.58-0.46l0.58,0.46c0.71,0.58,1.13,1.44,1.13,2.37 C20.71,14.26,19.97,15,19,15z"/></svg>
)

/* Common Avatar */
export const AvatarCircle = ({ size = 32, color = '#000000' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill={color}/></svg>
)

export const TradingThumb = ({ width = '100%', height }) => (
  <img src="/studio-assets/trading-thumb-1.svg" alt="" width={width} height={height} style={{ width, height, display: 'block', objectFit: 'cover' }} />
)
