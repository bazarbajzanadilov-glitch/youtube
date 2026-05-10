import { useContext } from 'react'
import s from './Screen6Copyright.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'

const Microscope = () => (
  <svg width="240" height="220" viewBox="0 0 240 220" aria-hidden="true">
    <rect x="80" y="160" width="120" height="36" rx="3" fill="#0FA8C7" stroke="#0A6379" strokeWidth="2"/>
    <rect x="120" y="120" width="40" height="48" fill="#0FA8C7" stroke="#0A6379" strokeWidth="2"/>
    <rect x="115" y="115" width="50" height="10" fill="#0A6379"/>
    <rect x="125" y="100" width="30" height="20" fill="#FFFFFF" stroke="#0A6379" strokeWidth="2"/>
    <path d="M 70 100 Q 50 70 80 50 L 100 50 L 100 70 L 80 70 Q 70 80 80 100 Z" fill="#0FA8C7" stroke="#0A6379" strokeWidth="2"/>
    <ellipse cx="60" cy="110" rx="20" ry="14" fill="#0FA8C7" stroke="#0A6379" strokeWidth="2"/>
    <path d="M 50 110 L 30 130 L 30 150 L 50 130 Z" fill="#0FA8C7" stroke="#0A6379" strokeWidth="2"/>
    <rect x="100" y="40" width="50" height="30" fill="#FFFFFF" stroke="#0A6379" strokeWidth="2"/>
    <rect x="105" y="20" width="14" height="22" fill="#0FA8C7" stroke="#0A6379" strokeWidth="2"/>
    <rect x="135" y="20" width="14" height="22" fill="#0FA8C7" stroke="#0A6379" strokeWidth="2"/>
  </svg>
)

export default function Screen6Copyright() {
  const { showToast } = useContext(NavContext)
  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="copyright"/>
      <div className={s.main}>
        <h1 className={s.title}>Обнаружение контента</h1>
        <div className={s.tabs}><div className={`${s.tab} ${s.tabActive}`}>Авторские права</div></div>
        <div className={s.barRow}>
          <button type="button" className={s.requestPill} onClick={() => showToast('Запросы на удаление')}>Запросы на удаление</button>
          <button type="button" className={s.removePill} onClick={() => showToast('Запросить удаление')}>Запросить удаление</button>
        </div>
        <div className={s.empty}>
          <div className={s.illustration}><Microscope/></div>
          <div className={s.emptyTitle}>Здесь пока пусто</div>
          <div className={s.emptyText}>
            Вы не отправляли <button type="button" className={s.textLink}>запросы на удаление видео в связи с нарушением авторских прав</button>.<br/>
            Хотите проверить, не нарушает ли кто-то авторские права в <em>ваших</em> видео? Перейдите в <button type="button" className={s.textLink}>совпадения</button>.
          </div>
        </div>
      </div>
    </div>
  )
}
