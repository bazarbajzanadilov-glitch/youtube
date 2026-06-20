import sx from './MonetizationExtras.module.css'
import Card from '../../components/ui/Card.jsx'

const revenueSources = [
  { title: 'Реклама на странице просмотра', tone: 'orange', icon: 'ad' },
  { title: 'Реклама в ленте Shorts', tone: 'yellow', icon: 'sh' },
  { title: 'Спонсорство', tone: 'green', icon: 'sp' },
  { title: 'Подарки', tone: 'teal', icon: 'gi' },
  { title: 'Supers', tone: 'purple', icon: 'su' },
]

const creatorTools = [
  'Скачать медиакит',
  'Служба поддержки авторов YouTube',
  'Инструмент поиска совпадений',
  'Конечные заставки видео',
]

const resourceGroups = [
  {
    title: 'Поддержка',
    links: ['Справочный центр', 'Форумы сообщества'],
  },
  {
    title: 'Всё о программе',
    links: ['Канал YouTube Creators'],
  },
  {
    title: 'Важная информация',
    links: [
      'Правила монетизации',
      'Правила в отношении контента, подходящего для монетизации',
      'Другие способы монетизации',
    ],
  },
]

export default function MonetizationOverviewTab({ activeSection = 'Обзор', onOpenAdmin }) {
  return (
    <div className={sx.partnerPage} data-active-section={activeSection}>
      <main className={sx.partnerMain}>
        <section className={sx.partnerIntro}>
          <h2>Вы - партнер YouTube</h2>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ваши источники дохода</h3>
          <Card padding="none" depth="md" className={sx.sourceCard}>
            {revenueSources.map((source) => (
              <div className={sx.sourceRow} key={source.title}>
                <span className={`${sx.sourceIcon} ${sx[source.tone]}`}>{source.icon}</span>
                <span>{source.title}</span>
              </div>
            ))}
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Больше способов заработка</h3>
          <Card padding="none" depth="md" className={sx.accordionCard}>
            <div className={sx.expandPanel}>
              <div className={sx.panelCopy}>
                <div className={sx.panelTop}>
                  <h4>Покупки</h4>
                  <span aria-hidden="true">⌃</span>
                </div>
                <strong>Зрители могут стать покупателями</strong>
                <p>
                  Продвигайте на канале товары из своего магазина или других брендов в рамках партнерской программы YouTube Покупок.
                </p>
                <button type="button" className={sx.whiteButton}>Включить рекламу</button>
              </div>
              <div className={sx.shoppingArt} aria-hidden="true">
                <span />
              </div>
            </div>
            <button type="button" className={sx.foldRow}>
              <span>Коллаборации</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <Card padding="none" depth="md" className={sx.infoCard}>
            <div className={sx.infoPanel}>
              <div className={sx.panelCopy}>
                <div className={sx.panelTop}>
                  <h3>Основное о монетизации</h3>
                </div>
                <h4>Сведения о доходе</h4>
                <p>
                  Посмотреть расчетный доход можно в YouTube Аналитике, а итоговую сумму к оплате за месяц - в AdSense.
                </p>
                <div className={sx.buttonRow}>
                  <button type="button" className={sx.whiteButton}>Подробнее</button>
                  <button type="button" className={sx.darkButton}>Скрыть</button>
                </div>
              </div>
              <div className={sx.analyticsArt} aria-hidden="true">
                <span />
              </div>
            </div>
            <button type="button" className={sx.foldRow}>
              <span>Помощь</span>
              <span aria-hidden="true">⌄</span>
            </button>
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ресурсы и инструменты для авторов</h3>
          <Card padding="lg" depth="md" className={sx.toolsCard}>
            {creatorTools.map((item) => (
              <button type="button" className={sx.toolLink} key={item}>
                <span className={sx.toolIcon} aria-hidden="true" />
                <span>{item}</span>
              </button>
            ))}
          </Card>
        </section>

        <section className={sx.partnerSection}>
          <h3>Ресурсы</h3>
          <Card padding="lg" depth="md" className={sx.resourcesCard}>
            {resourceGroups.map((group) => (
              <div className={sx.resourceGroup} key={group.title}>
                <h4>{group.title}</h4>
                {group.links.map((link) => (
                  <button type="button" key={link}>{link}</button>
                ))}
              </div>
            ))}
          </Card>
        </section>
      </main>

      <aside className={sx.partnerSide}>
        <Card padding="lg" depth="md" className={sx.sidePanel}>
          <h3>Настройка платежей</h3>
          <span className={sx.statusPill}>Выполняется</span>
          <div className={sx.sideBlock}>
            <h4>Что нужно сделать</h4>
            <strong>Пока действий от вас не требуется</strong>
            <p>
              Персональные данные подтверждены. Когда вы перейдете порог оплаты, мы сообщим о дальнейших действиях.
            </p>
          </div>
          <div className={sx.sideBlock}>
            <h4>Что дальше</h4>
            <p>Мы сообщим вам, когда нужно будет выбрать способ оплаты и завершить настройку.</p>
            <button type="button" className={sx.textLink}>Подробнее...</button>
          </div>
        </Card>

        <Card padding="lg" depth="md" className={sx.sidePanel}>
          <h3>Партнерская программа YouTube</h3>
          <div className={sx.sideBlock}>
            <h4>AdSense для YouTube</h4>
            <p>Идентификатор: pub-8534663269125491</p>
            <p>Связь установлена 3 мая 2026 г. в 03:17</p>
            <button type="button" className={sx.darkButton} onClick={onOpenAdmin}>Изменить</button>
          </div>
          <div className={sx.sideBlock}>
            <h4>Соглашения</h4>
            <p>
              Чтобы посмотреть принятые соглашения, в том числе условия Партнерской программы YouTube, нажмите кнопку ниже.
            </p>
            <button type="button" className={sx.darkButton}>Посмотреть соглашения</button>
          </div>
          <div className={sx.sideBlock}>
            <h4>Отказ от участия в Партнерской программе YouTube</h4>
            <p>В случае отказа вы лишитесь доступа к преимуществам программы. <button type="button" className={sx.inlineLink}>Подробнее</button></p>
            <button type="button" className={sx.darkButton}>Отказаться</button>
          </div>
        </Card>
      </aside>
    </div>
  )
}
