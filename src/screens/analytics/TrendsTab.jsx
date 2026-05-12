import { useState } from 'react'
import s from './AnalyticsTabs.module.css'
import Card from '../../components/ui/Card.jsx'
import { HeartIcon, SparkleIcon, SearchIcon } from '../icons.jsx'
import { formatCompactNumber } from '../../lib/analyticsFormat.js'

const SEARCH_IDEAS = [
  'обзор iphone 17 pro', 'самые быстрые электрокары 2026', 'asmr погода рассвет', 'jujutsu kaisen final',
  'how to learn react in 2026', 'medical residency interview tips', 'sadness and sorrow piano',
  'unboxing pixel watch 4', 'speedrun any% world record', 'квартирный ремонт за 100к',
  'tutorial vibes coding', 'fastest backend in rust', 'обзор mac studio m5',
]

const INSPIRATION = [
  { title: 'Как я снимаю короткие фильмы на iPhone 17 Pro', author: 'Tech Studio', views: 2_400_000, age: '3 нед. назад', dur: '12:46' },
  { title: 'Полный гайд по медицинской ординатуре', author: 'Sarmik Med', views: 184_000, age: '1 мес. назад', dur: '24:13' },
  { title: 'Я сделал свой ИИ-помощник за 30 минут', author: 'Vibe Coding', views: 92_000, age: '2 нед. назад', dur: '7:08' },
  { title: 'Самые быстрые электрокары 2026', author: 'Driveway Lab', views: 1_080_000, age: '1 нед. назад', dur: '18:32' },
  { title: 'Тест iPhone 17 Pro vs Pixel Pro в темноте', author: 'NightShoot', views: 540_000, age: '5 дн. назад', dur: '11:55' },
  { title: 'Как Sarmik Med изменил подготовку к экзаменам', author: 'EdTech Daily', views: 76_000, age: '4 дн. назад', dur: '9:41' },
  { title: 'Обзор Mac Studio M5 для дизайнеров', author: 'Designer Hub', views: 312_000, age: '6 дн. назад', dur: '15:24' },
  { title: 'Speedrun Hollow Knight Any% — Новый рекорд', author: 'Speed Squad', views: 1_900_000, age: '2 дн. назад', dur: '52:11' },
]

export default function TrendsTab() {
  const [saved, setSaved] = useState(() => new Set())
  function toggle(name) {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className={s.layoutSingle}>
      <div className={s.searchBar}>
        <SearchIcon size={18}/>
        <input className={s.searchInput} placeholder="Поиск идей для новых видео" />
        <span className={s.savedChip}>
          <HeartIcon size={14}/> Сохранено ({saved.size})
        </span>
      </div>

      <Card padding="lg" depth="md">
        <div className={s.cardTitle}>Что ищут зрители</div>
        <div className={s.cardSub}>Поисковые запросы вашей ниши за неделю</div>
        <div className={s.ideasGrid}>
          {SEARCH_IDEAS.map((q) => {
            const isSaved = saved.has(q)
            return (
              <div key={q} className={`${s.ideaCard} ${isSaved ? s.ideaSaved : ''}`}>
                <div className={s.ideaIcon}><SparkleIcon size={16}/></div>
                <span className={s.ideaText}>{q}</span>
                <button
                  type="button"
                  className={s.ideaSave}
                  onClick={() => toggle(q)}
                  aria-label={isSaved ? 'Убрать из сохранённого' : 'Сохранить'}
                >
                  <HeartIcon size={16}/>
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      <Card padding="lg" depth="md">
        <div className={s.cardTitle}>Новые видео для вдохновения</div>
        <div className={s.cardSub}>Похожие на ваш контент, набирают обороты</div>
        <div className={s.inspGrid}>
          {INSPIRATION.map((v) => (
            <div key={v.title} className={s.inspCard}>
              <div className={s.inspThumb}>
                <span className={s.inspDur}>{v.dur}</span>
              </div>
              <div className={s.inspMeta}>
                <div className={s.inspTitle}>{v.title}</div>
                <div className={s.inspSub}>
                  {v.author} · {formatCompactNumber(v.views)} · {v.age}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
