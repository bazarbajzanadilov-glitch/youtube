import { useContext } from 'react'
import { NavContext } from './NavContext.js'
import SidebarCompact from './SidebarCompact.jsx'
import SidebarExpanded from './SidebarExpanded.jsx'

/**
 * Универсальный sidebar. Compact / expanded управляется через
 * NavContext.sidebarExpanded — гамбургер в TopBar переключает.
 */
export default function Sidebar({ active }) {
  const { sidebarExpanded } = useContext(NavContext)
  return sidebarExpanded ? <SidebarExpanded active={active}/> : <SidebarCompact active={active}/>
}
