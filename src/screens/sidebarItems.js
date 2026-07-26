import {
  MdAnalytics,
  MdAutoFixHigh,
  MdCopyright,
  MdDashboard,
  MdGroups,
  MdLibraryMusic,
  MdMonetizationOn,
  MdOutlineDashboard,
  MdOutlineFeedback,
  MdSettings,
  MdSubtitles,
  MdVideoLibrary,
} from 'react-icons/md'
import {
  SideAnalytics,
  SideAudio,
  SideCommunity,
  SideContent,
  SideCopyright,
  SideMagic,
  SideMonetize,
  SideSettings,
  SideSubtitles,
} from './icons.jsx'

export const SIDEBAR_ITEMS = [
  { key: 'home', label: 'Главная', Icon: MdOutlineDashboard, ActiveIcon: MdDashboard },
  { key: 'content', label: 'Контент', Icon: SideContent, ActiveIcon: MdVideoLibrary },
  { key: 'analytics', label: 'Аналитика', Icon: SideAnalytics, ActiveIcon: MdAnalytics },
  { key: 'community', label: 'Сообщество', Icon: SideCommunity, ActiveIcon: MdGroups },
  { key: 'subtitles', label: 'Субтитры', Icon: SideSubtitles, ActiveIcon: MdSubtitles },
  {
    key: 'copyright',
    label: 'Обнаружение контента',
    expandedLabel: 'Обнаружение контен...',
    Icon: SideCopyright,
    ActiveIcon: MdCopyright,
  },
  {
    key: 'monetize',
    label: 'Монетизация',
    Icon: SideMonetize,
    ActiveIcon: MdMonetizationOn,
  },
  {
    key: 'channel',
    label: 'Настройка канала',
    Icon: SideMagic,
    ActiveIcon: MdAutoFixHigh,
  },
  {
    key: 'audio',
    label: 'Creator Music (beta)',
    Icon: SideAudio,
    ActiveIcon: MdLibraryMusic,
  },
  { key: 'settings', label: 'Настройки', Icon: SideSettings, ActiveIcon: MdSettings },
]

export const SidebarFeedbackIcon = MdOutlineFeedback
