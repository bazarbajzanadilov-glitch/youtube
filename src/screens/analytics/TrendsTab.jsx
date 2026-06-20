import Card from '../../components/ui/Card.jsx'
import { HeartIcon, SearchIcon } from '../icons.jsx'
import s from './AnalyticsTabs.module.css'

function buildIdeas(data) {
  const topVideos = data?.overview?.topVideos || []
  const topTraffic = data?.content?.traffic?.[0]?.label || 'Поиск на YouTube'
  const topGeo = data?.audience?.geography?.[0]?.label || 'основной аудитории канала'
  const leadVideo = topVideos[0]?.title || 'лучшего ролика канала'
  const secondaryVideo = topVideos[1]?.title || leadVideo

  return [
    {
      title: `Сделайте продолжение темы «${leadVideo}»`,
      meta: `${topTraffic} · Высокий интерес`,
    },
    {
      title: `Подготовьте Shorts-версию ролика «${secondaryVideo}»`,
      meta: 'Shorts · Средний интерес',
    },
    {
      title: `Запишите отдельное видео для зрителей из ${topGeo}`,
      meta: 'Аудитория · Растущий интерес',
    },
  ]
}

export default function TrendsTab({ data }) {
  const ideas = buildIdeas(data)

  return (
    <div className={s.trendsPage}>
      <div className={s.trendsHeader}>
        <h1>Идеи для новых видео</h1>
        <button type="button" className={s.savedButton}>
          <HeartIcon size={18} />
          Сохранено (0)
        </button>
      </div>

      <label className={s.trendsSearch}>
        <SearchIcon size={22} />
        <input type="search" placeholder="Поиск тем и запросов" />
      </label>

      <section className={s.ideaSection}>
        <h2>Рекомендации для канала</h2>
        <div className={s.ideaGrid}>
          {ideas.map((idea) => (
            <Card key={idea.title} padding="lg" depth="md" className={s.ideaCard}>
              <div>
                <div className={s.ideaTitle}>{idea.title}</div>
                <div className={s.ideaMeta}>{idea.meta}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
